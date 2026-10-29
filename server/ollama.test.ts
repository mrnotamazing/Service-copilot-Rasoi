import { describe, expect, it } from 'vitest'
import { createAi } from './ai.ts'
import { Hub, memoryStore } from './hub.ts'
import { createOllama, ollamaErrorReason } from './ollama.ts'

/** A fake Ollama: lists the given models and answers /api/chat with `reply`. */
function fakeOllama(models: string[], reply: string, seen: { body?: Record<string, unknown> } = {}) {
  return (async (url: string, init?: RequestInit) => {
    // Sizes grow with the number in the tag (gemma3:1b < gemma3:4b), as real downloads do.
    if (url.endsWith('/api/generate')) return new Response('{}')
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: models.map((name) => ({ name, size: Number(name.match(/(\d+)b$/)?.[1] ?? 1) * 1e9 })) }))
    seen.body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ message: { role: 'assistant', content: reply } }))
  }) as unknown as typeof fetch
}

describe('ollama', () => {
  it('picks a multilingual model, sends the whole prompt and strips thinking', async () => {
    const seen: { body?: Record<string, unknown> } = {}
    const o = createOllama({ fetchImpl: fakeOllama(['nomic-embed-text:latest', 'gemma3:1b', 'llama3.2:3b', 'gemma3:4b'], '<think>hmm</think>Offer the Malbec.', seen), pollMs: 60_000 })
    await o.refresh()
    expect(o.status.model).toBe('gemma3:4b')
    const ai = createAi(new Hub(memoryStore()), { chat: o.model })
    expect(ai.provider).toBe('ollama')
    expect(ai.modelLabel).toBe('gemma3:4b')
    const a = await ai.ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'Wine with the lamb shank?' }] })
    expect(a.source).toBe('ollama')
    expect(a.text).toMatch(/^Offer the Malbec\.\n\nFrom the menu: Slow-cooked lamb shank/)
    const msgs = seen.body!.messages as { role: string; content: string }[]
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toMatch(/TableMate/)
    expect(msgs.at(-1)!.content).toMatch(/^Wine with the lamb shank\?\n\n\(You are TableMate/)
    // A compact prompt: only the notes that matter, so a small context (faster on a laptop) is enough.
    expect(msgs[0].content.length).toBeLessThan(9000)
    expect(msgs[0].content).toMatch(/Drinks and pairings/)
    expect(msgs[0].content).not.toMatch(/Table reset/)
    expect(seen.body!.options).toMatchObject({ num_ctx: 6144, num_predict: 320 })
    expect(seen.body!.stream).toBe(true)
  })

  it('reads practice labels even when the model bolds them', async () => {
    const o = createOllama({ fetchImpl: fakeOllama(['qwen2.5:7b'], '**COACH:** ✓ You apologised.\n**GUEST:** Fine, thank you.'), pollMs: 60_000 })
    await o.refresh()
    const a = await createAi(new Hub(memoryStore()), { chat: o.model }).ask({
      kind: 'chat',
      mode: 'practice',
      scenario: 'cold_food',
      messages: [
        { role: 'assistant', text: 'This is cold.' },
        { role: 'user', text: 'I’m so sorry, I’ll bring you a fresh one right away.' },
      ],
    })
    expect(a.text).toBe('Fine, thank you.')
    expect(a.feedback).toMatch(/apologised/)
  })

  it('stays on the built-in trainer while Ollama is closed or has no model', async () => {
    const closed = createOllama({ fetchImpl: (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch, pollMs: 60_000 })
    await closed.refresh()
    expect(createAi(new Hub(memoryStore()), { chat: closed.model }).provider).toBe('built-in')
    const empty = createOllama({ fetchImpl: fakeOllama([], ''), pollMs: 60_000 })
    await empty.refresh()
    expect(empty.status).toMatchObject({ running: true, model: null })
    expect(createAi(new Hub(memoryStore()), { chat: empty.model }).provider).toBe('built-in')
  })

  it('adds the menu’s own facts when a local model answers about a dish', async () => {
    const o = createOllama({ fetchImpl: fakeOllama(['gemma3:4b'], 'Yes, it is vegetarian.'), pollMs: 60_000 })
    await o.refresh()
    const a = await createAi(new Hub(memoryStore()), { chat: o.model }).ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'Is the galouti kebab vegetarian?' }] })
    expect(a.text).toMatch(/^Yes, it is vegetarian\.\n\nFrom the menu: Galouti kebab: .*Contains: meat/)
  })

  it('explains common failures in plain words', () => {
    expect(ollamaErrorReason(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }))).toMatch(/isn’t running/)
    expect(ollamaErrorReason(new Error("model 'gemma3:4b' not found"))).toMatch(/ollama pull/)
  })

  it('streams the answer as it’s written and loads the model when it’s found', async () => {
    const calls: string[] = []
    const lines = ['{"message":{"content":"<think>hmm</think>Offer "}}', '{"message":{"content":"the Malbec."}}', '{"done":true}'].join('\n')
    const fetchImpl = (async (url: string) => {
      calls.push(url.split('/api/')[1])
      if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'gemma3:4b', size: 4e9 }] }))
      if (url.endsWith('/api/generate')) return new Response('{}')
      return new Response(lines)
    }) as unknown as typeof fetch
    const o = createOllama({ fetchImpl, pollMs: 60_000 })
    await o.refresh()
    expect(calls).toContain('generate')
    const seen: string[] = []
    const a = await createAi(new Hub(memoryStore()), { chat: o.model }).ask({ kind: 'chat', mode: 'ask', messages: [{ role: 'user', text: 'A wine for tonight?' }] }, (t) => seen.push(t))
    expect(a.text).toBe('Offer the Malbec.')
    expect(seen).toEqual(['Offer', 'Offer the Malbec.'])
  })
})
