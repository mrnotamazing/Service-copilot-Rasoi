import { describe, expect, it } from 'vitest'
import { createApi } from './api.ts'
import { Hub, memoryStore } from './hub.ts'
import { Simulator } from './simulator.ts'
import { safetyIssues } from '../shared/safety.ts'

describe('presenter mode', () => {
  it('warms up a service with something to show on every screen', () => {
    const hub = new Hub(memoryStore())
    const sim = new Simulator(hub)
    const api = createApi(hub, sim)
    sim.prepare('s_aisha')
    sim.pause()
    const now = hub.clock.now()
    expect(Math.abs(now - Date.now())).toBeLessThan(60_000)
    expect(sim.presenter).toBe('s_aisha')
    expect(sim.autopilot.has('s_aisha')).toBe(false)
    const m = api.snapshot('manager')
    expect(m.analytics!.visits).toBeGreaterThan(0)
    expect(m.insights!.length).toBeGreaterThan(0)
    expect(m.tables.some((t) => (t.mood?.value === 'unhappy' && !t.recoveredAt) || t.managerRequestedAt)).toBe(true)
    const k = api.snapshot('kitchen')
    expect(k.questions!.some((q) => !q.answer)).toBe(true)
    const me = api.snapshot('server', 's_aisha')
    expect(me.me!.tasks.length).toBeGreaterThanOrEqual(2)
    const mine = me.tables.filter((t) => t.serverId === 's_aisha')
    expect(mine.some((t) => t.lines.some((l) => safetyIssues(hub.config.menu.find((x) => x.id === l.menuItemId), t.party).length))).toBe(true)
    expect(me.team.kudos.length).toBeGreaterThan(0)
    sim.stopPresenting()
    expect(sim.autopilot.has('s_aisha')).toBe(true)
  })
})
