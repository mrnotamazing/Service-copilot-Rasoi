// The copilot's reasoning layer, from the night's own data. Four jobs:
// - Assist: why the top card comes first.
// - Predict: which station is about to fall behind, and which section is about to be swamped.
// - Explain: what happened at one table, step by step, and why tonight went the way it did.
// - Learn: each person's own practice journey, with practice picked from their real shift.
// Pure functions: the same events always give the same answers. Nothing here ranks people:
// managers see stages, stations and section load; personal learning stays on the person's own screen.

import { analytics, segmentsFor, type EngineState } from './engine.ts'
import { eatMinutes, QUEUE_COST_MIN, STATION_CAPACITY } from './predict.ts'
import { istClock } from './time.ts'
import type { Owner, RestaurantConfig, Segment, Station, TableState, Task, TaskText, Upcoming, VisitRecord } from './types.ts'

const MIN = 60_000
const k = (key: string, p?: Record<string, string | number>): TaskText => ({ k: key, p })
const round1 = (n: number) => Math.round(n * 10) / 10
const over = (s: Segment) => Math.max(0, (s.end - s.start) / MIN - s.targetMin)

// ---------------------------------------------------------------------------
// Assist: why this card first

/**
 * Up to three short reasons the top card is the best thing to do now, as translation keys.
 * A suggestion explained is easier to trust, and easier to overrule when the server knows better.
 */
export function whyFirst(task: Task, mine: Task[], table: TableState | undefined, now: number): TaskText[] {
  const out: TaskText[] = []
  const lateMin = Math.round((now - task.dueAt) / MIN)
  if (task.kind === 'allergy' || task.kind === 'safety_check') out.push(k('why.safety'))
  else if (task.kind === 'recovery') out.push(k('why.unhappy'))
  else if (task.kind === 'pickup') out.push(k('why.hot'))
  else if (task.kind === 'kitchen_delay') out.push(k('why.heads'))
  else if (task.kind === 'greet') out.push(k('why.first'))
  if (lateMin >= 1) out.push(k('why.late', { min: lateMin }))
  else if (task.dueAt - now <= 2 * MIN) out.push(k('why.soon'))
  const since = table?.lastAttentionAt ?? table?.seatedAt
  if (since && now - since >= 8 * MIN && task.kind !== 'greet') out.push(k('why.waiting', { min: Math.round((now - since) / MIN) }))
  if (table?.party?.vip) out.push(k('why.regular'))
  if (task.related?.length) out.push(k('why.bundle', { n: task.related.length }))
  const rest = mine.filter((t) => t.id !== task.id && !task.related?.some((r) => r.id === t.id))
  if (out.length < 3 && rest.length && rest.every((t) => t.dueAt > now)) out.push(k('why.restCanWait', { n: rest.length }))
  return out.slice(0, 3)
}

/**
 * A busy patch ahead: several things land for this server within a few minutes of each other.
 * Said early, so quick jobs get done now while there's room.
 */
export function crunchAhead(upcoming: Upcoming[], open: Task[], now: number): Upcoming | null {
  const soon = upcoming.filter((u) => u.kind !== 'crunch' && u.at - now <= 8 * MIN)
  if (soon.length < 3) return null
  const at = soon[Math.min(soon.length - 1, 2)].at
  const quick = open.filter((t) => t.dueAt > now && (t.kind === 'reset' || t.kind === 'farewell' || t.kind === 'clear_course' || t.kind === 'checkback')).length
  return {
    id: 'up:crunch',
    kind: 'crunch',
    tableId: soon[0].tableId,
    tableName: soon.map((u) => u.tableName).filter((n, i, a) => a.indexOf(n) === i).join(', '),
    at,
    text: k(quick ? 'up.crunchQuick' : 'up.crunch', { n: soon.length, min: Math.max(1, Math.round((at - now) / MIN)) }),
  }
}

// ---------------------------------------------------------------------------
// Predict: stations and sections

export type Risk = 'ok' | 'watch' | 'likely'

export interface StationForecast {
  station: Station
  /** Dishes cooking now. */
  cooking: number
  /** Dishes expected to be fired in the next 15 minutes (courses about to be ordered). */
  expected: number
  /** Extra minutes a new ticket would likely wait at the peak. */
  expectedOverMin: number
  /** Minutes until most of the expected dishes land. */
  peakInMin: number
  risk: Risk
  text: string
}

export interface SectionForecast {
  section: string
  staffId: string
  active: number
  /** Cards open now plus things due in the next 10 minutes. */
  jobs: number
  risk: Risk
}

export interface Forecast {
  stations: StationForecast[]
  sections: SectionForecast[]
  /** A load-balancing idea, by section (never "who is best"). */
  rebalance: string | null
  /** The most useful forecast lines, for the manager's screen and the AI's context. */
  headlines: string[]
}

const WINDOW_MIN = 15

/** Which station each course is likely to land on, from the menu's own mix. */
function stationShare(config: RestaurantConfig, course: string): Map<Station, number> {
  const dishes = config.menu.filter((m) => m.course === course)
  const out = new Map<Station, number>()
  for (const m of dishes) out.set(m.station, (out.get(m.station) ?? 0) + 1 / dishes.length)
  return out
}

/**
 * What the next quarter of an hour looks like. Courses about to be ordered (starters for tables just
 * greeted, mains for tables finishing starters, desserts after mains) are added to what's already
 * cooking at each station; the same queue model the ETAs use turns that into likely extra minutes.
 * Tonight's record at each station (how often it ran late) adds the kitchen's own pattern.
 */
export function forecast(state: EngineState, config: RestaurantConfig, now: number, tasks: Task[] = []): Forecast {
  const cooking = new Map<Station, number>()
  const expected = new Map<Station, { n: number; at: number }>()
  const add = (course: string, dishes: number, at: number) => {
    if (at - now > WINDOW_MIN * MIN) return
    for (const [st, share] of stationShare(config, course)) {
      const e = expected.get(st) ?? { n: 0, at: 0 }
      e.at = (e.at * e.n + Math.max(now, at) * dishes * share) / (e.n + dishes * share || 1)
      e.n += dishes * share
      expected.set(st, e)
    }
  }
  for (const t of Object.values(state.tables)) {
    if (!t.visitId) continue
    for (const l of t.lines) if (l.status === 'fired') cooking.set(l.station, (cooking.get(l.station) ?? 0) + l.qty)
    const size = t.party?.size ?? 2
    const has = (c: string) => t.lines.some((l) => l.course === c)
    const served = (c: string) => {
      const cl = t.lines.filter((l) => l.course === c && l.status !== 'unavailable')
      return cl.length && cl.every((l) => l.servedAt) ? Math.max(...cl.map((l) => l.servedAt!)) : null
    }
    if (!t.firstOrderAt) add('starter', size, (t.greetedAt ?? t.seatedAt ?? now) + 5 * MIN)
    else if (!has('main')) {
      const s = served('starter')
      if (s) add('main', size, s + (eatMinutes(state, 'starter') + 2) * MIN)
      else if (has('starter')) add('main', size, now + (eatMinutes(state, 'starter') + 6) * MIN)
    } else if (!has('dessert') && !t.billRequestedAt) {
      const s = served('main')
      // About half of tables order dessert.
      if (s) add('dessert', size * 0.5, s + (eatMinutes(state, 'main') + 2) * MIN)
    }
  }

  const a = analytics(state, config)
  const stations: StationForecast[] = [...new Set<Station>([...cooking.keys(), ...expected.keys()])]
    .filter((st) => st !== 'bar')
    .map((station) => {
      const c = cooking.get(station) ?? 0
      const e = expected.get(station)
      const n = Math.round((e?.n ?? 0) * 10) / 10
      const queueWait = Math.max(0, c + n - STATION_CAPACITY + 1) * QUEUE_COST_MIN
      const past = a.stations.find((s) => s.station === station)
      const habit = past && past.tickets >= 2 ? (past.lapses / past.tickets) * past.avgOverMin * 1.5 : 0
      const expectedOverMin = round1(queueWait + habit)
      const tol = config.sop.kitchenDelayToleranceMin
      const risk: Risk = expectedOverMin >= tol ? 'likely' : expectedOverMin >= tol / 2 ? 'watch' : 'ok'
      const peakInMin = e?.n ? Math.max(1, Math.round((e.at - now) / MIN)) : 0
      const name = station[0].toUpperCase() + station.slice(1)
      const record = past && past.lapses ? ` Tonight it has run late on ${past.lapses} of ${past.tickets} ${past.tickets === 1 ? 'ticket' : 'tickets'}.` : ''
      const text =
        risk === 'ok'
          ? `${name}: ${c} cooking${n >= 0.5 ? `, about ${Math.round(n)} more due in ${WINDOW_MIN} min` : ''}. Comfortable.`
          : `${name} ${risk === 'likely' ? 'likely to fall behind' : 'getting busy'}${peakInMin ? ` in about ${peakInMin} min` : ''}: ${c} ${c === 1 ? 'dish' : 'dishes'} cooking${n >= 0.5 ? `, about ${Math.round(n)} more due by ${istClock(now + WINDOW_MIN * MIN)}` : ''}. New tickets may wait ~${Math.max(1, Math.round(expectedOverMin))} min extra.${record}`
      return { station, cooking: c, expected: n, expectedOverMin, peakInMin, risk, text }
    })
    .sort((x, y) => y.expectedOverMin - x.expectedOverMin)

  // Section load: open cards plus courses landing in the next 10 minutes.
  const sections: SectionForecast[] = Object.entries(config.sections).map(([section, staffId]) => {
    const tables = Object.values(state.tables).filter((t) => t.section === section && t.visitId)
    const open = tasks.filter((t) => tables.some((x) => x.id === t.tableId)).length
    let landing = 0
    for (const t of tables)
      for (const l of t.lines) if (l.status === 'fired' && l.expectedReadyAt - now <= 10 * MIN) landing += 1 / Math.max(1, t.lines.filter((x) => x.ticketId === l.ticketId).length)
    const jobs = Math.round(open + landing)
    const risk: Risk = tables.length > config.sop.maxActiveTablesPerServer || jobs >= 7 ? 'likely' : jobs >= 5 ? 'watch' : 'ok'
    return { section, staffId, active: tables.length, jobs, risk }
  })

  let rebalance: string | null = null
  const busiest = [...sections].sort((x, y) => y.jobs - x.jobs)[0]
  const lightest = [...sections].sort((x, y) => x.jobs - y.jobs || x.active - y.active)[0]
  if (busiest && lightest && busiest.section !== lightest.section && busiest.jobs >= 5 && busiest.jobs >= lightest.jobs * 2 + 1) {
    // Only send new guests to a section with room under the table limit.
    const room = [...sections].filter((x) => x.section !== busiest.section && x.active < config.sop.maxActiveTablesPerServer).sort((x, y) => x.jobs - y.jobs || x.active - y.active)[0]
    rebalance =
      `Section ${busiest.section} has ${busiest.jobs} jobs due in the next 10 min; section ${lightest.section} has ${lightest.jobs === 1 ? '1 job' : lightest.jobs}. ` +
      `Ask section ${lightest.section} to run section ${busiest.section}'s food from the pass for a few minutes` +
      (room ? `, and seat the next party in section ${room.section}.` : '. Every other section is at its table limit, so hold new parties at the door for a few minutes.')
  }

  const headlines = [...stations.filter((s) => s.risk !== 'ok').map((s) => s.text), ...(rebalance ? [rebalance] : [])]
  return { stations, sections, rebalance, headlines }
}

// ---------------------------------------------------------------------------
// Explain: one table, step by step

export interface Step {
  label: string
  stage: Segment['stage']
  owner: Owner
  start: number
  end: number
  min: number
  targetMin: number
  overMin: number
  lapse: boolean
  station?: Station
}

export interface Reconstruction {
  visitId: string
  tableId: string
  tableName: string
  partySize: number
  serverId: string
  seatedAt: number
  endedAt: number
  live: boolean
  steps: Step[]
  /** Minutes past standard, by who controlled the step. */
  overByOwner: Record<'floor' | 'kitchen', number>
  /** The step that cost the most time, and the biggest one the floor controlled. */
  biggest: Step | null
  biggestFloor: Step | null
  mood?: VisitRecord['mood']
  recovered?: boolean
  /** The visit told in plain English, in order. */
  story: string[]
  /** What would have helped, as process changes. */
  helped: string[]
}

/** A live table as a visit so far (the steps already finished). */
export function liveVisit(t: TableState, config: RestaurantConfig, now: number): VisitRecord | null {
  if (!t.visitId || !t.seatedAt) return null
  return { visitId: t.visitId, tableId: t.id, tableName: t.name, serverId: t.serverId, partySize: t.party?.size ?? 0, seatedAt: t.seatedAt, endedAt: now, segments: segmentsFor(t, config), smooth: false, mood: t.mood?.value, recovered: t.mood?.value === 'unhappy' ? !!t.recoveredAt : undefined }
}

const HELPED: Record<string, string> = {
  greet: 'Seat new parties in the section with the lightest load, or have whoever is nearest greet and hand over.',
  kitchen: 'Give guests a heads-up as soon as the ETA slips (the card prompts it), and look at cover for that station at peak.',
  pickup: 'A food runner at peak, or a teammate who is free taking food from the pass, gets plates out while hot.',
  bill: 'Print the bill as dessert is cleared, so it is ready when they ask.',
  reset: 'Busser support at turn time gets the table back for the next party sooner.',
}

export function reconstructVisit(v: VisitRecord, config: RestaurantConfig, live = false): Reconstruction {
  const steps: Step[] = v.segments.map((s) => ({ label: s.label, stage: s.stage, owner: s.owner, start: s.start, end: s.end, min: round1((s.end - s.start) / MIN), targetMin: round1(s.targetMin), overMin: round1(over(s)), lapse: s.lapse, station: s.station }))
  const overByOwner = { floor: 0, kitchen: 0 }
  for (const s of steps) if (s.owner === 'floor' || s.owner === 'kitchen') overByOwner[s.owner] = round1(overByOwner[s.owner] + s.overMin)
  const worst = (xs: Step[]) => xs.filter((s) => s.overMin > 0).sort((a, b) => b.overMin - a.overMin)[0] ?? null
  const biggest = worst(steps)
  const biggestFloor = worst(steps.filter((s) => s.owner === 'floor'))
  const server = config.staff.find((s) => s.id === v.serverId)?.name ?? 'their server'
  const total = Math.round((v.endedAt - v.seatedAt) / MIN)

  const story: string[] = [`${v.tableName}, party of ${v.partySize}, seated at ${istClock(v.seatedAt)}${live ? `, still dining (${total} min so far)` : `, left at ${istClock(v.endedAt)} (${total} min)`}. Served by ${server}.`]
  for (const s of steps) {
    const what = s.stage === 'kitchen' ? `${s.label}${s.station ? ` (${s.station})` : ''}` : s.label
    story.push(`${istClock(s.start)} ${what}: ${s.min} min against a ${s.targetMin}-min standard${s.overMin > 0.25 ? `, ${s.overMin} min over` : ''}.`)
  }
  if (v.mood === 'unhappy') story.push(v.recovered ? 'Guests were unhappy at a check-in and were won back.' : 'Guests were unhappy at a check-in.')
  else if (v.mood) story.push(`At the last check-in guests were ${v.mood === 'happy' ? 'happy' : 'fine'}.`)
  if (!biggest) story.push('Every step was to standard.')
  else {
    const kitchenShare = overByOwner.kitchen / Math.max(0.1, overByOwner.kitchen + overByOwner.floor)
    story.push(
      `Biggest delay: ${biggest.label.toLowerCase()}${biggest.station ? ` on the ${biggest.station} station` : ''}, ${biggest.overMin} min over (${biggest.owner === 'kitchen' ? 'kitchen' : 'floor'}-controlled). ` +
        `In all, ${overByOwner.kitchen} min over in the kitchen and ${overByOwner.floor} min on the floor` +
        (kitchenShare >= 0.7 ? ', so this table’s wait was mostly the kitchen’s, not the server’s.' : kitchenShare <= 0.3 ? ', so most of the lost time was on the floor.' : '.'),
    )
  }
  const helped = [...new Set(steps.filter((s) => s.overMin > 0.25).sort((a, b) => b.overMin - a.overMin).map((s) => HELPED[s.stage]))].slice(0, 2)
  return { visitId: v.visitId, tableId: v.tableId, tableName: v.tableName, partySize: v.partySize, serverId: v.serverId, seatedAt: v.seatedAt, endedAt: v.endedAt, live, steps, overByOwner, biggest, biggestFloor, mood: v.mood, recovered: v.recovered, story, helped }
}

// ---------------------------------------------------------------------------
// Explain: why tonight is going the way it is

export interface ShiftIntel {
  lights: { id: 'guests' | 'kitchen' | 'floor'; label: string; level: Risk; text: string }[]
  /** Minutes past standard by who controlled the step, and the kitchen's share (0–1). */
  overMin: { floor: number; kitchen: number }
  kitchenShare: number | null
  /** The stage or station that lost the most time. */
  bottleneck: { label: string; owner: Owner; overMin: number; detail: string } | null
  /** The 15-minute window when most steps ran late, and what was happening then. */
  window: { from: number; to: number; lapses: number; fires: number } | null
  why: string[]
  actions: string[]
}

const STAGE_NAMES: Record<Segment['stage'], string> = { greet: 'Greeting', kitchen: 'Kitchen prep', pickup: 'Pass to table', bill: 'Bill presentation', reset: 'Table reset' }

export function shiftIntel(state: EngineState, config: RestaurantConfig): ShiftIntel {
  const live = Object.values(state.tables).filter((t) => t.visitId).flatMap((t) => segmentsFor(t, config))
  const all = [...state.visits.flatMap((v) => v.segments), ...live]
  const a = analytics(state, config)
  const overMin = { floor: 0, kitchen: 0 }
  for (const s of all) if (s.owner === 'floor' || s.owner === 'kitchen') overMin[s.owner] += over(s)
  overMin.floor = round1(overMin.floor)
  overMin.kitchen = round1(overMin.kitchen)
  const totalOver = overMin.floor + overMin.kitchen
  const kitchenShare = totalOver >= 1 ? overMin.kitchen / totalOver : null

  // Where the time went: each floor stage, and each kitchen station.
  const buckets = new Map<string, { label: string; owner: Owner; over: number; n: number; late: number }>()
  for (const s of all) {
    const key = s.stage === 'kitchen' ? `station:${s.station ?? 'kitchen'}` : s.stage
    const label = s.stage === 'kitchen' ? `${(s.station ?? 'kitchen')[0].toUpperCase()}${(s.station ?? 'kitchen').slice(1)} station` : STAGE_NAMES[s.stage]
    const b = buckets.get(key) ?? { label, owner: s.owner, over: 0, n: 0, late: 0 }
    b.over += over(s)
    b.n++
    if (s.lapse) b.late++
    buckets.set(key, b)
  }
  const top = [...buckets.values()].filter((b) => b.over >= 1).sort((x, y) => y.over - x.over)[0]
  const bottleneck = top ? { label: top.label, owner: top.owner, overMin: round1(top.over), detail: `${top.late} of ${top.n} ${top.owner === 'kitchen' ? 'tickets' : 'steps'} ran past standard, ${Math.round(top.over)} min over in all` } : null

  // When it went wrong: 15-minute windows by when the late step finished.
  const W = 15 * MIN
  const lapsed = all.filter((s) => s.lapse)
  let window: ShiftIntel['window'] = null
  if (lapsed.length >= 2) {
    const counts = new Map<number, number>()
    for (const s of lapsed) counts.set(Math.floor(s.end / W), (counts.get(Math.floor(s.end / W)) ?? 0) + 1)
    const [slot, n] = [...counts.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0]
    if (n >= 2) {
      const from = slot * W
      // Tickets fired in the half hour leading into it: the kitchen's load then.
      const fires = all.filter((s) => s.stage === 'kitchen' && s.start >= from - W && s.start < from + W).length
      window = { from, to: from + W, lapses: n, fires }
    }
  }

  const moods = a.moods
  const unrecovered = moods.unhappy - moods.recovered
  const kitchenLate = all.filter((s) => s.stage === 'kitchen')
  const kLateRate = kitchenLate.length ? kitchenLate.filter((s) => s.lapse).length / kitchenLate.length : 0
  const floor = all.filter((s) => s.owner === 'floor')
  const fLateRate = floor.length ? floor.filter((s) => s.lapse).length / floor.length : 0
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const lights: ShiftIntel['lights'] = [
    {
      id: 'guests',
      label: 'Guests',
      level: unrecovered >= 2 || a.managerRequests.length ? 'likely' : unrecovered === 1 ? 'watch' : 'ok',
      text: moods.happy + moods.ok + moods.unhappy === 0 ? 'No check-ins yet.' : `${moods.happy} happy, ${moods.ok} fine, ${moods.unhappy} unhappy${moods.recovered ? ` (${moods.recovered} won back)` : ''}${a.managerRequests.length ? `; ${a.managerRequests.length} waiting for you` : ''}.`,
    },
    { id: 'kitchen', label: 'Kitchen', level: kLateRate >= 0.35 ? 'likely' : kLateRate >= 0.15 ? 'watch' : 'ok', text: kitchenLate.length ? `${pct(kLateRate)} of tickets past standard.` : 'No tickets finished yet.' },
    { id: 'floor', label: 'Floor', level: fLateRate >= 0.3 ? 'likely' : fLateRate >= 0.12 ? 'watch' : 'ok', text: floor.length ? `${pct(fLateRate)} of floor steps past standard.` : 'No steps measured yet.' },
  ]

  const why: string[] = []
  if (kitchenShare !== null)
    why.push(
      kitchenShare >= 0.6
        ? `Most of tonight’s lost time is in the kitchen (${pct(kitchenShare)} of ${Math.round(totalOver)} min over standard). Servers are waiting on food more than guests are waiting on servers.`
        : kitchenShare <= 0.4
          ? `Most of tonight’s lost time is on the floor (${pct(1 - kitchenShare)} of ${Math.round(totalOver)} min over standard), so it’s about hands and timing in the room more than the kitchen.`
          : `Lost time is split between kitchen (${Math.round(overMin.kitchen)} min) and floor (${Math.round(overMin.floor)} min).`,
    )
  if (bottleneck) why.push(`The biggest single bottleneck is ${bottleneck.label.toLowerCase()}: ${bottleneck.detail}.`)
  if (window) why.push(`It bunched up between ${istClock(window.from)} and ${istClock(window.to)}: ${window.lapses} steps ran late, with ${window.fires} tickets fired around then${window.fires >= 6 ? ', a wave of orders landing together' : ''}.`)
  const overloaded = a.load.filter((l) => l.overloaded)
  if (overloaded.length) why.push(`${overloaded.length === 1 ? 'One section is' : `${overloaded.length} sections are`} above the ${config.sop.maxActiveTablesPerServer}-table limit right now, which slows every step there.`)
  if (!why.length) why.push(all.length ? 'Service is running to standard so far. Nothing stands out.' : 'Nothing to explain yet: tables are still early in their visits.')

  const actions: string[] = []
  if (bottleneck?.owner === 'kitchen') {
    actions.push(`Stagger fires when several tables order together, and consider extra cover on the ${bottleneck.label.replace(/ station$/, '').toLowerCase()} station for the peak.`)
    actions.push('Keep heads-ups early: a guest told before they ask rarely complains.')
  } else if (bottleneck) {
    const stage = Object.entries(STAGE_NAMES).find(([, n]) => n === bottleneck.label)?.[0]
    if (stage && HELPED[stage]) actions.push(HELPED[stage])
  }
  if (overloaded.length) actions.push('Seat the next arrivals into the lightest section until the load evens out.')
  if (unrecovered > 0) actions.push('Visit any unhappy table that hasn’t been won back yet.')
  // The engine's own suggestions, minus any that repeat the bottleneck advice above.
  for (const s of a.suggestions) if (actions.length < 4 && !(bottleneck && s.startsWith(bottleneck.label))) actions.push(s)
  return { lights, overMin, kitchenShare, bottleneck, window, why, actions: actions.slice(0, 4) }
}

// ---------------------------------------------------------------------------
// Learn: a personal journey (private to the person)

export interface PracticeEntry {
  at: number
  scenario: string
  score: number
  final?: boolean
}

export interface Skill {
  id: string
  scenarios: string[]
  replies: number
  /** Average of the first and latest few replies, when there are any. */
  first: number | null
  latest: number | null
  trend: 'up' | 'down' | 'flat' | null
}

export interface Recommendation {
  scenario: string
  why: TaskText
}

export interface LearningPlan {
  skills: Skill[]
  recommended: Recommendation[]
  /** A floor habit to focus on, from the person's own late steps (never kitchen delays). */
  focus: { stage: Segment['stage']; text: TaskText } | null
  sessions: number
}

const SKILLS: Record<'server' | 'manager', { id: string; scenarios: string[] }[]> = {
  server: [
    { id: 'recovery', scenarios: ['cold_food', 'rude', 'wrong_bill'] },
    { id: 'delays', scenarios: ['long_wait', 'sold_out'] },
    { id: 'safety', scenarios: ['allergy'] },
    { id: 'inclusion', scenarios: ['access_direct', 'fasting', 'misgender'] },
  ],
  manager: [
    { id: 'guests', scenarios: ['m_guest', 'm_allergy'] },
    { id: 'team', scenarios: ['m_feedback', 'm_harassed', 'm_conflict', 'm_newhire'] },
  ],
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export function learningPlan(log: PracticeEntry[], visits: VisitRecord[], tables: TableState[], audience: 'server' | 'manager' = 'server'): LearningPlan {
  const replies = log.filter((e) => !e.final)
  const skills: Skill[] = SKILLS[audience].map((s) => {
    const scores = replies.filter((e) => s.scenarios.includes(e.scenario)).map((e) => e.score)
    const first = avg(scores.slice(0, 3))
    const latest = scores.length > 3 ? avg(scores.slice(-3)) : first
    const trend = first === null || latest === null ? null : scores.length <= 3 ? 'flat' : latest - first >= 8 ? 'up' : first - latest >= 8 ? 'down' : 'flat'
    return { id: s.id, scenarios: s.scenarios, replies: scores.length, first, latest, trend }
  })

  const lastScore = (sc: string) => [...replies].reverse().find((e) => e.scenario === sc)?.score
  const practised = new Set(log.filter((e) => e.final).map((e) => e.scenario))
  const recs: (Recommendation & { weight: number })[] = []
  const rec = (scenario: string, why: TaskText, weight: number) => {
    const last = lastScore(scenario)
    // Already strong at it: still worth a mention only if tonight keeps raising it.
    const w = weight + (last === undefined ? 1 : last < 60 ? 1.5 : last >= 80 ? -1.5 : 0)
    recs.push({ scenario, why: last !== undefined && last < 60 ? k('learn.why.low', { score: last }) : why, weight: w })
  }

  if (audience === 'server') {
    // From tonight's real service: what this server's guests actually went through.
    const kitchenWaits = visits.filter((v) => v.segments.some((s) => s.stage === 'kitchen' && s.lapse)).length + tables.filter((t) => t.lines.some((l) => l.status === 'fired' && l.delayInformedAt)).length
    const unhappy = visits.filter((v) => v.mood === 'unhappy').length + tables.filter((t) => t.mood?.value === 'unhappy').length
    const soldOut = tables.filter((t) => t.lines.some((l) => l.status === 'unavailable')).length
    const allergies = tables.filter((t) => t.party?.allergies.length).length
    const access = tables.filter((t) => t.party?.needs?.some((n) => ['wheelchair', 'hearing', 'vision', 'service_animal'].includes(n))).length
    const fasting = tables.filter((t) => t.party?.needs?.includes('fasting')).length
    if (kitchenWaits) rec('long_wait', k('learn.why.delay', { n: kitchenWaits }), 2 + kitchenWaits)
    if (unhappy) rec('cold_food', k('learn.why.unhappy', { n: unhappy }), 3 + unhappy)
    if (soldOut) rec('sold_out', k('learn.why.soldout'), 2)
    if (allergies) rec('allergy', k('learn.why.allergy', { n: allergies }), 2.5)
    if (access) rec('access_direct', k('learn.why.access'), 2)
    if (fasting) rec('fasting', k('learn.why.fasting'), 2)
  }
  // Nothing from tonight yet: start with what they haven't tried.
  for (const s of SKILLS[audience]) {
    const untried = s.scenarios.find((sc) => !practised.has(sc) && lastScore(sc) === undefined)
    if (untried) rec(untried, k('learn.why.new'), 0.5)
  }
  const seen = new Set<string>()
  const recommended = recs
    .sort((x, y) => y.weight - x.weight)
    .filter((r) => (seen.has(r.scenario) ? false : (seen.add(r.scenario), true)))
    .slice(0, 2)
    .map(({ scenario, why }) => ({ scenario, why }))

  // A floor habit to work on: the step of their own that most often ran past standard.
  let focus: LearningPlan['focus'] = null
  if (audience === 'server') {
    const floor = visits.flatMap((v) => v.segments.filter((s) => s.owner === 'floor'))
    const byStage = new Map<Segment['stage'], { n: number; late: number }>()
    for (const s of floor) {
      const b = byStage.get(s.stage) ?? { n: 0, late: 0 }
      b.n++
      if (s.lapse) b.late++
      byStage.set(s.stage, b)
    }
    const worst = [...byStage.entries()].filter(([, b]) => b.late >= 2 && b.late / b.n >= 0.3).sort((x, y) => y[1].late / y[1].n - x[1].late / x[1].n)[0]
    if (worst) focus = { stage: worst[0], text: k(`learn.focus.${worst[0]}`, { n: worst[1].late, of: worst[1].n }) }
  }
  return { skills, recommended, focus, sessions: log.filter((e) => e.final).length }
}
