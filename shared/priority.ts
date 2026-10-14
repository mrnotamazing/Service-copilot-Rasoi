// What should the kitchen cook or send next? Each ticket on the line gets a priority from what the
// restaurant told us matters (set in Setup, like the menu's allergens): how far past (or close to) the
// standard time a dish is, a guest's allergy, a VIP or an occasion, a big party, the course. The same
// pure function runs on the kitchen screen and, for the AI's assessment, on the server.

import type { EngineState } from './engine.ts'
import { safetyIssues } from './safety.ts'
import type { Course, OrderLine, RestaurantConfig, TableState } from './types.ts'

const MIN = 60_000

/** How much each thing matters, 0 (ignore) to 10 (decisive), plus when to alert. The restaurant sets these in Setup. */
export interface PriorityConfig {
  /** Minutes past the standard time. Climbs fast: five minutes over counts in full. */
  overrun: number
  /** Close to the standard time, before it's late. */
  dueSoon: number
  /** A guest at the table has an allergy or diet a dish on the ticket clashes with. */
  allergy: number
  vip: number
  occasion: number
  largeParty: number
  /** Mains over starters over desserts. */
  course: number
  /** A dish counts as "approaching" at this percentage of its standard time. */
  dueSoonPct: number
  /** While a ticket is late, remind the pass this often (minutes). */
  realertMin: number
}

export const DEFAULT_PRIORITY: PriorityConfig = { overrun: 8, dueSoon: 4, allergy: 10, vip: 5, occasion: 3, largeParty: 2, course: 3, dueSoonPct: 80, realertMin: 2 }

export const PRIORITY_FIELDS: { key: keyof PriorityConfig; label: string; hint: string; max: number; unit?: string }[] = [
  { key: 'allergy', label: 'Allergy or diet clash', hint: 'A guest at the table has an allergy or diet a dish on the ticket clashes with', max: 10 },
  { key: 'overrun', label: 'Past the standard time', hint: 'Counts in full at five minutes over', max: 10 },
  { key: 'dueSoon', label: 'Close to the standard time', hint: 'Before it is late, so the pass can get ahead', max: 10 },
  { key: 'vip', label: 'VIP table', hint: 'Marked as a VIP when the table was seated', max: 10 },
  { key: 'occasion', label: 'Celebration', hint: 'A birthday, anniversary or other occasion', max: 10 },
  { key: 'largeParty', label: 'Large party', hint: 'Parties above four count more, up to eight', max: 10 },
  { key: 'course', label: 'Course', hint: 'Mains first, then starters, then desserts', max: 10 },
  { key: 'dueSoonPct', label: 'Warn when a dish reaches', hint: 'Share of its standard time that counts as approaching', max: 100, unit: '%' },
  { key: 'realertMin', label: 'Remind the pass every', hint: 'While a ticket is late (minutes)', max: 30, unit: 'min' },
]

export const priorityOf = (config: Pick<RestaurantConfig, 'priority'>): PriorityConfig => ({ ...DEFAULT_PRIORITY, ...(config.priority ?? {}) })

export type Level = 'normal' | 'soon' | 'late' | 'critical'

export interface TicketPriority {
  score: number
  level: Level
  /** Minutes past the standard time of the latest dish (0 when not late). */
  minsOver: number
  /** How much of its standard time the slowest dish has used, in percent. */
  pct: number
  /** Why this ticket is where it is, in plain words. */
  reasons: string[]
}

const COURSE_WEIGHT: Record<Course, number> = { main: 1, starter: 0.7, dessert: 0.4, drink: 0.2 }

/** The priority of one ticket (the dishes fired together for a table), as of `now`. */
export function ticketPriority(table: TableState, lines: OrderLine[], config: RestaurantConfig, now: number, p: PriorityConfig = priorityOf(config)): TicketPriority {
  const cooking = lines.filter((l) => l.status === 'fired')
  let minsOver = 0
  let pct = 0
  for (const l of cooking) {
    const std = Math.max(1, l.expectedReadyAt - l.firedAt)
    pct = Math.max(pct, ((now - l.firedAt) / std) * 100)
    minsOver = Math.max(minsOver, (now - l.expectedReadyAt) / MIN)
  }
  minsOver = Math.max(0, Math.round(minsOver * 10) / 10)
  const over = minsOver > 0
  const clash = cooking.flatMap((l) => safetyIssues(config.menu.find((m) => m.id === l.menuItemId), table.party).map((i) => ({ dish: l.name, tag: i.tag, because: i.because })))
  const party = table.party
  const size = party?.size ?? 0

  const parts = {
    overrun: p.overrun * Math.min(1, minsOver / 5),
    dueSoon: over ? p.dueSoon : p.dueSoon * Math.max(0, Math.min(1, (pct - p.dueSoonPct) / Math.max(1, 100 - p.dueSoonPct))),
    allergy: clash.length ? p.allergy : 0,
    vip: party?.vip ? p.vip : 0,
    occasion: party?.occasion ? p.occasion : 0,
    largeParty: p.largeParty * Math.max(0, Math.min(1, (size - 4) / 4)),
    course: p.course * Math.max(0, ...cooking.map((l) => COURSE_WEIGHT[l.course] ?? 0.5)),
  }
  const score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0) * 10) / 10

  const reasons: string[] = []
  if (over) reasons.push(`${minsOver >= 1 ? Math.round(minsOver) : '<1'} min over standard`)
  else if (pct >= p.dueSoonPct) reasons.push(`${Math.round(pct)}% of standard time`)
  for (const c of new Map(clash.map((c) => [`${c.because}:${c.tag}`, c])).values()) reasons.push(c.because === 'allergy' ? `${c.tag} allergy` : `${c.because} diet (${c.tag})`)
  if (party?.vip) reasons.push('VIP')
  if (party?.occasion) reasons.push(party.occasion)
  if (size >= 6) reasons.push(`party of ${size}`)

  const level: Level = (over && (minsOver >= 5 || clash.length > 0)) || minsOver >= 8 ? 'critical' : over ? 'late' : pct >= p.dueSoonPct ? 'soon' : 'normal'
  return { score, level, minsOver, pct: Math.round(pct), reasons }
}

export interface KitchenTicket extends TicketPriority {
  ticketId: string
  tableId: string
  tableName: string
  serverId: string
  lines: OrderLine[]
}

/** Every ticket with a dish still cooking, most urgent first. Ties go to the one fired first. */
export function kitchenTickets(state: Pick<EngineState, 'tables'>, config: RestaurantConfig, now: number): KitchenTicket[] {
  const p = priorityOf(config)
  const out: KitchenTicket[] = []
  for (const t of Object.values(state.tables)) {
    const byTicket = new Map<string, OrderLine[]>()
    for (const l of t.lines) if (l.status === 'fired' || l.status === 'ready') (byTicket.get(l.ticketId) ?? byTicket.set(l.ticketId, []).get(l.ticketId)!).push(l)
    for (const [ticketId, lines] of byTicket) {
      if (!lines.some((l) => l.status === 'fired')) continue
      out.push({ ticketId, tableId: t.id, tableName: t.name, serverId: t.serverId, lines, ...ticketPriority(t, lines, config, now, p) })
    }
  }
  return out.sort((a, b) => b.score - a.score || Math.min(...a.lines.map((l) => l.firedAt)) - Math.min(...b.lines.map((l) => l.firedAt)))
}

/** One sentence for each of the first few tickets, for a screen or as facts for the AI. */
export function describeTicket(k: KitchenTicket): string {
  const dishes = k.lines.filter((l) => l.status === 'fired').map((l) => `${l.qty}× ${l.name}`).join(', ')
  return `${k.tableName}: ${dishes}${k.reasons.length ? ` (${k.reasons.join('; ')})` : ''}`
}
