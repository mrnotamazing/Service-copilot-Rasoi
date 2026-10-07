// Ollama as the assistant's language model: free, runs on this computer, nothing leaves it.
// Used when no Anthropic key is set. The app checks every few seconds whether Ollama is running
// and has a model, so it can be started before or after `npm run dev`.

import type { ChatModel, ChatTurn } from './ai.ts'

/** Models that handle the six app languages reasonably, best first. Any other installed model works too. */
const PREFERRED = ['gemma3', 'qwen3', 'qwen2.5', 'llama3.1', 'llama3.2', 'mistral']
export const SUGGESTED_MODEL = 'gemma3:4b'

export interface OllamaStatus {
  running: boolean
  model: string | null
  /** Installed models, for the Setup page. */
  models: string[]
}

export function createOllama(opts: { host?: string; model?: string; fetchImpl?: typeof fetch; pollMs?: number } = {}) {
  const host = (opts.host || 'http://localhost:11434').replace(/\/+$/, '')
  const doFetch = opts.fetchImpl ?? fetch
  const status: OllamaStatus = { running: false, model: null, models: [] }

  function pick(models: string[], sizes: Record<string, number>): string | null {
    if (opts.model) return models.find((m) => m === opts.model || m === `${opts.model}:latest`) ?? null
    for (const p of PREFERRED) {
      // Within a family the bigger download is the smarter model (gemma3:4b over gemma3:1b).
      const hit = models.filter((m) => m.startsWith(p)).sort((a, b) => (sizes[b] ?? 0) - (sizes[a] ?? 0))[0]
      if (hit) return hit
    }
    // Embedding-only models can't chat.
    return models.find((m) => !/embed/i.test(m)) ?? null
  }

  async function refresh(): Promise<OllamaStatus> {
    try {
      const res = await doFetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) })
      const data = (await res.json()) as { models?: { name: string; size?: number }[] }
      status.running = res.ok
      status.models = (data.models ?? []).map((m) => m.name)
      status.model = pick(status.models, Object.fromEntries((data.models ?? []).map((m) => [m.name, m.size ?? 0])))
    } catch {
      status.running = false
      status.models = []
      status.model = null
    }
    return status
  }

  void refresh()
  const timer = setInterval(() => void refresh(), opts.pollMs ?? 10_000)
  timer.unref?.()

  const model: ChatModel = {
    name: 'ollama',
    checkFacts: true,
    available: () => status.running && !!status.model,
    label: () => status.model ?? undefined,
    async reply(system, turns: ChatTurn[]) {
      const name = status.model
      if (!name) throw new Error('No Ollama model installed')
      const res = await doFetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Local models are slower, and the first answer also loads the model into memory.
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
          model: name,
          stream: false,
          keep_alive: '30m',
          // The standards, menu and training notes are ~2-3k tokens; make sure they all fit.
          options: { num_ctx: 8192, temperature: 0.6 },
          messages: [
            { role: 'system', content: `${system.stable}\n\n${system.live}` },
            ...turns.map((t, i) => ({
              role: t.role,
              // The reminder rides on the latest message, where a small model pays most attention.
              content: i === turns.length - 1 && t.role === 'user' && system.reminder ? `${t.text}\n\n(${system.reminder})` : t.text,
            })),
          ],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: { content?: string }; error?: string }
      if (!res.ok) throw new Error(data.error ?? `Ollama returned ${res.status}`)
      // Reasoning models write their thinking in <think> tags first; staff only need the answer.
      const text = (data.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
      if (!text) throw new Error('Ollama returned an empty answer')
      return text
    },
  }

  return { model, status, refresh, host }
}

/** A short reason for the notice shown when Ollama can't answer and the built-in answer is used. */
export function ollamaErrorReason(e: unknown): string {
  const msg = e instanceof Error ? `${e.message} ${(e as { cause?: { code?: string } }).cause?.code ?? ''}` : String(e)
  if (/ECONNREFUSED|fetch failed/i.test(msg)) return 'Ollama isn’t running (open the Ollama app)'
  if (/TimeoutError|aborted/i.test(msg) || (e instanceof Error && e.name === 'TimeoutError')) return 'The local AI took too long to answer'
  if (/not found/i.test(msg)) return `That Ollama model isn’t installed (run: ollama pull ${SUGGESTED_MODEL})`
  return e instanceof Error ? e.message : msg
}
