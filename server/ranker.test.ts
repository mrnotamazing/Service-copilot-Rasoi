import { describe, expect, it } from 'vitest'
import { createRanker } from './ranker.ts'

describe('AI ranker', () => {
  it('sends quick jobs to the fast good model and careful jobs to the best one', () => {
    const r = createRanker()
    const ids = ['claude', 'gemini', 'groq', 'ollama']
    expect(r.order(ids, 'quick')[0]).toBe('groq') // fast and good
    expect(r.order(ids, 'deep')[0]).toBe('claude') // the most careful
    expect(r.order(ids, 'quick').at(-1)).toBe('ollama') // slow and weakest: last resort before the built-in
    expect(r.order(ids, 'deep').at(-1)).toBe('ollama')
  })

  it('learns the real speed of a model while running', () => {
    const r = createRanker()
    for (let i = 0; i < 6; i++) r.ok('groq', 9000) // groq is having a slow day
    for (let i = 0; i < 6; i++) r.ok('gemini', 500)
    expect(r.order(['groq', 'gemini'], 'quick')[0]).toBe('gemini')
  })

  it('rests a model that failed, then brings it back', () => {
    let t = 0
    const r = createRanker({ now: () => t })
    r.fail('groq')
    expect(r.order(['groq', 'gemini', 'claude'], 'quick')[0]).not.toBe('groq')
    expect(r.order(['groq', 'gemini'], 'quick').at(-1)).toBe('groq')
    t = 31_000
    expect(r.order(['groq', 'gemini'], 'quick')[0]).toBe('groq')
    r.fail('groq')
    r.fail('groq')
    t += 119_000
    expect(r.order(['groq', 'gemini'], 'quick')[0]).toBe('gemini')
    r.ok('groq', 600)
    expect(r.order(['groq', 'gemini'], 'quick')[0]).toBe('groq')
  })

  it('keeps a pinned order but still rests failing models', () => {
    const r = createRanker({ fixed: true })
    expect(r.order(['claude', 'gemini', 'groq'], 'quick')).toEqual(['claude', 'gemini', 'groq'])
    r.fail('claude')
    expect(r.order(['claude', 'gemini', 'groq'], 'quick')).toEqual(['gemini', 'groq', 'claude'])
  })
})
