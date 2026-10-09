import { describe, expect, it, vi } from 'vitest'
import { createApi } from './api.ts'
import { Hub, memoryStore } from './hub.ts'
import { createOutbound } from './outbound.ts'
import { Simulator } from './simulator.ts'

const MIN = 60_000

function setup() {
  const hub = new Hub(memoryStore())
  const sim = new Simulator(hub)
  const api = createApi(hub, sim)
  const post = (path: string, body: Record<string, unknown> = {}) => api.post(path, body)!.result
  return { hub, sim, api, post }
}

describe('integrations', () => {
  it('lists the systems restaurants use, grouped, with what TableMate does with each', () => {
    const { api } = setup()
    const list = api.snapshot('manager').integrations!
    expect(new Set(list.map((i) => i.category))).toEqual(new Set(['pos', 'bookings', 'orders', 'staff', 'stock', 'messaging', 'reviews', 'data']))
    expect(list.find((i) => i.id === 'petpooja')).toMatchObject({ mode: 'needs-partner-access' })
    for (const i of list) expect(i.uses.length).toBeGreaterThan(10)
  })

  it('a test booking arrives through the open endpoint and is counted', () => {
    const { hub, api, post } = setup()
    const r = post('/api/integrations/test') as { text: string }
    expect(r.text).toMatch(/Neha Gupta/)
    expect(Object.values(hub.state.tables).some((t) => t.party?.guestName === 'Neha Gupta' && t.party.allergies.includes('shellfish'))).toBe(true)
    expect(api.snapshot('manager').integrations!.find((i) => i.id === 'generic')!.eventCount).toBe(1)
  })

  it('sends only the chosen alerts to the webhook, in plain words', async () => {
    const hub = new Hub(memoryStore())
    const fetchImpl = vi.fn(async () => new Response('ok'))
    const out = createOutbound(hub, fetchImpl as unknown as typeof fetch)
    hub.updateConfig({ alerts: { url: 'https://hooks.example.com/x', kinds: ['manager'] } })
    hub.ingest({ type: 'table.seated', payload: { tableId: 'T1', partySize: 2 } })
    hub.ingest({ type: 'guest.recovered', payload: { tableId: 'T1', how: 'manager' } })
    hub.ingest({ type: 'server.checkback', payload: { tableId: 'T1', course: 'starter', mood: 'unhappy' } })
    await vi.waitFor(() => expect(out.stat.sent).toBe(1))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ kind: 'manager', restaurant: 'Saffron House' })
    expect(body.text).toMatch(/T1 asked to see the manager/)
  })

  it('rejects a webhook that isn’t https, and saves a good one', () => {
    const { hub, post } = setup()
    expect(() => post('/api/alerts', { url: 'http://insecure.example.com', kinds: ['manager'] })).toThrow(/https/)
    post('/api/alerts', { url: 'https://hooks.zapier.com/abc', kinds: ['manager', 'nonsense'] })
    expect(hub.config.alerts).toEqual({ url: 'https://hooks.zapier.com/abc', kinds: ['manager'] })
  })

  it('exports finished visits step by step, without anyone’s name', () => {
    const { sim, post } = setup()
    sim.fastForward(120)
    const rows = post('/api/export/visits') as Record<string, unknown>[]
    expect(rows.length).toBeGreaterThan(0)
    expect(Object.keys(rows[0])).toEqual(['date', 'table', 'guests', 'seated', 'step', 'controlled_by', 'station', 'minutes', 'standard_minutes', 'past_standard', 'guest_mood'])
    expect(JSON.stringify(rows)).not.toMatch(/Aisha|Rohan|Meera|s_aisha/)
    void MIN
  })
})
