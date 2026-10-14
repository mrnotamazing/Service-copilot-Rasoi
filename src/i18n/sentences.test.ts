import { describe, expect, it } from 'vitest'
import { Hub, memoryStore } from '../../server/hub.ts'
import { Simulator, MOMENTS } from '../../server/simulator.ts'
import { createApi } from '../../server/api.ts'
import { isCovered, SENTENCES } from './sentences.ts'

describe('server-written sentences', () => {
  it('has no duplicate templates', () => {
    expect(SENTENCES.length).toBe(new Set(SENTENCES).size)
  })

  it('every sentence the app writes during a busy service matches a template', async () => {
    const hub = new Hub(memoryStore())
    const sim = new Simulator(hub)
    const api = createApi(hub, sim)
    const seen = new Set<string>()
    const collect = () => {
      const snap = api.snapshot('manager', 'm_floor') as any
      const add = (s?: string) => s && seen.add(s)
      for (const f of snap.feed ?? []) add(f.text)
      for (const n of snap.notes ?? []) add(n.text)
      for (const i of snap.insights ?? []) { add(i.title); add(i.why); add(i.cta) }
      for (const l of snap.intel?.lights ?? []) add(l.text)
      for (const w of [...(snap.intel?.why ?? []), ...(snap.intel?.actions ?? [])]) add(w)
      for (const h of snap.forecast?.headlines ?? []) add(h)
      for (const s of snap.forecast?.stations ?? []) add(s.text)
      add(snap.forecast?.rebalance ?? undefined)
      for (const a of snap.analytics?.suggestions ?? []) add(a)
    }
    const run = (min: number) => {
      for (let i = 0; i < min * 4; i++) {
        hub.clock.set(hub.clock.now() + 15_000)
        ;(sim as unknown as { tick(): void }).tick()
      }
    }
    run(5)
    for (const m of MOMENTS) {
      try { sim.moment(m) } catch { /* no free table */ }
      run(6)
      collect()
    }
    run(40)
    collect()
    if (process.env.DUMP) console.log([...seen].join("\n"))
    const missing = [...seen].filter((s) => !isCovered(s))
    expect(missing).toEqual([])
  })
})

describe('S() in another language', () => {
  it('translates server sentences and keeps the names and numbers', async () => {
    const { setPrefs } = await import('../lib/prefs.ts')
    const { S } = await import('./sentences.ts')
    const samples = [
      'Aisha took T1\'s food from the pass',
      'T16 seated: party of 5 · Ms. Reddy · business dinner',
      'Kitchen: 3 dishes ready at the pass for T16',
      'Grill is likely to fall behind. Peak in about 4 min. 5 dishes cooking. New tickets may wait ~6 min extra.',
      'Hand T17 to Meera',
      '7 min over standard',
    ]
    for (const lang of ['hi', 'ta'] as const) {
      setPrefs({ lang })
      for (const s of samples) {
        const out = S(s)
        expect(out, `${lang}: ${s}`).not.toBe(s)
        for (const keep of s.match(/T\d+|\b\d+\b|Aisha|Meera|Ms\. Reddy|Grill/g) ?? []) if (keep !== 'Grill') expect(out, `${lang}: ${s}`).toContain(keep)
      }
    }
    setPrefs({ lang: 'en' })
    expect(S('Hand T17 to Meera')).toBe('Hand T17 to Meera')
  })
})
