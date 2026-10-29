// Allergy and diet safety check. Deliberately rule-based, never an AI guess: a dish is
// flagged when its ingredient tags meet a guest's declared allergy or dietary need.

import type { MenuItem, Party } from './types.ts'

/** Dietary needs and the ingredient tags each one rules out. */
export const DIET_RULES: Record<string, string[]> = {
  vegetarian: ['meat', 'fish', 'shellfish', 'egg'],
  vegan: ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey'],
  jain: ['meat', 'fish', 'shellfish', 'egg', 'root'],
  halal: ['pork', 'alcohol', 'nonhalal'],
  no_beef: ['beef'],
  no_pork: ['pork'],
}

export interface SafetyIssue {
  /** The ingredient tag that clashes, e.g. "dairy". */
  tag: string
  /** "allergy" for a declared allergy, otherwise the dietary need (vegan, jain, halal). */
  because: string
}

export function safetyIssues(item: Pick<MenuItem, 'contains'> | undefined, party: Party | undefined): SafetyIssue[] {
  if (!item?.contains?.length || !party) return []
  const out: SafetyIssue[] = []
  for (const a of party.allergies) if (item.contains.includes(a.toLowerCase())) out.push({ tag: a.toLowerCase(), because: 'allergy' })
  for (const need of party.needs ?? []) {
    const banned = DIET_RULES[need]
    if (!banned) continue
    for (const tag of item.contains) if (banned.includes(tag) && !out.some((o) => o.tag === tag)) out.push({ tag, because: need })
  }
  return out
}

// ---------------------------------------------------------------------------
// "Which dishes can a Jain guest have?": answered from the ingredient tags, never guessed.

const NEED_WORDS: { need: string; label: string; words: RegExp }[] = [
  { need: 'jain', label: 'Jain', words: /\bjain\b|जैन|জৈন|ஜைன/i },
  { need: 'vegan', label: 'vegan', words: /\bvegan\b|वीगन|ভিগান|வீகன்|vegano/i },
  { need: 'vegetarian', label: 'vegetarian', words: /\bveg(etarian)?\b|शाकाहारी|शाकाहार|নিরামিষ|சைவ|vegetarian/i },
  { need: 'halal', label: 'halal', words: /halal|हलाल|হালাল|ஹலால்/i },
  { need: 'no_beef', label: 'no-beef', words: /\bbeef\b|बीफ़|बीफ|গোমাংস|மாட்டிறைச்சி|vacuno|ternera/i },
  { need: 'no_pork', label: 'no-pork', words: /\bpork\b|पोर्क|সুয়োরের|শূকর|பன்றி|cerdo/i },
]
const ALLERGY_WORDS: { tag: string; label: string; words: RegExp }[] = [
  { tag: 'nuts', label: 'nut allergy', words: /\b(nut|nuts|peanut|cashew|almond|pistachio)\b|मेव|बादाम|काजू|বাদাম|கொட்டை|frutos secos|nueces/i },
  { tag: 'dairy', label: 'dairy allergy', words: /\b(dairy|milk|lactose)\b|डेयरी|दूध|দুধ|பால்|lácteos|leche/i },
  { tag: 'gluten', label: 'gluten allergy', words: /\b(gluten|wheat|coeliac|celiac)\b|ग्लूटेन|गेहूँ|গ্লুটেন|க்ளூட்டன்|gluten/i },
  { tag: 'egg', label: 'egg allergy', words: /\beggs?\b|अंडा|अंडे|ডিম|முட்டை|huevo/i },
  { tag: 'shellfish', label: 'shellfish allergy', words: /\b(shellfish|prawn|shrimp|crab|lobster)\b|झींगा|চিংড়ি|இறால்|marisco/i },
  { tag: 'fish', label: 'fish allergy', words: /\bfish\b|मछली|মাছ|மீன்|pescado/i },
]
/** Asking for a list of dishes, not how to serve the guest ("which dishes", "what can they eat", "on the menu"). */
const LIST_INTENT = /\b(dish|dishes|menu|options?|which|what can|safe|suitable|items?|eat|have|order)\b|डिश|मेन्यू|मेनू|व्यंजन|क्या खा|कौन|খাবার|মেনু|কোন|உணவு|மெனு|எந்த|platos?|carta|qué puede/i

const READABLE: Record<string, string> = { root: 'onion, garlic or root veg', nonhalal: 'non-halal meat' }

/**
 * For a question like "what dishes are Jain on the menu?": which dishes suit that diet or allergy as
 * listed, and which don't and why. Null when the question isn't asking for such a list.
 */
export function menuForNeed(question: string, menu: MenuItem[]): string | null {
  if (!LIST_INTENT.test(question)) return null
  const needs = NEED_WORDS.filter((n) => n.words.test(question))
  const allergies = ALLERGY_WORDS.filter((a) => a.words.test(question))
  // "vegan" also reads as "veg": keep the stricter one.
  const diet = needs.some((n) => n.need === 'vegan') ? needs.filter((n) => n.need !== 'vegetarian') : needs
  if (!diet.length && !allergies.length) return null
  const party: Party = { size: 1, allergies: allergies.map((a) => a.tag), needs: diet.map((n) => n.need) }
  const ok: string[] = []
  const not: string[] = []
  for (const m of menu) {
    const issues = safetyIssues(m, party)
    if (!m.contains?.length) continue
    if (issues.length) not.push(`${m.name} (${[...new Set(issues.map((i) => READABLE[i.tag] ?? i.tag))].join(', ')})`)
    else ok.push(m.name)
  }
  const who = [diet.length ? `who is ${diet.map((n) => n.label).join(' and ')}` : '', allergies.length ? `with a ${allergies.map((a) => a.label.replace(' allergy', '')).join(' and ')} allergy` : ''].filter(Boolean).join(' and ')
  return [
    `For a guest ${who}, by tonight’s ingredient list:`,
    `✓ Suitable as listed: ${ok.length ? ok.join(', ') : 'none'}`,
    `✗ Not as listed: ${not.length ? not.join(', ') : 'none'}`,
    'Always confirm with the kitchen; some dishes can be adapted.',
  ].join('\n')
}
