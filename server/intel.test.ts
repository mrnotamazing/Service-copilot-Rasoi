import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from '../shared/config.ts'
import { learningPlan, reconstructVisit, whyFirst } from '../shared/intel.ts'
import type { Snapshot } from '../shared/snapshot.ts'
import { createApi } from './api.ts'
import { Hub, memoryStore } from './hub.ts'
import { Simulator } from './simulator.ts'
import { parseWhatIf, runWhatIf } from './whatif.ts'

const MIN = 60_000

function busyNight(minutes = 90) {
  const hub = new Hub(memoryStore())
  const sim = new Simulator(hub)
  const api = createApi(hub, sim)
  sim.intensity = 1.6
  sim.fastForward(minutes)
  return { hub, sim, api }
}

describe('assist: why this first', () => {
  it('explains the top card in plain reasons', () => {
    const { hub, api } = busyNight(40)
    const snap = api.snapshot('server', 's_aisha')
    const top = snap.me!.top[0]
    if (top) {
      expect(snap.me!.why!.length).toBeGreaterThan(0)
      expect(snap.me!.why!.length).toBeLessThanOrEqual(3)
      for (const w of snap.me!.why! as { k: string }[]) expect(w.k).toMatch(/^why\./)
    }
    const task = { ...hub.tasks()[0], kind: 'allergy' as const, dueAt: hub.clock.now() - 3 * MIN }
    const why = whyFirst(task, [task], hub.state.tables[task.tableId], hub.clock.now()).map((w) => (w as { k: string }).k)
    expect(why).toContain('why.safety')
    expect(why).toContain('why.late')
  })
})

describe('predict: forecasts', () => {
  it('forecasts every working station and each section’s load for the manager', () => {
    const { api } = busyNight(35)
    const snap = api.snapshot('manager') as Snapshot
    expect(snap.forecast!.stations.length).toBeGreaterThan(0)
    expect(snap.forecast!.sections.map((s) => s.section).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    for (const s of snap.forecast!.stations) expect(s.text).toMatch(/cooking/)
    // Section load is load, never a ranking of people.
    expect(JSON.stringify(snap.forecast)).not.toMatch(/best|worst|slowest server/i)
  })
})

describe('explain: incidents and the shift', () => {
  it('reconstructs a visit step by step and says who controlled the delay', () => {
    const { hub } = busyNight(120)
    const v = hub.state.visits.find((x) => x.segments.some((s) => s.lapse)) ?? hub.state.visits[0]
    expect(v).toBeTruthy()
    const r = reconstructVisit(v, hub.config)
    expect(r.steps.length).toBe(v.segments.length)
    expect(r.story[0]).toMatch(new RegExp(`^${v.tableName}, party of`))
    if (r.biggest) expect(r.story.join(' ')).toMatch(/Biggest delay/)
  })

  it('explains tonight with a bottleneck, lights and actions', () => {
    const { api } = busyNight(120)
    const intel = api.snapshot('manager').intel!
    expect(intel.lights.map((l) => l.id)).toEqual(['guests', 'kitchen', 'floor'])
    expect(intel.why.length).toBeGreaterThan(0)
    expect(intel.overMin.floor + intel.overMin.kitchen).toBeGreaterThan(0)
  })

  it('writes an incident story and complaint help without a model', async () => {
    const { hub, api } = busyNight(120)
    const v = hub.state.visits[0]
    const story = await api.ask({ kind: 'incident', visitId: v.visitId })
    expect(story.text).toMatch(new RegExp(v.tableName))
    const t = Object.values(hub.state.tables).find((x) => x.visitId)!
    const help = await api.ask({ kind: 'complaint', tableId: t.id, staffId: t.serverId })
    expect(help.text).toMatch(/^Say: “/)
    expect(help.text).toMatch(/\n1\. /)
  })
})

describe('decide: what-if', () => {
  it('compares the same evening with one thing changed', () => {
    const r = runWhatIf(DEMO_CONFIG, { extraGrill: true }, { minutes: 90, runs: 2 })
    expect(r.label).toBe('an extra grill cook')
    expect(r.changed.kitchenLate).toBeLessThanOrEqual(r.base.kitchenLate + 0.05)
    expect(r.findings.some((f) => /Recommendation/.test(f))).toBe(true)
    // Same seed, same night.
    expect(runWhatIf(DEMO_CONFIG, {}, { minutes: 60, runs: 1 }).base).toEqual(runWhatIf(DEMO_CONFIG, {}, { minutes: 60, runs: 1 }).changed)
  })

  it('a server off sick hands their section to a colleague', () => {
    const r = runWhatIf(DEMO_CONFIG, { sickServer: 's_rohan' }, { minutes: 90, runs: 1 })
    expect(r.changed.peakTables).toBeGreaterThanOrEqual(r.base.peakTables)
  })

  it('reads a manager’s question', () => {
    expect(parseWhatIf('What if Aisha is off sick tonight?', DEMO_CONFIG)).toEqual({ sickServer: 's_aisha' })
    expect(parseWhatIf('what if we are 40% busier', DEMO_CONFIG)).toEqual({ covers: 1.4 })
    expect(parseWhatIf('What if we add a second grill cook?', DEMO_CONFIG)).toEqual({ extraGrill: true })
    expect(parseWhatIf('How do I give feedback?', DEMO_CONFIG)).toBeNull()
  })

  it('answers what-if questions in the manager chat from a simulation', async () => {
    const hub = new Hub(memoryStore())
    const api = createApi(hub, new Simulator(hub))
    const a = await api.ask({ kind: 'chat', mode: 'ask', staffId: 'm_floor', messages: [{ role: 'user', text: 'What if we add a second grill cook?' }] })
    expect(a.text).toMatch(/^What if: an extra grill cook/)
  })
})

describe('learn: a private journey', () => {
  it('tracks practice over time and recommends practice from the real shift', () => {
    const log = [
      { at: 1, scenario: 'cold_food', score: 40 },
      { at: 2, scenario: 'cold_food', score: 50 },
      { at: 3, scenario: 'rude', score: 45 },
      { at: 4, scenario: 'cold_food', score: 80 },
      { at: 5, scenario: 'rude', score: 85 },
      { at: 6, scenario: 'wrong_bill', score: 90 },
      { at: 7, scenario: 'wrong_bill', score: 85, final: true },
    ]
    const { hub } = busyNight(120)
    const mine = hub.state.visits.filter((v) => v.serverId === 's_aisha')
    const plan = learningPlan(log, mine, [], 'server')
    const recovery = plan.skills.find((s) => s.id === 'recovery')!
    expect(recovery).toMatchObject({ replies: 6, first: 45, latest: 85, trend: 'up' })
    expect(plan.recommended.length).toBeGreaterThan(0)
    expect(plan.sessions).toBe(1)
  })

  it('only reaches the person’s own screen', () => {
    const { api } = busyNight(30)
    expect(api.snapshot('server', 's_aisha').me!.learning).toBeTruthy()
    expect(JSON.stringify(api.snapshot('manager'))).not.toMatch(/"learning"|practiceLog/)
  })

  it('logs each practice reply in the person’s own game state', async () => {
    const hub = new Hub(memoryStore())
    hub.ingest({ type: 'practice.scored', payload: { staffId: 's_aisha', scenario: 'rude', score: 72 } })
    expect(hub.game.players.s_aisha.practiceLog).toEqual([expect.objectContaining({ scenario: 'rude', score: 72 })])
  })
})
