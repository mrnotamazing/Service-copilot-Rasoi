import { describe, expect, it, vi } from 'vitest'
import { createTts, MAX_CHARS, TtsError } from './tts.ts'

const audio = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })

describe('tts proxy', () => {
  it('asks ElevenLabs with the key in a header and caches the clip', async () => {
    const f = vi.fn(async () => audio())
    const tts = createTts({ key: 'k', fetch: f as unknown as typeof fetch })
    const a = await tts.synth('Table 4 needs water')
    const b = await tts.synth('  Table 4   needs water ')
    expect(a.length).toBe(3)
    expect(b).toBe(a)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/v1/text-to-speech/')
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('k')
  })

  it('rejects empty and oversized text without calling out', async () => {
    const f = vi.fn(async () => audio())
    const tts = createTts({ key: 'k', fetch: f as unknown as typeof fetch })
    await expect(tts.synth('   ')).rejects.toMatchObject({ status: 400 })
    await expect(tts.synth('x'.repeat(MAX_CHARS + 1))).rejects.toMatchObject({ status: 413 })
    expect(f).not.toHaveBeenCalled()
  })

  it('rate limits each caller, but not cached clips', async () => {
    const f = vi.fn(async () => audio())
    const tts = createTts({ key: 'k', perMinute: 2, fetch: f as unknown as typeof fetch })
    await tts.synth('one', 'a', 0)
    await tts.synth('two', 'a', 1000)
    await expect(tts.synth('three', 'a', 2000)).rejects.toMatchObject({ status: 429 })
    await expect(tts.synth('one', 'a', 2000)).resolves.toBeTruthy()
    await expect(tts.synth('three', 'b', 2000)).resolves.toBeTruthy()
    await expect(tts.synth('three', 'a', 61_500)).resolves.toBeTruthy()
  })

  it('turns upstream failures into safe errors that never include the key', async () => {
    const bad = createTts({ key: 'secret-key', fetch: (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch })
    const err = (await bad.synth('hello').catch((e) => e)) as TtsError
    expect(err).toBeInstanceOf(TtsError)
    expect(err.status).toBe(502)
    expect(err.message).not.toContain('secret-key')
    const busy = createTts({ key: 'k', fetch: (async () => new Response('', { status: 429 })) as unknown as typeof fetch })
    await expect(busy.synth('hello')).rejects.toMatchObject({ status: 429 })
  })
})
