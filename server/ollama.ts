// Ollama as the assistant's language model: free, runs on this computer, nothing leaves it.
// Used when no Anthropic key is set. The app checks every few seconds whether Ollama is running
// and has a model, so it can be started before or after `npm run dev`.
//
// Built for laptops: it asks for a compact prompt (only the training notes that matter for the
// question), keeps one small context size (so the model never reloads), caps answer length, streams the answer as it's
// written, and loads the model into memory as soon as it's found, so the first answer isn't slow.

import type { ChatModel, ChatTurn } from './ai.ts'

/** Models that handle the six app languages reasonably, best first. Any other installed model works too. */
const PREFERRED = ['gemma3', 'qwen3', 'qwen2.5', 'llama3.1', 'llama3.2', 'mistral']
export const SUGGESTED_MODEL = 'gemma3:4b'

/**
 * One fixed working-memory size: compact prompts fit with room for a long role-play, and changing
 * the size between requests would make Ollama reload the model (the warm-up uses it too).
 */
const NUM_CTX = 6144

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
      const picked = pick(status.models, Object.fromEntries((data.models ?? []).map((m) => [m.name, m.size ?? 0])))
      if (picked && picked !== status.model) warm(picked)
      status.model = picked
    } catch {
      status.running = false
      status.models = []
      status.model = null
    }
    return status
  }

  /** Load the model into memory now (a request with no prompt), so the first real answer is quick. */
  function warm(name: string) {
    void doFetch(`${host}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: name, keep_alive: '30m', options: { num_ctx: NUM_CTX } }) }).catch(() => {})
  }

  void refresh()
  const timer = setInterval(() => void refresh(), opts.pollMs ?? 10_000)
  timer.unref?.()

  const model: ChatModel = {
    name: 'ollama',
    checkFacts: true,
    compact: true,
    available: () => status.running && !!status.model,
    label: () => status.model ?? undefined,
    async reply(system, turns: ChatTurn[], onText) {
      const name = status.model
      if (!name) throw new Error('No Ollama model installed')
      const messages = [
        { role: 'system', content: `${system.stable}\n\n${system.live}` },
        ...turns.map((t, i) => ({
          role: t.role,
          // The reminder rides on the latest message, where a small model pays most attention.
          content: i === turns.length - 1 && t.role === 'user' && system.reminder ? `${t.text}\n\n(${system.reminder})` : t.text,
        })),
      ]
      const res = await doFetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Local models are slower, and the first answer may also load the model into memory.
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
          model: name,
          stream: true,
          keep_alive: '30m',
          // Answers are short by design; the cap stops a rambling model from holding things up.
          options: { num_ctx: NUM_CTX, num_predict: 320, temperature: 0.6 },
          messages,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `Ollama returned ${res.status}`)
      }
      // Ollama streams one JSON object per line; show the answer as it's written.
      let full = ''
      let shown = ''
      const visible = () => full.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
      const read = async (line: string) => {
        if (!line.trim()) return
        const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string }
        if (chunk.error) throw new Error(chunk.error)
        full += chunk.message?.content ?? ''
        const now = visible()
        if (onText && now && now !== shown) onText((shown = now))
      }
      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const l of lines) await read(l)
        }
        await read(buf)
      } else {
        for (const l of (await res.text()).split('\n')) await read(l)
      }
      // Reasoning models write their thinking in <think> tags first; staff only need the answer.
      const text = visible()
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
