// Read aloud. When the server has a natural voice set up (ElevenLabs), that reads; otherwise, and
// whenever it can't, the device's own speech engine does (no audio leaves the device).
// Text is first made "speakable" (T3 becomes "Table 3", 2× becomes "2", dish names get the
// pronunciation guide), then read sentence by sentence with the most natural voice available.

import { LANGUAGES, translate } from '../i18n/index.ts'
import { getPrefs, type Lang } from './prefs.ts'
import { pronounce, pronounceParts, type Origin, type Part } from './pronounce.ts'

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

export const canSpeak = () => synth() !== null

const ORIGIN_CODE: Record<Origin, string> = { hi: 'hi-IN', it: 'it-IT', fr: 'fr-FR' }
const speechCode = (lang: Lang | Origin) => LANGUAGES.find((l) => l.id === lang)?.speech ?? ORIGIN_CODE[lang as Origin] ?? 'en-IN'

/** Voices that sound human: neural/online/premium voices first, then the device's default. */
const NATURAL = /natural|neural|online|premium|enhanced|wavenet|siri|google/i

/** Voices for a language, best first. English prefers an Indian English voice: it says Indian dishes and names best. */
export function voicesFor(lang: Lang | Origin): SpeechSynthesisVoice[] {
  const s = synth()
  if (!s) return []
  const code = speechCode(lang)
  const base = code.split('-')[0]
  const score = (v: SpeechSynthesisVoice) => {
    const vl = v.lang.replace('_', '-')
    return (vl === code ? 4 : 0) + (NATURAL.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1) + (v.default ? 0.5 : 0)
  }
  return s
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
    .sort((a, b) => score(b) - score(a))
}

function voiceFor(lang: Lang | Origin): SpeechSynthesisVoice | null {
  const chosen = getPrefs().voices?.[lang as Lang]
  const list = voicesFor(lang)
  return list.find((v) => v.voiceURI === chosen) ?? list[0] ?? null
}

/** True when this device can read the language in its own voice (voices load lazily on some browsers). */
export function hasVoice(lang: Lang) {
  return voiceFor(lang) !== null
}

/** Which cuisine voices this device has, for the settings panel. */
export function cuisineVoices(): Record<Origin, boolean> {
  return { hi: !!voiceFor('hi'), it: !!voiceFor('it'), fr: !!voiceFor('fr') }
}

/** Turn screen text into something that sounds natural when read by one voice (dish words respelled). */
export function speakable(text: string, lang: Lang): string {
  return pronounce(text, lang, (s) => plainSpeakable(s, lang))
}

/** Table numbers, quantities, minutes and symbols, said the way a person would. */
function plainSpeakable(text: string, lang: Lang): string {
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params)
  return (
    text
      // Table names: "T3" -> "Table 3"
      .replace(/\bT(\d{1,3})\b/g, (_, n: string) => t('speech.table', { n }))
      // Quantities: "2× Galouti kebab" -> "2 Galouti kebab"
      .replace(/(\d+)\s*[×x]\s+/g, '$1 ')
      // "5 min" -> "5 minutes", "~6 min" -> "about 6 minutes"
      .replace(/~\s*(\d+)/g, (_, n: string) => `${t('speech.about')} ${n}`)
      .replace(/(\d+)\s*min\b\.?/g, (_, n: string) => `${n} ${t(n === '1' ? 'speech.minute' : 'speech.minutes')}`)
      .replace(/\s*&\s*/g, ` ${t('speech.and')} `)
      // Separators read as pauses, not symbols.
      .replace(/\s*[·•|]\s*/g, ', ')
      .replace(/\s*\/\s*/g, ` ${t('speech.or')} `)
      // Shouty labels like "ALLERGY" read as words, emoji are skipped.
      .replace(/\b([A-Z]{3,})\b/g, (w) => w[0] + w.slice(1).toLowerCase())
      .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
      .replace(/\s{2,}/g, ' ')
  )
}

/** Parts with a voice that exists on this device; missing cuisine voices fall back to respellings. Neighbours that share a voice are joined. */
function resolve(parts: Part[], lang: Lang): { text: string; voice: Lang | Origin }[] {
  const out: { text: string; voice: Lang | Origin }[] = []
  for (const p of parts) {
    const usable = p.voice === lang || !!voiceFor(p.voice)
    const piece = usable ? p : { text: p.fallback ?? p.text, voice: lang }
    const prev = out.at(-1)
    if (prev && prev.voice === piece.voice) prev.text = `${prev.text} ${piece.text}`
    else out.push({ text: piece.text, voice: piece.voice })
  }
  return out.map((p) => ({ ...p, text: p.text.replace(/\s+([,.;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim() })).filter((p) => p.text)
}

/** Split into sentences so the voice pauses where a person would. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।;:])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// The natural voice. Languages the multilingual model reads well; others use the device voice.

const CLOUD_LANGS = new Set<Lang>(['en', 'es', 'hi', 'ta'])
let cloudReady: Promise<boolean> | null = null
let player: HTMLAudioElement | null = null
let playing = 0

/** True once the server has said it has a natural voice. Asked once; a missing server means the device voice. */
export function cloudVoiceAvailable(): Promise<boolean> {
  cloudReady ??= (async () => {
    try {
      const r = await fetch('/api/tts/status', { signal: AbortSignal.timeout(4000) })
      return r.ok && !!((await r.json()) as { enabled?: boolean }).enabled
    } catch {
      return false
    }
  })()
  return cloudReady
}

/** Plain words for the natural voice: it says dish names itself, so no respelling. */
function cloudText(text: string, lang: Lang) {
  return plainSpeakable(text, lang).replace(/\s+([,.;:!?])/g, '$1').trim()
}

async function speakCloud(text: string, lang: Lang, ticket: number): Promise<boolean> {
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: cloudText(text, lang).slice(0, 600) }), signal: AbortSignal.timeout(20000) })
    if (!r.ok) return false
    const url = URL.createObjectURL(await r.blob())
    if (ticket !== playing) return true // something newer started or it was stopped: drop this clip
    player?.pause()
    const a = new Audio(url)
    player = a
    a.playbackRate = Math.min(1.5, Math.max(0.7, getPrefs().speechRate))
    a.onended = a.onerror = () => URL.revokeObjectURL(url)
    await a.play()
    return true
  } catch {
    return false
  }
}

export function speak(text: string, opts: { lang?: Lang; interrupt?: boolean } = {}) {
  const s = synth()
  if (!text.trim()) return
  const want = opts.lang ?? getPrefs().lang
  if (CLOUD_LANGS.has(want) && typeof Audio !== 'undefined') {
    const ticket = ++playing
    s?.cancel()
    void cloudVoiceAvailable().then(async (ok) => {
      if (ticket !== playing) return
      if (ok && (await speakCloud(text, want, ticket))) return
      if (ticket === playing) speakDevice(text, opts)
    })
    return
  }
  speakDevice(text, opts)
}

function speakDevice(text: string, opts: { lang?: Lang; interrupt?: boolean } = {}) {
  const s = synth()
  if (!s || !text.trim()) return
  let lang = opts.lang ?? getPrefs().lang
  // No voice for this language on the device: English is better than silence.
  if (lang !== 'en' && !voiceFor(lang)) lang = 'en'
  if (opts.interrupt !== false) s.cancel()
  const rate = getPrefs().speechRate
  const target = lang
  // Dish words go to a voice from their own cuisine; everything else to the server's voice.
  for (const chunk of resolve(pronounceParts(text, target, (x) => plainSpeakable(x, target)), target)) {
    const voice = voiceFor(chunk.voice)
    const pieces = chunk.voice === target ? sentences(chunk.text) : [chunk.text]
    for (const piece of pieces) {
      const u = new SpeechSynthesisUtterance(piece)
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? speechCode(chunk.voice)
      // A touch slower than default and a natural pitch: clearer over restaurant noise.
      u.rate = rate * 0.95
      u.pitch = 1
      s.speak(u)
    }
  }
}

/**
 * Read a card: its title, then the details. When the device has no voice for the chosen
 * language, the English wording is read instead of letters the voice can't pronounce.
 */
export function speakTask(title: string, hint: string, english?: { title: string; hint: string }) {
  const lang = getPrefs().lang
  const useEnglish = lang !== 'en' && !voiceFor(lang) && english
  const t = useEnglish ? english : { title, hint }
  speak(`${t.title.replace(/[.:]?$/, '.')} ${t.hint}`, { lang: useEnglish ? 'en' : lang })
}

export function stopSpeaking() {
  playing++
  player?.pause()
  synth()?.cancel()
}
