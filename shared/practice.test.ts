import { describe, expect, it } from 'vitest'
import { createAi } from '../server/ai.ts'
import { createApi } from '../server/api.ts'
import { Hub, memoryStore } from '../server/hub.ts'
import { Simulator } from '../server/simulator.ts'
import { PRACTICE_DAILY_XP, practiceXp } from './game.ts'
import { patienceAfter, practiceDebrief, practiceStep, SCENARIOS, scoreReply } from './practice.ts'
import { PRACTICE_TEXT } from './practiceText/index.ts'

describe('practice text', () => {
  it('has every line, ideal reply and coaching tip in all six languages', () => {
    const en = PRACTICE_TEXT.en
    for (const [lang, tx] of Object.entries(PRACTICE_TEXT)) {
      for (const sc of SCENARIOS) {
        const s = tx.scenarios[sc.id]
        expect(s, `${lang} ${sc.id}`).toBeTruthy()
        for (const k of ['opening', 'calm', 'upset', 'resolved', 'walkout'] as const) expect(s[k].trim(), `${lang} ${sc.id}.${k}`).not.toBe('')
        expect(s.ideal.every((x) => x.trim()), `${lang} ${sc.id}.ideal`).toBe(true)
      }
      expect(Object.keys(tx.checks).sort()).toEqual(Object.keys(en.checks).sort())
    }
  })
})

describe('scoring out of 100', () => {
  it('scores by the must-dos, with stars from the score', () => {
    const great = scoreReply('cold_food', 'I’m so sorry. Let me replace it right away; it’ll be with you in 10 minutes.')
    expect(great.score).toBe(100)
    expect(great.stars).toBe(3)
    expect(great.criteria.every((c) => c.met)).toBe(true)
    const half = scoreReply('cold_food', 'I’m so sorry about that.')
    expect(half.score).toBe(33)
    expect(half.stars).toBe(1)
    expect(half.criteria.filter((c) => !c.met)).toHaveLength(2)
  })

  it('heavily penalises blame, safety guesses and judgement', () => {
    const blame = scoreReply('cold_food', 'Sorry, it’s the kitchen’s fault, I’ll replace it in 10 minutes.')
    expect(blame.penalty).toBe(true)
    expect(blame.score).toBeLessThan(60)
    expect(blame.stars).toBe(1)
  })

  it('scores replies written in Hindi, Nepali, Bengali, Tamil and Spanish', () => {
    expect(scoreReply('cold_food', 'मुझे बहुत खेद है, मैं इसे अभी बदलवा दूँ, लगभग 10 मिनट में आएगा।', 'hi').score).toBe(100)
    expect(scoreReply('cold_food', 'माफ गर्नुहोस्, म अहिले नै नयाँ ल्याउँछु, १० मिनेटमा।', 'ne').score).toBe(100)
    expect(scoreReply('cold_food', 'আমি খুবই দুঃখিত, এখনই নতুন এনে দিচ্ছি, ১০ মিনিটে।', 'bn').score).toBe(100)
    expect(scoreReply('cold_food', 'மன்னிக்கவும், இப்போதே புதியது கொண்டு வருகிறேன், 10 நிமிடத்தில்.', 'ta').score).toBe(100)
    expect(scoreReply('cold_food', 'Lo siento mucho, le traigo uno nuevo ahora mismo, en 10 minutos.', 'es').score).toBe(100)
  })

  it('coaches in the practising person’s language', () => {
    expect(scoreReply('cold_food', 'ठीक है', 'hi').tips[0]).toBe(PRACTICE_TEXT.hi.checks.sorry.tip)
  })
})

describe('a realistic other side', () => {
  const good = 'I’m so sorry. Let me replace it right away; it’ll be with you in 10 minutes.'
  // Partly right (an apology and an action, but no time): they push for specifics.
  const vague = 'Sorry about that, I’ll replace it.'
  const bad = 'It’s not my fault, the kitchen is slow.'

  it('opens, calms after a good reply but raises a follow-up, and is won over by a second', () => {
    expect(practiceStep('cold_food', []).text).toBe(PRACTICE_TEXT.en.scenarios.cold_food.opening)
    const one = practiceStep('cold_food', [good])
    expect(one).toMatchObject({ mood: 'better', patience: 3, done: false, text: PRACTICE_TEXT.en.scenarios.cold_food.calm })
    expect(one.ideal).toBe(PRACTICE_TEXT.en.scenarios.cold_food.ideal[0])
    const two = practiceStep('cold_food', [good, good])
    expect(two).toMatchObject({ done: true, outcome: 'won', text: PRACTICE_TEXT.en.scenarios.cold_food.resolved })
  })

  it('pushes for specifics after a vague reply and walks out after blame', () => {
    expect(practiceStep('cold_food', [vague]).text).toBe(PRACTICE_TEXT.en.push.guest)
    const blamed = practiceStep('cold_food', [bad])
    expect(blamed).toMatchObject({ mood: 'worse', done: true, outcome: 'lost', text: PRACTICE_TEXT.en.scenarios.cold_food.walkout })
  })

  it('gets more upset after a weak reply, and can still be won back', () => {
    const weak = 'Okay.'
    expect(practiceStep('cold_food', [weak]).text).toBe(PRACTICE_TEXT.en.scenarios.cold_food.upset)
    expect(patienceAfter([{ score: 10 }, { score: 90 }, { score: 90 }])).toMatchObject({ outcome: 'won', patience: 4 })
    // Calmer after a strong reply means a calmer line, never "I'm still waiting"; two strong replies win them over.
    const back = practiceStep('cold_food', ['Sorry about that.', good, 'Completely fair. I’ll have it first in line, about 10 minutes, and bring bread meanwhile.'])
    expect(back).toMatchObject({ mood: 'better', done: true, outcome: 'won', text: PRACTICE_TEXT.en.scenarios.cold_food.resolved })
  })

  it('speaks the practising person’s language, and plays staff in staff situations', () => {
    expect(practiceStep('cold_food', [], 'ta').text).toBe(PRACTICE_TEXT.ta.scenarios.cold_food.opening)
    expect(practiceStep('m_conflict', ['Okay.'], 'es').text).toBe(PRACTICE_TEXT.es.scenarios.m_conflict.upset)
    expect(practiceStep('m_conflict', ['Let’s talk after service and check in tomorrow.'], 'es').text).toBe(PRACTICE_TEXT.es.push.staff)
    expect(practiceStep('m_conflict', ['Okay, fine, thanks.', 'Okay, fine, thanks.'], 'es')).toMatchObject({ done: true, outcome: 'lost' })
  })

  it('debriefs with an average, the outcome and the ideal replies', () => {
    const d = practiceDebrief('cold_food', [good, good])
    expect(d).toMatchObject({ score: 100, stars: 3, outcome: 'won' })
    expect(d.text).toMatch(/won them over/)
    expect(d.ideals).toHaveLength(2)
  })
})

describe('practice XP', () => {
  it('pays up to 10 per reply and a finishing bonus', () => {
    expect(practiceXp(73)).toBe(7)
    expect(practiceXp(90, true, 'won')).toBe(40)
    expect(practiceXp(40, true, 'lost')).toBe(10)
  })

  it('records XP for each scored reply and the finish, through the API, capped per day', async () => {
    const hub = new Hub(memoryStore())
    const api = createApi(hub, new Simulator(hub))
    const good = 'I’m so sorry. Let me replace it right away; it’ll be with you in 10 minutes.'
    const r1 = await api.ask({ kind: 'chat', mode: 'practice', scenario: 'cold_food', staffId: 's_aisha', messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: good }] })
    expect(r1).toMatchObject({ score: 100, xp: 10, mood: 'better' })
    const done = await api.ask({ kind: 'chat', mode: 'practice', scenario: 'cold_food', staffId: 's_aisha', finish: true, messages: [{ role: 'user', text: good, score: 100 }, { role: 'assistant', text: 'x' }, { role: 'user', text: good, score: 100 }] })
    expect(done.outcome).toBe('won')
    // 30 for three stars + 10 for winning them over + 30 for the first-rehearsal badge + 20 for the quest
    expect(done.xp).toBe(90)
    const p = hub.game.players.s_aisha
    expect(p.badges.first_rehearsal).toBeTruthy()
    expect(p.quests.q_practice).toBeTruthy()
    // Grinding stops paying once the day's practice XP is used up.
    for (let i = 0; i < 30; i++) await api.ask({ kind: 'chat', mode: 'practice', scenario: 'rude', staffId: 's_aisha', messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: good }] })
    const day = Object.entries(p.counters).find(([k]) => k.startsWith('practiceXp:'))![1]
    expect(day).toBe(PRACTICE_DAILY_XP)
  })

  it('lets managers earn training XP too', async () => {
    const hub = new Hub(memoryStore())
    const api = createApi(hub, new Simulator(hub))
    const r = await api.ask({ kind: 'chat', mode: 'practice', scenario: 'm_allergy', staffId: 'm_floor', messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: 'Calling 112 for an ambulance now; let’s help him use his EpiPen.' }] })
    expect(r.xp).toBeGreaterThan(0)
  })
})

describe('practice with a language model', () => {
  const chatWith = (answer: string, seen: { live?: string; turns?: unknown[] } = {}) => ({
    name: 'claude' as const,
    reply: async (system: { live: string }, turns: unknown[]) => ((seen.live = system.live), (seen.turns = turns), answer),
  })

  it('reads the model’s score, ideal reply and the guest’s line, in the person’s language', async () => {
    const seen: { live?: string } = {}
    const chat = chatWith('COACH: ✓ आपने माफ़ी माँगी → समय बताइए\nSCORE: 82\nIDEAL: मुझे खेद है, 10 मिनट में नया आएगा।\nGUEST: ठीक है, पर कितनी देर लगेगी?', seen)
    const a = await createAi(new Hub(memoryStore()), { chat }).ask({
      kind: 'chat', mode: 'practice', scenario: 'cold_food', staffId: 's_aisha', lang: 'hi',
      messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: 'मुझे खेद है, मैं इसे बदलवा दूँ।' }],
    })
    expect(a).toMatchObject({ source: 'claude', score: 82, stars: 3, mood: 'better', patience: 3, done: false, ideal: 'मुझे खेद है, 10 मिनट में नया आएगा।', text: 'ठीक है, पर कितनी देर लगेगी?' })
    expect(a.feedback).toMatch(/माफ़ी/)
    expect(seen.live).toMatch(/patience right now: 2\/4/)
    expect(seen.live).toMatch(/Hindi/)
  })

  it('carries patience across turns and ends when they’re won over', async () => {
    const seen: { live?: string } = {}
    const chat = chatWith('COACH: ✓ Great\nSCORE: 90\nIDEAL: …\nGUEST: Thank you, that’s sorted.', seen)
    const a = await createAi(new Hub(memoryStore()), { chat }).ask({
      kind: 'chat', mode: 'practice', scenario: 'cold_food', staffId: 's_aisha',
      messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: 'first', score: 85 }, { role: 'assistant', text: 'y' }, { role: 'user', text: 'second' }],
    })
    expect(seen.live).toMatch(/patience right now: 3\/4/)
    expect(a).toMatchObject({ done: true, outcome: 'won', patience: 4 })
  })

  it('caps a generous model score when the reply blames the kitchen', async () => {
    const chat = chatWith('COACH: ✓ ok\nSCORE: 95\nIDEAL: …\nGUEST: Hmm.')
    const a = await createAi(new Hub(memoryStore()), { chat }).ask({
      kind: 'chat', mode: 'practice', scenario: 'cold_food', staffId: 's_aisha',
      messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: 'Sorry, it’s the kitchen’s fault. I’ll bring a new one in 5 minutes.' }],
    })
    expect(a.score).toBeLessThanOrEqual(40)
    expect(a.mood).toBe('worse')
  })
})

