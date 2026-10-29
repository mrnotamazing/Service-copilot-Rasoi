import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from '../shared/config.ts'
import { answerAboutDish } from '../shared/menuAnswer.ts'
import { createApi } from './api.ts'
import { Hub, memoryStore } from './hub.ts'
import { Simulator } from './simulator.ts'

const dish = (id: string) => DEMO_CONFIG.menu.find((m) => m.id === id)!
const MIN = 60_000

describe('dish questions answered from the menu notes', () => {
  it('answers spice, ingredients, changes and descriptions it knows', () => {
    expect(answerAboutDish('Is the galouti kebab spicy?', dish('m_galouti'))).toMatchObject({ known: true, text: expect.stringMatching(/medium spicy.*milder/) })
    expect(answerAboutDish('Does the galouti kebab have nuts?', dish('m_galouti')).text).toMatch(/contains nuts/)
    expect(answerAboutDish('Any egg in the burrata?', dish('m_burrata')).text).toMatch(/no egg in its ingredient list/)
    expect(answerAboutDish('Can the paneer tikka be made less spicy?', dish('m_tikka')).text).toMatch(/Can be made mild/)
    expect(answerAboutDish('kya galouti kebab तीखा है?', dish('m_galouti')).known).toBe(true)
    expect(answerAboutDish('Is the gnocchi vegan?', dish('m_gnocchi')).text).toMatch(/isn’t vegan.*dairy, egg/)
    expect(answerAboutDish('Is the burrata vegetarian?', dish('m_burrata')).text).toMatch(/nothing in its ingredient list/)
  })

  it('says so, instead of guessing, when the notes don’t cover it', () => {
    const a = answerAboutDish('Is the risotto good for kids?', dish('m_risotto'))
    expect(a.known).toBe(false)
    expect(a.text).toMatch(/Ask the kitchen/)
    expect(answerAboutDish('Can the risotto be made vegan?', dish('m_risotto')).known).toBe(false)
    expect(answerAboutDish('Is it spicy?', { ...dish('m_risotto'), spice: undefined }).known).toBe(false)
  })

  it('uses an earlier kitchen answer to the same question', () => {
    const d = { ...dish('m_risotto'), facts: [{ q: 'Is the risotto good for kids?', a: 'Yes, it’s mild and creamy; we can do a half portion.', at: 1 }] }
    expect(answerAboutDish('is the truffle risotto ok for kids', d)).toMatchObject({ known: true, text: expect.stringMatching(/half portion/) })
  })
})

describe('asking the kitchen', () => {
  function setup() {
    const hub = new Hub(memoryStore())
    const sim = new Simulator(hub)
    const api = createApi(hub, sim)
    const post = (path: string, body: Record<string, unknown> = {}) => api.post(path, body)!.result
    return { hub, sim, api, post }
  }

  it('the assistant offers to ask the kitchen when it can’t answer', async () => {
    const { api } = setup()
    const a = await api.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'Is the truffle risotto good for kids?' }] })
    expect(a.askKitchen).toMatchObject({ menuItemId: 'm_risotto', unsure: true })
    const b = await api.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'How spicy is the biryani?' }] })
    expect(b.text).toMatch(/medium spicy/)
    expect(b.askKitchen).toMatchObject({ unsure: false })
  })

  it('question → kitchen screen → answer card for the server → saved to the dish', () => {
    const { hub, api, post } = setup()
    const { questionId } = post('/api/kitchen/ask', { from: 's_aisha', text: 'Is the truffle risotto good for kids?', menuItemId: 'm_risotto' }) as { questionId: string }
    expect(api.snapshot('kitchen').questions![0]).toMatchObject({ id: questionId, text: 'Is the truffle risotto good for kids?' })
    post('/api/kitchen/answer', { questionId, answer: 'Yes, mild and creamy; half portion available.', save: true })
    const card = hub.tasks().find((t) => t.kind === 'kitchen_answer')!
    expect(card).toMatchObject({ staffId: 's_aisha', title: 'Kitchen answered: Yes, mild and creamy; half portion available.' })
    expect(hub.config.menu.find((m) => m.id === 'm_risotto')!.facts).toEqual([expect.objectContaining({ q: 'Is the truffle risotto good for kids?' })])
    hub.ingest({ type: 'dish.answer_seen', payload: { questionId } })
    expect(hub.tasks().some((t) => t.kind === 'kitchen_answer')).toBe(false)
  })

  it('a kitchen on autopilot answers what it can, or offers to come over', () => {
    const { hub, sim, post } = setup()
    post('/api/kitchen/ask', { from: 's_rohan', text: 'Can the gnocchi be made without butter?', menuItemId: 'm_gnocchi' })
    sim.fastForward(3)
    expect(hub.state.questions[0].answer).toBe('Chef will come to the table to explain.')
    void MIN
  })

  it('the menu editor adds, checks and removes dishes', () => {
    const { hub, post } = setup()
    post('/api/menu', { item: { name: 'Mango lassi', course: 'drink', station: 'bar', prepMin: 3, spice: 0, contains: ['dairy', 'nonsense'], description: 'Yoghurt and Alphonso mango.' } })
    const lassi = hub.config.menu.find((m) => m.name === 'Mango lassi')!
    expect(lassi).toMatchObject({ id: 'm_mango_lassi', contains: ['dairy'], spice: 0 })
    expect(() => post('/api/menu', { item: { name: '', course: 'main', station: 'hot', prepMin: 5 } })).toThrow(/name/)
    expect(() => post('/api/menu', { item: { name: 'X', course: 'main', station: 'hot', prepMin: 5, spice: 7 } })).toThrow(/Spice/)
    post('/api/menu', { deleteId: lassi.id })
    expect(hub.config.menu.some((m) => m.id === lassi.id)).toBe(false)
  })
})
