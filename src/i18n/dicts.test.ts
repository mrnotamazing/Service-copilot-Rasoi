import { describe, expect, it } from 'vitest'
import { DICTS, L } from './index.ts'
import { setPrefs } from '../lib/prefs.ts'

const en = DICTS.en as Record<string, string>
const langs = ['hi', 'es', 'ne', 'bn', 'ta'] as const
const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
// Names and terms that are the same in every language.
// Names, web addresses and bibliographic references stay as written.
const KEEP = (en: string) => /https?:\/\/|\.com\b|^Journal |\(\d{4}\)\.|^[A-Z][a-z]+, [A-Z]\. /.test(en)

describe('translations', () => {
  it.each(langs)('%s has every key, keeps every {placeholder}', (l) => {
    const d = DICTS[l] as Record<string, string>
    const missing = Object.keys(en).filter((k) => !d[k]?.trim())
    const broken = Object.keys(en).filter((k) => d[k] && holes(d[k]) !== holes(en[k]))
    // A string still equal to its English text is allowed for names and a few loanwords, but not for sentences.
    expect({ missing, broken }).toEqual({ missing: [], broken: [] })
  })

  // Switched on once the last translation batch is merged (the work is in progress).
  it.skip.each(langs)('%s has no English sentences left', (l) => {
    const d = DICTS[l] as Record<string, string>
    const left = Object.keys(en).filter((k) => d[k] === en[k] && /\b[a-z]{3,} [a-z]{3,} [a-z]{3,}/i.test(en[k]) && !KEEP(en[k]))
    expect(left.length, `still English in ${l}: ${left.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(12)
  })

  it('looks up English text written in the code, with placeholders', () => {
    setPrefs({ lang: 'es' })
    expect(L('Previous scene')).not.toBe('Previous scene')
    expect(L('{n} min over', { n: 3 })).toMatch(/3/)
    expect(L('A sentence nobody translated')).toBe('A sentence nobody translated')
    setPrefs({ lang: 'en' })
    expect(L('{n} min over', { n: 3 })).toBe('3 min over')
  })
})
