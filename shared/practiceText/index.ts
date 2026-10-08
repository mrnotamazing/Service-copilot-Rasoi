import { bn } from './bn.ts'
import { en } from './en.ts'
import { es } from './es.ts'
import { hi } from './hi.ts'
import { ne } from './ne.ts'
import { ta } from './ta.ts'
import type { PracticeLang, PracticeText } from './types.ts'

export type { PracticeLang, PracticeText, ScenarioText } from './types.ts'

export const PRACTICE_TEXT: Record<PracticeLang, PracticeText> = { en, hi, ne, bn, ta, es }

/** The practice text in this language (English if the language isn't covered). */
export function practiceText(lang?: string): PracticeText {
  return PRACTICE_TEXT[(lang ?? 'en') as PracticeLang] ?? en
}
