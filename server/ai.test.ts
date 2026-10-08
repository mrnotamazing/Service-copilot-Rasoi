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

describe('coach and practice', () => {
  it('coaches from the server’s own visits only', async () => {
    const hub = new Hub(memoryStore())
    const a = await createAi(hub).ask({ kind: 'coach', staffId: 's_aisha' })
    expect(a.text).toMatch(/Kitchen delays never count against you/)
  })

  it('role-plays a guest and scores the reply with the built-in rubric', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const open = await ai.ask({ kind: 'practice', scenario: 'cold_food', history: [] })
    expect(open.text).toMatch(/lukewarm/)
    expect(open.feedback).toBeUndefined()
    const good = await ai.ask({
      kind: 'practice',
      scenario: 'cold_food',
      history: [{ role: 'guest', text: open.text }, { role: 'server', text: 'I’m so sorry, I completely understand. Let me replace it right away, it will be with you in 5 minutes.' }],
    })
    expect(good.stars).toBe(3)
    expect(good.feedback).toMatch(/✓ You apologised/)
    expect(good.done).toBe(false)
    const blame = await ai.ask({ kind: 'practice', scenario: 'cold_food', history: [{ role: 'server', text: 'Sorry, that is the kitchen’s fault, not mine.' }] })
    expect(blame.stars).toBe(1)
    expect(blame.feedback).toMatch(/Leave the kitchen out of it/)
  })

  it('reads a structured Dify practice answer', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ answer: 'COACH: ✓ Kind and clear.\nGUEST: Alright, thank you.' }), { status: 200 }))
    const ai = createAi(new Hub(memoryStore()), { url: 'http://dify.local/v1', key: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    const a = await ai.ask({ kind: 'practice', scenario: 'long_wait', history: [{ role: 'server', text: 'Sorry, 5 minutes.' }] })
    expect(a).toMatchObject({ text: 'Alright, thank you.', feedback: '✓ Kind and clear.', source: 'dify' })
  })
})

describe('saved configs from older versions', () => {
  it('gets ingredient tags for the safety check', async () => {
    const { withDefaults } = await import('./hub.ts')
    const { DEMO_CONFIG } = await import('../shared/config.ts')
    const old = { ...DEMO_CONFIG, menu: DEMO_CONFIG.menu.map(({ contains: _c, ...m }) => m) }
    expect(withDefaults(old).menu.find((m) => m.id === 'm_burrata')?.contains).toEqual(['dairy'])
  })
})

describe('assistant chat', () => {
  it('answers from the menu, the section and the training notes without any AI service', async () => {
    const hub = new Hub(memoryStore())
    hub.ingest({ type: 'table.seated', payload: { tableId: 'T1', partySize: 2, needs: ['jain'] } })
    const ai = createAi(hub)
    const dish = await ai.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'What is in the galouti kebab?' }] })
    expect(dish.text).toMatch(/Galouti kebab.*Contains: meat, onion, garlic or root veg, nuts.*Not suitable as-is for vegetarian, vegan, Jain/)
    const brief = await ai.ask({ kind: 'chat', mode: 'ask', staffId: 's_aisha', messages: [{ role: 'user', text: 'Brief me on my section' }] })
    expect(brief.text).toMatch(/T1/)
    const lesson = await ai.ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'A guest is angry their food was cold' }] })
    expect(lesson.text).toMatch(/LAST|Listen/)
    expect(lesson.suggestions?.length).toBeGreaterThan(0)
  })

  it('runs a practice role-play with coaching and a debrief', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const open = await ai.ask({ kind: 'chat', mode: 'practice', scenario: 'rude', messages: [] })
    expect(open.text).toMatch(/Do you even work here/)
    const turns = [
      { role: 'assistant' as const, text: open.text },
      { role: 'user' as const, text: 'I’m so sorry for the wait, I understand. Let me get that for you right away.' },
    ]
    const next = await ai.ask({ kind: 'chat', mode: 'practice', scenario: 'rude', messages: turns })
    expect(next.feedback).toMatch(/✓ You apologised/)
    const debrief = await ai.ask({ kind: 'chat', mode: 'practice', scenario: 'rude', messages: [...turns, { role: 'assistant', text: next.text }], finish: true })
    expect(debrief.done).toBe(true)
    expect(debrief.stars).toBeGreaterThan(0)
  })

  it('uses a chat model with a cacheable system prompt and parses the guest and coach', async () => {
    const calls: { system: { stable: string; live: string }; turns: { role: string; text: string }[] }[] = []
    const chat = {
      name: 'claude' as const,
      reply: async (system: { stable: string; live: string }, turns: { role: 'user' | 'assistant'; text: string }[]) => {
        calls.push({ system, turns })
        return 'COACH: ✓ Calm and kind.\n→ Give a time.\nGUEST: Fine, but be quick. [END]'
      },
    }
    const hub = new Hub(memoryStore())
    const ai = createAi(hub, { chat })
    const a = await ai.ask({ kind: 'chat', mode: 'practice', scenario: 'long_wait', lang: 'hi', messages: [{ role: 'assistant', text: 'It’s been half an hour.' }, { role: 'user', text: 'Sorry, 5 minutes.' }] })
    expect(a).toMatchObject({ source: 'claude', text: 'Fine, but be quick.', feedback: '✓ Calm and kind.\n→ Give a time.', done: true })
    expect(calls[0].turns[0].role).toBe('user') // conversation must open with the server
    expect(calls[0].system.live).toMatch(/Hindi/)
    await ai.ask({ kind: 'chat', mode: 'ask', lang: 'ta', messages: [{ role: 'user', text: 'hello' }] })
    expect(calls[1].system.stable).toBe(calls[0].system.stable) // identical prefix, so it caches
    expect(calls[0].system.stable).toMatch(/Galouti kebab: starter, grill/)
  })

  it('falls back to the built-in answer with a notice when the model fails', async () => {
    const chat = { name: 'claude' as const, reply: async () => Promise.reject(new Error('boom')) }
    const a = await createAi(new Hub(memoryStore()), { chat, chatErrorReason: () => 'The AI service is busy right now' }).ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'Explain Jain food' }] })
    expect(a.source).toBe('built-in')
    expect(a.notice).toMatch(/busy/)
    expect(a.text).toMatch(/Jain diners avoid/)
  })

  it('skips a model that is not available yet and says when a question needs it', async () => {
    let ready = false
    const chat = { name: 'claude' as const, available: () => ready, reply: async () => 'From the model' }
    const ai = createAi(new Hub(memoryStore()), { chat })
    expect(ai.provider).toBe('built-in')
    const off = await ai.ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'What is the capital of Peru?' }] })
    expect(off.source).toBe('built-in')
    expect(off.text).toMatch(/isn’t connected/)
    ready = true
    expect(ai.provider).toBe('claude')
    const on = await ai.ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'What is the capital of Peru?' }] })
    expect(on).toMatchObject({ source: 'claude', text: 'From the model' })
  })
})

describe('quick buttons are fast', () => {
  it('send a short system prompt, cap the length and stream the words', async () => {
    const hub = new Hub(memoryStore())
    const seen: { stable: string; maxTokens?: number }[] = []
    const chat = {
      name: 'ollama' as const,
      compact: true,
      async reply(system: { stable: string }, _t: unknown, onText?: (t: string) => void, opts?: { maxTokens?: number }) {
        seen.push({ stable: system.stable, maxTokens: opts?.maxTokens })
        onText?.('Good evening')
        return 'Good evening, welcome.'
      },
    }
    const ai = createAi(hub, { chat })
    const streamed: string[] = []
    const a = await ai.ask({ kind: 'briefing', staffId: 's_aisha' }, (t) => streamed.push(t))
    expect(a.text).toBe('Good evening, welcome.')
    expect(streamed).toEqual(['Good evening'])
    expect(seen[0].stable.length).toBeLessThan(1000)
    expect(seen[0].maxTokens).toBe(240)
  })

  it('show the built-in answer when the model says nothing for 12 seconds', async () => {
    vi.useFakeTimers()
    try {
      const hub = new Hub(memoryStore())
      const chat = {
        name: 'ollama' as const,
        reply: (_s: unknown, _t: unknown, _o?: unknown, opts?: { signal?: AbortSignal }) =>
          new Promise<string>((_, reject) => opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      }
      const pending = createAi(hub, { chat }).ask({ kind: 'briefing', staffId: 's_aisha' })
      await vi.advanceTimersByTimeAsync(12_000)
      const a = await pending
      expect(a.source).toBe('built-in')
      expect(a.notice).toMatch(/took too long/)
    } finally {
      vi.useRealTimers()
    }
  })
})
