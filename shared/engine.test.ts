import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { analytics, applyEvent, deriveTasks, initialState, segmentsFor, tasksFor, type EngineState } from './engine.ts'
import type { IncomingEvent } from './events.ts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 7, 13, 30)
const config = structuredClone(DEMO_CONFIG)

function run(events: [number, IncomingEvent][]): EngineState {
  const s = initialState(config)
  events.forEach(([min, e], i) => applyEvent(s, { id: `e${i}`, source: 'sim', at: T0 + min * MIN, ...e } as never, config))
  return s
}

const seat = (tableId: string, extra = {}): IncomingEvent => ({ type: 'table.seated', payload: { tableId, partySize: 2, ...extra } })
const fire = (tableId: string, ticketId: string, ids: [string, string][]): IncomingEvent => ({
  type: 'order.fired',
  payload: { tableId, ticketId, lines: ids.map(([id, menuItemId]) => ({ id, menuItemId, qty: 1 })) },
})

describe('greeting', () => {
  it('raises a greet card for the section server and closes it when greeted', () => {
    const s = run([[0, seat('T1')]])
    const tasks = deriveTasks(s, config, T0 + 0.5 * MIN)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ kind: 'greet', staffId: 's_aisha', tableId: 'T1' })

    applyEvent(s, { id: 'g', type: 'server.greeted', source: 'app', at: T0 + MIN, payload: { tableId: 'T1' } }, config)
    expect(deriveTasks(s, config, T0 + MIN).filter((t) => t.kind === 'greet')).toHaveLength(0)
  })

  it('closes the greet card automatically when the POS shows an order', () => {
    const s = run([[0, seat('T1')], [1, fire('T1', 'k1', [['l1', 'm_burrata']])]])
    expect(deriveTasks(s, config, T0 + 1.5 * MIN).some((t) => t.kind === 'greet')).toBe(false)
  })
})

describe('priority', () => {
  it('ranks an overdue, high-impact card above a fresh low-impact one and caps at three', () => {
    const s = run([
      [0, seat('T1')],
      [0, { type: 'server.greeted', payload: { tableId: 'T1' } }],
      [1, fire('T1', 'k1', [['l1', 'm_burrata']])], // ready ~T0+7
      [7, { type: 'item.ready', payload: { ticketId: 'k1' } }],
      [9, seat('T2')],
      [9.5, seat('T3')],
      [9.8, seat('T4')],
    ])
    const tasks = deriveTasks(s, config, T0 + 10 * MIN)
    const { top, queued } = tasksFor(tasks, 's_aisha')
    expect(top[0]).toMatchObject({ kind: 'pickup', tableId: 'T1' }) // food waiting 3 min, overdue
    expect(top).toHaveLength(3)
    expect(queued).toBe(1)
  })

  it('hides snoozed cards until the snooze ends', () => {
    const s = run([[0, seat('T1')]])
    const id = deriveTasks(s, config, T0)[0].id
    applyEvent(s, { id: 's', type: 'task.snoozed', source: 'app', at: T0, payload: { taskId: id, staffId: 's_aisha', minutes: 2 } }, config)
    expect(deriveTasks(s, config, T0 + MIN)).toHaveLength(0)
    expect(deriveTasks(s, config, T0 + 3 * MIN)).toHaveLength(1)
  })
})

describe('kitchen relay', () => {
  it('asks the server to warn the table when the kitchen runs past tolerance', () => {
    const s = run([[0, seat('T5')], [0, { type: 'server.greeted', payload: { tableId: 'T5' } }], [2, fire('T5', 'k1', [['l1', 'm_seabass']])]])
    // sea bass 16 min + 4 tolerance => delay card after minute 22
    expect(deriveTasks(s, config, T0 + 21 * MIN).some((t) => t.kind === 'kitchen_delay')).toBe(false)
    const late = deriveTasks(s, config, T0 + 23 * MIN).find((t) => t.kind === 'kitchen_delay')
    expect(late?.staffId).toBe('s_rohan')
    expect(late?.title).toMatch(/T5 mains running 5 min late/)
  })

  it('turns a stock-out into a "tell the guest" card with alternatives', () => {
    const s = run([
      [0, seat('T6')],
      [1, fire('T6', 'k1', [['l1', 'm_risotto']])],
      [3, { type: 'item.stock', payload: { menuItemId: 'm_risotto', available: false } }],
    ])
    const card = deriveTasks(s, config, T0 + 3 * MIN).find((t) => t.kind === 'unavailable')
    expect(card?.title).toContain('Truffle risotto')
    expect(card?.hint).toMatch(/Slow-cooked lamb shank|Pan-seared sea bass/)
  })

  it('prompts allergy confirmation and posts it to the kitchen', () => {
    const s = run([[0, seat('T2', { allergies: ['nuts'] })], [1, fire('T2', 'k1', [['l1', 'm_soup']])]])
    expect(deriveTasks(s, config, T0 + MIN).some((t) => t.kind === 'allergy')).toBe(true)
    applyEvent(s, { id: 'a', type: 'allergy.confirmed', source: 'app', at: T0 + 1.2 * MIN, payload: { tableId: 'T2' } }, config)
    expect(s.notes.at(-1)).toMatchObject({ direction: 'to_kitchen', text: 'ALLERGY T2: nuts' })
  })
})

describe('end of meal', () => {
  it('prompts farewell after payment, then a reset with a checklist', () => {
    const s = run([[0, seat('T8')], [1, fire('T8', 'k1', [['l1', 'm_kulfi']])], [30, { type: 'bill.requested', payload: { tableId: 'T8' } }], [31, { type: 'bill.settled', payload: { tableId: 'T8' } }]])
    const kinds = deriveTasks(s, config, T0 + 31.5 * MIN).map((t) => t.kind)
    expect(kinds).toContain('farewell')
    applyEvent(s, { id: 'f', type: 'guest.farewelled', source: 'app', at: T0 + 32 * MIN, payload: { tableId: 'T8' } }, config)
    const reset = deriveTasks(s, config, T0 + 32 * MIN).find((t) => t.kind === 'reset')
    expect(reset?.checklist).toContain('Condiments, salt & pepper topped up')
  })
})

describe('attribution', () => {
  it('blames a slow ticket on the kitchen, not the server, and keeps the visit "smooth"', () => {
    const s = run([
      [0, seat('T1')],
      [1, { type: 'server.greeted', payload: { tableId: 'T1' } }],
      [3, fire('T1', 'k1', [['l1', 'm_galouti']])], // 9 min prep + 4 tolerance
      [25, { type: 'item.ready', payload: { ticketId: 'k1' } }], // 22 min: kitchen lapse
      [25.5, { type: 'item.served', payload: { lineIds: ['l1'] } }],
      [50, { type: 'bill.requested', payload: { tableId: 'T1' } }],
      [51, { type: 'bill.presented', payload: { tableId: 'T1' } }],
      [55, { type: 'bill.settled', payload: { tableId: 'T1' } }],
      [58, { type: 'table.reset', payload: { tableId: 'T1' } }],
    ])
    const visit = s.visits[0]
    const kitchen = visit.segments.find((x) => x.stage === 'kitchen')!
    expect(kitchen).toMatchObject({ owner: 'kitchen', lapse: true, station: 'grill' })
    expect(visit.segments.filter((x) => x.owner === 'floor').every((x) => !x.lapse)).toBe(true)
    expect(visit.smooth).toBe(true)
    const a = analytics(s, config)
    expect(a.lapsesByOwner).toEqual({ floor: 0, kitchen: 1, guest: 0 })
    expect(s.tables.T1.status).toBe('available')
  })

  it('records a late greeting as a floor lapse', () => {
    const s = run([[0, seat('T1')], [5, { type: 'server.greeted', payload: { tableId: 'T1' } }]])
    const [greet] = segmentsFor(s.tables.T1, config)
    expect(greet).toMatchObject({ stage: 'greet', owner: 'floor', lapse: true })
  })
})
