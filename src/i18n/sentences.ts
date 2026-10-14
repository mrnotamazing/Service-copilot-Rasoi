// Sentences the server writes in English (the activity feed, kitchen alerts, floor suggestions, the
// "why tonight" analysis). They are shown in the person's language by matching each one against these
// templates, translating the template and putting the same names and numbers back in. Anything that
// matches no template (a note someone typed, a dish name) is shown as written.
//
// A {name} in a template stands for any text. Keep a template in the same words the server uses.

import { getPrefs } from '../lib/prefs.ts'
import { L } from './index.ts'

export const SENTENCES: string[] = [
  // --- Activity feed
  '{t} seated: party of {n}',
  '{t} seated: party of {n} · {rest}',
  '{t} ordered {items}',
  'Kitchen: a dish ready at the pass',
  'Kitchen: a dish ready at the pass for {t}',
  'Kitchen: {n} dishes ready at the pass',
  'Kitchen: {n} dishes ready at the pass for {t}',
  '{s} took {t}’s food from the pass',
  '{t}’s food was waiting; the manager ran it',
  '{d} is back on the menu',
  '{d} is off the menu',
  '{s} greeted {t}',
  '{s} told {t} about a kitchen delay before they asked',
  '{s} told {t} a dish had run out',
  '{t}: guests not happy at the check-in',
  '{s} checked in at {t}',
  '{s} checked in at {t}: happy',
  '{s} checked in at {t}: fine',
  '{t} asked to see the manager',
  '{s} won {t} back',
  'The manager visited {t}',
  '{s} caught an allergy or diet clash at {t}',
  '{s} sent {t}’s allergy to the kitchen',
  '{s} cleared starters at {t}',
  '{s} cleared mains at {t}',
  '{s} cleared desserts at {t}',
  '{t} asked for the bill',
  '{s} brought {t} the bill',
  '{t}’s bill was late; the manager brought it',
  '{t} paid',
  '{s} said goodbye to {t}',
  '{t} reset and ready',
  'Kitchen → floor: {x}',
  '{s} → kitchen: {x}',
  '{s} asked the kitchen: {x}',
  'Kitchen answered: {x}',
  'Kitchen answered {s}: {x}',
  '{s} → everyone: {x}',
  '{s} sent kudos to {s2}',
  '{s} practised a tough moment: {n}/100',
  '{s} practised a tough moment: {n}/100 (finished)',
  // words inside those lines
  'regular',
  'anniversary',
  'birthday',
  'business dinner',
  'nut allergy',
  'shellfish allergy',
  'gluten allergy',
  'dairy allergy',
  'wheelchair user',
  'hard of hearing',
  'low vision',
  'high chair',
  'Jain',
  'halal',
  'vegan',
  'quiet table',
  'assistance animal',
  'no beef',
  'no pork',
  'fasting',
  'a dish',
  // --- Kitchen alerts and tickets
  'ALLERGY {t}: {list}',
  'SAFETY {t}: {items}. Please adapt or tell me.',
  '{n} min over standard',
  '{n}% of standard time',
  'past its standard time',
  '{tag} allergy',
  '{because} diet ({tag})',
  'party of {n}',
  'nuts',
  'shellfish',
  'gluten',
  'dairy',
  // --- Floor suggestions
  '{t}: no one on tonight lists {lang}',
  'The guests prefer {lang}. {s} can use the assistant to say the welcome and read the menu notes in {lang}, and keep sentences short and clear.',
  'Hand {t} to {s}',
  'Hand to {s}',
  'Handed {t} to {s}',
  'The guests prefer {lang}; {h} speaks it and has {tw}.',
  'They haven’t ordered yet, so it’s an easy handover.',
  '{m} introduces {h}, and the table goes back to {m2} after this visit.',
  'Ask {h} to stop by {t}',
  'Ask {h}',
  'The guests prefer {lang}, which {h} speaks.',
  '{h} is at the table limit, so {m} keeps the table and {h2} joins for a minute at the next check-back.',
  'They have already ordered, so {m} keeps the table and {h} joins for a minute at the next check-back.',
  'Could you stop by {t} for a minute at the next check-back? The guests prefer {lang}. {m} is looking after them.',
  '{s} has {tw}, over tonight’s limit of {max}; {to} has {tw2}.',
  '{t} was seated {n} min ago and hasn’t ordered, so it’s the easiest to hand over.',
  'Nudge the kitchen about “{q}”',
  'Nudge the kitchen',
  '{s} asked {n} min ago{rest} and is still waiting for an answer for the guests.',
  'A guest is waiting on this: “{q}”. Could someone answer on the Kitchen screen?',
  'First visit at {t}: {s} for the welcome',
  'Give to {s}',
  '{s} is the best fit right now',
  'no tables',
  '{n} table',
  '{n} tables',
  '{t} is yours for this visit: {why}. {from} will introduce you; it goes back to {home} afterwards.',
  '{t} is yours for this visit. {from} will introduce you; it goes back to {home} afterwards.',
  '{t} goes to {to} for this visit ({why}). Please introduce {to2} to the guests and pass on anything they’ve told you.',
  '{t} goes to {to} for this visit. Please introduce {to2} to the guests and pass on anything they’ve told you.',
  'the guests prefer {lang}',
  '{from} has a full section',
  'their first visit, so we want the best welcome',
  '{t} is back with you.',
  '{t} goes back to {s}. Thank you for looking after them.',
  // --- Station and section forecast
  'dish',
  'dishes',
  ' Tonight it has run late on {a} of {b} tickets.',
  'Section {a} has {n} jobs due in the next 10 min; section {b} has {m}.',
  '1 job',
  // --- A table, step by step
  '{t}, party of {n}, seated at {time}, still dining ({m} min so far). Served by {s}.',
  '{t}, party of {n}, seated at {time}, left at {end} ({m} min). Served by {s}.',
  '{time} {what}: {a} min against a {b}-min standard.',
  '{time} {what}: {a} min against a {b}-min standard, {c} min over.',
  'Guests were unhappy at a check-in and were won back.',
  'Guests were unhappy at a check-in.',
  'At the last check-in guests were happy.',
  'At the last check-in guests were fine.',
  'Every step was to standard.',
  'Biggest delay: {what}, {n} min over ({owner}-controlled).',
  'Biggest delay: {what} on the {station} station, {n} min over ({owner}-controlled).',
  'In all, {k} min over in the kitchen and {f} min on the floor.',
  'kitchen',
  'floor',
  'Seated → greeted',
  'Bill asked → presented',
  'Paid → table reset',
  'Seat new parties in the section with the lightest load, or have whoever is nearest greet and hand over.',
  'Give guests a heads-up as soon as the ETA slips (the card prompts it), and look at cover for that station at peak.',
  'A food runner at peak, or a teammate who is free taking food from the pass, gets plates out while hot.',
  'Print the bill as dessert is cleared, so it is ready when they ask.',
  'Busser support at turn time gets the table back for the next party sooner.',
  // --- Why tonight is going the way it is
  'Guests',
  'Kitchen',
  'Floor',
  'No check-ins yet.',
  '{n}% of tickets past standard.',
  'No tickets finished yet.',
  '{n}% of floor steps past standard.',
  'No steps measured yet.',
  'Most of tonight’s lost time is in the kitchen ({p}% of {n} min over standard). Servers are waiting on food more than guests are waiting on servers.',
  'Most of tonight’s lost time is on the floor ({p}% of {n} min over standard), so it’s about hands and timing in the room more than the kitchen.',
  'Lost time is split between kitchen ({k} min) and floor ({f} min).',
  'The biggest single bottleneck is {label}: {detail}.',
  '{late} of {n} tickets ran past standard, {over} min over in all',
  '{late} of {n} steps ran past standard, {over} min over in all',
  'step',
  'steps',
  'ticket',
  'tickets',
  'One section is above the {max}-table limit right now, which slows every step there.',
  '{n} sections are above the {max}-table limit right now, which slows every step there.',
  'Service is running to standard so far. Nothing stands out.',
  'Nothing to explain yet: tables are still early in their visits.',
  'Stagger fires when several tables order together, and consider extra cover on the {station} station for the peak.',
  'Keep heads-ups early: a guest told before they ask rarely complains.',
  'Seat the next arrivals into the lightest section until the load evens out.',
  'Visit any unhappy table that hasn’t been won back yet.',
  'Greeting',
  'Kitchen prep',
  'Pass to table',
  'Bill presentation',
  'Table reset',
  '{station} station',
  '{s}’s section has {n} active tables (SOP limit {max}).',
  '{s}’s section has {n} active tables (SOP limit {max}). Consider handing {t} to {to} ({m} active).',
  '{station} station ran past target on {a} of {b} tickets (avg {c} min over). Consider extra cover there at peak.',
  'Plates wait at the pass on {p}% of courses. A food runner during peak would free servers up.',
  'Table resets are slow ({a} min vs {b} target). Busser support at turn time would raise covers.',
  // --- Added after reshaping the server's sentences
  '{s} speaks {lang}, which the guests prefer',
  '{s} has no tables right now',
  '{s} has room ({tw})',
  '{s} has no open cards',
  '{s} hasn’t welcomed a newcomer tonight',
  '{s} introduces {s2}, and the table goes back afterwards.',
  '{name}: {c} cooking.',
  'About {n} more due in {w} min.',
  'About {n} more due by {time}.',
  'Comfortable.',
  '{name} is likely to fall behind.',
  '{name} is getting busy.',
  'Peak in about {n} min.',
  '{c} dish cooking.',
  '{c} dishes cooking.',
  'New tickets may wait ~{x} min extra.',
  'Tonight it has run late on {a} of {b} tickets.',
  'Tonight it has run late on {a} of 1 ticket.',
  '{n} jobs',
  'Ask section {b} to run section {a}’s food from the pass for a few minutes.',
  'Seat the next party in section {c}.',
  'Every other section is at its table limit, so hold new parties at the door for a few minutes.',
  'This table’s wait was mostly the kitchen’s, not the server’s.',
  'Most of the lost time was on the floor.',
  '{h} happy, {o} fine, {u} unhappy.',
  '{h} happy, {o} fine, {u} unhappy ({r} won back).',
  '{h} happy, {o} fine, {u} unhappy. {n} waiting for you.',
  '{h} happy, {o} fine, {u} unhappy ({r} won back). {n} waiting for you.',
  'It bunched up between {a} and {b}: {n} {steps} ran late, with {m} {tickets} fired around then.',
  'A wave of orders landed together.',
  'grill', 'hot', 'cold', 'pastry', 'bar',
  'Grill station', 'Hot station', 'Cold station', 'Pastry station', 'Bar station',
  'greeting', 'kitchen prep', 'pass to table', 'bill presentation', 'table reset',
  // --- Demo staging (presenter moments and the simulated kitchen)
  'Staged: {x}',
  'a new party arrives',
  'a guest with a nut allergy at {t} orders {d}',
  'regulars arrive for a birthday',
  'a guest with an access need arrives',
  'guests who prefer {lang} sit at {t}',
  'a guest asks “{q}”',
  'the kitchen falls behind',
  '{d} runs out',
  '{t} isn’t happy with their food',
  '{t} asks to see the manager',
  '{t} asks for the bill',
  'a rush: {n} parties seated at once, more waiting',
  'No free table right now; they’ll be seated when one frees up.',
  'No free table right now.',
  'Everyone on tonight speaks the same languages.',
  'Nothing is cooking right now; try again once orders are in.',
  'Everything is already off.',
  'No table is eating yet; try again once food is out.',
  'No table has finished mains yet.',
  'Every table is full already.',
  '{station} is backed up, about {n} minutes behind',
  '{d} is off for tonight',
  '{c} in kitchen',
  '{c} pass → table',
  'Starter', 'Main', 'Dessert',
  '{t} is nearly due',
  '{t}: still {text}',
  '{t}: {text}',
  '{a} of {b} min',
  '{a} of {b} min, {station}',
]

type Compiled = { template: string; re: RegExp; names: string[] }

/** Placeholders that hold free text (a typed note, a list of dishes, the rest of a line). */
const FREE = new Set(['x', 'q', 'rest', 'items', 'list', 'text', 'detail'])

const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
let compiled: Compiled[] | null = null
function compile(): Compiled[] {
  if (compiled) return compiled
  const list = [...new Set(SENTENCES)].map((template) => {
    const names: string[] = []
    // Split on {name}, escape the fixed text between them.
    const source = template
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part)
        if (!m) return escape(part)
        names.push(m[1])
        // A name or number never runs across a sentence, a "·" list or a ";" clause; free text can.
        return FREE.has(m[1]) ? '(.+?)' : '((?:(?!\\. |; | · ).)+?)'
      })
      .join('')
    return { template, re: new RegExp(`^${source}$`, 's'), names }
  })
  // More fixed wording first, so the most specific template wins.
  const fixed = (c: Compiled) => c.template.replace(/\{\w+\}/g, '').length
  compiled = list.sort((a, b) => fixed(b) - fixed(a))
  return compiled
}

const cache = new Map<string, string>()
/** Between two sentences: end punctuation, a space, then a capital, a digit or an opening quote. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9“])/

/**
 * A sentence the server wrote in English, in the current language. Pieces that fill the sentence
 * (names, numbers, short phrases like "1 table") are translated too where they match a template.
 */
export function S(text: string | undefined | null, depth = 0): string {
  if (!text) return text ?? ''
  const { lang } = getPrefs()
  if (lang === 'en' || depth > 3) return text
  const ck = `${lang}\n${text}`
  const hit = cache.get(ck)
  if (hit !== undefined) return hit
  const out = translate(text, depth)
  if (cache.size > 4000) cache.clear()
  cache.set(ck, out)
  return out
}

function translate(raw: string, depth: number): string {
  const text = raw.replace(/'/g, '’')
  for (const c of compile()) {
    const m = c.re.exec(text)
    if (!m) continue
    const params: Record<string, string> = {}
    c.names.forEach((n, i) => (params[n] = S(m[i + 1], depth + 1)))
    const out = L(c.template, params)
    // A template with no translation yet returns the English with the pieces put back: fine.
    return out
  }
  // Several sentences: translate each.
  const sentences = text.split(SENTENCE_BREAK)
  if (sentences.length > 1) {
    const done = sentences.map((p) => S(p, depth + 1))
    if (done.some((d, i) => d !== sentences[i])) return done.join(' ')
  }
  // Several short parts in one sentence: "Ms. Reddy · nut allergy", "nuts, dairy".
  for (const sep of [' · ', '; ', ', ']) {
    if (text.includes(sep)) {
      const parts = text.split(sep)
      const done = parts.map((p) => S(p, depth + 1))
      if (done.some((d, i) => d !== parts[i])) return done.join(sep)
    }
  }
  // A single capitalised word that is known in lower case ("Grill" at the start of a sentence).
  if (/^[A-Z][a-z]+$/.test(text)) {
    const low = text.toLowerCase()
    const t = L(low)
    if (t !== low) return t
  }
  return L(text) === text ? raw : L(text)
}

/** For tests: does a template cover this sentence (or every sentence/part of it)? */
export function isCovered(raw: string, depth = 0): boolean {
  const text = raw.replace(/'/g, '’')
  if (compile().some((c) => c.re.test(text))) return true
  if (depth > 3) return false
  const sentences = text.split(SENTENCE_BREAK)
  if (sentences.length > 1) return sentences.every((p) => isCovered(p, depth + 1))
  for (const sep of [' · ', '; ', ', ']) if (text.includes(sep) && text.split(sep).some((p) => isCovered(p, depth + 1))) return true
  return false
}
