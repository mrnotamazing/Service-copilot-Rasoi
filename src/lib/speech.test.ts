import { describe, expect, it } from 'vitest'
import { speakable } from './speech.ts'

describe('speakable text', () => {
  it('reads tables, quantities, minutes and dishes the way a person would say them', () => {
    expect(speakable('Pick up T3 starters from the pass. 2× Galouti kebab, 1× Paneer tikka', 'en')).toBe(
      'Pick up Table 3 starters from the pass. 2 ga-low-tee kebaab, 1 puh-neer tick-ah',
    )
    expect(speakable('Ready in about 1 min · ~6 min', 'en')).toBe('Ready in about 1 minute, about 6 minutes')
    expect(speakable('SAFETY T4: Burrata & heirloom tomato 😊', 'en')).toBe('Safety Table 4: boo-rah-ta with air-loom tomato')
  })

  it('uses the dish’s own script for Indian-language voices', () => {
    expect(speakable('T2 के मेन कोर्स: 1× Dum biryani', 'hi')).toBe('टेबल 2 के मेन कोर्स: 1 दम बिरयानी')
    expect(speakable('Mesa lista: Pumpkin gnocchi & Pistachio kulfi', 'es')).toBe('Mesa lista: ñoquis de calabaza y kulfi de pistacho')
  })
})
