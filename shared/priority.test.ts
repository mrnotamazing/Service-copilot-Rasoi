import { describe, expect, it } from 'vitest'
import { Hub, memoryStore } from '../server/hub.ts'
import type { IncomingEvent } from './events.ts'
import { DEFAULT_PRIORITY, kitchenTickets, priorityOf, ticketPriority } from './priority.ts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 7, 13, 30)
const play = (events: [number, IncomingEvent][]) => {
  const hub = new Hub(memoryStore())
  for (const [min, e] of events) hub.ingest({ ...e, at: T0 + min * MIN } as IncomingEvent)
  return hub
}
const seat = (tableId: string, extra: Record<string, unknown> = {}): [number, IncomingEvent] => [0, { type: 'table.seated', source: 'pos:sim', payload: { tableId, partySize: 2, ...extra } } as IncomingEvent]
const fire = (tableId: string, ticketId: string, item: string, at = 1): [number, IncomingEvent] => [at, { type: 'order.fired', source: 'pos:sim', payload: { tableId, ticketId, lines: [{ id: `l_${ticketId}`, menuItemId: item, qty: 1 }] } }]

describe('kitchen priority', () => {
  it('is calm while a dish is well inside its time, then warns, then goes late and critical', () => {
    const hub = play([seat('T1'), fire('T1', 'k1', 'm_tikka')])
    const at = (min: number) => kitchenTickets(hub.state, hub.config, T0 + min * MIN)[0]
    const std = hub.config.menu.find((m) => m.id === 'm_tikka')!.prepMin
    expect(at(1 + std * 0.3).level).toBe('normal')
    expect(at(1 + std * 0.9).level).toBe('soon')
    expect(at(1 + std + 2).level).toBe('late')
    expect(at(1 + std + 2).reasons[0]).toMatch(/min over standard/)
    expect(at(1 + std + 6).level).toBe('critical')
    expect(at(1 + std + 6).score).toBeGreaterThan(at(1 + std + 2).score)
  })

  it('puts an allergy clash and a VIP ahead of an equally old plain ticket', () => {
    const hub = play([seat('T1'), seat('T2', { allergies: ['nuts'], vip: true, occasion: 'anniversary' }), fire('T1', 'k1', 'm_galouti'), fire('T2', 'k2', 'm_galouti')])
    const list = kitchenTickets(hub.state, hub.config, T0 + 6 * MIN)
    expect(list.map((k) => k.tableId)).toEqual(['T2', 'T1'])
    expect(list[0].reasons).toEqual(expect.arrayContaining(['nuts allergy', 'VIP', 'anniversary']))
    expect(list[1].reasons.join()).not.toMatch(/allergy|VIP/)
  })

  it('follows the weights the restaurant set', () => {
    const hub = play([seat('T1', { vip: true }), seat('T2'), fire('T1', 'k1', 'm_tikka'), fire('T2', 'k2', 'm_tikka', 1.5)])
    const t = hub.state.tables
    const plain = { ...hub.config }
    const vipFirst = { ...hub.config, priority: { vip: 10, overrun: 0, dueSoon: 0, course: 0 } }
    const vipLast = { ...hub.config, priority: { vip: 0 } }
    const now = T0 + 5 * MIN
    expect(kitchenTickets({ tables: t }, vipFirst, now)[0].tableId).toBe('T1')
    // With VIP ignored, the order falls to what is most overdue.
    expect(kitchenTickets({ tables: t }, vipLast, now)[0].tableId).toBe('T1')
    expect(priorityOf(plain)).toEqual(DEFAULT_PRIORITY)
    expect(ticketPriority(t.T1, t.T1.lines, vipFirst, now).score).toBeGreaterThan(ticketPriority(t.T2, t.T2.lines, vipFirst, now).score)
  })
})

describe('a task put off comes back higher', () => {
  it('lifts the card each time it returns', () => {
    const hub = play([seat('T1'), fire('T1', 'k1', 'm_tikka'), [3, { type: 'item.ready', source: 'kitchen', payload: { ticketId: 'k1' } }]])
    hub.clock.set(T0 + 4 * MIN)
    const pick = () => hub.tasks(T0 + 4 * MIN).find((t) => t.kind === 'pickup')
    const task = pick()!
    const before = task.score
    hub.ingest({ type: 'task.snoozed', source: 'app', payload: { taskId: task.id, staffId: task.staffId, minutes: 2 }, at: T0 + 4 * MIN } as IncomingEvent)
    expect(hub.tasks(T0 + 5 * MIN).find((t) => t.id === task.id)).toBeUndefined() // out of the way while put off
    const back = hub.tasks(T0 + 7 * MIN).find((t) => t.id === task.id)!
    expect(back.resurfaced).toMatchObject({ times: 1 })
    expect(back.score).toBeGreaterThan(before)
  })
})
