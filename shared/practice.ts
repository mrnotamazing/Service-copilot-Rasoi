// "Practice tough moments": short role-plays where the AI plays a guest and coaches the reply.
// The rubric below powers the built-in coach (no AI service needed) and is also given to Dify,
// so feedback always follows the restaurant's own service standards.

export interface Scenario {
  id: string
  /** Guest lines for the built-in role-play: the opening, then one follow-up. */
  guest: [string, string]
  /** Extra things a great reply does in this situation. */
  musts: Check[]
}

export interface Check {
  id: string
  test: RegExp
  good: string
  tip: string
}

const APOLOGY: Check = { id: 'sorry', test: /\b(sorry|apolog)/i, good: 'You apologised.', tip: 'Start with a sincere sorry, even if it wasn’t your fault.' }
const EMPATHY: Check = {
  id: 'empathy',
  test: /\b(understand|i hear you|you['’]?re right|completely fair|frustrat|that['’]?s not (ok|okay|good enough))/i,
  good: 'You showed you understood how they feel.',
  tip: 'Name the feeling: “I completely understand, that’s frustrating.”',
}
const ACTION: Check = {
  id: 'action',
  test: /\b(i['’]?ll|i will|let me|right away|straight away|replace|bring|check|fix|arrange|get you)\b/i,
  good: 'You offered a clear next step.',
  tip: 'Say exactly what you’ll do next: “Let me replace it right away.”',
}
const TIME: Check = { id: 'time', test: /\b(\d+\s*(min|minute)s?|a minute|right now|immediately|shortly)\b/i, good: 'You gave a time.', tip: 'Give a time, so the wait feels shorter: “in about 5 minutes”.' }
const NO_BLAME: Check = {
  id: 'blame',
  test: /\b(kitchen['’]?s fault|not my fault|chef (messed|forgot)|they messed|blame)\b/i,
  good: '',
  tip: 'Leave the kitchen out of it. The guest wants it fixed, not who caused it.',
}
const CHECK_KITCHEN: Check = {
  id: 'confirm',
  test: /\b(check|confirm|ask)\b.*\b(kitchen|chef)\b|\b(kitchen|chef)\b.*\b(check|confirm)\b/i,
  good: 'You checked with the kitchen instead of guessing.',
  tip: 'Never promise a dish is safe from memory. Say you’ll confirm with the chef.',
}
const NO_GUESS: Check = { id: 'guess', test: /\b(definitely safe|it['’]?s safe|100%|for sure|no nuts at all)\b/i, good: '', tip: 'Don’t guarantee safety yourself; let the kitchen confirm.' }

export const SCENARIOS: Scenario[] = [
  { id: 'cold_food', guest: ['Excuse me. My lamb is lukewarm, and we waited forty minutes for it.', 'Fine. But I don’t want to wait another forty minutes.'], musts: [APOLOGY, ACTION, TIME] },
  { id: 'long_wait', guest: ['It’s been half an hour since we ordered. Is anything actually happening?', 'We have a show at nine. Will we make it?'], musts: [APOLOGY, TIME, ACTION] },
  { id: 'sold_out', guest: ['The risotto is off? That’s the whole reason we came tonight.', 'What would you have instead, honestly?'], musts: [APOLOGY, EMPATHY, ACTION] },
  { id: 'allergy', guest: ['I have a severe nut allergy. Is the biryani safe for me?', 'Okay. What could I have instead?'], musts: [CHECK_KITCHEN, ACTION] },
  { id: 'rude', guest: ['Hey, you! We’ve been waving for ages. Do you even work here?', 'Just bring the bill. Now.'], musts: [APOLOGY, ACTION] },
  { id: 'wrong_bill', guest: ['This bill has two desserts on it that we never ordered.', 'This is the second mistake tonight.'], musts: [APOLOGY, ACTION, EMPATHY] },
]

/** Feedback on one reply: what worked, the most useful tip, and 1–3 stars. */
export function scoreReply(scenarioId: string, reply: string): { good: string[]; tips: string[]; stars: number } {
  const sc = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]
  const checks = [...sc.musts, ...(sc.musts.includes(EMPATHY) ? [] : [EMPATHY])]
  const good: string[] = []
  const tips: string[] = []
  for (const c of checks) (c.test.test(reply) ? good.push(c.good) : sc.musts.includes(c) && tips.push(c.tip))
  for (const bad of [NO_BLAME, NO_GUESS]) if (bad.test.test(reply)) tips.unshift(bad.tip)
  if (reply.trim().split(/\s+/).length < 5) tips.push('Say a little more: a full, calm sentence reassures the guest.')
  const hit = sc.musts.filter((c) => c.test.test(reply)).length / sc.musts.length
  const stars = tips.some((t) => t === NO_BLAME.tip || t === NO_GUESS.tip) ? 1 : hit >= 0.99 ? 3 : hit >= 0.5 ? 2 : 1
  return { good: good.filter(Boolean), tips, stars }
}
