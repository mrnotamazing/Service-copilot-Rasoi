import { describe, expect, it } from 'vitest'
import { deriveTasks, applyEvent, initialState } from '../../shared/engine.ts'
import { DEMO_CONFIG } from '../../shared/config.ts'
import { BADGES, QUESTS, LEVELS } from '../../shared/game.ts'
import { DICTS, renderText, translate } from './index.ts'
import { en } from './en.ts'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang} has every key, nothing extra, and the same placeholders`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort())
      for (const [key, value] of Object.entries(en)) {
        expect(value.trim().length, `${lang}:${key} empty`).toBeGreaterThan(0)
        expect(placeholders((dict as Record<string, string>)[key]), `${lang}:${key}`).toEqual(placeholders(value))
      }
    })
  }

  it('covers every badge, quest and rank the game can award', () => {
    for (const b of BADGES) expect(en).toHaveProperty([`badge.${b.id}.t`])
    for (const q of QUESTS) expect(en).toHaveProperty([`quest.${q.id}`])
    LEVELS.forEach((_, i) => expect(en).toHaveProperty([`rank.${i}`]))
  })

  it('renders engine task text in English exactly as the engine wrote it, and in other languages', () => {
    const s = initialState(DEMO_CONFIG)
    applyEvent(s, { id: 'e1', type: 'table.seated', source: 'sim', at: 0, payload: { tableId: 'T1', partySize: 2, guestName: 'Ms. Iyer', needs: ['wheelchair'] } }, DEMO_CONFIG)
    applyEvent(s, { id: 'e2', type: 'order.fired', source: 'sim', at: 60_000, payload: { tableId: 'T1', ticketId: 'k', lines: [{ id: 'l', menuItemId: 'm_lamb', qty: 1 }] } }, DEMO_CONFIG)
    const late = deriveTasks(s, DEMO_CONFIG, 60_000 * 25).find((t) => t.kind === 'kitchen_delay')!
    expect(renderText('en', late.text!.title)).toBe(late.title)
    expect(renderText('hi', late.text!.title)).toBe('T1 के मेन कोर्स 10 मिनट देर से')
    expect(renderText('es', late.text!.title)).toBe('principales de T1 con 10 min de retraso')
  })

  it('falls back to English, then to the key', () => {
    expect(translate('ta', 'no.such.key')).toBe('no.such.key')
    expect(translate('hi', 't.greet', { table: 'T4' })).toBe('T4 का स्वागत करें')
  })
})
