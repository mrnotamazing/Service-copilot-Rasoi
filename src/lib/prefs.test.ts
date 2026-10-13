import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, sanitizePrefs } from './prefs.ts'

describe('saved settings', () => {
  it('keeps valid values and drops the rest', () => {
    expect(sanitizePrefs({ lang: 'hi', textSize: 'large', readAloud: true, speechRate: 1.2, extra: 'x' })).toMatchObject({ lang: 'hi', textSize: 'large', readAloud: true, speechRate: 1.2 })
  })
  it('falls back to defaults for anything unusable, so a stale save never blocks the app', () => {
    expect(sanitizePrefs({ lang: 'klingon', textSize: 'huge', chime: 'yes', speechRate: 'fast', voices: [] })).toEqual({ ...DEFAULT_PREFS })
    expect(sanitizePrefs(null)).toEqual({ ...DEFAULT_PREFS })
    expect(sanitizePrefs('nope')).toEqual({ ...DEFAULT_PREFS })
  })
})
