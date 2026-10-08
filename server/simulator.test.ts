import { describe, expect, it } from 'vitest'
import { createApi } from './api.ts'
import { Hub, memoryStore } from './hub.ts'
import { MOMENTS, Simulator } from './simulator.ts'

const MIN = 60_000

function setup() {
  const hub = new Hub(memoryStore())
  const sim = new Simulator(hub)
  const api = createApi(hub, sim)
  const post = (path: string, body: Record<string, unknown> = {}) => api.post(path, body)!.result as Record<string, unknown>
  // Run the service forward by `min` minutes of service time without waiting in real time.
  const run = (min: number) => {
    for (let i = 0; i < min * 4; i++) {
      hub.clock.set(hub.clock.now() + MIN / 4)
      ;(sim as unknown as { tick(): void }).tick()
    }
  }
  return { hub, sim, post, run }
}

describe('demo control', () => {
  it('stages every moment and narrates it', () => {
    const { hub, sim, post, run } = setup()
    post('/api/sim/moment', { kind: 'allergy' })
    expect(Object.values(hub.state.tables).some((t) => t.party?.allergies.includes('nuts'))).toBe(true)
    run(25)
    for (const kind of MOMENTS) {
      const r = post('/api/sim/moment', { kind })
      expect(typeof r.text).toBe('string')
    }
    const texts = hub.feed.map((f) => f.text).join('\n')
    expect(texts).toMatch(/Staged: a guest with a nut allergy arrives/)
    expect(texts).toMatch(/seated: party of \d · Sam Banerjee · nut allergy/)
    expect(texts).toMatch(/Kitchen → floor: Grill is backed up/)
    sim.pause()
  })

  it('explains why a moment can’t happen yet', () => {
    const { sim, post } = setup()
    const r = post('/api/sim/moment', { kind: 'unhappy' })
    expect(r).toMatchObject({ ok: false })
    expect(r.text).toMatch(/No table is eating yet/)
    sim.pause()
  })

  it('showcase mode runs the whole restaurant and stages moments by itself', () => {
    const { hub, sim, post, run } = setup()
    const status = post('/api/sim/settings', { showcase: true }) as { showcase: boolean; running: boolean; autoManager: boolean; autopilot: string[] }
    expect(status).toMatchObject({ showcase: true, running: true, autoManager: true })
    expect(status.autopilot).toHaveLength(3)
    run(120)
    const staged = hub.feed.filter((f) => f.kind === 'demo')
    expect(staged.length).toBeGreaterThanOrEqual(3)
    expect(hub.state.visits.length).toBeGreaterThan(0)
    // Requests to see the manager get answered by the manager on autopilot.
    expect(Object.values(hub.state.tables).filter((t) => t.managerRequestedAt && !t.managerVisitedAt && hub.clock.now() - t.managerRequestedAt > 5 * MIN)).toHaveLength(0)
    sim.pause()
  })

  it('reset clears the service, the feed and the game', () => {
    const { hub, sim, post, run } = setup()
    post('/api/sim/settings', { showcase: true })
    run(20)
    post('/api/sim/reset')
    expect(hub.feed).toHaveLength(0)
    expect(hub.state.visits).toHaveLength(0)
    expect(Object.values(hub.state.tables).every((t) => t.status === 'available')).toBe(true)
    sim.pause()
  })
})
