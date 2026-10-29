// "What should I suggest to table 4?": dishes picked from what the guests have said they'd like
// (spicy, light, vegetarian, something sweet…), never one that clashes with their allergies or
// diet, and never one the kitchen has switched off. Every wish in the conversation counts; a later
// wish wins where two disagree ("something spicy" … "actually, mild"). Rule-based, so it is the
// safety net under the AI's wording and the answer when no AI is reachable.

import { DIET_RULES, safetyIssues } from './safety.ts'
import type { Course, MenuItem, Party } from './types.ts'

export interface Wishes {
  spice?: 'hot' | 'mild'
  course?: Course
  diets: string[]
  allergies: string[]
  light?: boolean
  likes: string[]
}

const RULES: { re: RegExp; set: (w: Wishes) => void }[] = [
  { re: /\b(not|no|less|without)\s+(too\s+)?(spicy|hot|spice)\b|\bmild\b|कम (तीखा|मसाल)|बिना मिर्च|কম ঝাল|காரம் குறைவு|poco picante|sin picante|suave/i, set: (w) => (w.spice = 'mild') },
  { re: /\b(spic(y|ier)|hot|fiery|chilli|chili|kick)\b|तीखा|मसालेदार|पिरो|ঝাল|காரமான|picante/i, set: (w) => (w.spice = w.spice === 'mild' ? 'mild' : 'hot') },
  { re: /\b(starters?|appeti[sz]ers?|small plates?|to share|sharing)\b|स्टार्टर|स्टार्टर्स|entrantes?|entradas?/i, set: (w) => (w.course = 'starter') },
  { re: /\b(mains?|main course|hearty|filling|big meal|dinner)\b|मेन कोर्स|plato principal|fuerte/i, set: (w) => (w.course = 'main') },
  { re: /\b(desserts?|sweet|something sweet|after dinner)\b|मीठा|मिठाई|डेज़र्ट|মিষ্টি|ডেজার্ট|இனிப்பு|postres?|dulce/i, set: (w) => (w.course = 'dessert') },
  { re: /\b(light|healthy|not heavy|small)\b|हल्का|हलुका|হালকা|லேசான|ligero/i, set: (w) => (w.light = true) },
  { re: /\bvegan\b|वीगन|vegano/i, set: (w) => w.diets.push('vegan') },
  { re: /\bveg(etarian|gie)?\b|शाकाहारी|निरामिष|নিরামিষ|சைவ|vegetariano/i, set: (w) => w.diets.push('vegetarian') },
  { re: /\bjain\b|जैन/i, set: (w) => w.diets.push('jain') },
  { re: /\bhalal\b|हलाल/i, set: (w) => w.diets.push('halal') },
  { re: /\b(no|without|allergic to|allergy to)\s+(nuts?|peanuts?)\b|nut allergy|मेवे से एलर्जी/i, set: (w) => w.allergies.push('nuts') },
  { re: /\b(no|without|allergic to|allergy to)\s+(dairy|milk|lactose)\b|lactose|dairy allergy/i, set: (w) => w.allergies.push('dairy') },
  { re: /\b(no|without|allergic to|allergy to)\s+(gluten|wheat)\b|coeliac|celiac|gluten[- ]free/i, set: (w) => w.allergies.push('gluten') },
  { re: /\b(no|without|allergic to|allergy to)\s+eggs?\b|egg allergy/i, set: (w) => w.allergies.push('egg') },
  { re: /\b(no|without|allergic to|allergy to)\s+(shellfish|prawns?|shrimp)\b/i, set: (w) => w.allergies.push('shellfish') },
  { re: /\b(fish|seafood)\b/i, set: (w) => w.likes.push('fish') },
  { re: /\b(meat|lamb|mutton|chicken|kebab)\b/i, set: (w) => w.likes.push('meat') },
]
const LIKE_WORDS = /\b(chocolate|cream|cheese|mushroom|paneer|rice|pasta|truffle|saffron|pumpkin|tomato|lamb|biryani|kulfi|gnocchi|risotto|soup|kebab|tikka)\b/gi

/** What the guests want, from everything the server has typed so far (later wishes win). */
export function readWishes(lines: string[]): Wishes {
  const w: Wishes = { diets: [], allergies: [], likes: [] }
  for (const line of lines) {
    // A new spice wish replaces an older one.
    if (/spic|hot|mild|तीख|पिरो|ঝাল|கார|picante/i.test(line)) w.spice = undefined
    for (const r of RULES) if (r.re.test(line)) r.set(w)
    for (const m of line.matchAll(LIKE_WORDS)) w.likes.push(m[0].toLowerCase())
  }
  w.diets = [...new Set(w.diets)].filter((d) => !(d === 'vegetarian' && w.diets.includes('vegan')))
  w.allergies = [...new Set(w.allergies)]
  w.likes = [...new Set(w.likes)]
  return w
}

export interface Pick {
  item: MenuItem
  score: number
  why: string[]
}

/** Dishes that suit the table and the wishes, best first. Clashes and switched-off dishes are left out. */
/** The table's party plus any allergy or diet the server mentioned while asking. */
export function guestWith(party: Party | undefined, wishes: Wishes): Party {
  return { ...party, size: party?.size ?? 2, allergies: [...new Set([...(party?.allergies ?? []), ...wishes.allergies])], needs: [...new Set([...(party?.needs ?? []), ...wishes.diets.filter((d) => DIET_RULES[d])])] }
}

export function pickDishes(menu: MenuItem[], unavailable: string[], party: Party | undefined, wishes: Wishes, limit = 3): Pick[] {
  const guest = guestWith(party, wishes)
  const off = new Set(unavailable)
  const picks: Pick[] = []
  for (const item of menu) {
    if (off.has(item.id) || item.course === 'drink') continue
    if (safetyIssues(item, guest).length) continue
    const why: string[] = []
    let score = 0
    if (wishes.course) {
      if (item.course !== wishes.course) continue
      score += 2
    }
    const spice = item.spice ?? 0
    if (wishes.spice === 'hot') {
      if (spice >= 2) (score += 4), why.push('spicy')
      else score -= 3
    }
    if (wishes.spice === 'mild') {
      if (spice <= 1) (score += 2), why.push('mild')
      else continue
    }
    // What the table already told us: little ones at the table keep it mild, a celebration earns a dessert.
    if (!wishes.spice && guest.needs?.includes('highchair') && spice >= 2) score -= 2
    if (party?.occasion && !wishes.course && item.course === 'dessert') (score += 1), why.push(`for the ${party.occasion}`)
    if (wishes.light) {
      if (item.course === 'starter' || item.course === 'dessert') score += 1
      if ((item.contains ?? []).includes('meat')) score -= 1
      else why.push('light')
    }
    for (const like of wishes.likes) {
      const text = `${item.name} ${item.description ?? ''} ${(item.contains ?? []).join(' ')}`.toLowerCase()
      if (text.includes(like)) (score += 3), why.push(like)
    }
    picks.push({ item, score, why })
  }
  // Without a course in mind, one from each course reads better than three mains.
  picks.sort((a, b) => b.score - a.score)
  if (!wishes.course) {
    const seen = new Set<Course>()
    const varied = picks.filter((p) => (seen.has(p.item.course) ? false : (seen.add(p.item.course), true)))
    return [...varied, ...picks.filter((p) => !varied.includes(p))].slice(0, limit)
  }
  return picks.slice(0, limit)
}

/** One or two lines the server could say to recommend a dish. */
export function pitch(item: MenuItem): string {
  const first = (item.description ?? '').split(/(?<=\.)\s/)[0]?.trim()
  const heat = item.spice === 3 ? ' It has a real kick.' : item.spice === 2 ? ' It has a gentle warmth.' : ''
  return `“May I suggest the ${item.name}? ${first ? first.charAt(0).toUpperCase() + first.slice(1) : ''}${heat}”`.replace(/\s+”/, '”')
}

/** The built-in answer: what to suggest and why, from the rules above. */
export function suggestFallback(menu: MenuItem[], unavailable: string[], party: Party | undefined, wishLines: string[], dishId?: string, tableName?: string): { text: string; dishes: string[] } {
  if (dishId) {
    const item = menu.find((m) => m.id === dishId)
    if (!item) return { text: 'That dish isn’t on the menu.', dishes: [] }
    const issues = safetyIssues(item, guestWith(party, readWishes(wishLines)))
    if (issues.length) return { text: `Better not: the ${item.name} has ${issues.map((i) => i.tag).join(', ')}, which ${tableName ?? 'this table'} can’t have.`, dishes: [] }
    if (unavailable.includes(item.id)) return { text: `The ${item.name} is off tonight. Try another dish.`, dishes: [] }
    return { text: `${pitch(item)}${item.adjust ? `\nIf they ask: the kitchen can ${item.adjust.charAt(0).toLowerCase()}${item.adjust.slice(1)}` : ''}`, dishes: [item.id] }
  }
  const wishes = readWishes(wishLines)
  const picks = pickDishes(menu, unavailable, party, wishes)
  if (!picks.length) return { text: 'Nothing on tonight’s menu fits all of that. Ask the kitchen what they can adapt.', dishes: [] }
  const lines = picks.map((p) => `• ${p.item.name}${p.why.length ? ` (${[...new Set(p.why)].join(', ')})` : ''}: ${pitch(p.item)}`)
  return { text: lines.join('\n'), dishes: picks.map((p) => p.item.id) }
}
