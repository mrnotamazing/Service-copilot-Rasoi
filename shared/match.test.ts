import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { applyEvent, initialState } from './engine.ts'
import type { CopilotEvent } from './events.ts'
import { floorInsights } from './floorInsights.ts'
import { bestFit } from './match.ts'

const ev = (type: string, payload: unknown, at = 1000): CopilotEvent => ({ id: `e${Math.random()}`, type, payload, at, source: 'manager' }) as CopilotEvent

describe('welcoming a first-time guest', () => {
  it('suggests the server with a shared language and room, and says why', () => {
    const s = initialState(DEMO_CONFIG)
    const speaker = DEMO_CONFIG.staff.find((x) => x.role === 'server' && x.languages?.includes('hi') && x.id !== s.tables.T1.serverId)
    expect(speaker).toBeTruthy()
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'hi', firstVisit: true }), DEMO_CONFIG)
    const fit = bestFit(s, DEMO_CONFIG, 'T1')!
    expect(fit.reasons[0]).toContain('Hindi')
    const tip = floorInsights(s, DEMO_CONFIG, 2000).find((i) => i.kind === 'first_visit')
    if (fit.server.id !== s.tables.T1.serverId) expect(tip?.action).toMatchObject({ type: 'move', tableId: 'T1', serverId: fit.server.id, reason: 'first_visit' })
  })

  it('rotates newcomers: a server who just hosted one is less likely to get the next', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, firstVisit: true }), DEMO_CONFIG)
    const a = bestFit(s, DEMO_CONFIG, 'T1')!.server.id
    applyEvent(s, ev('table.assigned', { tableId: 'T1', serverId: a }), DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T2', partySize: 2, firstVisit: true }), DEMO_CONFIG)
    expect(bestFit(s, DEMO_CONFIG, 'T2')!.server.id).not.toBe(a)
  })

  it('is quiet when switched off, once greeted, and for returning guests', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'hi', firstVisit: true }), DEMO_CONFIG)
    expect(floorInsights(s, { ...DEMO_CONFIG, firstVisit: 'off' }, 2000).some((i) => i.kind === 'first_visit')).toBe(false)
    applyEvent(s, ev('server.greeted', { tableId: 'T1' }, 1500), DEMO_CONFIG)
    expect(floorInsights(s, DEMO_CONFIG, 2000).some((i) => i.kind === 'first_visit')).toBe(false)
    const r = initialState(DEMO_CONFIG)
    applyEvent(r, ev('table.seated', { tableId: 'T1', partySize: 2, language: 'hi' }), DEMO_CONFIG)
    expect(floorInsights(r, DEMO_CONFIG, 2000).some((i) => i.kind === 'first_visit')).toBe(false)
  })
})
