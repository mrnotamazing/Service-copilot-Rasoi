// Any OpenAI-compatible chat service as the assistant's model. Built for the free, very fast ones:
// Groq (default), Cerebras and OpenRouter's free models. Answers stream as they are written. When a
// model is rate limited or busy, the next one in the list answers, and a model that just failed
// rests for a minute.

import type { ChatModel, ChatTurn } from './ai.ts'

export interface Preset {
  id: string
  url: string
  models: string[]
}

export const PRESETS: Record<string, Preset> = {
  groq: { id: 'groq', url: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'] },
  cerebras: { id: 'cerebras', url: 'https://api.cerebras.ai/v1', models: ['llama-3.3-70b', 'llama3.1-8b'] },
  openrouter: { id: 'openrouter', url: 'https://openrouter.ai/api/v1', models: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'] },
}

/** Which preset the environment asks for, with its key: GROQ_API_KEY, CEREBRAS_API_KEY or OPENROUTER_API_KEY, or a custom URL. */
export function fromEnv(env: NodeJS.ProcessEnv): { key: string; url: string; models: string[]; id: string } | null {
  const custom = env.OPENAI_COMPAT_URL && env.OPENAI_COMPAT_KEY
  if (custom) return { id: 'custom', key: env.OPENAI_COMPAT_KEY!, url: env.OPENAI_COMPAT_URL!.replace(/\/+$/, ''), models: env.AI_MODEL ? [env.AI_MODEL] : ['default'] }
  for (const [name, p] of Object.entries(PRESETS)) {
    const key = env[`${name.toUpperCase()}_API_KEY`]
    if (key) return { id: p.id, key, url: p.url, models: env.AI_MODEL ? [env.AI_MODEL, ...p.models] : p.models }
  }
  return null
}

/** Best first: strong, fast chat models. Anything not named here comes after, in the service's own order. */
const PREFER = [/gpt-oss-120b/, /llama-3\.3-70b/, /qwen.*(32b|27b|235b)/, /gemma.*(27b|12b)/, /llama.*70b/, /gpt-oss-20b/, /llama-3\.1-8b/]
const NOT_CHAT = /whisper|orpheus|tts|guard|safeguard|embed|moderation|allam|vision-preview|image/i

/** Chat models the service really offers, best first (model lists change; names baked into code go stale). */
export function rankModels(ids: string[]): string[] {
  const chat = ids.filter((m) => !NOT_CHAT.test(m))
  const score = (m: string) => {
    const i = PREFER.findIndex((r) => r.test(m))
    return i < 0 ? PREFER.length : i
  }
  return [...chat].sort((a, b) => score(a) - score(b))
}

const RETRY = new Set([408, 425, 429, 500, 502, 503, 504])

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export function createOpenAi(cfg: { key: string; url: string; models: string[]; id?: string; fetchImpl?: typeof fetch }) {
  const doFetch = cfg.fetchImpl ?? fetch
  const rested = new Map<string, number>()
  let lastGood: string | null = null
  let models = cfg.models
  // Ask the service which models it has now; keep the built-in list if it can't say.
  const discovered = (async () => {
    try {
      const res = await doFetch(`${cfg.url}/models`, { headers: { authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(6000) })
      const data = (await res.json()) as { data?: { id: string }[] }
      const ranked = rankModels((data.data ?? []).map((m) => m.id))
      if (ranked.length && cfg.models[0] !== 'default') models = [...new Set([...cfg.models.filter((m) => ranked.includes(m)), ...ranked])]
    } catch {
      /* keep the preset list */
    }
  })()

  async function once(name: string, system: Parameters<ChatModel['reply']>[0], turns: ChatTurn[], onText: Parameters<ChatModel['reply']>[2], o: Parameters<ChatModel['reply']>[3]) {
    const messages = [
      { role: 'system', content: `${system.stable}\n\n${system.live}` },
      ...turns.map((t, i) => ({ role: t.role, content: i === turns.length - 1 && t.role === 'user' && system.reminder ? `${t.text}\n\n(${system.reminder})` : t.text })),
    ]
    const res = await doFetch(`${cfg.url}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' },
      signal: o?.signal ? AbortSignal.any([AbortSignal.timeout(45_000), o.signal]) : AbortSignal.timeout(45_000),
      body: JSON.stringify({ model: name, stream: true, temperature: 0.6, max_tokens: o?.maxTokens ?? 600, messages, ...(/gpt-oss/.test(name) ? { reasoning_effort: 'low' } : {}) }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string }
      const msg = typeof data.error === 'string' ? data.error : (data.error?.message ?? `The AI service returned ${res.status}`)
      throw new HttpError(msg, res.status)
    }
    let full = ''
    let shown = ''
    // Reasoning models may write their thinking in <think> tags first; staff only need the answer.
    const visible = () => full.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
    const line = (l: string) => {
      const m = l.match(/^data:\s*(.*)$/)
      if (!m || m[1] === '[DONE]' || !m[1]) return
      const chunk = JSON.parse(m[1]) as { choices?: { delta?: { content?: string } }[] }
      full += chunk.choices?.[0]?.delta?.content ?? ''
      const now = visible()
      if (onText && now && now !== shown) onText((shown = now))
    }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      lines.forEach(line)
    }
    line(buf)
    const text = visible()
    if (!text) throw new HttpError('The AI service returned an empty answer', 502)
    return text
  }

  const model: ChatModel = {
    name: 'cloud',
    lean: true,
    label: () => `${cfg.id ?? 'cloud'}: ${lastGood ?? models[0]}`,
    async reply(system, turns, onText, o) {
      await discovered
      const now = Date.now()
      const order = [...new Set([lastGood, ...models].filter((m): m is string => !!m))]
      const ready = order.filter((m) => (rested.get(m) ?? 0) < now)
      let lastError: unknown
      for (const name of (ready.length ? ready : order).slice(0, 4)) {
        try {
          const text = await once(name, system, turns, onText, o)
          lastGood = name
          return text
        } catch (e) {
          lastError = e
          const status = e instanceof HttpError ? e.status : 0
          const retry = RETRY.has(status) || (e as Error).name === 'TimeoutError' || (status === 404 || status === 400)
          if (o?.signal?.aborted || !retry) throw e
          rested.set(name, Date.now() + 60_000)
          console.warn(`[${cfg.id}] ${name} couldn't answer (${status || (e as Error).name}); trying the next model`)
        }
      }
      throw lastError
    },
  }
  return { model }
}

export function cloudErrorReason(e: unknown): string {
  const status = e instanceof HttpError ? e.status : 0
  if (status === 401 || status === 403) return 'The AI key was rejected: check it in .env'
  if (status === 429) return 'The free AI limit was reached for a moment'
  if (e instanceof Error && e.name === 'TimeoutError') return 'The AI took too long to answer'
  return e instanceof Error ? e.message : String(e)
}
