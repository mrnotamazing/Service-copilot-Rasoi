import { describe, expect, it, vi } from 'vitest'
import { createAi } from './ai.ts'
import { Hub, memoryStore } from './hub.ts'

function hubWithLateTable() {
  const hub = new Hub(memoryStore())
  const t0 = Date.UTC(2026, 9, 7, 13, 30)
  hub.clock.set(t0)
  hub.clock.pause()
  hub.ingest({ type: 'table.seated', at: t0, payload: { tableId: 'T5', partySize: 2, guestName: 'Ms. Iyer', occasion: 'anniversary' } })
  hub.ingest({ type: 'order.fired', at: t0 + 60_000, payload: { tableId: 'T5', ticketId: 'k1', lines: [{ id: 'l1', menuItemId: 'm_seabass', qty: 2 }] } })
  hub.clock.set(t0 + 25 * 60_000) // sea bass is 16 min; well past tolerance
  hub.clock.pause()
  const task = hub.tasks().find((t) => t.kind === 'kitchen_delay')!
  return { hub, task }
}

describe('AI assistance', () => {
  it('writes a built-in guest line when Dify is not configured', async () => {
    const { hub, task } = hubWithLateTable()
    const ai = createAi(hub)
    const a = await ai.ask({ kind: 'guest_script', taskId: task.id, staffId: 's_rohan' })
    expect(a.source).toBe('built-in')
    expect(a.text).toContain('Ms. Iyer')
    expect(a.text).toContain('pan-seared sea bass')
    expect(a.text).not.toMatch(/kitchen'?s fault|blame/i)
  })

  it('sends the facts to Dify chat-messages and returns its answer', async () => {
    const { hub, task } = hubWithLateTable()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ answer: 'Ms. Iyer, your sea bass is moments away.' }), { status: 200 }))
    const ai = createAi(hub, { url: 'http://dify.local/v1/', key: 'app-123', fetchImpl: fetchImpl as unknown as typeof fetch })
    const a = await ai.ask({ kind: 'guest_script', taskId: task.id, staffId: 's_rohan' })
    expect(a).toEqual({ text: 'Ms. Iyer, your sea bass is moments away.', source: 'dify' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://dify.local/v1/chat-messages')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer app-123')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ response_mode: 'blocking', user: 's_rohan', inputs: { kind: 'guest_script' } })
    expect(body.query).toContain('anniversary')
  })

  it('falls back to the built-in answer and says why when Dify fails', async () => {
    const { hub, task } = hubWithLateTable()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 }))
    const ai = createAi(hub, { url: 'http://dify.local/v1', key: 'bad', fetchImpl: fetchImpl as unknown as typeof fetch })
    const a = await ai.ask({ kind: 'guest_script', taskId: task.id })
    expect(a.source).toBe('built-in')
    expect(a.notice).toMatch(/Invalid API key/)
    expect(a.text.length).toBeGreaterThan(20)
  })

  it('briefs a server on their own section, allergies first-class', async () => {
    const hub = new Hub(memoryStore())
    hub.ingest({ type: 'table.seated', payload: { tableId: 'T2', partySize: 4, allergies: ['nuts'] } })
    const a = await createAi(hub).ask({ kind: 'briefing', staffId: 's_aisha' })
    expect(a.text).toContain('ALLERGY nuts')
    expect(a.text).toContain('T2')
  })

  it('answers SOP questions from the configured standards', async () => {
    const hub = new Hub(memoryStore())
    const a = await createAi(hub).ask({ kind: 'ask_sop', question: 'How fast should I reset a table?' })
    expect(a.text).toMatch(/Reset a table within 5 min/)
  })

  it('asks Dify for inclusive, gender-neutral wording in the device language', async () => {
    const { hub, task } = hubWithLateTable()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ answer: 'ok' }), { status: 200 }))
    const ai = createAi(hub, { url: 'http://dify.local/v1', key: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    await ai.ask({ kind: 'guest_script', taskId: task.id, lang: 'hi' })
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.query).toMatch(/gender-neutral/)
    expect(body.query).toMatch(/no sir\/madam/)
    expect(body.query).toMatch(/Reply in Hindi\.$/)
  })

  it('puts guest access needs in the briefing as what to do', async () => {
    const hub = new Hub(memoryStore())
    hub.ingest({ type: 'table.seated', payload: { tableId: 'T2', partySize: 2, needs: ['wheelchair'] } })
    const a = await createAi(hub).ask({ kind: 'briefing', staffId: 's_aisha' })
    expect(a.text).toContain('step-free route')
  })
})

describe('staff profile', () => {
  it('lets a person set their own pronouns, trimmed and length-limited', async () => {
    const { createApi } = await import('./api.ts')
    const { Simulator } = await import('./simulator.ts')
    const hub = new Hub(memoryStore())
    const api = createApi(hub, new Simulator(hub))
    api.post('/api/staff/profile', { staffId: 's_aisha', pronouns: '  they/them  ' })
    expect(hub.config.staff.find((s) => s.id === 's_aisha')?.pronouns).toBe('they/them')
    api.post('/api/staff/profile', { staffId: 's_aisha', pronouns: '' })
    expect(hub.config.staff.find((s) => s.id === 's_aisha')?.pronouns).toBeUndefined()
    expect(() => api.post('/api/staff/profile', { staffId: 'nobody', pronouns: 'x' })).toThrow()
  })
})
