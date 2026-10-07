// Read aloud with the device's own speech engine (no audio leaves the device).
// Text is first made "speakable" (T3 becomes "Table 3", 2× becomes "2", dish names get the
// pronunciation guide), then read sentence by sentence with the most natural voice available.

import { LANGUAGES, translate } from '../i18n/index.ts'
import { getPrefs, type Lang } from './prefs.ts'
import { pronounce } from './pronounce.ts'

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

export const canSpeak = () => synth() !== null

const speechCode = (lang: Lang) => LANGUAGES.find((l) => l.id === lang)?.speech ?? 'en-IN'

/** Voices that sound human: neural/online/premium voices first, then the device's default. */
const NATURAL = /natural|neural|online|premium|enhanced|wavenet|siri|google/i

/** Voices for a language, best first. English prefers an Indian English voice: it says Indian dishes and names best. */
export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
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

function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  const chosen = getPrefs().voices?.[lang]
  const list = voicesFor(lang)
  return list.find((v) => v.voiceURI === chosen) ?? list[0] ?? null
}

/** True when this device can read the language in its own voice (voices load lazily on some browsers). */
export function hasVoice(lang: Lang) {
  return voiceFor(lang) !== null
}

/** Turn screen text into something that sounds natural when read out. */
export function speakable(text: string, lang: Lang): string {
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params)
  return (
    pronounce(text, lang)
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
      .trim()
  )
}

/** Split into sentences so the voice pauses where a person would. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।;:])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function speak(text: string, opts: { lang?: Lang; interrupt?: boolean } = {}) {
  const s = synth()
  if (!s || !text.trim()) return
  let lang = opts.lang ?? getPrefs().lang
  // No voice for this language on the device: English is better than silence.
  if (lang !== 'en' && !voiceFor(lang)) lang = 'en'
  if (opts.interrupt !== false) s.cancel()
  const voice = voiceFor(lang)
  const rate = getPrefs().speechRate
  for (const part of sentences(speakable(text, lang))) {
    const u = new SpeechSynthesisUtterance(part)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? speechCode(lang)
    // A touch slower than default and a natural pitch: clearer over restaurant noise.
    u.rate = rate * 0.95
    u.pitch = 1
    s.speak(u)
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
  synth()?.cancel()
}
