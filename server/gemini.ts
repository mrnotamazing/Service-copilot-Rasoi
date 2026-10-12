// Google Gemini as the assistant's language model (used when GEMINI_API_KEY is set). It runs in
// Google's cloud, so it is fast on any laptop, and AI Studio keys have a free tier.
//
// Nothing to train: every request carries the restaurant's standards, menu and training notes
// (the long, stable part first, so Gemini's automatic context caching makes repeats cheap and
// quick), plus the live part: who is asking, their tables, the language. Answers stream.

import type { ChatModel, ChatTurn } from './ai.ts'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
/** Used when the model list can't be read; GEMINI_MODEL overrides both. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * The newest fast "Flash" model the key can use (e.g. gemini-2.5-flash, or a later one), skipping
 * lite, image, audio, live and preview variants. Flash is quick and strong enough for staff help.
 */
export function pickFlash(names: string[]): string | null {
  const ids = names.map((n) => n.replace(/^models\//, ''))
  const version = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)-flash/)?.[1] ?? 0)
  const stable = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash(?:-latest|-\d{3})?$/.test(id))
  const best = (xs: string[]) => [...xs].sort((a, b) => version(b) - version(a) || a.length - b.length)[0] ?? null
  return best(stable) ?? best(ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash/.test(id) && !/lite|image|tts|audio|live|embedding/.test(id)))
}

type Thinking = { thinkingBudget: number } | { thinkingLevel: string } | null

export function createGemini(opts: { key: string; model?: string; fetchImpl?: typeof fetch }) {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': opts.key }
  let model: string | null = opts.model ?? null
  // Short answers for busy staff: thinking off (or as low as the model allows), so words start at once.
  const thinkingTries: Thinking[] = [{ thinkingBudget: 0 }, { thinkingLevel: 'low' }, null]
  let thinking = 0

  async function resolveModel(): Promise<string> {
    if (model) return model
    try {
      const res = await doFetch(`${BASE}/models?pageSize=200`, { headers, signal: AbortSignal.timeout(5000) })
      const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
      model = pickFlash((data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name)) ?? DEFAULT_GEMINI_MODEL
    } catch {
      model = DEFAULT_GEMINI_MODEL
    }
    return model
  }
  void resolveModel()

  const chat: ChatModel = {
    name: 'gemini',
    label: () => model ?? undefined,
    async reply(system, turns: ChatTurn[], onText, o) {
      const name = await resolveModel()
      const contents = turns.map((t, i) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: i === turns.length - 1 && t.role === 'user' && system.reminder ? `${t.text}\n\n(${system.reminder})` : t.text }],
      }))
      for (;;) {
        const think = thinkingTries[thinking]
        const res = await doFetch(`${BASE}/models/${name}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers,
          signal: o?.signal ? AbortSignal.any([AbortSignal.timeout(60_000), o.signal]) : AbortSignal.timeout(60_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `${system.stable}\n\n${system.live}` }] },
            contents,
            generationConfig: { maxOutputTokens: o?.maxTokens ?? 1024, temperature: 0.6, ...(think ? { thinkingConfig: think } : {}) },
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } }
          const msg = err.error?.message ?? `Gemini returned ${res.status}`
          // A model that doesn't take this thinking setting: try the next form once, then remember it.
          if (res.status === 400 && /thinking/i.test(msg) && thinking < thinkingTries.length - 1) {
            thinking++
            continue
          }
          throw Object.assign(new Error(msg), { status: res.status })
        }
        let full = ''
        const read = (line: string) => {
          if (!line.startsWith('data:')) return
          const chunk = JSON.parse(line.slice(5)) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
          if (chunk.promptFeedback?.blockReason) throw new Error('Gemini declined to answer that request')
          const text = chunk.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? ''
          if (!text) return
          full += text
          onText?.(full)
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
            for (const l of lines) read(l.trim())
          }
          read(buf.trim())
        } else {
          for (const l of (await res.text()).split('\n')) read(l.trim())
        }
        const text = full.trim()
        if (!text) throw new Error('Gemini returned an empty answer')
        return text
      }
    },
  }
  return { model: chat, resolveModel }
}

/** A short reason for the notice shown when Gemini can't answer and the built-in answer is used. */
export function geminiErrorReason(e: unknown): string {
  const status = (e as { status?: number }).status
  const msg = e instanceof Error ? e.message : String(e)
  if (status === 400 && /api key/i.test(msg)) return 'The Gemini API key was rejected'
  if (status === 403) return 'The Gemini API key isn’t allowed to use this model'
  if (status === 429) return 'Gemini’s free limit is used up for now'
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) return 'Couldn’t reach Gemini'
  if (e instanceof Error && e.name === 'TimeoutError') return 'Gemini took too long to answer'
  return msg
}
