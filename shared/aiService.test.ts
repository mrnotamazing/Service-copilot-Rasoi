import { describe, expect, it } from 'vitest'
import { serviceOf } from './aiService.ts'

describe('serviceOf', () => {
  it('names the cloud service from a model label', () => {
    expect(serviceOf('groq: openai/gpt-oss-120b')).toBe('Groq')
    expect(serviceOf('openrouter: nvidia/nemotron-3.5-lightning:free')).toBe('OpenRouter')
  })
  it('leaves unknown or missing labels unnamed', () => {
    expect(serviceOf('gemma3:4b')).toBeUndefined()
    expect(serviceOf(undefined)).toBeUndefined()
  })
})
