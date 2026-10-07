import { describe, expect, it } from 'vitest'
import { Hub, memoryStore } from '../server/hub.ts'
import { levelFor, playerView, teamView } from './game.ts'
import type { IncomingEvent } from './events.ts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 7, 13, 30)

function play(events: [number, IncomingEvent][]) {
  const hub = new Hub(memoryStore())
  for (const [min, e] of events) hub.ingest({ ...e, at: T0 + min * MIN } as IncomingEvent)
  return hub
}

const seat = (tableId: string): IncomingEvent => ({ type: 'table.seated', source: 'pos:sim', payload: { tableId, partySize: 2 } })
const app = (e: IncomingEvent): IncomingEvent => ({ ...e, source: 'app' } as IncomingEvent)

/** A full table served to standard by Aisha (section A). */
function smoothVisit(tableId: string, start: number): [number, IncomingEvent][] {
  return [
    [start, seat(tableId)],
    [start + 0.5, app({ type: 'server.greeted', payload: { tableId } })],
    [start + 1, { type: 'order.fired', source: 'pos:sim', payload: { tableId, ticketId: `k${tableId}${start}`, lines: [{ id: `l${tableId}${start}`, menuItemId: 'm_kulfi', qty: 1 }] } }],
    [start + 5, { type: 'item.ready', source: 'pos:sim', payload: { ticketId: `k${tableId}${start}` } }],
    [start + 5.3, app({ type: 'item.served', payload: { lineIds: [`l${tableId}${start}`] } })],
    [start + 30, { type: 'bill.requested', source: 'pos:sim', payload: { tableId } }],
    [start + 31, app({ type: 'bill.presented', payload: { tableId } })],
    [start + 33, { type: 'bill.settled', source: 'pos:sim', payload: { tableId } }],
    [start + 35, app({ type: 'table.reset', payload: { tableId } })],
  ]
}

describe('XP', () => {
  it('rewards a swift greeting more than a late one, and never takes XP away', () => {
    const hub = play([
      [0, seat('T1')],
      [0.5, app({ type: 'server.greeted', payload: { tableId: 'T1' } })],
      [0, seat('T2')],
      [6, app({ type: 'server.greeted', payload: { tableId: 'T2' } })],
    ])
    const awards = playerView(hub.game, 's_aisha')!.awards.filter((a) => a.kind === 'xp')
    expect(awards.map((a) => [a.title, a.xp])).toEqual([
      ['Swift welcome', 15],
      ['Done welcome', 3],
    ])
    expect(hub.game.players.s_aisha.combo).toBe(0)
  })

  it('ignores POS events and manager overrides', () => {
    const hub = play([
      [0, seat('T1')],
      [3, { type: 'server.greeted', source: 'manager', payload: { tableId: 'T1' } }],
    ])
    expect(hub.game.players.s_aisha.xp).toBe(0)
  })

  it('unlocks the first-shift badge immediately', () => {
    const hub = play([
      [0, seat('T1')],
      [0.4, app({ type: 'server.greeted', payload: { tableId: 'T1' } })],
    ])
    const view = playerView(hub.game, 's_aisha')!
    expect(view.badges.find((b) => b.id === 'first_welcome')?.earnedAt).not.toBeNull()
    expect(view.awards.some((a) => a.kind === 'badge' && a.title === 'First welcome')).toBe(true)
  })
})

describe('streaks, shields and the team goal', () => {
  it('counts smooth tables toward the streak, the team goal and a shield every third', () => {
    const hub = play([...smoothVisit('T1', 0), ...smoothVisit('T2', 40), ...smoothVisit('T3', 80)])
    const p = hub.game.players.s_aisha
    expect(p.streak).toBe(3)
    expect(p.shields).toBe(1)
    expect(teamView(hub.game).smooth).toBe(3)
    expect(p.quests.q_smooth).toBeDefined()
  })

  it('spends a shield instead of breaking the streak on a slip', () => {
    const slip: [number, IncomingEvent][] = [
      [130, seat('T4')],
      [140, app({ type: 'server.greeted', payload: { tableId: 'T4' } })], // 10 min: floor lapse
      [170, { type: 'bill.settled', source: 'pos:sim', payload: { tableId: 'T4' } }],
      [171, app({ type: 'table.reset', payload: { tableId: 'T4' } })],
    ]
    const hub = play([...smoothVisit('T1', 0), ...smoothVisit('T2', 40), ...smoothVisit('T3', 80), ...slip])
    const p = hub.game.players.s_aisha
    expect(p.streak).toBe(3)
    expect(p.shields).toBe(0)
  })
})

describe('kudos', () => {
  it('rewards both sides and shows on the team feed', () => {
    const hub = play([[0, { type: 'kudos.sent', source: 'app', payload: { from: 's_rohan', to: 's_aisha', reason: 'Covered my table' } }]])
    expect(hub.game.players.s_aisha.xp).toBe(10)
    expect(hub.game.players.s_rohan.xp).toBe(5)
    expect(teamView(hub.game).kudos[0]).toMatchObject({ from: 's_rohan', to: 's_aisha' })
  })
})

describe('levels', () => {
  it('maps XP to hospitality ranks', () => {
    expect(levelFor(0).title).toBe('Commis')
    expect(levelFor(130)).toMatchObject({ level: 2, title: 'Server', nextTitle: 'Senior server' })
    expect(levelFor(5000).progress).toBe(1)
  })
})
