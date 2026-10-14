import { describe, expect, it } from 'vitest'
import { createApi } from '../server/api.ts'
import { Hub, memoryStore } from '../server/hub.ts'
import { Simulator } from '../server/simulator.ts'
import { DEMO_CONFIG } from './config.ts'
import { pickDishes, readWishes, suggestFallback } from './suggest.ts'

const menu = DEMO_CONFIG.menu
const nutTable = { size: 2, allergies: ['nuts'] }

describe('suggesting dishes', () => {
  it('reads what the guests want, and a later wish wins', () => {
    expect(readWishes(['something spicy']).spice).toBe('hot')
    expect(readWishes(['something spicy', 'actually not too spicy']).spice).toBe('mild')
    expect(readWishes(['vegetarian please', 'and a dessert']).diets).toEqual(['vegetarian'])
    expect(readWishes(['and a dessert']).course).toBe('dessert')
    // The quick buttons in the app's languages read the same way.
    expect(readWishes(['कुछ तीखा']).spice).toBe('hot')
    expect(readWishes(['இனிப்பு ஏதாவது']).course).toBe('dessert')
    expect(readWishes(['Algo picante']).spice).toBe('hot')
  })

  it('never picks a dish that clashes with the table or is off tonight', () => {
    const picks = pickDishes(menu, ['m_tikka'], nutTable, readWishes(['something spicy']))
    expect(picks.length).toBeGreaterThan(0)
    for (const p of picks) {
      expect(p.item.contains ?? []).not.toContain('nuts')
      expect(p.item.id).not.toBe('m_tikka')
    }
  })

  it('puts the spicy dishes first when they ask for spice', () => {
    const [top] = pickDishes(menu, [], { size: 2, allergies: [] }, readWishes(['they want something spicy']))
    expect(top.item.spice ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('counts an allergy the server mentions while asking', () => {
    const r = suggestFallback(menu, [], { size: 2, allergies: [] }, ['a dessert, but she is allergic to nuts'])
    expect(r.dishes).not.toContain('m_kulfi')
    expect(r.dishes.length).toBeGreaterThan(0)
  })

  it('writes a line to recommend one dish, or says why not', () => {
    expect(suggestFallback(menu, [], nutTable, [], 'm_burrata').text).toMatch(/May I suggest the Burrata/)
    expect(suggestFallback(menu, [], nutTable, [], 'm_kulfi').text).toMatch(/Better not/)
  })

  it('answers through the API with the dishes it recommends', async () => {
    const hub = new Hub(memoryStore())
    const api = createApi(hub, new Simulator(hub))
    hub.ingest({ type: 'table.seated', payload: { tableId: 'T1', partySize: 2, allergies: ['nuts'] } })
    const a = await api.ask({ kind: 'menu_suggest', staffId: 's_aisha', tableId: 'T1', messages: [{ role: 'user', text: 'something spicy' }] })
    expect(a.text.length).toBeGreaterThan(10)
    expect(a.dishes?.length).toBeGreaterThan(0)
    expect(a.dishes).not.toContain('m_galouti')
  })
})
