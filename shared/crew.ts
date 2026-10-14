// The team game for the kitchen pass and the manager's floor. Like the servers' game it is about the
// work, not about people: the kitchen builds a clean-pass streak (dishes out within their time) and the
// manager gathers "support moments" (handing a table to the right colleague, a word to the team, a guest
// won back). Each screen shows only its own progress; nobody is ranked, and nothing here reaches the floor.

import type { CopilotEvent } from './events.ts'
import type { EngineState } from './engine.ts'
import type { RestaurantConfig } from './types.ts'

const MIN = 60_000

export interface CrewAward {
  id: string
  at: number
  kind: 'xp' | 'badge' | 'level'
  title: string
  detail?: string
  xp: number
}

export interface CrewPart {
  xp: number
  streak: number
  bestStreak: number
  counters: Record<string, number>
  badges: Record<string, number>
  level: number
  awards: CrewAward[]
}

export interface CrewState {
  kitchen: CrewPart
  floor: CrewPart
  seq: number
}

export type CrewKind = 'kitchen' | 'floor'

interface Def {
  title: string
  rank: { xp: number; title: string }[]
  /** A shift goal: this many of `goalCounter`. */
  goal: { counter: string; target: number; title: string }
  badges: { id: string; title: string; description: string; icon: string; counter: string; target: number }[]
}

export const CREW: Record<CrewKind, Def> = {
  kitchen: {
    title: 'The pass',
    rank: [
      { xp: 0, title: 'Prep cook' },
      { xp: 100, title: 'Line cook' },
      { xp: 280, title: 'Chef de partie' },
      { xp: 560, title: 'Sous chef' },
      { xp: 950, title: 'Head chef' },
      { xp: 1500, title: 'Pass legend' },
    ],
    goal: { counter: 'onTime', target: 15, title: 'Send out 15 dishes on time' },
    badges: [
      { id: 'hot_line', title: 'Hot line', description: 'Send out 5 dishes in a row on time', icon: 'Flame', counter: 'bestStreak', target: 5 },
      { id: 'clean_pass', title: 'Clean pass', description: 'Send out 12 dishes in a row on time', icon: 'Sparkles', counter: 'bestStreak', target: 12 },
      { id: 'swift_hands', title: 'Swift hands', description: 'Send out 8 dishes in half their time', icon: 'Timer', counter: 'swift', target: 8 },
      { id: 'quick_answers', title: 'Quick answers', description: 'Answer 3 dish questions from the floor', icon: 'Megaphone', counter: 'answers', target: 3 },
      { id: 'full_pass', title: 'Full pass', description: 'Send out 30 dishes in one shift', icon: 'Crown', counter: 'plates', target: 30 },
    ],
  },
  floor: {
    title: 'The floor',
    rank: [
      { xp: 0, title: 'Floor walker' },
      { xp: 80, title: 'Host' },
      { xp: 220, title: 'Floor lead' },
      { xp: 450, title: 'Floor captain' },
      { xp: 800, title: 'General manager' },
      { xp: 1300, title: 'Maître d’ of the house' },
    ],
    goal: { counter: 'moments', target: 10, title: 'Make 10 support moments' },
    badges: [
      { id: 'right_hands', title: 'Right hands', description: 'Hand 3 tables to the colleague who fits best', icon: 'HeartHandshake', counter: 'handovers', target: 3 },
      { id: 'team_voice', title: 'Voice of the team', description: 'Send 5 clear notes to the team', icon: 'Megaphone', counter: 'notes', target: 5 },
      { id: 'guest_saver', title: 'Guest saver', description: 'Win back 3 guests', icon: 'ShieldCheck', counter: 'recoveries', target: 3 },
      { id: 'on_the_floor', title: 'On the floor', description: 'Visit 5 tables', icon: 'Sun', counter: 'visits', target: 5 },
      { id: 'cheerleader', title: 'Cheerleader', description: 'Thank 5 teammates', icon: 'Crown', counter: 'kudos', target: 5 },
    ],
  },
}

const blank = (): CrewPart => ({ xp: 0, streak: 0, bestStreak: 0, counters: {}, badges: {}, level: 1, awards: [] })

export function initialCrew(): CrewState {
  return { kitchen: blank(), floor: blank(), seq: 0 }
}

function rankFor(kind: CrewKind, xp: number) {
  const r = CREW[kind].rank
  let i = 0
  while (i + 1 < r.length && xp >= r[i + 1].xp) i++
  return { index: i, level: i + 1, title: r[i].title, floor: r[i].xp, next: r[i + 1]?.xp ?? null, nextTitle: r[i + 1]?.title ?? null, progress: r[i + 1] ? (xp - r[i].xp) / (r[i + 1].xp - r[i].xp) : 1 }
}

function give(crew: CrewState, kind: CrewKind, at: number, xp: number, title: string, detail?: string) {
  const p = crew[kind]
  p.xp += xp
  p.awards.push({ id: `c${++crew.seq}`, at, kind: 'xp', title, detail, xp })
  const lv = rankFor(kind, p.xp)
  if (lv.level > p.level) {
    p.level = lv.level
    p.awards.push({ id: `c${++crew.seq}`, at, kind: 'level', title: lv.title, detail: 'New rank', xp: 0 })
  }
  if (p.awards.length > 30) p.awards.splice(0, p.awards.length - 30)
}

function count(crew: CrewState, kind: CrewKind, key: string, at: number) {
  const p = crew[kind]
  p.counters[key] = (p.counters[key] ?? 0) + 1
  checkBadges(crew, kind, at)
}

function checkBadges(crew: CrewState, kind: CrewKind, at: number) {
  const p = crew[kind]
  const counters: Record<string, number> = { ...p.counters, bestStreak: p.bestStreak }
  for (const b of CREW[kind].badges) {
    if (p.badges[b.id] === undefined && (counters[b.counter] ?? 0) >= b.target) {
      p.badges[b.id] = at
      p.awards.push({ id: `c${++crew.seq}`, at, kind: 'badge', title: b.title, detail: b.description, xp: 0 })
    }
  }
}

/**
 * Advances the crew game for one event. Called with the engine state from before the event, so the
 * time a dish took (fired to ready) can be read from it.
 */
export function crewEvent(crew: CrewState, ev: CopilotEvent, state: EngineState, config: RestaurantConfig): void {
  const k = crew.kitchen
  switch (ev.type) {
    case 'item.ready': {
      const ids = new Set(ev.payload.lineIds ?? [])
      for (const t of Object.values(state.tables))
        for (const l of t.lines) {
          if (l.status !== 'fired' || !(ids.has(l.id) || (ev.payload.ticketId && l.ticketId === ev.payload.ticketId))) continue
          const target = config.menu.find((m) => m.id === l.menuItemId)?.prepMin ?? 12
          const mins = (ev.at - l.firedAt) / MIN
          const swift = mins <= target / 2
          const onTime = mins <= target + 0.25
          count(crew, 'kitchen', 'plates', ev.at)
          if (onTime) {
            k.streak++
            k.bestStreak = Math.max(k.bestStreak, k.streak)
            count(crew, 'kitchen', 'onTime', ev.at)
            if (swift) count(crew, 'kitchen', 'swift', ev.at)
            give(crew, 'kitchen', ev.at, swift ? 15 : 10, swift ? 'Swift' : 'On time', k.streak > 1 ? `${k.streak} in a row` : undefined)
          } else {
            k.streak = 0
            give(crew, 'kitchen', ev.at, 3, 'Sent out', 'Next one, clean')
          }
        }
      break
    }
    case 'dish.answered':
      count(crew, 'kitchen', 'answers', ev.at)
      give(crew, 'kitchen', ev.at, 8, 'Answered the floor', undefined)
      break
    case 'table.assigned':
      if (ev.source === 'manager') {
        count(crew, 'floor', 'handovers', ev.at)
        count(crew, 'floor', 'moments', ev.at)
        give(crew, 'floor', ev.at, 15, 'Table handed over', ev.payload.reason ? `for ${ev.payload.reason}` : undefined)
      }
      break
    case 'manager.instruction':
      count(crew, 'floor', 'notes', ev.at)
      count(crew, 'floor', 'moments', ev.at)
      give(crew, 'floor', ev.at, 5, 'Note to the team')
      break
    case 'guest.recovered':
      if (ev.payload.how === 'manager') {
        count(crew, 'floor', 'recoveries', ev.at)
        count(crew, 'floor', 'moments', ev.at)
        give(crew, 'floor', ev.at, 20, 'Guest won back')
      }
      break
    case 'manager.visited':
      count(crew, 'floor', 'visits', ev.at)
      count(crew, 'floor', 'moments', ev.at)
      give(crew, 'floor', ev.at, 8, 'Table visited')
      break
    case 'kudos.sent':
      if (config.staff.find((s) => s.id === ev.payload.from)?.role === 'manager') {
        count(crew, 'floor', 'kudos', ev.at)
        count(crew, 'floor', 'moments', ev.at)
        give(crew, 'floor', ev.at, 10, 'Thanked a teammate')
      }
      break
  }
}

export interface CrewView {
  kind: CrewKind
  title: string
  xp: number
  level: ReturnType<typeof rankFor>
  streak: number
  bestStreak: number
  goal: { title: string; done: number; target: number }
  counters: Record<string, number>
  badges: { id: string; title: string; description: string; icon: string; target: number; progress: number; earnedAt: number | null }[]
  awards: CrewAward[]
}

export function crewView(crew: CrewState, kind: CrewKind): CrewView {
  const p = crew[kind]
  const def = CREW[kind]
  const counters: Record<string, number> = { ...p.counters, bestStreak: p.bestStreak }
  return {
    kind,
    title: def.title,
    xp: p.xp,
    level: rankFor(kind, p.xp),
    streak: p.streak,
    bestStreak: p.bestStreak,
    goal: { title: def.goal.title, done: Math.min(def.goal.target, p.counters[def.goal.counter] ?? 0), target: def.goal.target },
    counters: p.counters,
    badges: def.badges.map((b) => ({ id: b.id, title: b.title, description: b.description, icon: b.icon, target: b.target, progress: Math.min(b.target, counters[b.counter] ?? 0), earnedAt: p.badges[b.id] ?? null })),
    awards: p.awards.slice(-12),
  }
}
