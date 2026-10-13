// Every AI model this installation can use, as one list, best first. The server asks them in
// order (adapted by the ranker), so one rate-limited or offline service never leaves staff without
// an answer: the next one takes over, and the built-in trainer is the last resort that always works.
//
//   Default order: Claude, Gemini, free cloud AI (Groq…), Ollama (local).
//   AI_PRIORITY=cloud,gemini,ollama,claude   changes the order
//   AI_PROVIDER=ollama                        uses only the local model

import type { ChatModel } from './ai.ts'

export interface Provider {
  name: ChatModel['name']
  model: ChatModel
  /** Why a call failed, in plain words. */
  reason: (e: unknown) => string
  /** One line for the start-up log. */
  describe: () => Promise<string> | string
  /** Ollama only: re-check what is installed. */
  refresh?: () => Promise<unknown>
  status?: unknown
}

export async function loadProviders(env: NodeJS.ProcessEnv = process.env): Promise<Provider[]> {
  const only = env.AI_PROVIDER && env.AI_PROVIDER !== 'auto' ? env.AI_PROVIDER : null
  const want = (n: string) => !only || only === n
  const all: Provider[] = []

  if (want('claude') && (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) {
    const m = await import('./claude.ts')
    all.push({ name: 'claude', model: m.createClaude(), reason: m.claudeErrorReason, describe: () => `Claude (${env.ANTHROPIC_MODEL || 'claude-opus-5-5'})` })
  }
  const gkey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
  if (want('gemini') && gkey) {
    const m = await import('./gemini.ts')
    const g = m.createGemini({ key: gkey, model: env.GEMINI_MODEL })
    all.push({ name: 'gemini', model: g.model, reason: m.geminiErrorReason, describe: async () => `Google Gemini (${await g.resolveModel()})` })
  }
  if (want('cloud')) {
    const o = await import('./openai.ts')
    const cfg = o.fromEnv(env)
    if (cfg) {
      const c = o.createOpenAi(cfg)
      all.push({ name: 'cloud', model: c.model, reason: o.cloudErrorReason, describe: () => `Free cloud AI (${c.model.label?.()})` })
    }
  }
  if (want('ollama') && env.OLLAMA !== 'off') {
    const m = await import('./ollama.ts')
    const o = m.createOllama({ host: env.OLLAMA_HOST, model: env.OLLAMA_MODEL })
    all.push({
      name: 'ollama',
      model: o.model,
      reason: m.ollamaErrorReason,
      refresh: o.refresh,
      status: o.status,
      describe: async () => {
        const st = await o.refresh()
        return st.model ? `Ollama (${st.model}, free and local)` : st.running ? `Ollama is running but has no model: run "ollama pull ${m.SUGGESTED_MODEL}"` : 'Ollama (not running yet)'
      },
    })
  }
  const order = (env.AI_PRIORITY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return order.length ? [...all].sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99)) : all
}
