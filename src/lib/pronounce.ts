// How to say tonight's dishes and guests' names out loud.
//
// English speech engines can't say "paneer tikka" or "gnocchi". The fix that actually works is
// code-switching, the way a person does: each dish word is spoken by a voice from its own
// cuisine (a Hindi voice says पनीर टिक्का, an Italian voice says gnocchi, a French voice says
// crème brûlée), with the rest of the sentence in the server's language. When the device has no
// voice for that cuisine, a respelling tuned for English voices is used instead.

import type { Lang } from './prefs.ts'
import { DISH_NAMES } from '../../shared/dishNames.ts'

/** A cuisine voice a dish word can be handed to. */
export type Origin = 'hi' | 'it' | 'fr'

export interface DishWord {
  /** Plain words, read by the server's own voice. */
  text?: string
  /** Or: a word from another cuisine, its native spelling, and a respelling for when no such voice exists. */
  origin?: Origin
  native?: string
  fallback?: string
}

/** Each menu dish broken into words and where each comes from. */
const DISH_WORDS: Record<string, DishWord[]> = {
  'Burrata & heirloom tomato': [{ origin: 'it', native: 'burrata', fallback: 'boorahta' }, { text: 'with airloom tomato' }],
  'Galouti kebab': [{ origin: 'hi', native: 'गलौटी कबाब', fallback: 'galowtee kebaab' }],
  'Wild mushroom soup': [{ text: 'wild mushroom soup' }],
  'Paneer tikka': [{ origin: 'hi', native: 'पनीर टिक्का', fallback: 'puneer tikkah' }],
  'Slow-cooked lamb shank': [{ text: 'slow cooked lamb shank' }],
  'Pan-seared sea bass': [{ text: 'pan seared sea bass' }],
  'Truffle risotto': [{ text: 'truffle' }, { origin: 'it', native: 'risotto', fallback: 'rizotto' }],
  'Dum biryani': [{ origin: 'hi', native: 'दम बिरयानी', fallback: 'dumm biryaani' }],
  'Pumpkin gnocchi': [{ text: 'pumpkin' }, { origin: 'it', native: 'gnocchi', fallback: 'nyokee' }],
  'Chocolate fondant': [{ text: 'chocolate' }, { origin: 'fr', native: 'fondant', fallback: 'fondahn' }],
  'Pistachio kulfi': [{ text: 'pistachio' }, { origin: 'hi', native: 'कुल्फ़ी', fallback: 'koolfee' }],
  'Saffron crème brûlée': [{ text: 'saffron' }, { origin: 'fr', native: 'crème brûlée', fallback: 'krem broolay' }],
}

/** Whole dish names in each Indian language and Spanish, read by that language's own voice. */
const DISH_LOCAL: Record<string, Partial<Record<Lang, string>>> = DISH_NAMES

/** Single words English voices often get wrong (dishes not on the menu, guest names). */
const WORDS_EN: Record<string, string> = {
  biryani: 'biryaani',
  paneer: 'puneer',
  tikka: 'tikkah',
  kulfi: 'koolfee',
  gnocchi: 'nyokee',
  burrata: 'boorahta',
  risotto: 'rizotto',
  bruschetta: 'broosketta',
  dal: 'daal',
  naan: 'naahn',
  masala: 'muhsaala',
  korma: 'korma',
  samosa: 'suhmosa',
  chaat: 'chaaht',
  dosa: 'dosa',
  crème: 'krem',
  brûlée: 'broolay',
  heirloom: 'airloom',
  'd’souza': 'de sooza',
  "d'souza": 'de sooza',
  iyer: 'eye yer',
  'mx.': 'mix',
  'ms.': 'miz',
  'dr.': 'doctor',
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DISH_RE = new RegExp(Object.keys(DISH_WORDS).sort((a, b) => b.length - a.length).map(escape).join('|'), 'gi')
const WORD_RE = new RegExp(`(?<![\\p{L}])(${Object.keys(WORDS_EN).map(escape).join('|')})(?![\\p{L}])`, 'giu')

const findDish = (m: string) => Object.keys(DISH_WORDS).find((k) => k.toLowerCase() === m.toLowerCase())!

/** A stretch of speech and who should say it: the server's own voice, or a cuisine voice. */
export interface Part {
  text: string
  voice: Lang | Origin
  /** What the server's own voice says instead when the cuisine voice is missing. */
  fallback?: string
}

/**
 * Split text into parts for the right voices. `plain` makes the server-language parts speakable
 * (table numbers, minutes and so on); it is never applied to dish words.
 */
export function pronounceParts(text: string, lang: Lang, plain: (s: string) => string): Part[] {
  const parts: Part[] = []
  const say = (s: string) => {
    let out = plain(s)
    if (lang === 'en') out = out.replace(WORD_RE, (m) => WORDS_EN[m.toLowerCase()] ?? m)
    if (out.trim()) parts.push({ text: out, voice: lang })
  }
  let last = 0
  for (const m of text.matchAll(DISH_RE)) {
    say(text.slice(last, m.index))
    last = m.index! + m[0].length
    const dish = findDish(m[0])
    const local = DISH_LOCAL[dish][lang]
    if (lang !== 'en' && local) {
      parts.push({ text: local, voice: lang })
      continue
    }
    for (const w of DISH_WORDS[dish]) parts.push(w.origin ? { text: w.native!, voice: w.origin, fallback: w.fallback } : { text: w.text!, voice: lang })
  }
  say(text.slice(last))
  return parts
}

/** One-voice version: every dish word as its respelling (used when no cuisine voices exist, and in tests). */
export function pronounce(text: string, lang: Lang, plain: (s: string) => string = (s) => s): string {
  return pronounceParts(text, lang, plain)
    .map((p) => (p.voice === lang ? p.text : (p.fallback ?? p.text)))
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const MENU_FOR_TEST = Object.keys(DISH_WORDS)
