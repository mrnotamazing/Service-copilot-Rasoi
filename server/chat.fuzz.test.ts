import { describe, expect, it } from 'vitest'
import { scenariosFor } from '../shared/practice.ts'
import { createAi, type ChatModel, type ChatTurn } from './ai.ts'
import { Hub, memoryStore } from './hub.ts'

// Every kind of conversation must get a real answer: several questions in a row, every role-play
// to the end, in every language, with and without an AI model (including one that answers badly).
const LANGS = ['en', 'hi', 'ne', 'bn', 'ta', 'es']
const QUESTIONS = ['Explain Jain food', 'what dishes are jain on menu', 'Which dishes are vegan?', 'What’s in the galouti kebab?', 'How do I handle a complaint?', 'Brief me on my section', 'asdf qwerty', '?']
const REPLIES = ['I’m so sorry, let me fix it right away, about 10 minutes.', 'ok', 'It’s the kitchen’s fault.', 'मुझे खेद है, अभी ठीक करूँ।', 'Are you okay? Let’s talk in private after service.']

const models: Record<string, ChatModel | undefined> = {
  none: undefined,
  good: { name: 'claude', reply: async () => 'COACH: ✓ Good → Add a time\nSCORE: 70\nIDEAL: Sorry, 10 minutes.\nGUEST: Okay, how long?' },
  plain: { name: 'ollama', compact: true, checkFacts: true, reply: async () => 'Here is a plain answer.' },
  messy: { name: 'ollama', compact: true, reply: async () => '<what worked>\n\n' },
  failing: { name: 'claude', reply: async () => Promise.reject(new Error('boom')) },
}

describe('the chat always answers', () => {
  for (const [label, chat] of Object.entries(models)) {
    it(`answers a run of questions (${label} model)`, async () => {
      const ai = createAi(new Hub(memoryStore()), { chat })
      for (const staffId of ['s_aisha', 'm_floor'])
        for (const lang of LANGS) {
          const turns: ChatTurn[] = []
          for (const q of QUESTIONS) {
            turns.push({ role: 'user', text: q })
            const a = await ai.ask({ kind: 'chat', mode: 'ask', staffId, lang, messages: [...turns] })
            expect(a.text.trim(), `${label} ${staffId} ${lang} "${q}"`).not.toBe('')
            turns.push({ role: 'assistant', text: a.text })
          }
        }
    })

    it(`plays every role-play to the end (${label} model)`, async () => {
      const ai = createAi(new Hub(memoryStore()), { chat })
      for (const [staffId, role] of [['s_aisha', 'server'], ['m_floor', 'manager']] as const)
        for (const sc of scenariosFor(role))
          for (const lang of LANGS) {
            const turns: ChatTurn[] = []
            let a = await ai.ask({ kind: 'chat', mode: 'practice', scenario: sc.id, staffId, lang, messages: [] })
            expect(a.text.trim()).not.toBe('')
            turns.push({ role: 'assistant', text: a.text })
            for (const r of REPLIES) {
              turns.push({ role: 'user', text: r })
              a = await ai.ask({ kind: 'chat', mode: 'practice', scenario: sc.id, staffId, lang, messages: [...turns] })
              expect(a.text.trim(), `${label} ${sc.id} ${lang} "${r}"`).not.toBe('')
              expect(a.score).toBeGreaterThanOrEqual(0)
              turns.at(-1)!.score = a.score
              turns.push({ role: 'assistant', text: a.text })
              if (a.done) break
            }
            const d = await ai.ask({ kind: 'chat', mode: 'practice', scenario: sc.id, staffId, lang, finish: true, messages: [...turns] })
            expect(d.text.trim()).not.toBe('')
          }
    })
  }
})

describe('diet and allergy lists', () => {
  it('answers “what dishes are Jain on the menu” from the ingredient tags, with or without AI', async () => {
    const without = await createAi(new Hub(memoryStore())).ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'Explain Jain food' }, { role: 'assistant', text: 'x' }, { role: 'user', text: 'what dishes are jain on menu' }] })
    expect(without.text).toMatch(/Suitable as listed: Burrata & heirloom tomato, Pistachio kulfi/)
    expect(without.text).toMatch(/Galouti kebab \(meat, onion, garlic or root veg\)/)
    let live = ''
    const chat: ChatModel = { name: 'ollama', compact: true, checkFacts: true, reply: async (system) => ((live = system.live), 'The burrata and the kulfi.') }
    const withAi = await createAi(new Hub(memoryStore()), { chat }).ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'जैन मेहमान के लिए कौन सी डिश हैं?' }] })
    expect(live).toMatch(/Checked from the menu’s ingredient tags/)
    expect(withAi.text).toMatch(/^The burrata and the kulfi\.\n\nFrom the menu: For a guest who is Jain/)
  })

  it('handles allergies and leaves “explain” questions to the training notes', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const nut = await ai.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'what can a guest with a nut allergy eat?' }] })
    expect(nut.text).toMatch(/with a nut allergy/)
    expect(nut.text).toMatch(/Not as listed: Galouti kebab \(nuts\), Dum biryani \(nuts\), Pistachio kulfi \(nuts\)/)
    const explain = await ai.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'Explain Jain food' }] })
    expect(explain.text).toMatch(/Jain diners avoid/)
  })
})
