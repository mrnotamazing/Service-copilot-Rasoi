// Read aloud with the device's own speech engine (no audio leaves the device).
// Picks a voice for the chosen language and falls back to English when the device has none.

import { LANGUAGES } from '../i18n/index.ts'
import { getPrefs, type Lang } from './prefs.ts'

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

export const canSpeak = () => synth() !== null

function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  const s = synth()
  if (!s) return null
  const code = LANGUAGES.find((l) => l.id === lang)?.speech ?? 'en-IN'
  const voices = s.getVoices()
  const base = code.split('-')[0]
  return voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.replace('_', '-').startsWith(base)) ?? null
}

/** True when this device can read the language in its own voice (voices load lazily on some browsers). */
export function hasVoice(lang: Lang) {
  return voiceFor(lang) !== null
}

export function speak(text: string, opts: { lang?: Lang; interrupt?: boolean } = {}) {
  const s = synth()
  if (!s || !text.trim()) return
  const lang = opts.lang ?? getPrefs().lang
  if (opts.interrupt !== false) s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voice = voiceFor(lang) ?? voiceFor('en')
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  } else {
    u.lang = LANGUAGES.find((l) => l.id === lang)?.speech ?? 'en-IN'
  }
  u.rate = getPrefs().speechRate
  s.speak(u)
}

export function stopSpeaking() {
  synth()?.cancel()
}
