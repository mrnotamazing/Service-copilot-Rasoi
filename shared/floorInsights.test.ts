import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { applyEvent, deriveTasks, initialState } from './engine.ts'
import type { CopilotEvent } from './events.ts'
import { floorInsights, handoverNotes } from './floorInsights.ts'

const MIN = 60_000
const ev = (type: string, payload: unknown, at = 1000): CopilotEvent => ({ id: `e${Math.random()}`, type, payload, at, source: 'manager' }) as CopilotEvent

describe('handing a table to another server', () => {
  it('moves the cards for this visit, then the table goes back to its section', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'bn' }), DEMO_CONFIG)
    applyEvent(s, ev('table.assigned', { tableId: 'T1', serverId: 's_priya', reason: 'language' }, 2000), DEMO_CONFIG)
    expect(s.tables.T1.handover).toEqual({ from: 's_aisha', at: 2000, reason: 'language' })
    const greet = deriveTasks(s, DEMO_CONFIG, 3000).find((t) => t.kind === 'greet' && t.tableId === 'T1')
    expect(greet?.staffId).toBe('s_priya')
    expect(greet?.hint).toContain('prefers Bengali')
    applyEvent(s, ev('bill.settled', { tableId: 'T1' }, 50 * MIN), DEMO_CONFIG)
    applyEvent(s, ev('table.reset', { tableId: 'T1' }, 55 * MIN), DEMO_CONFIG)
    expect(s.tables.T1.serverId).toBe('s_aisha')
    expect(s.tables.T1.handover).toBeUndefined()
    expect(s.visits.at(-1)?.serverId).toBe('s_priya')
  })

  it('handing it back to the section server clears the handover; a free table changes for good', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2 }), DEMO_CONFIG)
    applyEvent(s, ev('table.assigned', { tableId: 'T1', serverId: 's_priya' }), DEMO_CONFIG)
    applyEvent(s, ev('table.assigned', { tableId: 'T1', serverId: 's_kabir' }), DEMO_CONFIG)
    expect(s.tables.T1.handover?.from).toBe('s_aisha')
    applyEvent(s, ev('table.assigned', { tableId: 'T1', serverId: 's_aisha' }), DEMO_CONFIG)
    expect(s.tables.T1.handover).toBeUndefined()
    applyEvent(s, ev('table.assigned', { tableId: 'T2', serverId: 's_rohan' }), DEMO_CONFIG)
    expect(s.tables.T2.handover).toBeUndefined()
    applyEvent(s, ev('table.seated', { tableId: 'T2', partySize: 2 }), DEMO_CONFIG)
    applyEvent(s, ev('table.reset', { tableId: 'T2' }, 9 * MIN), DEMO_CONFIG)
    expect(s.tables.T2.serverId).toBe('s_rohan')
  })

  it('tells both servers, with the reason', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'bn' }), DEMO_CONFIG)
    const n = handoverNotes(s.tables.T1, 'Aisha', 'Priya', 'language')
    expect(n.toNew).toBe('T1 is yours for this visit: the guests prefer Bengali (বাংলা). Aisha will introduce you; it goes back to Aisha afterwards.')
    expect(n.toOld).toContain('Please introduce Priya')
    // Handed on again: it still goes back to the section's own server.
    expect(handoverNotes(s.tables.T1, 'Priya', 'Kabir', 'load', 'Aisha').toNew).toBe('T1 is yours for this visit: Priya has a full section. Priya will introduce you; it goes back to Aisha afterwards.')
  })
})

describe('floor suggestions for the manager', () => {
  it('suggests a server who speaks the guests’ language, before they order', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'bn' }), DEMO_CONFIG)
    const [i] = floorInsights(s, DEMO_CONFIG, 2 * MIN)
    expect(i.kind).toBe('language_move')
    expect(i.action).toEqual({ type: 'move', tableId: 'T1', serverId: 's_priya', reason: 'language' })
    expect(i.why).toContain('Bengali')
  })

  it('after they’ve ordered, asks the teammate to stop by instead of moving the table', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'ta' }), DEMO_CONFIG)
    applyEvent(s, ev('order.fired', { tableId: 'T1', ticketId: 'k1', lines: [{ id: 'l1', menuItemId: DEMO_CONFIG.menu[0].id, qty: 1 }] }, 3 * MIN), DEMO_CONFIG)
    const [i] = floorInsights(s, DEMO_CONFIG, 4 * MIN)
    expect(i.kind).toBe('language_help')
    expect(i.action).toMatchObject({ type: 'note', to: 's_meera', tableId: 'T1' })
  })

  it('says so when no one speaks it, and stays quiet when the server already does', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'fr' }), DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T2', partySize: 2, language: 'hi' }), DEMO_CONFIG)
    const out = floorInsights(s, DEMO_CONFIG, 2 * MIN)
    expect(out.map((i) => i.kind)).toEqual(['language_gap'])
    expect(out[0].action).toBeUndefined()
  })

  it('offers the just-seated table of a server over the limit to a teammate with room', () => {
    const s = initialState(DEMO_CONFIG)
    // Two of section B's tables were given to Aisha earlier tonight, so she has six.
    applyEvent(s, ev('table.assigned', { tableId: 'T5', serverId: 's_aisha' }), DEMO_CONFIG)
    applyEvent(s, ev('table.assigned', { tableId: 'T6', serverId: 's_aisha' }), DEMO_CONFIG)
    for (const [i, id] of ['T1', 'T2', 'T3', 'T4', 'T5'].entries()) {
      applyEvent(s, ev('table.seated', { tableId: id, partySize: 2 }, i * MIN), DEMO_CONFIG)
      applyEvent(s, ev('order.fired', { tableId: id, ticketId: `k${i}`, lines: [{ id: `l${i}`, menuItemId: DEMO_CONFIG.menu[0].id, qty: 1 }] }, i * MIN + 1), DEMO_CONFIG)
    }
    applyEvent(s, ev('table.seated', { tableId: 'T6', partySize: 2 }, 8 * MIN), DEMO_CONFIG)
    const load = floorInsights(s, DEMO_CONFIG, 9 * MIN).find((i) => i.kind === 'load_move')
    expect(load?.tableId).toBe('T6')
    expect(load?.action).toMatchObject({ type: 'move', tableId: 'T6', reason: 'load' })
    expect(load?.why).toContain('over tonight\'s limit of 4')
  })

  it('nudges the kitchen about a guest question waiting more than three minutes', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('dish.question', { questionId: 'q1', from: 's_aisha', text: 'Is the dal made with ghee?', tableId: 'T1' }), DEMO_CONFIG)
    expect(floorInsights(s, DEMO_CONFIG, 2 * MIN)).toEqual([])
    const [i] = floorInsights(s, DEMO_CONFIG, 5 * MIN)
    expect(i.kind).toBe('question_wait')
    expect(i.action).toMatchObject({ type: 'kitchen', tableId: 'T1' })
  })
})

describe('handovers across the app', () => {
  it('section load counts a handed-over table for the server who has it', async () => {
    const { forecast } = await import('./intel.ts')
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T5', partySize: 2 }), DEMO_CONFIG)
    applyEvent(s, ev('table.assigned', { tableId: 'T5', serverId: 's_meera' }), DEMO_CONFIG)
    const f = forecast(s, DEMO_CONFIG, 2 * MIN)
    expect(f.sections.find((x) => x.section === 'B')?.active).toBe(0)
    expect(f.sections.find((x) => x.section === 'C')?.active).toBe(1)
  })
})
