// Answers a guest's question about a dish from what the restaurant recorded about it: ingredient
// tags, spice level, description, what the kitchen can change, and answers the kitchen gave before.
// When none of that covers the question it says so (known: false), and the app offers to ask the
// kitchen, never a guess. Pure, so the built-in trainer, the simulator and tests all agree.

import type { DishFact, MenuItem } from './types.ts'

export const SPICE_WORDS = ['not spicy', 'mild', 'medium spicy', 'hot'] as const

export interface DishAnswer {
  text: string
  /** False when the recorded details don't answer the question: ask the kitchen. */
  known: boolean
  /** A general question ("what's in it", "tell me about it"): show the whole dish card. */
  general?: boolean
}

const SPICE = /spic|\bhot\b|chill?i|heat|mirch|तीख|तीखा|मसालेद|पिरो|ঝাল|காரம்|picant/i
const CHANGE = /without|\bless\b|can (it|you|they|we|the|this)\b.*\b(made|make|done|changed|without|less|more)|be made|make it|remove|swap|instead|substitut|version|\bmild(er)?\b|बिना|कम |छाडेर|ছাড়া|இல்லாமல்|\bsin\b/i
const DIETS: [string, RegExp, string[]][] = [
  ['vegetarian', /vegetarian|\bveg\b|शाकाहारी/i, ['meat', 'fish', 'shellfish', 'pork']],
  ['vegan', /vegan/i, ['meat', 'fish', 'shellfish', 'pork', 'dairy', 'egg']],
  ['Jain', /\bjain/i, ['meat', 'fish', 'shellfish', 'pork', 'egg', 'root']],
  ['halal', /halal/i, ['pork', 'alcohol', 'nonhalal']],
]
const DESCRIBE = /what('?s| is) (in|it|the)|how (is|’s|'s) it|describe|made|ingredient|taste|recipe|क्या है|के हो|কী আছে|என்ன|qué lleva|cómo es/i

/** Ingredient words a guest might use, mapped to the menu's ingredient tags. */
const TAGS: [string, RegExp][] = [
  ['nuts', /\bnuts?\b|peanut|almond|cashew|pista|walnut|kaju|badam|मेवा/i],
  ['dairy', /milk|dairy|cream|cheese|butter|ghee|lactose|paneer|curd|yogh?urt|दूध/i],
  ['gluten', /gluten|wheat|flour|maida|atta/i],
  ['egg', /\beggs?\b|अंडा/i],
  ['fish', /\bfish\b|मछली/i],
  ['shellfish', /prawn|shrimp|crab|lobster|shellfish/i],
  ['soy', /\bsoy|soya/i],
  ['sesame', /sesame|\btil\b/i],
  ['meat', /\bmeat|chicken|lamb|mutton|beef|non-?veg/i],
  ['pork', /\bpork|bacon|ham\b/i],
  ['alcohol', /alcohol|wine|\brum\b|beer|liquor/i],
  ['root', /onion|garlic|potato|root veg|प्याज|लहसुन/i],
]
const TAG_WORD: Record<string, string> = { root: 'onion, garlic or root vegetables', nonhalal: 'non-halal meat', nuts: 'nuts' }

const STOP = new Set('a an the is are does do it this that there any in of with for to on be can you they we i guest guests our your please have has how what which dish item order much very tell about explain know info details me more like'.split(' '))
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? []

/** An earlier kitchen answer to the same question, if one fits well enough. */
export function matchFact(question: string, facts: DishFact[] = [], dishName = ''): DishFact | undefined {
  const skip = new Set(words(dishName))
  const q = new Set(words(question).filter((w) => !skip.has(w)))
  if (!q.size) return undefined
  let best: { f: DishFact; score: number } | undefined
  for (const f of facts) {
    const fw = new Set(words(f.q).filter((w) => !skip.has(w)))
    const shared = [...q].filter((w) => fw.has(w)).length
    const score = shared / Math.max(1, Math.min(q.size, fw.size))
    if (score >= 0.5 && (!best || score > best.score)) best = { f, score }
  }
  return best?.f
}

export function answerAboutDish(question: string, dish: MenuItem): DishAnswer {
  const name = dish.name
  const known = (text: string): DishAnswer => ({ text, known: true })
  const learned = matchFact(question, dish.facts, name)
  if (learned) return known(`${name}: ${learned.a} (the kitchen’s answer to “${learned.q}”)`)

  if (SPICE.test(question)) {
    if (dish.spice === undefined) return unknown(dish, 'how spicy it is')
    const level = SPICE_WORDS[dish.spice]
    const change = dish.adjust && /mild|spic|chill?i/i.test(dish.adjust) ? ` ${dish.adjust}` : ''
    return known(`${name} is ${level}${dish.spice ? ` (${dish.spice} of 3)` : ''}.${change}`)
  }

  // "Can it be made…" before anything else: only the kitchen's own notes can promise a change.
  if (CHANGE.test(question)) return dish.adjust ? known(`${name}: ${dish.adjust}`) : unknown(dish, 'what can be changed')

  const diet = DIETS.find(([, re]) => re.test(question))
  if (diet) {
    const clash = diet[2].filter((t) => dish.contains?.includes(t))
    return known(clash.length ? `${name} isn’t ${diet[0]} as it is: it contains ${clash.map((t) => TAG_WORD[t] ?? t).join(', ')}.${dish.adjust ? ` ${dish.adjust}` : ''}` : `${name} has nothing in its ingredient list that a ${diet[0]} diet avoids. Confirm with the kitchen for a strict diet.`)
  }

  const tags = TAGS.filter(([, re]) => re.test(question)).map(([tag]) => tag)
  if (tags.length) {
    const has = tags.filter((t) => dish.contains?.includes(t))
    const not = tags.filter((t) => !dish.contains?.includes(t))
    const parts = [
      has.length ? `contains ${has.map((t) => TAG_WORD[t] ?? t).join(' and ')}` : '',
      not.length ? `has no ${not.map((t) => TAG_WORD[t] ?? t).join(' or ')} in its ingredient list` : '',
    ].filter(Boolean)
    return known(`${name} ${parts.join('; it ')}. For an allergy, always confirm with the kitchen before ordering.`)
  }

  if (DESCRIBE.test(question)) return { text: dish.description ? `${name}: ${dish.description}` : `${name}.`, known: true, general: true }

  // "Tell me about the galouti kebab": the description is the answer.
  const asked = words(question).filter((w) => !words(name).includes(w))
  if (!asked.length) return { text: dish.description ? `${name}: ${dish.description}` : `${name}.`, known: true, general: true }
  // An ingredient the tags don't cover (coriander, mushroom…): only the description can say yes.
  const inText = asked.filter((w) => `${dish.description ?? ''} ${dish.adjust ?? ''}`.toLowerCase().includes(w))
  if (inText.length && dish.description) return known(`${name}: ${dish.description}`)
  return unknown(dish, 'that')
}

function unknown(dish: MenuItem, what: string): DishAnswer {
  return { text: `The menu notes for ${dish.name} don’t say ${what}. I won’t guess: tap “Ask the kitchen” and the chef gets your question straight away.`, known: false }
}

/** One line per dish with everything recorded about it, for the AI's menu knowledge. */
export function dishLine(m: MenuItem): string {
  const bits = [
    `${m.course}, ${m.station}, about ${m.prepMin} min`,
    `contains ${m.contains?.join(', ') || 'not listed'}`,
    m.spice !== undefined ? `spice: ${SPICE_WORDS[m.spice]}` : 'spice: not recorded',
    m.description ? `what it is: ${m.description}` : '',
    m.adjust ? `can be changed: ${m.adjust}` : '',
    ...(m.facts ?? []).slice(-5).map((f) => `kitchen answered "${f.q}": ${f.a}`),
  ].filter(Boolean)
  return `- ${m.name}: ${bits.join('; ')}`
}
