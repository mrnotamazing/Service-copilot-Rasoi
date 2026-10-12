import { describe, expect, it, vi } from 'vitest'
import { createGemini, geminiErrorReason, pickFlash } from './gemini.ts'

const sse = (...texts: string[]) => texts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join('')

describe('Gemini', () => {
  it('picks the newest stable Flash model', () => {
    expect(pickFlash(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-pro', 'models/gemini-3-flash-preview'])).toBe('gemini-2.5-flash')
    expect(pickFlash(['models/gemini-3.5-flash', 'models/gemini-2.5-flash'])).toBe('gemini-3.5-flash')
    expect(pickFlash(['models/gemini-3-flash-preview'])).toBe('gemini-3-flash-preview')
    expect(pickFlash([])).toBeNull()
  })

  it('streams an answer with the system prompt, turns, length cap and thinking off', async () => {
    const calls: { url: string; body?: Record<string, unknown> }[] = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined })
      return new Response(sse('Good ', 'evening.'), { status: 200 })
    })
    const g = createGemini({ key: 'k', model: 'gemini-2.5-flash', fetchImpl: fetchImpl as unknown as typeof fetch })
    const seen: string[] = []
    const text = await g.model.reply({ stable: 'STABLE', live: 'LIVE' }, [{ role: 'user', text: 'hi' }], (t) => seen.push(t), { maxTokens: 120 })
    expect(text).toBe('Good evening.')
    expect(seen).toEqual(['Good ', 'Good evening.'])
    expect(calls[0].url).toMatch(/models\/gemini-2.5-flash:streamGenerateContent\?alt=sse$/)
    expect(calls[0].body).toMatchObject({ systemInstruction: { parts: [{ text: 'STABLE\n\nLIVE' }] }, contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } } })
  })

  it('falls back to another thinking setting when a model rejects it', async () => {
    let n = 0
    const fetchImpl = vi.fn(async () => (n++ === 0 ? new Response(JSON.stringify({ error: { message: 'thinking_budget is not supported' } }), { status: 400 }) : new Response(sse('ok'), { status: 200 })))
    const g = createGemini({ key: 'k', model: 'gemini-3-flash', fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await g.model.reply({ stable: '', live: '' }, [{ role: 'user', text: 'x' }])).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('explains failures in plain words', () => {
    expect(geminiErrorReason(Object.assign(new Error('API key not valid. Please pass a valid API key.'), { status: 400 }))).toMatch(/key was rejected/)
    expect(geminiErrorReason(Object.assign(new Error('Resource exhausted'), { status: 429 }))).toMatch(/free limit/)
  })
})
