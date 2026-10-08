import { useRef, useState } from 'react'
import type { AiAnswer, AiKind } from '../../server/ai.ts'
import { postStream } from './live.ts'
import { getPrefs } from './prefs.ts'

export type { AiAnswer }
/** An answer still being written: shown as it arrives, without its source badge yet. */
export type LiveAnswer = AiAnswer & { streaming?: boolean }

/** One AI request with loading/error state. The answer streams in as the model writes it. */
export function useAi() {
  const [answer, setAnswer] = useState<LiveAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  async function ask(kind: AiKind, body: { staffId?: string; taskId?: string; question?: string; lang?: string; tableId?: string; visitId?: string } = {}) {
    const mine = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const final = await postStream<AiAnswer>('/api/ai', { kind, lang: getPrefs().lang, ...body }, (text) => {
        if (mine === seq.current) setAnswer({ text, source: 'built-in', streaming: true })
      })
      if (mine === seq.current) setAnswer(final)
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }

  return { answer, loading, error, ask, clear: () => setAnswer(null) }
}
