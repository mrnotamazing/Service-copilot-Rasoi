import { useState } from 'react'
import type { AiAnswer, AiKind } from '../../server/ai.ts'
import { post } from './live.ts'

export type { AiAnswer }

/** One AI request with loading/error state. */
export function useAi() {
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(kind: AiKind, body: { staffId?: string; taskId?: string; question?: string } = {}) {
    setLoading(true)
    setError(null)
    try {
      setAnswer(await post<AiAnswer>('/api/ai', { kind, ...body }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return { answer, loading, error, ask, clear: () => setAnswer(null) }
}
