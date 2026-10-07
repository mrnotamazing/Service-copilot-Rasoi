import { describe, expect, it } from 'vitest'
import { pronounceParts } from './pronounce.ts'
import { speakable } from './speech.ts'

describe('speakable text', () => {
  it('reads tables, quantities and minutes the way a person would, with dish respellings as the fallback', () => {
    expect(speakable('Pick up T3 starters from the pass. 2× Galouti kebab, 1× Paneer tikka', 'en')).toBe('Pick up Table 3 starters from the pass. 2 galowtee kebaab, 1 puneer tikkah')
    expect(speakable('Ready in about 1 min · ~6 min', 'en')).toBe('Ready in about 1 minute, about 6 minutes')
    expect(speakable('SAFETY T4: Burrata & heirloom tomato 😊', 'en')).toBe('Safety Table 4: boorahta with airloom tomato')
  })

  it('uses the dish’s own script for Indian-language voices and local names in Spanish', () => {
    expect(speakable('T2 के मेन कोर्स: 1× Dum biryani', 'hi')).toBe('टेबल 2 के मेन कोर्स: 1 दम बिरयानी')
    expect(speakable('Mesa lista: Pumpkin gnocchi & Pistachio kulfi', 'es')).toBe('Mesa lista: ñoquis de calabaza y kulfi de pistacho')
  })

  it('hands each dish word to a voice from its own cuisine', () => {
    const parts = pronounceParts('2 Paneer tikka and Pumpkin gnocchi then Saffron crème brûlée', 'en', (s) => s)
    expect(parts.map((p) => [p.voice, p.text.trim()])).toEqual([
      ['en', '2'],
      ['hi', 'पनीर टिक्का'],
      ['en', 'and'],
      ['en', 'pumpkin'],
      ['it', 'gnocchi'],
      ['en', 'then'],
      ['en', 'saffron'],
      ['fr', 'crème brûlée'],
    ])
  })
})
