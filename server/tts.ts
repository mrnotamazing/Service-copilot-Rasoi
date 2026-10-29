// Natural voice for read-aloud, through ElevenLabs. The key stays on the server: the browser only
// ever asks this endpoint for audio. Clips are cached (the same card read twice costs nothing),
// callers are rate limited, and any failure tells the app to fall back to the device's own voice.

export interface TtsConfig {
  key: string
  voiceId?: string
  model?: string
  fetch?: typeof fetch
  /** Requests allowed per caller per minute. */
  perMinute?: number
  /** Cached clips kept in memory. */
  cacheSize?: number
}

export class TtsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export const MAX_CHARS = 600
// George: a warm, clear storyteller. Any voice id from the ElevenLabs library works.
export const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'
export const DEFAULT_MODEL = 'eleven_multilingual_v2'

export function createTts(cfg: TtsConfig) {
  const doFetch = cfg.fetch ?? fetch
  const voice = cfg.voiceId || DEFAULT_VOICE
  const model = cfg.model || DEFAULT_MODEL
  const limit = cfg.perMinute ?? 30
  const cacheMax = cfg.cacheSize ?? 200
  const cache = new Map<string, Buffer>()
  const hits = new Map<string, number[]>()

  function allow(caller: string, now: number) {
    const recent = (hits.get(caller) ?? []).filter((t) => now - t < 60_000)
    if (recent.length >= limit) {
      hits.set(caller, recent)
      return false
    }
    recent.push(now)
    hits.set(caller, recent)
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k)
    return true
  }

  return {
    enabled: true as const,
    voice,
    model,
    async synth(text: string, caller = 'anon', now = Date.now()): Promise<Buffer> {
      const clean = text.replace(/\s+/g, ' ').trim()
      if (!clean) throw new TtsError('Nothing to read', 400)
      if (clean.length > MAX_CHARS) throw new TtsError(`Text is too long (max ${MAX_CHARS} characters)`, 413)
      const id = `${voice}|${model}|${clean}`
      const cached = cache.get(id)
      if (cached) {
        cache.delete(id)
        cache.set(id, cached)
        return cached
      }
      if (!allow(caller, now)) throw new TtsError('Too many voice requests. Try again in a minute.', 429)
      const res = await doFetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': cfg.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: clean, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new TtsError(res.status === 401 || res.status === 403 ? 'The voice key was rejected' : res.status === 429 ? 'The voice service is busy' : 'The voice service failed', res.status === 429 ? 429 : 502)
      const audio = Buffer.from(await res.arrayBuffer())
      if (!audio.length) throw new TtsError('The voice service returned no audio', 502)
      cache.set(id, audio)
      if (cache.size > cacheMax) cache.delete(cache.keys().next().value!)
      return audio
    },
  }
}

export type Tts = ReturnType<typeof createTts>
