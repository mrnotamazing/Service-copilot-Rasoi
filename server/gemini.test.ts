import { describe, expect, it, vi } from 'vitest'
import { createGemini, fallbackModels, geminiErrorReason, pickFlash } from './gemini.ts'

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

describe('retired Gemini models', () => {
  it('reads the replacement from Google’s answer and switches to it', async () => {
    const msg = 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.'
    const { suggestedModel } = await import('./gemini.ts')
    expect(suggestedModel(msg)).toBe('gemini-3.8-flash')
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url)
      return url.includes('gemini-2.5-flash') ? new Response(JSON.stringify({ error: { message: msg } }), { status: 404 }) : new Response(sse('ready'), { status: 200 })
    })
    const g = createGemini({ key: 'k', model: 'gemini-2.5-flash', fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await g.model.reply({ stable: '', live: '' }, [{ role: 'user', text: 'x' }])).toBe('ready')
    expect(urls.at(-1)).toMatch(/gemini-3.8-flash:streamGenerateContent/)
    expect(g.model.label?.()).toBe('gemini-3.8-flash')
  })

  it('lists the other Flash models newest first, lite last, skipping image, audio and preview ones', () => {
    expect(fallbackModels(['models/gemini-2.5-flash', 'models/gemini-3.5-flash-lite', 'models/gemini-3.8-flash', 'models/gemini-3.1-flash-lite', 'models/gemini-3.5-flash', 'models/gemini-3.1-flash-image', 'models/gemini-2.5-flash-preview-tts', 'models/gemini-3-flash-preview', 'models/gemma-4-31b-it'])).toEqual([
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ])
  })

  it('tries the next model when one is busy or over its free limit, and keeps using the one that worked', async () => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url)
      if (url.endsWith('/models?pageSize=200')) return new Response(JSON.stringify({ models: ['gemini-3.8-flash', 'gemini-3.5-flash'].map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] })) }), { status: 200 })
      if (url.includes('gemini-3.8-flash')) return new Response(JSON.stringify({ error: { message: 'This model is currently experiencing high demand.' } }), { status: 503 })
      return new Response(sse('hello'), { status: 200 })
    })
    const g = createGemini({ key: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await g.model.reply({ stable: '', live: '' }, [{ role: 'user', text: 'x' }])).toBe('hello')
    const asked = urls.filter((u) => u.includes(':streamGenerateContent'))
    expect(asked.map((u) => u.match(/models\/([\w.-]+):/)![1])).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash'])
    // Next time it starts with the model that worked.
    await g.model.reply({ stable: '', live: '' }, [{ role: 'user', text: 'y' }])
    expect(urls.filter((u) => u.includes(':streamGenerateContent')).slice(2).map((u) => u.match(/models\/([\w.-]+):/)![1])).toEqual(['gemini-3.5-flash'])
  })

  it('does not hide a rejected key behind other models', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes('/models?') ? new Response(JSON.stringify({ models: [] }), { status: 200 }) : new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 })))
    const g = createGemini({ key: 'bad', model: 'gemini-3.5-flash', fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(g.model.reply({ stable: '', live: '' }, [{ role: 'user', text: 'x' }])).rejects.toThrow(/API key/)
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes(':streamGenerateContent'))).toHaveLength(1)
  })
})
