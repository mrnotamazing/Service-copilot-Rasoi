// Forecasts from the night's own data: when a dish will really be ready (given how busy its
// station is), when a table will finish a course, and when it will want the bill.
// Pure functions of engine state, so the same events always give the same forecast.

import type { EngineState } from './engine.ts'
import type { Course, OrderLine, RestaurantConfig, TableState, Task, TaskText, Upcoming } from './types.ts'

const MIN = 60_000
/** Dishes a station can work on at once before tickets start queueing. */
const STATION_CAPACITY = 2
/** Minutes each extra queued dish adds at a station. */
const QUEUE_COST_MIN = 0.75
/** Typical minutes a table takes to eat each course, until tonight's data says otherwise. */
const DEFAULT_EAT_MIN: Record<string, number> = { starter: 12, main: 18, dessert: 9, drink: 10 }

export interface Running {
  n: number
  sumMin: number
}

/** Blend a learned average with the default; one or two samples barely move it. */
function learned(stat: Running | undefined, fallbackMin: number): number {
  if (!stat?.n) return fallbackMin
  const w = Math.min(0.8, stat.n / (stat.n + 3))
  return fallbackMin * (1 - w) + (stat.sumMin / stat.n) * w
}

/** How many dishes are ahead of this one at its station. */
export function queueAhead(state: EngineState, line: OrderLine): number {
  let ahead = 0
  for (const t of Object.values(state.tables))
    for (const l of t.lines) if (l.station === line.station && l.status === 'fired' && l.ticketId !== line.ticketId && l.firedAt < line.firedAt) ahead++
  return ahead
}

/** When this dish will most likely be ready. Overdue dishes get an honest "a few more minutes". */
export function predictReady(state: EngineState, config: RestaurantConfig, line: OrderLine, now: number): number {
  if (line.status !== 'fired') return line.readyAt ?? now
  const prepMin = config.menu.find((m) => m.id === line.menuItemId)?.prepMin ?? (line.expectedReadyAt - line.firedAt) / MIN
  const ahead = queueAhead(state, line)
  const eta = line.firedAt + learned(state.prepStats[line.menuItemId], prepMin) * MIN + Math.max(0, ahead - STATION_CAPACITY + 1) * QUEUE_COST_MIN * MIN
  return eta > now ? eta : now + Math.max(1, 1 + ahead * 0.5) * MIN
}

/** Whole minutes until ready, at least 1. */
export const minutesUntil = (at: number, now: number) => Math.max(1, Math.round((at - now) / MIN))

export function eatMinutes(state: EngineState, course: Course): number {
  return learned(state.eatStats[course], DEFAULT_EAT_MIN[course] ?? 12)
}

const k = (key: string, p?: Record<string, string | number>): TaskText => ({ k: key, p })

/**
 * What is likely to need this server in the next few minutes, so they can get ahead of it:
 * food about to come up at the pass, a course about to finish, a bill about to be asked for.
 * Anything already on a card is left out.
 */
export function upcomingFor(state: EngineState, config: RestaurantConfig, staffId: string, now: number, open: Task[]): Upcoming[] {
  const out: Upcoming[] = []
  const has = (kind: string, tableId: string) => open.some((t) => t.kind === kind && t.tableId === tableId)
  const tables = Object.values(state.tables).filter((t) => t.serverId === staffId && t.visitId)

  for (const t of tables) {
    // Food about to be ready.
    const byCourse = new Map<string, number>()
    for (const l of t.lines) {
      if (l.status !== 'fired') continue
      const eta = predictReady(state, config, l, now)
      byCourse.set(l.course, Math.max(byCourse.get(l.course) ?? 0, eta))
    }
    for (const [course, eta] of byCourse)
      if (eta - now <= 5 * MIN && !has('kitchen_delay', t.id))
        out.push({ id: `up:food:${t.id}:${course}`, kind: 'food_ready', tableId: t.id, tableName: t.name, at: eta, text: k('up.food', { table: t.name, course: `@course.${course}`, min: minutesUntil(eta, now) }) })

    // A course about to finish.
    for (const course of ['starter', 'main', 'dessert'] as const) {
      const cl = t.lines.filter((l) => l.course === course && l.status !== 'unavailable')
      if (!cl.length || cl.some((l) => l.status !== 'served') || t.courseClearedAt[course] || has('clear_course', t.id)) continue
      const end = Math.max(...cl.map((l) => l.servedAt!)) + eatMinutes(state, course) * MIN
      if (end - now <= 5 * MIN && end - now > -2 * MIN)
        out.push({ id: `up:end:${t.id}:${course}`, kind: 'course_end', tableId: t.id, tableName: t.name, at: end, text: k('up.course', { table: t.name, course: `@course.${course}`, min: minutesUntil(end, now), next: `@next.${course}` }) })
    }

    // The bill is coming: dessert finished, or mains finished with no dessert ordered.
    const mainsDone = t.courseClearedAt.main
    const noDessert = !t.lines.some((l) => l.course === 'dessert')
    if (!t.billRequestedAt && (t.courseClearedAt.dessert || (mainsDone && noDessert && now > mainsDone + 2 * MIN)))
      out.push({ id: `up:bill:${t.id}`, kind: 'bill_soon', tableId: t.id, tableName: t.name, at: now + 2 * MIN, text: k('up.bill', { table: t.name }) })
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 3)
}

/** Table numbers next to each other in the same section count as "next door". */
export function isNear(a: TableState | undefined, b: TableState | undefined): boolean {
  if (!a || !b || a.id === b.id || a.section !== b.section) return false
  const n = (x: TableState) => Number(x.name.replace(/\D/g, ''))
  return Math.abs(n(a) - n(b)) === 1
}
