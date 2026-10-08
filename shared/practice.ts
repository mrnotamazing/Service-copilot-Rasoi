// "Practice tough moments": short role-plays where the AI plays a guest (or, for managers, a team
// member), scores each reply out of 100 and shows an ideal reply to learn from.
//
// The rubric below powers the built-in coach (no AI service needed) and is given to the language
// model too, so feedback follows the restaurant's own standards in any of the app's languages.
// The other side reacts like a real person: a patience level rises with good replies and falls
// with poor ones. Two strong replies win them over; blame, judgement or two poor replies lose them.

import { practiceText, type PracticeText } from './practiceText/index.ts'

export interface Scenario {
  id: string
  /** Who practises it. Unset: servers. */
  for?: 'server' | 'manager'
  /** Who the AI plays: a guest (default) or a team member. */
  plays?: 'guest' | 'staff'
  /** What a great reply does in this situation. */
  musts: Check[]
}

/**
 * Something a reply does (or, for penalties, must not do). English is matched with a pattern;
 * the other app languages with word stems, so a reply in Hindi or Tamil is scored fairly too.
 */
export interface Check {
  id: string
  test: RegExp
  stems?: string[]
}

function met(c: Check, reply: string): boolean {
  if (c.test.test(reply)) return true
  const r = reply.toLowerCase()
  return !!c.stems?.some((s) => r.includes(s.toLowerCase()))
}

const APOLOGY: Check = {
  id: 'sorry',
  test: /\b(sorry|apolog)/i,
  stems: ['माफ़', 'माफ', 'क्षमा', 'सॉरी', 'खेद', 'सरी', 'দুঃখিত', 'ক্ষমা', 'সরি', 'மன்னி', 'வருந்துகிறேன்', 'perdón', 'perdon', 'lo siento', 'disculp', 'lamento', 'siento mucho'],
}
const EMPATHY: Check = {
  id: 'empathy',
  test: /\b(understand|i hear you|you['’]?re right|completely fair|frustrat|that['’]?s not (ok|okay|good enough))/i,
  stems: ['समझ', 'सही कह', 'जायज़', 'बुझ्छु', 'बुझें', 'ठीक हो', 'বুঝতে পার', 'ঠিক বলেছেন', 'স্বাভাবিক', 'புரிகிறது', 'புரிந்து', 'நியாயம்', 'entiendo', 'comprendo', 'tiene razón', 'tienes razón', 'frustra'],
}
const ACTION: Check = {
  id: 'action',
  test: /\b(i['’]?ll|i will|let me|right away|straight away|replace|bring|check|fix|arrange|get you)\b/i,
  stems: ['लाऊँ', 'लाता', 'लाती', 'ले आऊँ', 'बदल', 'ठीक कर', 'बनवा', 'करूँ', 'दूँ', 'ल्याउँछु', 'ल्याइदिन्छु', 'मिलाउँछु', 'गर्छु', 'हेर्छु', 'আনছি', 'এনে দিচ্ছি', 'বদলে', 'ঠিক করে', 'করে দিচ্ছি', 'দেখছি', 'கொண்டு வருகிறேன்', 'மாற்றி', 'சரிசெய்', 'செய்கிறேன்', 'கவனிக்கிறேன்', 'le traigo', 'te traigo', 'voy a', 'cambi', 'lo arreglo', 'me encargo'],
}
const TIME: Check = {
  id: 'time',
  test: /\b(\d+\s*(min|minute)s?|a minute|right now|immediately|shortly)\b/i,
  stems: ['मिनट', 'अभी', 'तुरंत', 'मिनेट', 'तुरुन्त', 'अहिले', 'মিনিট', 'এখনই', 'এক্ষুনি', 'நிமிட', 'உடனே', 'இப்போதே', 'minuto', 'ahora mismo', 'enseguida'],
}
const NO_BLAME: Check = {
  id: 'blame',
  test: /\b(kitchen['’]?s fault|not my fault|chef (messed|forgot)|they messed|blame)\b/i,
  stems: ['किचन की ग़लती', 'किचन की गलती', 'मेरी ग़लती नहीं', 'मेरी गलती नहीं', 'किचनको गल्ती', 'मेरो गल्ती होइन', 'কিচেনের দোষ', 'আমার দোষ না', 'சமையலறையின் தவறு', 'என் தவறு இல்லை', 'culpa de la cocina', 'no es mi culpa', 'culpa del chef'],
}
const CHECK_KITCHEN: Check = {
  id: 'confirm',
  test: /\b(check|confirm|ask)\b.*\b(kitchen|chef)\b|\b(kitchen|chef)\b.*\b(check|confirm)\b/i,
  stems: ['शेफ़', 'शेफ', 'किचन', 'सेफ', 'भान्सा', 'শেফ', 'কিচেন', 'রান্নাঘর', 'செஃப', 'சமையலறை', 'chef', 'cocina'],
}
const NO_GUESS: Check = {
  id: 'guess',
  test: /\b(definitely safe|it['’]?s safe|100%|for sure|no nuts at all)\b/i,
  stems: ['पक्का सुरक्षित', 'बिल्कुल सुरक्षित', 'पूरै सुरक्षित', 'একদম নিরাপদ', 'নিশ্চিত নিরাপদ', 'முற்றிலும் பாதுகாப்பான', 'நிச்சயம் பாதுகாப்பான', 'totalmente seguro', 'seguro al 100'],
}
// Inclusive service: speak to the guest, ask instead of assuming, and never comment on the need.
const DIRECT: Check = { id: 'direct', test: /\b(you|your)\b/i, stems: ['आप', 'तपाईं', 'আপনি', 'আপনার', 'நீங்கள்', 'உங்க', 'usted', 'le ', 'te ', 'tú'] }
const ASK: Check = {
  id: 'ask',
  test: /\b(may i ask|can i ask|could you tell me|what (would|do) you|is there anything|which .* (do|would) you|do you (eat|avoid|prefer))\b|\?/i,
  stems: ['क्या आप', 'बताइए', 'के तपाईं', 'सोध्न', 'জিজ্ঞেস', 'বলবেন', 'கேட்கலாமா', 'சொல்லுங்கள்', 'puedo preguntar'],
}
const NO_JUDGE: Check = {
  id: 'judge',
  test: /\b(why (don['’]?t|do) you|that['’]?s (weird|strange|odd)|just this once|a little won['’]?t)\b/i,
  stems: ['थोड़ा सा चलेगा', 'थोड़ा चल जाएगा', 'क्यों नहीं खाते', 'अलिकति त', 'किन खानुहुन्न', 'একটু খেলে কিছু', 'কেন খান না', 'கொஞ்சம் சாப்பிட்டால்', 'ஏன் சாப்பிட', 'un poquito no', 'por qué no come'],
}

// Managers: listen, take ownership, protect the team, act privately, follow up.
const LISTEN: Check = {
  id: 'listen',
  test: /\b(tell me (what|more)|what happened|help me understand|i['’]?d like to hear|walk me through|i hear you|i understand)\b/i,
  stems: ['क्या हुआ', 'बताइए', 'बताओ', 'के भयो', 'भन्नुहोस्', 'কী হয়েছে', 'বলুন', 'என்ன நடந்தது', 'சொல்லுங்கள்', 'qué pasó', 'qué ha pasado', 'cuéntame', 'cuénteme'],
}
const OWN: Check = {
  id: 'own',
  test: /\b(i['’]?m the (manager|floor manager)|my name is|i['’]?ll (personally|take care|look into|make sure|sort)|i take responsibility|that['’]?s on (us|me))\b/i,
  stems: ['मैनेजर हूँ', 'मैं ख़ुद', 'मैं खुद', 'मेरी ज़िम्मेदारी', 'म्यानेजर हुँ', 'म आफैं', 'मेरो जिम्मेवारी', 'ম্যানেজার', 'আমি নিজে', 'আমার দায়িত্ব', 'மேலாளர்', 'நானே', 'என் பொறுப்பு', 'responsable de sala', 'me encargo', 'mi responsabilidad'],
}
const PRIVATE: Check = {
  id: 'private',
  test: /\b(in private|privately|step (aside|outside|away)|have a (quick )?word|after service|come with me|quiet (word|moment|place))\b/i,
  stems: ['अलग से', 'अकेले में', 'सर्विस के बाद', 'छुट्टै', 'एक्लै', 'सर्भिसपछि', 'আলাদা করে', 'একান্তে', 'সার্ভিসের পর', 'தனியாக', 'சேவைக்குப் பிறகு', 'en privado', 'a solas', 'después del servicio'],
}
const SPECIFIC: Check = {
  id: 'specific',
  test: /\b(t\d+|table \d+|tonight|yesterday|this week|\d+ (min|minutes)|when you|i noticed|i saw)\b/i,
  stems: ['आज रात', 'आज मैंने', 'आज राति', 'देखें', 'আজ রাতে', 'আজ দেখলাম', 'இன்றிரவு', 'இன்று', 'esta noche', 'vi que'],
}
const SUPPORT: Check = {
  id: 'support',
  test: /\b(are you (ok|okay|alright|all right)|how are you|not your fault|take (a|five|a few|some) (min|minutes|break|moment)|i['’]?ve got (it|this)|you['’]?re safe|i believe you)\b/i,
  stems: ['आप ठीक', 'तुम ठीक', 'आपकी कोई ग़लती नहीं', 'आपकी ग़लती नहीं', 'आपकी गलती नहीं', 'ठीक हुनुहुन्छ', 'तपाईंको गल्ती होइन', 'ঠিক আছেন', 'আপনার কোনো দোষ নেই', 'আপনার দোষ নেই', 'நலமா', 'உங்கள் தவறு இல்லை', 'உங்கள் தவறு எதுவும் இல்லை', 'estás bien', 'está bien?', 'no es tu culpa', 'no es su culpa'],
}
const FOLLOW: Check = {
  id: 'follow',
  test: /\b(check (in|back)|follow up|let['’]?s (talk|meet|agree)|tomorrow|next shift|keep an eye|together)\b/i,
  stems: ['कल', 'फिर बात', 'बाद में बात', 'हम बात करेंगे', 'भोलि', 'फेरि कुरा', 'पछि कुरा', 'কাল', 'আবার কথা', 'পরে কথা', 'நாளை', 'மீண்டும் பேச', 'பேசுவோம்', 'mañana', 'hablamos', 'lo revisamos', 'revisamos'],
}
const EMERGENCY: Check = {
  id: 'emergency',
  test: /\b(112|108|ambulance|epi-?pen|adrenaline|auto-?injector|doctor|hospital)\b/i,
  stems: ['112', '११२', '১১২', 'एम्बुलेंस', 'एम्बुलेन्स', 'অ্যাম্বুলেন্স', 'ஆம்புலன்ஸ்', 'ambulancia', 'adrenalina'],
}
const NO_SHAME: Check = {
  id: 'shame',
  test: /\b(useless|stupid|lazy|(?<!not )your fault|you always|you never|in front of everyone|or you['’]?re (out|fired))\b/i,
  stems: ['बेकार', 'आलसी', 'बेवकूफ़', 'हमेशा तुम', 'काम नलाग्ने', 'अल्छी', 'অকেজো', 'অলস', 'বোকা', 'சோம்பேறி', 'பயனற்ற', 'inútil', 'vago', 'vaga', 'siempre haces'],
}

export const SCENARIOS: Scenario[] = [
  { id: 'cold_food', musts: [APOLOGY, ACTION, TIME] },
  { id: 'long_wait', musts: [APOLOGY, TIME, ACTION] },
  { id: 'sold_out', musts: [APOLOGY, EMPATHY, ACTION] },
  { id: 'allergy', musts: [CHECK_KITCHEN, ACTION] },
  { id: 'rude', musts: [APOLOGY, ACTION] },
  { id: 'wrong_bill', musts: [APOLOGY, ACTION, EMPATHY] },
  // Inclusive service
  { id: 'access_direct', musts: [APOLOGY, DIRECT, ACTION] },
  { id: 'fasting', musts: [ASK, CHECK_KITCHEN, ACTION] },
  { id: 'misgender', musts: [APOLOGY, ACTION] },
  // Managers (TableMate plays a guest or a team member)
  { id: 'm_guest', for: 'manager', musts: [LISTEN, APOLOGY, OWN, ACTION] },
  { id: 'm_feedback', for: 'manager', plays: 'staff', musts: [PRIVATE, SPECIFIC, LISTEN, FOLLOW] },
  { id: 'm_harassed', for: 'manager', plays: 'staff', musts: [SUPPORT, ACTION, FOLLOW] },
  { id: 'm_conflict', for: 'manager', plays: 'staff', musts: [PRIVATE, LISTEN, FOLLOW] },
  { id: 'm_newhire', for: 'manager', plays: 'staff', musts: [SUPPORT, ACTION, FOLLOW] },
  { id: 'm_allergy', for: 'manager', musts: [EMERGENCY, ACTION] },
]

/** The scenarios a server or a manager can practise. */
export function scenariosFor(role: 'server' | 'manager'): Scenario[] {
  return SCENARIOS.filter((s) => (s.for ?? 'server') === role)
}

export function scenarioById(id: string | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export interface Score {
  /** 0–100. */
  score: number
  /** 1–3, from the score. */
  stars: 1 | 2 | 3
  /** Each thing a great reply does here, and whether this one did it. */
  criteria: { id: string; met: boolean; label: string }[]
  good: string[]
  tips: string[]
  /** It blamed, judged, shamed or guessed about safety: the other side gets much more upset. */
  penalty: boolean
}

export function starsFor(score: number): 1 | 2 | 3 {
  return score >= 80 ? 3 : score >= 50 ? 2 : 1
}

/**
 * Scores one reply out of 100: the share of this situation's must-dos it hits, plus a little for
 * showing understanding where that isn't already required, minus a lot for blame, judgement,
 * shaming or guessing about safety. Coaching comes back in the requested language.
 */
export function scoreReply(scenarioId: string, reply: string, lang?: string): Score {
  const sc = scenarioById(scenarioId) ?? SCENARIOS[0]
  const tx = practiceText(lang).checks
  const manager = sc.for === 'manager'
  const hits = sc.musts.map((c) => met(c, reply))
  let score = Math.round((100 * hits.filter(Boolean).length) / sc.musts.length)
  const good = sc.musts.filter((_, i) => hits[i]).map((c) => tx[c.id].good)
  const tips = sc.musts.filter((_, i) => !hits[i]).map((c) => tx[c.id].tip)
  if (!manager && !sc.musts.includes(EMPATHY) && met(EMPATHY, reply)) {
    score = Math.min(100, score + 10)
    good.push(tx.empathy.good)
  }
  const bads = (manager ? [NO_BLAME, NO_SHAME] : [NO_BLAME, NO_GUESS, NO_JUDGE]).filter((b) => met(b, reply))
  for (const b of bads) tips.unshift(tx[b.id].tip)
  score -= 45 * bads.length
  const words = reply.trim().split(/\s+/).filter(Boolean).length
  if (words < 4 && reply.trim().length < 25) {
    score -= 15
    tips.push(tx.short.tip)
  }
  score = Math.max(0, Math.min(100, score))
  return {
    score,
    stars: bads.length ? 1 : starsFor(score),
    criteria: sc.musts.map((c, i) => ({ id: c.id, met: hits[i], label: hits[i] ? tx[c.id].good : tx[c.id].tip })),
    good: good.filter(Boolean),
    tips,
    penalty: bads.length > 0,
  }
}

// ---------------------------------------------------------------------------
// The other side of the conversation

/** Patience runs 0 (they give up) to 4 (won over); everyone starts at 2: unhappy but willing. */
export const PATIENCE_START = 2
export const PATIENCE_MAX = 4
/** After this many replies the conversation ends either way. */
export const MAX_REPLIES = 4

export type Mood = 'better' | 'same' | 'worse'
export type Outcome = 'won' | 'lost' | 'ok'

/** How one reply moves the other person: strong replies calm them, poor ones wind them up. */
export function moodFor(score: number, penalty = false): Mood {
  if (penalty || score < 45) return 'worse'
  return score >= 75 ? 'better' : 'same'
}

const STEP: Record<Mood, number> = { better: 1, same: 0, worse: -1 }

/**
 * Patience after a run of replies (penalties cost double), and whether that ends the conversation.
 * Two strong replies win them over, even with a weak one in between, as long as they haven't given up.
 */
export function patienceAfter(turns: { score: number; penalty?: boolean }[]): { patience: number; outcome?: Outcome } {
  let p = PATIENCE_START
  let strong = 0
  for (const t of turns) {
    const mood = moodFor(t.score, t.penalty)
    if (mood === 'better') strong++
    p += STEP[mood] * (t.penalty ? 2 : 1)
    p = Math.max(0, Math.min(PATIENCE_MAX, p))
    if (p >= PATIENCE_MAX || (strong >= 2 && p >= PATIENCE_START)) return { patience: PATIENCE_MAX, outcome: 'won' }
    if (p <= 0) return { patience: p, outcome: 'lost' }
  }
  if (turns.length >= MAX_REPLIES) return { patience: p, outcome: p >= 3 ? 'won' : p <= 1 ? 'lost' : 'ok' }
  return { patience: p }
}

export interface PracticeTurn {
  /** What the other side says next (in the requested language). */
  text: string
  /** Score of the reply just given (absent on the opening line). */
  scored?: Score
  /** The ideal version of the reply just given. */
  ideal?: string
  mood?: Mood
  patience: number
  done: boolean
  outcome?: Outcome
}

/**
 * The built-in role-play: scores the latest reply and answers like a real person would. A good
 * reply calms them but they raise a real follow-up; a vague one gets pushed for specifics; a poor
 * one makes them more upset. Win them over (or lose them) and the conversation ends.
 */
export function practiceStep(scenarioId: string, replies: string[], lang?: string): PracticeTurn {
  const sc = scenarioById(scenarioId) ?? SCENARIOS[0]
  const tx: PracticeText = practiceText(lang)
  const lines = tx.scenarios[sc.id] ?? practiceText('en').scenarios[sc.id]
  const who = sc.plays === 'staff' ? 'staff' : 'guest'
  if (!replies.length) return { text: lines.opening, patience: PATIENCE_START, done: false }
  const scores = replies.map((r) => scoreReply(sc.id, r, lang))
  const last = scores.at(-1)!
  const { patience, outcome } = patienceAfter(scores)
  const mood = moodFor(last.score, last.penalty)
  const ideal = lines.ideal[Math.min(replies.length - 1, 1)]
  if (outcome) {
    const text = outcome === 'won' ? lines.resolved : outcome === 'lost' ? lines.walkout : tx.grudging[who]
    return { text, scored: last, ideal, mood, patience, done: true, outcome }
  }
  // Each reaction is used once; after that a vague or poor reply gets pushed for specifics.
  const seen = { calm: false, upset: false }
  for (let i = 0; i < scores.length - 1; i++) {
    const m = moodFor(scores[i].score, scores[i].penalty)
    if (m === 'better') seen.calm = true
    if (m === 'worse') seen.upset = true
  }
  const text = mood === 'better' && !seen.calm ? lines.calm : mood === 'worse' && !seen.upset ? lines.upset : tx.push[who]
  return { text, scored: last, ideal, mood, patience, done: false }
}

/** A short debrief in the requested language: what worked, what to practise, how it ended. */
export function practiceDebrief(scenarioId: string, replies: string[], lang?: string, scores?: number[]): { text: string; score: number; stars: 1 | 2 | 3; outcome: Outcome; ideals: string[] } {
  const sc = scenarioById(scenarioId) ?? SCENARIOS[0]
  const tx = practiceText(lang)
  const scored = replies.map((r) => scoreReply(sc.id, r, lang))
  // A model's own scores (if it gave them) take precedence over the word-matching rubric.
  const values = scored.map((s, i) => scores?.[i] ?? s.score)
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  const { outcome = 'ok' } = patienceAfter(values.map((score, i) => ({ score, penalty: scored[i].penalty })))
  const good = [...new Set(scored.flatMap((s) => s.good))].slice(0, 2)
  // What to practise: a must-do no reply managed, or else a slip (blame, guessing…) that happened.
  const managed = new Set(scored.flatMap((s) => s.criteria.filter((c) => c.met).map((c) => c.id)))
  const never = sc.musts.find((c) => !managed.has(c.id))
  const slip = scored.find((s) => s.penalty)?.tips[0]
  const tip = slip ?? (never ? tx.checks[never.id].tip : undefined)
  const text = [
    tx.debrief[outcome],
    good.length ? `${tx.debrief.worked}: ${good.join(' ')}` : '',
    `${tx.debrief.practise}: ${tip ?? tx.debrief.keep}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { text, score: avg, stars: starsFor(avg), outcome, ideals: (tx.scenarios[sc.id] ?? practiceText('en').scenarios[sc.id]).ideal }
}

/** The opening line in English: what the scenario is, for prompts. */
export function scenarioOpening(scenarioId: string, lang = 'en'): string {
  return (practiceText(lang).scenarios[scenarioId] ?? practiceText('en').scenarios[scenarioId])?.opening ?? ''
}
