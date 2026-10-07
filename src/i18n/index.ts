import type { TaskText } from '../../shared/types.ts'
import { usePrefs, type Lang } from '../lib/prefs.ts'
import { bn } from './bn.ts'
import { en, type Key } from './en.ts'
import { es } from './es.ts'
import { hi } from './hi.ts'
import { ne } from './ne.ts'
import { ta } from './ta.ts'

export type { Key }
export type Dict = Record<Key, string>

export const DICTS: Record<Lang, Dict> = { en, hi, ne, bn, ta, es }

/** Shown in each language's own name, so people can find theirs whatever is selected. */
export const LANGUAGES: { id: Lang; native: string; english: string; speech: string; short: string }[] = [
  { id: 'en', native: 'English', english: 'English', speech: 'en-IN', short: 'EN' },
  { id: 'hi', native: 'हिन्दी', english: 'Hindi', speech: 'hi-IN', short: 'हि' },
  { id: 'ne', native: 'नेपाली', english: 'Nepali', speech: 'ne-NP', short: 'ने' },
  { id: 'bn', native: 'বাংলা', english: 'Bengali', speech: 'bn-IN', short: 'বা' },
  { id: 'ta', native: 'தமிழ்', english: 'Tamil', speech: 'ta-IN', short: 'த' },
  { id: 'es', native: 'Español', english: 'Spanish', speech: 'es-ES', short: 'ES' },
]

export type Params = Record<string, string | number>

/** Look up a key (falls back to English, then the key itself) and fill {placeholders}. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const dict = DICTS[lang] as Record<string, string>
  const template = dict[key] ?? (en as Record<string, string>)[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name]
    if (v === undefined) return `{${name}}`
    // A value starting with "@" is a key itself, e.g. "@course.main".
    return typeof v === 'string' && v.startsWith('@') ? translate(lang, v.slice(1)) : String(v)
  })
}

export function renderText(lang: Lang, text: TaskText): string {
  if ('raw' in text) return text.raw
  if ('parts' in text) return text.parts.map((p) => renderText(lang, p)).filter(Boolean).join(text.sep ?? ' · ')
  return translate(lang, text.k, text.p)
}

/** Translation hook: re-renders when the language changes. */
export function useT() {
  const { lang } = usePrefs()
  const t = (key: Key, params?: Params) => translate(lang, key, params)
  return Object.assign(t, { lang, text: (x: TaskText) => renderText(lang, x), any: (key: string, params?: Params) => translate(lang, key, params) })
}
