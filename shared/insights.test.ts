import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { analytics, applyEvent, deriveTasks, initialState, tasksFor, type EngineState } from './engine.ts'
import type { IncomingEvent } from './events.ts'
import { predictReady, upcomingFor } from './predict.ts'
import { safetyIssues } from './safety.ts'
import { istClock, istServiceStart } from './time.ts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 7, 13, 30)
const config = structuredClone(DEMO_CONFIG)

function run(events: [number, IncomingEvent][], s: EngineState = initialState(config)): EngineState {
  events.forEach(([min, e], i) => applyEvent(s, { id: `x${s.eventCount}${i}`, source: 'sim', at: T0 + min * MIN, ...e } as never, config))
  return s
}
const seat = (tableId: string, extra = {}): IncomingEvent => ({ type: 'table.seated', payload: { tableId, partySize: 2, ...extra } })
const fire = (tableId: string, ticketId: string, ids: [string, string][]): IncomingEvent => ({
  type: 'order.fired',
  payload: { tableId, ticketId, lines: ids.map(([id, menuItemId]) => ({ id, menuItemId, qty: 1 })) },
})

describe('IST', () => {
  it('starts service at 7pm IST and shows IST whatever the machine timezone', () => {
    const start = istServiceStart(T0)
    expect(new Date(start).toISOString()).toBe('2026-10-07T13:30:00.000Z')
    expect(istClock(start)).toMatch(/^7:00\s?pm$/i)
  })
})

describe('safety check', () => {
  it('flags dishes that clash with an allergy or a diet, from ingredient tags', () => {
    const burrata = config.menu.find((m) => m.id === 'm_burrata')
    expect(safetyIssues(burrata, { size: 2, allergies: [], needs: ['vegan'] })).toEqual([{ tag: 'dairy', because: 'vegan' }])
    expect(safetyIssues(burrata, { size: 2, allergies: ['dairy'] })).toEqual([{ tag: 'dairy', because: 'allergy' }])
    expect(safetyIssues(config.menu.find((m) => m.id === 'm_tikka'), { size: 2, allergies: [], needs: ['jain'] })).toEqual([{ tag: 'root', because: 'jain' }])
    expect(safetyIssues(config.menu.find((m) => m.id === 'm_kulfi'), { size: 2, allergies: [], needs: ['halal'] })).toEqual([])
  })

  it('raises a top-priority card, and "tell the kitchen" posts a safety note', () => {
    const s = run([[0, seat('T1', { needs: ['vegan'] })], [1, fire('T1', 'k', [['l1', 'm_burrata'], ['l2', 'm_kulfi']])]])
    const tasks = deriveTasks(s, config, T0 + 1.5 * MIN)
    expect(tasks[0].kind).toBe('safety_check')
    expect(tasks[0].hint).toMatch(/Burrata & heirloom tomato has dairy \(vegan\)/)
    expect(tasks[0].hint).toMatch(/Pistachio kulfi has dairy \(vegan\)/)
    run([[2, { type: 'safety.resolved', payload: { tableId: 'T1', lineIds: ['l1', 'l2'], resolution: 'kitchen' } }]], s)
    expect(deriveTasks(s, config, T0 + 2.5 * MIN).some((t) => t.kind === 'safety_check')).toBe(false)
    expect(s.notes.at(-1)?.text).toMatch(/^SAFETY T1: Burrata/)
    expect(analytics(s, config).safetyCatches).toBe(2)
  })
})

describe('kitchen forecasts', () => {
  it('pushes the ETA out when the station is busy, and warns before the dish is late', () => {
    // Ten grill dishes ahead of T5's sea bass.
    const s = run([
      ...['T1', 'T2', 'T3', 'T4', 'T6'].map((t, i): [number, IncomingEvent] => [0, fire(t, `g${i}`, [[`g${i}a`, 'm_tikka'], [`g${i}b`, 'm_galouti']])]),
      [1, seat('T5')],
      [1, fire('T5', 'k5', [['sb', 'm_seabass']])],
    ])
    const line = s.tables.T5.lines[0]
    expect(predictReady(s, config, line, T0 + 2 * MIN)).toBeGreaterThan(line.expectedReadyAt + 2 * MIN)
    const early = deriveTasks(s, config, T0 + 9 * MIN).find((t) => t.kind === 'kitchen_delay' && t.tableId === 'T5')
    expect(early?.title).toMatch(/T5 mains likely \d+ min late/)
    expect(early?.hint).toMatch(/Ready in about \d+ min/)
  })

  it('learns real prep times from the night', () => {
    const s = run([[0, seat('T1')], [0, fire('T1', 'a', [['a1', 'm_kulfi']])], [10, { type: 'item.ready', payload: { lineIds: ['a1'] } }]])
    expect(s.prepStats.m_kulfi).toEqual({ n: 1, sumMin: 10 })
  })
})

describe('same-trip bundling and coming up', () => {
  it('attaches waiting tasks at the same table or the pass to a top card', () => {
    const s = run([
      ...['T1', 'T2', 'T3', 'T4'].map((t): [number, IncomingEvent] => [0, seat(t)]),
      ...['T1', 'T2', 'T3', 'T4'].map((t, i): [number, IncomingEvent] => [1, fire(t, `k${i}`, [[`l${i}`, 'm_kulfi']])]),
      [6, { type: 'item.ready', payload: { lineIds: ['l0', 'l1', 'l2', 'l3'] } }],
    ])
    const { top } = tasksFor(deriveTasks(s, config, T0 + 9 * MIN), 's_aisha', 3, s.tables)
    const related = top.flatMap((t) => t.related ?? [])
    expect(related.length).toBeGreaterThan(0)
    expect(related.every((r) => r.where === 'pass' || r.where === 'same' || r.where === 'near')).toBe(true)
  })

  it('puts two pickups at the pass on one card, freeing a slot', () => {
    const s = run([
      [0, seat('T1')],
      [0, seat('T3')],
      [0, { type: 'server.greeted', payload: { tableId: 'T1' } }],
      [0, { type: 'server.greeted', payload: { tableId: 'T3' } }],
      [1, fire('T1', 'a', [['a1', 'm_soup']])],
      [1, fire('T3', 'b', [['b1', 'm_soup']])],
      [8, { type: 'item.ready', payload: { lineIds: ['a1', 'b1'] } }],
    ])
    const { top, queued } = tasksFor(deriveTasks(s, config, T0 + 9 * MIN), 's_aisha', 3, s.tables)
    const pickups = top.filter((t) => t.kind === 'pickup')
    expect(pickups).toHaveLength(1)
    expect(pickups[0].related).toEqual([expect.objectContaining({ where: 'pass', kind: 'pickup' })])
    expect(queued).toBe(0)
  })

  it('predicts a course finishing and food coming up', () => {
    const s = run([
      [0, seat('T1')],
      [0, { type: 'server.greeted', payload: { tableId: 'T1' } }],
      [1, fire('T1', 'a', [['a1', 'm_burrata']])],
      [7, { type: 'item.ready', payload: { lineIds: ['a1'] } }],
      [7, { type: 'item.served', payload: { lineIds: ['a1'] } }],
    ])
    const up = upcomingFor(s, config, 's_aisha', T0 + 16 * MIN, [])
    expect(up.map((u) => u.kind)).toContain('course_end')
  })
})

describe('guest mood', () => {
  it('turns an unhappy check-in into a recovery card and counts it for the manager by table', () => {
    const s = run([
      [0, seat('T2')],
      [1, fire('T2', 'a', [['a1', 'm_kulfi']])],
      [6, { type: 'item.ready', payload: { lineIds: ['a1'] } }],
      [6, { type: 'item.served', payload: { lineIds: ['a1'] } }],
      [10, { type: 'server.checkback', payload: { tableId: 'T2', course: 'dessert', mood: 'unhappy' } }],
    ])
    expect(deriveTasks(s, config, T0 + 10.5 * MIN)[0].kind).toBe('recovery')
    run([[11, { type: 'guest.recovered', payload: { tableId: 'T2', how: 'manager' } }]], s)
    expect(deriveTasks(s, config, T0 + 11.5 * MIN).some((t) => t.kind === 'recovery')).toBe(false)
    const a = analytics(s, config)
    expect(a.moods).toMatchObject({ unhappy: 1, recovered: 1 })
    expect(a.managerRequests).toEqual([{ tableId: 'T2', tableName: 'T2', at: T0 + 11 * MIN }])
  })
})
