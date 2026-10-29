import { describe, expect, it } from 'vitest'
import { Hub, memoryStore } from '../server/hub.ts'
import { crewView } from './crew.ts'
import type { IncomingEvent } from './events.ts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 7, 13, 30)
const play = (events: [number, IncomingEvent][]) => {
  const hub = new Hub(memoryStore())
  for (const [min, e] of events) hub.ingest({ ...e, at: T0 + min * MIN } as IncomingEvent)
  return hub
}
const seat = (tableId: string): [number, IncomingEvent] => [0, { type: 'table.seated', source: 'pos:sim', payload: { tableId, partySize: 2 } }]
const fire = (n: number, at: number): [number, IncomingEvent] => [at, { type: 'order.fired', source: 'pos:sim', payload: { tableId: 'T1', ticketId: `k${n}`, lines: [{ id: `l${n}`, menuItemId: 'm_kulfi', qty: 1 }] } }]
const ready = (n: number, at: number): [number, IncomingEvent] => [at, { type: 'item.ready', source: 'kitchen', payload: { ticketId: `k${n}` } }]

describe('the kitchen’s clean-pass game', () => {
  it('builds a streak of dishes sent out on time and breaks it on a late one', () => {
    // Kulfi has a short prep time: 4 minutes is on time, 40 minutes is late.
    const hub = play([seat('T1'), fire(1, 1), ready(1, 5), fire(2, 6), ready(2, 10), fire(3, 11), ready(3, 51), fire(4, 52), ready(4, 56)])
    const v = crewView(hub.game.crew, 'kitchen')
    expect(v.counters.plates).toBe(4)
    expect(v.bestStreak).toBe(2)
    expect(v.streak).toBe(1)
    expect(v.xp).toBeGreaterThan(30)
    expect(v.goal.done).toBe(3)
  })

  it('earns a badge and a rank, and answering the floor counts', () => {
    const events: [number, IncomingEvent][] = [seat('T1')]
    for (let i = 1; i <= 6; i++) events.push(fire(i, i * 5), ready(i, i * 5 + 4))
    events.push([40, { type: 'dish.question', source: 'app', payload: { questionId: 'q1', from: 's_aisha', text: 'Is it spicy?' } }], [41, { type: 'dish.answered', source: 'kitchen', payload: { questionId: 'q1', answer: 'Mild', by: 'k_pass' } }])
    const v = crewView(play(events).game.crew, 'kitchen')
    expect(v.badges.find((b) => b.id === 'hot_line')?.earnedAt).not.toBeNull()
    expect(v.counters.answers).toBe(1)
    expect(v.awards.some((a) => a.kind === 'badge')).toBe(true)
  })
})

describe('the manager’s support moments', () => {
  it('counts handovers, notes, recoveries and thanks as team support, not rankings', () => {
    const hub = play([
      seat('T1'),
      [1, { type: 'table.assigned', source: 'manager', payload: { tableId: 'T1', serverId: 's_priya', reason: 'language' } }],
      [2, { type: 'manager.instruction', source: 'manager', payload: { instructionId: 'i1', from: 'm_floor', to: ['s_priya'], text: 'Table 1 speaks Bengali' } }],
      [3, { type: 'guest.recovered', source: 'manager', payload: { tableId: 'T1', how: 'manager' } }],
      [4, { type: 'kudos.sent', source: 'manager', payload: { from: 'm_floor', to: 's_priya', reason: 'Great save' } }],
    ])
    const v = crewView(hub.game.crew, 'floor')
    expect(v.counters).toMatchObject({ handovers: 1, notes: 1, recoveries: 1, kudos: 1, moments: 4 })
    expect(v.goal).toMatchObject({ done: 4, target: 10 })
    expect(JSON.stringify(v)).not.toMatch(/s_priya|s_aisha/)
  })

  it('does not count a server’s own recovery as the manager’s', () => {
    const hub = play([seat('T1'), [1, { type: 'guest.recovered', source: 'app', payload: { tableId: 'T1', how: 'fixed' } }]])
    expect(crewView(hub.game.crew, 'floor').counters.moments ?? 0).toBe(0)
  })
})
