// What-if: run the same evening twice in a sandbox, as it is and with one thing changed (more guests,
// a server off sick, an extra grill cook, a slower kitchen), and compare. Each pair of runs uses the
// same random seed, so guests arrive and order the same way and only the change makes the difference.
// Runs in a throwaway Hub: the live service is never touched.

import { segmentsFor } from '../shared/engine.ts'
import type { RestaurantConfig } from '../shared/types.ts'
import { Hub, memoryStore } from './hub.ts'
import { Simulator } from './simulator.ts'

const MIN = 60_000

export interface WhatIf {
  /** Guests arriving, relative to a normal night (1.3 = 30% more). */
  covers?: number
  /** A server who is off: their section goes to the colleague with the fewest tables. */
  sickServer?: string
  /** A second cook on the grill. */
  extraGrill?: boolean
  /** How fast the kitchen cooks (0.8 = 20% slower). */
  kitchenSpeed?: number
}

export interface Outcome {
  /** Parties and guests seated. */
  tables: number
  covers: number
  /** Average minutes from order to food ready. */
  foodWaitMin: number
  /** Share of kitchen tickets past standard, 0–1. */
  kitchenLate: number
  /** Share of floor steps past standard, 0–1. */
  floorLate: number
  /** Share of tables served fully to standard, 0–1. */
  smooth: number
  /** Most tables any one server had at once. */
  peakTables: number
  walkouts: number
}

export interface WhatIfResult {
  scenario: WhatIf
  label: string
  minutes: number
  runs: number
  base: Outcome
  changed: Outcome
  findings: string[]
}

/** Small, fast, seedable random numbers. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Run `fn` with Math.random seeded, so the simulator's choices repeat exactly. */
function seeded<T>(seed: number, fn: () => T): T {
  const real = Math.random
  Math.random = mulberry32(seed)
  try {
    return fn()
  } finally {
    Math.random = real
  }
}

function runOnce(config: RestaurantConfig, w: WhatIf, minutes: number, seed: number): Outcome {
  return seeded(seed, () => {
    const hub = new Hub(memoryStore())
    let cfg = structuredClone(config)
    if (w.sickServer && cfg.staff.some((s) => s.id === w.sickServer && s.role === 'server')) {
      const others = cfg.staff.filter((s) => s.role === 'server' && s.id !== w.sickServer)
      if (others.length) {
        const count = (id: string) => Object.values(cfg.sections).filter((x) => x === id).length
        const sections = { ...cfg.sections }
        for (const [sec, id] of Object.entries(sections)) if (id === w.sickServer) sections[sec] = [...others].sort((a, b) => count(a.id) - count(b.id))[0].id
        cfg = { ...cfg, sections }
      }
    }
    hub.updateConfig(cfg)
    hub.clock.set(Date.UTC(2026, 0, 1, 13, 30))
    const sim = new Simulator(hub)
    sim.intensity = w.covers ?? 1
    sim.extraGrill = !!w.extraGrill
    sim.kitchenSpeed = w.kitchenSpeed ?? 1
    let peak = 0
    sim.fastForward(minutes, () => {
      const per = new Map<string, number>()
      for (const t of Object.values(hub.state.tables)) if (t.visitId) per.set(t.serverId, (per.get(t.serverId) ?? 0) + 1)
      peak = Math.max(peak, ...per.values(), 0)
    })
    const visits = hub.state.visits
    const live = Object.values(hub.state.tables).filter((t) => t.visitId).flatMap((t) => segmentsFor(t, hub.config))
    const segs = [...visits.flatMap((v) => v.segments), ...live]
    const kitchen = segs.filter((s) => s.stage === 'kitchen')
    const floor = segs.filter((s) => s.owner === 'floor')
    const share = (xs: typeof segs) => (xs.length ? xs.filter((s) => s.lapse).length / xs.length : 0)
    const seated = hub.events.filter((e) => e.type === 'table.seated')
    return {
      tables: seated.length,
      covers: seated.reduce((n, e) => n + (e.type === 'table.seated' ? e.payload.partySize : 0), 0),
      foodWaitMin: kitchen.length ? kitchen.reduce((n, s) => n + (s.end - s.start) / MIN, 0) / kitchen.length : 0,
      kitchenLate: share(kitchen),
      floorLate: share(floor),
      smooth: visits.length ? visits.filter((v) => v.smooth).length / visits.length : 0,
      peakTables: peak,
      walkouts: sim.walkouts,
    }
  })
}

function mean(xs: Outcome[]): Outcome {
  const keys = Object.keys(xs[0]) as (keyof Outcome)[]
  return Object.fromEntries(keys.map((key) => [key, xs.reduce((n, x) => n + x[key], 0) / xs.length])) as unknown as Outcome
}

export function describeWhatIf(w: WhatIf, config: RestaurantConfig): string {
  const parts: string[] = []
  if (w.covers && w.covers !== 1) parts.push(`${w.covers > 1 ? '+' : ''}${Math.round((w.covers - 1) * 100)}% guests`)
  if (w.sickServer) parts.push(`${config.staff.find((s) => s.id === w.sickServer)?.name ?? 'a server'} off sick`)
  if (w.extraGrill) parts.push('an extra grill cook')
  if (w.kitchenSpeed && w.kitchenSpeed !== 1) parts.push(`kitchen ${Math.round(Math.abs(1 - w.kitchenSpeed) * 100)}% ${w.kitchenSpeed < 1 ? 'slower' : 'faster'}`)
  return parts.join(', ') || 'no change'
}

/** Compare a normal evening with the changed one. 2½ hours of service, averaged over a few seeds. */
export function runWhatIf(config: RestaurantConfig, w: WhatIf, opts: { minutes?: number; runs?: number; seed?: number } = {}): WhatIfResult {
  const minutes = Math.max(30, Math.min(240, opts.minutes ?? 150))
  const runs = Math.max(1, Math.min(5, opts.runs ?? 3))
  const seeds = Array.from({ length: runs }, (_, i) => (opts.seed ?? 7) * 1000 + i)
  const base = mean(seeds.map((s) => runOnce(config, {}, minutes, s)))
  const changed = mean(seeds.map((s) => runOnce(config, w, minutes, s)))
  return { scenario: w, label: describeWhatIf(w, config), minutes, runs, base, changed, findings: findings(base, changed, w, config) }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const r1 = (x: number) => Math.round(x * 10) / 10

function findings(b: Outcome, c: Outcome, w: WhatIf, config: RestaurantConfig): string[] {
  const out: string[] = []
  const dWait = c.foodWaitMin - b.foodWaitMin
  if (Math.abs(dWait) >= 0.5) out.push(`Food would take ${r1(Math.abs(dWait))} min ${dWait > 0 ? 'longer' : 'less'} on average (${r1(c.foodWaitMin)} vs ${r1(b.foodWaitMin)} min).`)
  const dK = c.kitchenLate - b.kitchenLate
  if (Math.abs(dK) >= 0.05) out.push(`Kitchen tickets past standard: ${pct(c.kitchenLate)} instead of ${pct(b.kitchenLate)}.`)
  const dF = c.floorLate - b.floorLate
  if (Math.abs(dF) >= 0.04) out.push(`Floor steps past standard: ${pct(c.floorLate)} instead of ${pct(b.floorLate)}${dF > 0 && c.peakTables > config.sop.maxActiveTablesPerServer ? `; one server would have up to ${Math.round(c.peakTables)} tables at once (limit ${config.sop.maxActiveTablesPerServer})` : ''}.`)
  if (Math.abs(c.covers - b.covers) >= 2) out.push(`${Math.round(c.covers)} guests seated instead of ${Math.round(b.covers)}.`)
  if (c.walkouts - b.walkouts >= 0.7) out.push(`About ${Math.round(c.walkouts - b.walkouts)} more parties would give up waiting for a table.`)
  if (!out.length) out.push('Little would change: the team absorbs it within standard.')

  // What to do about it.
  if (w.sickServer && (dF > 0.04 || c.peakTables > config.sop.maxActiveTablesPerServer)) out.push('Recommendation: bring in cover for the busiest hour, or cap bookings in the merged section and run food for it from the pass.')
  else if (w.sickServer) out.push('Recommendation: the team can cover; brief the merged section on allergies and regulars before service.')
  if ((w.covers ?? 1) > 1 && dK > 0.08) out.push('Recommendation: stagger bookings by 15 minutes at peak, or add a cook on the busiest station.')
  if ((w.covers ?? 1) > 1 && dF > 0.06) out.push('Recommendation: add a food runner or a fourth server for the peak hour.')
  if (w.extraGrill) out.push(dK < -0.03 || dWait < -0.5 ? 'Recommendation: worth it at peak; schedule the second grill cook for the busiest 90 minutes.' : 'Recommendation: the grill isn’t the limit on a night like this; the extra cook adds little.')
  if ((w.kitchenSpeed ?? 1) < 1 && dK > 0.05) out.push('Recommendation: on a short-handed kitchen night, warn tables early and keep heads-ups going.')
  return out
}

/** Read a what-if out of a manager's question ("what if Aisha is off sick", "30% busier", "extra grill cook"). */
export function parseWhatIf(q: string, config: RestaurantConfig): WhatIf | null {
  const s = q.toLowerCase()
  if (!/what if|what happens if|if we (had|have|get)|simulate|busier|off sick|call(s|ed)? in sick|extra (grill|cook)|second (grill|cook)/.test(s)) return null
  const w: WhatIf = {}
  const pctMatch = s.match(/(\d{1,3})\s*%\s*(more|busier|extra)?/)
  if (/busier|more (guests|covers|bookings)|rush|full house|double/.test(s) || pctMatch) w.covers = /double/.test(s) ? 2 : pctMatch ? 1 + Math.min(150, Number(pctMatch[1])) / 100 : 1.3
  if (/(fewer|less) (guests|covers)|quiet/.test(s)) w.covers = 0.7
  const sick = config.staff.find((x) => x.role === 'server' && s.includes(x.name.toLowerCase()))
  if (sick && /sick|off|absent|away|leave|miss|not in|out/.test(s)) w.sickServer = sick.id
  else if (/sick|absent|short.?staffed|one (server|waiter) (down|short)|a server (is )?off/.test(s)) w.sickServer = config.staff.find((x) => x.role === 'server')?.id
  if (/(extra|second|another|one more) (grill|cook|chef)/.test(s)) w.extraGrill = true
  if (/slow(er)? kitchen|kitchen (is )?(short|slow)|chef (is )?(off|sick)/.test(s)) w.kitchenSpeed = 0.8
  return Object.keys(w).length ? w : null
}

export function whatIfText(r: WhatIfResult): string {
  return [`What if: ${r.label}. I ran ${r.runs} simulated ${r.minutes}-minute services both ways with the same guests:`, ...r.findings.map((f) => `• ${f}`)].join('\n')
}
