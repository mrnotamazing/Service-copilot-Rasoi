import { describe, expect, it } from 'vitest'
import { createRanker } from './ranker.ts'

describe('AI ranker', () => {
  it('keeps the fixed order until something says otherwise', () => {
    expect(createRanker().order(['claude', 'gemini', 'cloud'])).toEqual(['claude', 'gemini', 'cloud'])
  })

  it('rests a model that failed, then brings it back', () => {
    let t = 0
    const r = createRanker({ now: () => t })
    r.fail('gemini')
    expect(r.order(['claude', 'gemini', 'cloud'])).toEqual(['claude', 'cloud', 'gemini'])
    t = 31_000
    expect(r.order(['claude', 'gemini', 'cloud'])).toEqual(['claude', 'gemini', 'cloud'])
    r.fail('gemini')
    r.fail('gemini') // third failure in a row: rests 10 minutes
    t += 119_000
    expect(r.order(['gemini', 'cloud'])).toEqual(['cloud', 'gemini'])
    r.ok('gemini', 800)
    expect(r.order(['gemini', 'cloud'])).toEqual(['gemini', 'cloud'])
  })
})
