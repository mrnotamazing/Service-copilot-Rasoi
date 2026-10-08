import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { applyEvent, deriveTasks, initialState } from './engine.ts'
import { afterEvent, beforeEvent, initialGame } from './game.ts'
import type { CopilotEvent } from './events.ts'

const ev = (type: string, payload: unknown, at = 1000): CopilotEvent => ({ id: `e${Math.random()}`, type, payload, at, source: 'manager' }) as CopilotEvent

describe('manager notes and kudos', () => {
  it('a note becomes a card for each server it was sent to, until each one taps Got it', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('manager.instruction', { instructionId: 'n1', from: 'm_floor', to: ['s_aisha', 's_rohan'], text: 'Push the dessert specials' }), DEMO_CONFIG)
    const cards = deriveTasks(s, DEMO_CONFIG, 2000).filter((t) => t.kind === 'instruction')
    expect(cards.map((c) => c.staffId).sort()).toEqual(['s_aisha', 's_rohan'])
    expect(cards[0].title).toBe('Floor Manager: Push the dessert specials')
    applyEvent(s, ev('instruction.acked', { instructionId: 'n1', staffId: 's_aisha' }, 3000), DEMO_CONFIG)
    expect(deriveTasks(s, DEMO_CONFIG, 4000).filter((t) => t.kind === 'instruction').map((c) => c.staffId)).toEqual(['s_rohan'])
    expect(s.instructions[0].acks).toEqual({ s_aisha: 3000 })
    // Someone it wasn't sent to can't acknowledge it.
    applyEvent(s, ev('instruction.acked', { instructionId: 'n1', staffId: 's_meera' }, 5000), DEMO_CONFIG)
    expect(s.instructions[0].acks.s_meera).toBeUndefined()
  })

  it('kudos from the manager give the server XP and show on the team board', () => {
    const s = initialState(DEMO_CONFIG)
    const g = initialGame(DEMO_CONFIG)
    const e = ev('kudos.sent', { from: 'm_floor', to: 's_tenzin', reason: 'Kept us calm' })
    beforeEvent(g, e, s, DEMO_CONFIG)
    applyEvent(s, e, DEMO_CONFIG)
    afterEvent(g, [], DEMO_CONFIG)
    expect(g.players.s_tenzin.xp).toBeGreaterThan(0)
    expect(g.kudos.at(-1)).toMatchObject({ from: 'm_floor', to: 's_tenzin', reason: 'Kept us calm' })
  })
})
