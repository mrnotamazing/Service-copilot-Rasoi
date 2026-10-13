// Decides which AI model to ask first. The order starts from a fixed preference (best first), is
// re-ordered by the last quality evaluation (`npm run eval:ai` writes data/ai-ranking.json), and
// adapts while running: a model that just failed rests for a while (longer each time it fails in a
// row) so the next one answers at once, and it returns to its place as soon as it works again.

import { existsSync, readFileSync } from 'node:fs'

export interface Ranking {
  updated: string
  /** Quality 0-100 per model name, from the evaluation. */
  scores: Record<string, number>
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

const REST_MS = [30_000, 120_000, 600_000]
/** Evaluation scores within this many points count as equal, so the fixed preference decides. */
const TIE = 4

export function createRanker(opts: { file?: string; now?: () => number } = {}) {
  const now = opts.now ?? Date.now
  const state = new Map<string, { fails: number; restUntil: number; ms: number }>()
  let ranking: Ranking | null = null
  let loaded = 0
  const get = (n: string) => state.get(n) ?? { fails: 0, restUntil: 0, ms: 0 }

  function scores() {
    if (opts.file && now() - loaded > 60_000) {
      ranking = readRanking(opts.file)
      loaded = now()
    }
    return ranking?.scores ?? {}
  }

  return {
    /** Names best first: rested ones last; among the rest, a clearly better evaluation first, otherwise the fixed order. */
    order(names: string[]): string[] {
      const sc = scores()
      const t = now()
      const idx = (n: string) => names.indexOf(n)
      return [...names].sort((a, b) => {
        const ra = get(a).restUntil > t ? 1 : 0
        const rb = get(b).restUntil > t ? 1 : 0
        if (ra !== rb) return ra - rb
        const sa = sc[a]
        const sb = sc[b]
        if (sa !== undefined && sb !== undefined && Math.abs(sa - sb) > TIE) return sb - sa
        return idx(a) - idx(b)
      })
    },
    ok(name: string, ms: number) {
      state.set(name, { fails: 0, restUntil: 0, ms: get(name).ms ? Math.round(get(name).ms * 0.7 + ms * 0.3) : ms })
    },
    fail(name: string) {
      const s = get(name)
      state.set(name, { ...s, fails: s.fails + 1, restUntil: now() + REST_MS[Math.min(s.fails, REST_MS.length - 1)] })
    },
    /** For the Setup page and logs. */
    snapshot(names: string[]) {
      const sc = scores()
      const t = now()
      return names.map((n) => ({ name: n, quality: sc[n], ms: get(n).ms || undefined, resting: get(n).restUntil > t, fails: get(n).fails }))
    },
  }
}
export type Ranker = ReturnType<typeof createRanker>
