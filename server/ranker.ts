// Decides which AI model to ask first for a job. Each model has a quality (from the last evaluation,
// `npm run eval:ai`, or a sensible starting guess) and a speed (measured while running). Quick jobs
// weigh speed heavily so everyday answers come back fast; deep jobs (judging a practice reply, a
// debrief) weigh quality. A model that just failed rests for a while (longer each time in a row) and
// comes back as soon as it works again, so staff always get an answer from the best model available.

import { existsSync, readFileSync } from 'node:fs'
import type { Tier } from './tasks.ts'

export interface Ranking {
  updated: string
  /** Overall quality 0-100 per model id. */
  scores: Record<string, number>
  /** Quality per kind of job. */
  tiers?: Partial<Record<Tier, Record<string, number>>>
  /** Median answer time in ms per model id. */
  ms?: Record<string, number>
}

export function readRanking(file: string): Ranking | null {
  try {
    if (!existsSync(file)) return null
    const r = JSON.parse(readFileSync(file, 'utf8')) as Ranking
    return r && typeof r.scores === 'object' ? r : null
  } catch {
    return null
  }
}

/** A starting guess before anything has been measured: quality and typical answer time per service. */
const GUESS: Record<string, { q: number; ms: number }> = {
  claude: { q: 92, ms: 3500 },
  gemini: { q: 84, ms: 2500 },
  groq: { q: 84, ms: 700 },
  cerebras: { q: 80, ms: 600 },
  openrouter: { q: 72, ms: 2500 },
  cloud: { q: 75, ms: 2000 },
  ollama: { q: 55, ms: 12000 },
}
/** Points lost per second of answer time, and the most that can be lost, by how urgent the job is. */
const SPEED: Record<Tier, { perSec: number; cap: number }> = {
  quick: { perSec: 6, cap: 40 },
  standard: { perSec: 3, cap: 25 },
  deep: { perSec: 1, cap: 10 },
}

const REST_MS = [30_000, 120_000, 600_000]
/** Values within this many points count as equal, so the fixed order decides. */
const TIE = 3

export function createRanker(opts: { file?: string; now?: () => number; /** Keep the given order (AI_PRIORITY); only rest failing models. */ fixed?: boolean } = {}) {
  const now = opts.now ?? Date.now
  const state = new Map<string, { fails: number; restUntil: number; ms: number }>()
  let ranking: Ranking | null = null
  let loaded = -Infinity
  const get = (n: string) => state.get(n) ?? { fails: 0, restUntil: 0, ms: 0 }

  function data() {
    if (opts.file && now() - loaded > 60_000) {
      ranking = readRanking(opts.file)
      loaded = now()
    }
    return ranking
  }
  const guess = (id: string) => GUESS[id] ?? GUESS[id.split(':')[0]] ?? { q: 60, ms: 5000 }

  function value(id: string, tier: Tier) {
    const r = data()
    const q = r?.tiers?.[tier]?.[id] ?? r?.scores?.[id] ?? guess(id).q
    const ms = get(id).ms || r?.ms?.[id] || guess(id).ms
    const s = SPEED[tier]
    return q - Math.min(s.cap, (ms / 1000) * s.perSec)
  }

  return {
    /** Ids best first for this kind of job: rested ones last; then by quality minus a speed penalty. */
    order(ids: string[], tier: Tier = 'quick'): string[] {
      const t = now()
      const idx = (n: string) => ids.indexOf(n)
      return [...ids].sort((a, b) => {
        const ra = get(a).restUntil > t ? 1 : 0
        const rb = get(b).restUntil > t ? 1 : 0
        if (ra !== rb) return ra - rb
        if (opts.fixed) return idx(a) - idx(b)
        const va = value(a, tier)
        const vb = value(b, tier)
        return Math.abs(va - vb) > TIE ? vb - va : idx(a) - idx(b)
      })
    },
    ok(id: string, ms: number) {
      const s = get(id)
      state.set(id, { fails: 0, restUntil: 0, ms: s.ms ? Math.round(s.ms * 0.7 + ms * 0.3) : ms })
    },
    fail(id: string) {
      const s = get(id)
      state.set(id, { ...s, fails: s.fails + 1, restUntil: now() + REST_MS[Math.min(s.fails, REST_MS.length - 1)] })
    },
    /** For the Setup page and the health check. */
    snapshot(ids: string[]) {
      const r = data()
      const t = now()
      return ids.map((n) => ({ name: n, quality: r?.scores?.[n], ms: get(n).ms || r?.ms?.[n] || undefined, resting: get(n).restUntil > t, fails: get(n).fails }))
    },
  }
}
export type Ranker = ReturnType<typeof createRanker>
