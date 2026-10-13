import { describe, expect, it, vi } from 'vitest'
import { createOpenAi, fromEnv } from './openai.ts'

const sse = (...parts: string[]) =>
  new Response([...parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`), 'data: [DONE]\n\n'].join(''), { status: 200 })
const sys = { stable: 's', live: 'l' }
const turns = [{ role: 'user' as const, text: 'hi' }]

describe('cloud AI (OpenAI-compatible)', () => {
  it('streams the answer and sends the key as a bearer token', async () => {
    const f = vi.fn(async () => sse('Hel', 'lo there'))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['m1'], fetchImpl: f as unknown as typeof fetch })
    const seen: string[] = []
    expect(await model.reply(sys, turns, (t) => seen.push(t))).toBe('Hello there')
    expect(seen).toEqual(['Hel', 'Hello there'])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://x/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k')
  })

  it('moves to the next model when one is rate limited, and remembers the one that worked', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => (JSON.parse(init.body as string).model === 'big' ? new Response(JSON.stringify({ error: { message: 'slow down' } }), { status: 429 }) : sse('ok')))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['big', 'small'], fetchImpl: f as unknown as typeof fetch })
    expect(await model.reply(sys, turns)).toBe('ok')
    expect(await model.reply(sys, turns)).toBe('ok')
    expect(f).toHaveBeenCalledTimes(3) // big, small, then small straight away
  })

  it('does not retry a rejected key', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['a', 'b'], fetchImpl: f as unknown as typeof fetch })
    await expect(model.reply(sys, turns)).rejects.toThrow('bad key')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('picks the preset from the environment', () => {
    expect(fromEnv({})).toBeNull()
    expect(fromEnv({ GROQ_API_KEY: 'g' } as NodeJS.ProcessEnv)).toMatchObject({ id: 'groq', url: 'https://api.groq.com/openai/v1' })
    expect(fromEnv({ CEREBRAS_API_KEY: 'c', AI_MODEL: 'x' } as NodeJS.ProcessEnv)?.models[0]).toBe('x')
  })
})
