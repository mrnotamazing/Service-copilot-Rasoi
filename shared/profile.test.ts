import { describe, expect, it } from 'vitest'
import { cleanProfile } from './profile.ts'

describe('profile edits', () => {
  it('keeps valid fields and trims text', () => {
    expect(cleanProfile({ name: '  Aisha K  ', color: '#2d6fb5', avatar: 'icon:chef', languages: ['hi', 'ta', 'hi', 'xx'], pronouns: ' she/her ' })).toEqual({
      name: 'Aisha K',
      color: '#2d6fb5',
      avatar: 'icon:chef',
      languages: ['hi', 'ta'],
      pronouns: 'she/her',
    })
  })

  it('rejects anything that is not a small image or a known illustration', () => {
    expect(cleanProfile({ avatar: 'https://evil.example/x.png' })).toMatch(/couldn’t be used/)
    expect(cleanProfile({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' })).toMatch(/couldn’t be used/)
    expect(cleanProfile({ avatar: `data:image/jpeg;base64,${'A'.repeat(70_000)}` })).toMatch(/couldn’t be used/)
    expect(cleanProfile({ avatar: 'data:image/jpeg;base64,/9j/4AAQ' })).toEqual({ avatar: 'data:image/jpeg;base64,/9j/4AAQ' })
    expect(cleanProfile({ color: 'red' })).toMatch(/colours/)
    expect(cleanProfile({ name: '   ' })).toMatch(/empty/)
  })
})
