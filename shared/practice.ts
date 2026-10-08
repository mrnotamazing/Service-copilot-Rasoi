// "Practice tough moments": short role-plays where the AI plays a guest (or, for managers, a team
// member) and coaches the reply.
// The rubric below powers the built-in coach (no AI service needed) and is also given to Dify,
// so feedback always follows the restaurant's own service standards.

export interface Scenario {
  id: string
  /** Who practises it. Unset: servers. */
  for?: 'server' | 'manager'
  /** Who the AI plays: a guest (default) or a team member. */
  plays?: 'guest' | 'staff'
  /** Lines for the built-in role-play: the opening, then one follow-up. */
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

// Inclusive service: speak to the guest, ask instead of assuming, and never comment on the need.
const DIRECT: Check = {
  id: 'direct',
  test: /\b(you|your)\b/i,
  good: 'You spoke to the guest directly.',
  tip: 'Speak to the guest themselves, not only to the person with them.',
}
const ASK: Check = {
  id: 'ask',
  test: /\b(may i ask|can i ask|could you tell me|what (would|do) you|is there anything|which .* (do|would) you|do you (eat|avoid|prefer))\b|\?/i,
  good: 'You asked instead of assuming.',
  tip: 'Ask kindly what they eat or need: rules differ from person to person.',
}
const NO_JUDGE: Check = { id: 'judge', test: /\b(why (don['’]?t|do) you|that['’]?s (weird|strange|odd)|just this once|a little won['’]?t)\b/i, good: '', tip: 'Never question or comment on someone’s faith, diet or disability.' }

// Managers: listen, take ownership, protect the team, act privately, follow up.
const LISTEN: Check = {
  id: 'listen',
  test: /\b(tell me (what|more)|what happened|help me understand|i['’]?d like to hear|walk me through|i hear you|i understand)\b/i,
  good: 'You listened before acting.',
  tip: 'Start by listening: “Tell me what happened.”',
}
const OWN: Check = {
  id: 'own',
  test: /\b(i['’]?m the (manager|floor manager)|my name is|i['’]?ll (personally|take care|look into|make sure|sort)|i take responsibility|that['’]?s on (us|me))\b/i,
  good: 'You took ownership.',
  tip: 'Introduce yourself and take ownership: “I’m the manager; I’ll sort this out.”',
}
const PRIVATE: Check = {
  id: 'private',
  test: /\b(in private|privately|step (aside|outside|away)|have a (quick )?word|after service|come with me|quiet (word|moment|place))\b/i,
  good: 'You kept it private.',
  tip: 'Move the conversation somewhere private, away from guests and the team.',
}
const SPECIFIC: Check = {
  id: 'specific',
  test: /\b(t\d+|table \d+|tonight|yesterday|this week|\d+ (min|minutes)|when you|i noticed|i saw)\b/i,
  good: 'You were specific about what happened.',
  tip: 'Be specific: when, which table, what happened, and the effect.',
}
const SUPPORT: Check = {
  id: 'support',
  test: /\b(are you (ok|okay|alright|all right)|how are you|not your fault|take (a|five|a few|some) (min|minutes|break|moment)|i['’]?ve got (it|this)|you['’]?re safe|i believe you)\b/i,
  good: 'You looked after the person first.',
  tip: 'Check on the person first: “Are you okay? It wasn’t your fault.”',
}
const FOLLOW: Check = {
  id: 'follow',
  test: /\b(check (in|back)|follow up|let['’]?s (talk|meet|agree)|tomorrow|next shift|keep an eye|together)\b/i,
  good: 'You agreed a follow-up.',
  tip: 'Agree a next step and when you’ll check in.',
}
const EMERGENCY: Check = {
  id: 'emergency',
  test: /\b(112|108|ambulance|epi-?pen|adrenaline|auto-?injector|doctor|hospital)\b/i,
  good: 'You treated it as an emergency straight away.',
  tip: 'Act first: call 112 for an ambulance and help them use their own adrenaline auto-injector.',
}
const NO_SHAME: Check = {
  id: 'shame',
  test: /\b(useless|stupid|lazy|(?<!not )your fault|you always|you never|in front of everyone|or you['’]?re (out|fired))\b/i,
  good: '',
  tip: 'Talk about the work, not the person; avoid “always”, “never” and labels.',
}

export const SCENARIOS: Scenario[] = [
  { id: 'cold_food', guest: ['Excuse me. My lamb is lukewarm, and we waited forty minutes for it.', 'Fine. But I don’t want to wait another forty minutes.'], musts: [APOLOGY, ACTION, TIME] },
  { id: 'long_wait', guest: ['It’s been half an hour since we ordered. Is anything actually happening?', 'We have a show at nine. Will we make it?'], musts: [APOLOGY, TIME, ACTION] },
  { id: 'sold_out', guest: ['The risotto is off? That’s the whole reason we came tonight.', 'What would you have instead, honestly?'], musts: [APOLOGY, EMPATHY, ACTION] },
  { id: 'allergy', guest: ['I have a severe nut allergy. Is the biryani safe for me?', 'Okay. What could I have instead?'], musts: [CHECK_KITCHEN, ACTION] },
  { id: 'rude', guest: ['Hey, you! We’ve been waving for ages. Do you even work here?', 'Just bring the bill. Now.'], musts: [APOLOGY, ACTION] },
  { id: 'wrong_bill', guest: ['This bill has two desserts on it that we never ordered.', 'This is the second mistake tonight.'], musts: [APOLOGY, ACTION, EMPATHY] },
  // Inclusive service
  {
    id: 'access_direct',
    guest: ['(The guest uses a wheelchair. You asked their friend what they would like.) Excuse me, you can ask me. I’m the one ordering.', 'Thank you. And is there a step on the way to the restroom?'],
    musts: [APOLOGY, DIRECT, ACTION],
  },
  { id: 'fasting', guest: ['I’m fasting for Navratri, so no grains, onion or garlic tonight. What can I actually eat here?', 'And can the kitchen make something specially?'], musts: [ASK, CHECK_KITCHEN, ACTION] },
  { id: 'misgender', guest: ['(You said “sir”.) Actually, it’s “ma’am”. Or just my name, Priya.', 'It happens. Could we see the dessert menu?'], musts: [APOLOGY, ACTION] },
  // Managers (TableMate plays a guest or a team member)
  {
    id: 'm_guest',
    for: 'manager',
    guest: ['Are you the manager? Our server ignored us for twenty minutes and then got our order wrong. This is unacceptable.', 'Fine. But I don’t want that server at our table again.'],
    musts: [LISTEN, APOLOGY, OWN, ACTION],
  },
  {
    id: 'm_feedback',
    for: 'manager',
    plays: 'staff',
    guest: ['You wanted to see me? Is this about the bills taking long? Section A was packed tonight.', 'Okay. What should I do differently?'],
    musts: [PRIVATE, SPECIFIC, LISTEN, FOLLOW],
  },
  {
    id: 'm_harassed',
    for: 'manager',
    plays: 'staff',
    guest: ['The man at T6 keeps grabbing my arm and making comments. I don’t want to go back there.', 'But they’re regulars. Won’t I get in trouble?'],
    musts: [SUPPORT, ACTION, FOLLOW],
  },
  {
    id: 'm_conflict',
    for: 'manager',
    plays: 'staff',
    guest: ['Rohan keeps taking tables from my section and the tips that come with them. It’s not fair and I’m done being polite about it.', 'So what are you going to do about it?'],
    musts: [PRIVATE, LISTEN, FOLLOW],
  },
  {
    id: 'm_newhire',
    for: 'manager',
    plays: 'staff',
    guest: ['Sorry… I’m new and my English isn’t good. Everything is so fast tonight, I keep forgetting things.', 'Maybe this job is not for me.'],
    musts: [SUPPORT, ACTION, FOLLOW],
  },
  {
    id: 'm_allergy',
    for: 'manager',
    guest: ['My husband’s lips are swelling. He told the waiter he’s allergic to nuts! What was in that kebab?', 'Is someone calling an ambulance?'],
    musts: [EMERGENCY, ACTION],
  },
]

/** The scenarios a server or a manager can practise. */
export function scenariosFor(role: 'server' | 'manager'): Scenario[] {
  return SCENARIOS.filter((s) => (s.for ?? 'server') === role)
}

/** Feedback on one reply: what worked, the most useful tip, and 1–3 stars. */
export function scoreReply(scenarioId: string, reply: string): { good: string[]; tips: string[]; stars: number } {
  const sc = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]
  const manager = sc.for === 'manager'
  const checks = [...sc.musts, ...(manager || sc.musts.includes(EMPATHY) ? [] : [EMPATHY])]
  const good: string[] = []
  const tips: string[] = []
  for (const c of checks) (c.test.test(reply) ? good.push(c.good) : sc.musts.includes(c) && tips.push(c.tip))
  const bads = manager ? [NO_BLAME, NO_SHAME] : [NO_BLAME, NO_GUESS, NO_JUDGE]
  for (const bad of bads) if (bad.test.test(reply)) tips.unshift(bad.tip)
  if (reply.trim().split(/\s+/).length < 5) tips.push('Say a little more: a full, calm sentence reassures them.')
  const hit = sc.musts.filter((c) => c.test.test(reply)).length / sc.musts.length
  const stars = tips.some((t) => bads.some((b) => b.tip === t)) ? 1 : hit >= 0.99 ? 3 : hit >= 0.5 ? 2 : 1
  return { good: good.filter(Boolean), tips, stars }
}
