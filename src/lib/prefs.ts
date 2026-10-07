// Comfort & access preferences. Kept on this device (a shared iPad switches in a tap) and
// applied to <html> as data attributes so CSS can adapt type size, font, contrast and motion.

import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'hi' | 'ne' | 'bn' | 'ta' | 'es'

export interface Prefs {
  lang: Lang
  textSize: 'standard' | 'large' | 'xlarge'
  readableFont: boolean
  highContrast: boolean
  reduceMotion: boolean
  quietCelebrations: boolean
  readAloud: boolean
  speechRate: number
  haptics: boolean
  chime: boolean
  flash: boolean
  focusMode: boolean
  leftHanded: boolean
}

export const DEFAULT_PREFS: Prefs = {
  lang: 'en',
  textSize: 'standard',
  readableFont: false,
  highContrast: false,
  reduceMotion: false,
  quietCelebrations: false,
  readAloud: false,
  speechRate: 1,
  haptics: true,
  chime: false,
  flash: false,
  focusMode: false,
  leftHanded: false,
}

const KEY = 'tablemate-prefs'
let prefs: Prefs = load()
const listeners = new Set<() => void>()

function load(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function apply() {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.lang = prefs.lang
  el.dataset.text = prefs.textSize
  el.dataset.font = prefs.readableFont ? 'readable' : 'brand'
  el.dataset.contrast = prefs.highContrast ? 'high' : 'normal'
  el.dataset.motion = prefs.reduceMotion ? 'reduce' : 'full'
}
apply()

export function getPrefs(): Prefs {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage blocked: settings still apply for this visit
  }
  apply()
  for (const l of listeners) l()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}
