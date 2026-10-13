import { describe, expect, it, vi } from 'vitest'
import { createOpenAi, fromEnv, rankModels } from './openai.ts'

const sse = (...parts: string[]) =>
  new Response([...parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`), 'data: [DONE]\n\n'].join(''), { status: 200 })
/** The service's model list is not part of these tests: it answers "no list", so the preset models are used. */
const withModels = (f: (u: string, i: RequestInit) => Promise<Response>) => vi.fn(async (u: string, i: RequestInit) => (String(u).endsWith('/models') ? new Response('{}', { status: 404 }) : f(u, i)))
const chatCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => !String(c[0]).endsWith('/models'))
const sys = { stable: 's', live: 'l' }
const turns = [{ role: 'user' as const, text: 'hi' }]

describe('cloud AI (OpenAI-compatible)', () => {
  it('streams the answer and sends the key as a bearer token', async () => {
    const f = withModels(async () => sse('Hel', 'lo there'))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['m1'], fetchImpl: f as unknown as typeof fetch })
    const seen: string[] = []
    expect(await model.reply(sys, turns, (t) => seen.push(t))).toBe('Hello there')
    expect(seen).toEqual(['Hel', 'Hello there'])
    const [url, init] = chatCalls(f)[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://x/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k')
  })

  it('moves to the next model when one is rate limited, and remembers the one that worked', async () => {
    const f = withModels(async (_u, init) => (JSON.parse(init.body as string).model === 'big' ? new Response(JSON.stringify({ error: { message: 'slow down' } }), { status: 429 }) : sse('ok')))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['big', 'small'], fetchImpl: f as unknown as typeof fetch })
    expect(await model.reply(sys, turns)).toBe('ok')
    expect(await model.reply(sys, turns)).toBe('ok')
    expect(chatCalls(f)).toHaveLength(3) // big, small, then small straight away
  })

  it('does not retry a rejected key', async () => {
    const f = withModels(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['a', 'b'], fetchImpl: f as unknown as typeof fetch })
    await expect(model.reply(sys, turns)).rejects.toThrow('bad key')
    expect(chatCalls(f)).toHaveLength(1)
  })

  it('uses the models the service really offers, best first, and skips non-chat ones', async () => {
    const f = vi.fn(async (u: string) => (String(u).endsWith('/models') ? new Response(JSON.stringify({ data: [{ id: 'whisper-large-v3' }, { id: 'openai/gpt-oss-20b' }, { id: 'openai/gpt-oss-120b' }, { id: 'meta-llama/llama-prompt-guard-2-86m' }] })) : sse('hi')))
    const { model } = createOpenAi({ key: 'k', url: 'https://x/v1', models: ['retired-model'], fetchImpl: f as unknown as typeof fetch })
    await model.reply(sys, turns)
    expect(rankModels(['whisper-large-v3', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'])).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
    expect(JSON.parse((f.mock.calls.at(-1) as unknown as [string, RequestInit])[1].body as string).model).toBe('openai/gpt-oss-120b')
  })

  it('picks the preset from the environment', () => {
    expect(fromEnv({})).toBeNull()
    expect(fromEnv({ GROQ_API_KEY: 'g' } as NodeJS.ProcessEnv)).toMatchObject({ id: 'groq', url: 'https://api.groq.com/openai/v1' })
    expect(fromEnv({ CEREBRAS_API_KEY: 'c', AI_MODEL: 'x' } as NodeJS.ProcessEnv)?.models[0]).toBe('x')
  })
})
