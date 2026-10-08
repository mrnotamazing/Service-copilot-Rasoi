import { describe, expect, it } from 'vitest'
import { createAi } from '../server/ai.ts'
import { Hub, memoryStore } from '../server/hub.ts'
import { scenariosFor, scoreReply } from './practice.ts'
import { findLessons, LESSONS, lessonsFor, MANAGER_STARTERS, STARTERS } from './training.ts'

describe('training notes', () => {
  it('splits notes by audience, with inclusion notes for everyone', () => {
    const server = lessonsFor('server').map((l) => l.id)
    const manager = lessonsFor('manager').map((l) => l.id)
    expect(server).toContain('greet')
    expect(server).not.toContain('m_feedback')
    expect(manager).toContain('m_feedback')
    expect(manager).not.toContain('greet')
    for (const id of ['equal', 'assume', 'faith', 'sensory', 'harassment']) {
      expect(server).toContain(id)
      expect(manager).toContain(id)
    }
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length)
  })

  it('answers every starter and every suggested follow-up without an AI service', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const dead: string[] = []
    for (const [staffId, questions] of [
      ['s_aisha', [...STARTERS, ...lessonsFor('server').flatMap((l) => l.next)]],
      ['m_floor', [...MANAGER_STARTERS, ...lessonsFor('manager').flatMap((l) => l.next)]],
    ] as const) {
      for (const q of new Set(questions)) {
        const a = await ai.ask({ kind: 'chat', mode: 'ask', staffId, messages: [{ role: 'user', text: q }] })
        if (/isn’t connected/.test(a.text)) dead.push(`${staffId}: ${q}`)
      }
    }
    expect(dead).toEqual([])
  })

  it('gives managers manager answers and servers server answers', () => {
    expect(findLessons('A guest wants the manager. What do I do?', 1, 'manager')[0].id).toBe('m_visit')
    expect(findLessons('How do I give a server feedback?', 1, 'manager')[0].id).toBe('m_feedback')
    expect(findLessons('guest is fasting for navratri', 1, 'server')[0].id).toBe('faith')
    expect(findLessons('how do I give feedback', 1, 'server')).toEqual([])
  })
})

describe('practice for everyone', () => {
  it('has separate situations for servers and managers', () => {
    expect(scenariosFor('server').map((s) => s.id)).toEqual(expect.arrayContaining(['cold_food', 'access_direct', 'fasting', 'misgender']))
    expect(scenariosFor('manager').map((s) => s.id)).toEqual(['m_guest', 'm_feedback', 'm_harassed', 'm_conflict', 'm_newhire', 'm_allergy'])
  })

  it('coaches managers on listening, privacy, support and follow-up', () => {
    const good = scoreReply('m_feedback', 'Can we have a quick word in private? Tell me what happened at T4 tonight; I noticed the bill took 10 minutes. Let’s check in next shift.')
    expect(good.stars).toBe(3)
    const harsh = scoreReply('m_feedback', 'You always mess this up, it’s your fault.')
    expect(harsh.stars).toBe(1)
    expect(harsh.tips[0]).toMatch(/not the person/)
    const support = scoreReply('m_harassed', 'Are you okay? It’s not your fault. I’ll take T6 myself and we’ll check in after service.')
    expect(support.stars).toBe(3)
    expect(scoreReply('m_allergy', 'Call 112 now and get the ambulance; I’ll help him use his EpiPen.').stars).toBe(3)
  })

  it('coaches inclusive service without judging', () => {
    expect(scoreReply('fasting', 'Of course. Is there anything else you avoid? I’ll check with the chef what they can make for you.').stars).toBe(3)
    const judging = scoreReply('fasting', 'Why don’t you just eat a little, it’s fine.')
    expect(judging.stars).toBe(1)
    expect(judging.tips[0]).toMatch(/Never question/)
  })

  it('plays a team member, not a guest, in staff situations', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const a = await ai.ask({ kind: 'chat', mode: 'practice', scenario: 'm_harassed', staffId: 'm_floor', messages: [] })
    expect(a.text).toMatch(/T6/)
    const r = await ai.ask({
      kind: 'chat',
      mode: 'practice',
      scenario: 'm_harassed',
      staffId: 'm_floor',
      messages: [
        { role: 'assistant', text: a.text },
        { role: 'user', text: 'Are you okay? It’s not your fault. I’ll take T6 myself and we’ll check in after service.' },
      ],
    })
    expect(r.feedback).toMatch(/looked after the person/)
  })
})

describe('role-aware assistant', () => {
  it('briefs a manager on the whole floor and keeps load free of rankings', async () => {
    const ai = createAi(new Hub(memoryStore()))
    const a = await ai.ask({ kind: 'chat', mode: 'ask', staffId: 'm_floor', messages: [{ role: 'user', text: 'Plan my pre-shift briefing' }] })
    expect(a.text).toMatch(/Tonight so far/)
    expect(a.text).toMatch(/Section A: \d+ active tables/)
    expect(a.text).toMatch(/Ten minutes, standing/)
  })

  it('sends a model the manager’s coaching notes and the simple-words request', async () => {
    let seen: { stable: string; live: string; reminder?: string } | undefined
    const chat = { name: 'claude' as const, reply: async (system: { stable: string; live: string; reminder?: string }) => ((seen = system), 'ok') }
    await createAi(new Hub(memoryStore()), { chat }).ask({ kind: 'chat', mode: 'ask', staffId: 'm_floor', simple: true, messages: [{ role: 'user', text: 'How do I support my team?' }] })
    expect(seen!.stable).toMatch(/talking to a floor manager/)
    expect(seen!.stable).toMatch(/POSH Act/)
    expect(seen!.stable).not.toMatch(/The first two minutes/)
    expect(seen!.live).toMatch(/simple words/)
    expect(seen!.reminder).toMatch(/management coach; use simple everyday words/)
  })
})
