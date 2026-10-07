// The game layer. Built on research about what motivates without controlling:
// - XP is one shared currency for every good action (immediate, specific feedback).
// - Late is never punished: a step past standard still earns a little XP.
// - Streaks count tables served fully to standard, and shields (streak freezes)
//   absorb a slip so one bad moment doesn't wipe the evening.
// - Badges reward meaningful accomplishments, several reachable on the first shift.
// - The social layer is cooperative: a team goal and kudos between staff.
//   There are no leaderboards; personal progress is private to each server.
//
// Pure and deterministic: fed the same events, it produces the same game.

import type { CopilotEvent } from './events.ts'
import type { EngineState } from './engine.ts'
import type { RestaurantConfig, VisitRecord } from './types.ts'

const MIN = 60_000

export interface Award {
  id: string
  staffId: string
  at: number
  kind: 'xp' | 'badge' | 'level' | 'shield' | 'quest' | 'kudos'
  xp: number
  title: string
  detail?: string
  /** Translation key and params for the title (and detail), rendered in each device's language. */
  k?: string
  p?: Record<string, string | number>
  dk?: string
  dp?: Record<string, string | number>
}

export interface PlayerState {
  staffId: string
  xp: number
  combo: number
  bestCombo: number
  streak: number
  bestStreak: number
  shields: number
  counters: Record<string, number>
  badges: Record<string, number> // badge id -> earned at
  quests: Record<string, number> // quest id -> completed at
}

export interface Kudos {
  id: string
  at: number
  from: string
  to: string
  reason: string
}

export interface GameState {
  players: Record<string, PlayerState>
  awards: Award[] // most recent last, capped
  kudos: Kudos[]
  teamSmooth: number
  seq: number
}

// ---------------------------------------------------------------------------
// Catalogue

export const LEVELS: { xp: number; title: string }[] = [
  { xp: 0, title: 'Commis' },
  { xp: 120, title: 'Server' },
  { xp: 320, title: 'Senior server' },
  { xp: 650, title: 'Captain' },
  { xp: 1100, title: 'Head of floor' },
  { xp: 1700, title: 'Maître d’' },
]

export function levelFor(xp: number) {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++
  const cur = LEVELS[i]
  const next = LEVELS[i + 1]
  return {
    index: i,
    level: i + 1,
    title: cur.title,
    floor: cur.xp,
    next: next?.xp ?? null,
    nextTitle: next?.title ?? null,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  }
}

export interface BadgeDef {
  id: string
  title: string
  description: string
  icon: string // lucide icon name, resolved on the client
  counter: string
  target: number
}

export const BADGES: BadgeDef[] = [
  { id: 'first_welcome', title: 'First welcome', description: 'Greet your first table', icon: 'Hand', counter: 'greets', target: 1 },
  { id: 'warm_welcome', title: 'Warm welcome', description: 'Greet 5 tables in under a minute', icon: 'Sun', counter: 'fastGreets', target: 5 },
  { id: 'allergy_guardian', title: 'Allergy guardian', description: 'Confirm 3 allergies with the kitchen', icon: 'ShieldCheck', counter: 'allergies', target: 3 },
  { id: 'heads_up', title: 'Heads-up hero', description: 'Tell 5 tables about a delay or change before they ask', icon: 'Megaphone', counter: 'informs', target: 5 },
  { id: 'hot_hands', title: 'Hot hands', description: 'Take 5 courses from the pass within 30 seconds', icon: 'Flame', counter: 'fastPickups', target: 5 },
  { id: 'quick_turn', title: 'Quick turn', description: 'Reset 3 tables within 3 minutes of payment', icon: 'Timer', counter: 'fastResets', target: 3 },
  { id: 'smooth_operator', title: 'Smooth operator', description: 'Serve 5 tables fully to standard', icon: 'Sparkles', counter: 'smooth', target: 5 },
  { id: 'team_player', title: 'Team player', description: 'Send 3 kudos to teammates', icon: 'HeartHandshake', counter: 'kudosSent', target: 3 },
  { id: 'safety_first', title: 'Safety first', description: 'Catch 2 dishes that clash with an allergy or diet', icon: 'ShieldCheck', counter: 'safety', target: 2 },
  { id: 'perfect_evening', title: 'Perfect evening', description: 'Reach a streak of 8 tables to standard', icon: 'Crown', counter: 'bestStreak', target: 8 },
]

export interface QuestDef {
  id: string
  title: string
  counter: string
  target: number
  xp: number
}

/** Tonight's quests: small, specific, achievable in one service. */
export const QUESTS: QuestDef[] = [
  { id: 'q_greet', title: 'Greet 3 tables in under a minute', counter: 'fastGreets', target: 3, xp: 40 },
  { id: 'q_heads_up', title: 'Give 2 guests a heads-up before they ask', counter: 'informs', target: 2, xp: 40 },
  { id: 'q_smooth', title: 'Serve 3 tables fully to standard', counter: 'smooth', target: 3, xp: 60 },
]

/** Cooperative goal for the whole floor. */
export const TEAM_GOAL = 12

// ---------------------------------------------------------------------------
// Engine

export function initialGame(config: RestaurantConfig): GameState {
  const players: Record<string, PlayerState> = {}
  for (const s of config.staff) if (s.role === 'server') players[s.id] = blankPlayer(s.id)
  return { players, awards: [], kudos: [], teamSmooth: 0, seq: 0 }
}

function blankPlayer(staffId: string): PlayerState {
  return { staffId, xp: 0, combo: 0, bestCombo: 0, streak: 0, bestStreak: 0, shields: 0, counters: {}, badges: {}, quests: {} }
}

type Grade = 'swift' | 'on_time' | 'late'

function grade(elapsedMs: number, targetMin: number): Grade {
  const m = elapsedMs / MIN
  if (m <= targetMin / 2) return 'swift'
  if (m <= targetMin + 0.25) return 'on_time'
  return 'late'
}

const GRADE_XP: Record<Grade, number> = { swift: 15, on_time: 10, late: 3 }
const GRADE_WORD: Record<Grade, string> = { swift: 'Swift', on_time: 'On time', late: 'Done' }

/**
 * Advances the game for one event. Call with the engine state *before* the event
 * (to read timings), then call `afterEvent` with the state after it (for visit closes).
 */
export function beforeEvent(game: GameState, ev: CopilotEvent, state: EngineState, config: RestaurantConfig): void {
  const sop = config.sop
  if (ev.type === 'kudos.sent') {
    const { from, to, reason } = ev.payload
    if (!game.players[to] || from === to) return
    game.kudos.push({ id: ev.id, at: ev.at, from, to, reason })
    if (game.kudos.length > 50) game.kudos.splice(0, game.kudos.length - 50)
    if (game.players[from]) {
      bump(game, from, 'kudosSent', ev.at, config)
      award(game, from, ev.at, 5, 'xp', 'Kudos sent', `to ${name(config, to)}`, config, { k: 'a.kudosSent', dk: 'd.to', dp: { name: name(config, to) } })
    }
    award(game, to, ev.at, 10, 'kudos', `Kudos from ${name(config, from)}`, reason, config, { k: 'a.kudosFrom', p: { name: name(config, from) } })
    return
  }
  // Only staff taps earn XP; POS events and manager overrides don't.
  if (ev.source !== 'app') return

  const tableOf = (id: string) => state.tables[id]
  const credit = (staffId: string | undefined, xp: number, title: string, detail: string | undefined, g?: Grade, key?: string) => {
    if (!staffId || !game.players[staffId]) return
    const p = game.players[staffId]
    if (g === 'late') p.combo = 0
    else if (g) {
      p.combo++
      p.bestCombo = Math.max(p.bestCombo, p.combo)
    }
    const comboBonus = g && g !== 'late' && p.combo >= 3 ? Math.min(10, p.combo) : 0
    award(game, staffId, ev.at, xp + comboBonus, 'xp', title, comboBonus ? `${detail ? detail + ', ' : ''}combo ×${p.combo}` : detail, config, {
      k: key,
      dk: comboBonus ? 'd.combo' : undefined,
      dp: comboBonus ? { table: detail ?? '', n: p.combo } : undefined,
    })
  }

  switch (ev.type) {
    case 'server.greeted': {
      const t = tableOf(ev.payload.tableId)
      if (!t?.seatedAt || t.greetedAt || t.firstOrderAt) return
      const g = grade(ev.at - t.seatedAt, sop.greetWithinMin)
      bump(game, t.serverId, 'greets', ev.at, config)
      if (ev.at - t.seatedAt <= MIN) bump(game, t.serverId, 'fastGreets', ev.at, config)
      credit(t.serverId, GRADE_XP[g], `${GRADE_WORD[g]} welcome`, t.name, g, `a.welcome.${g}`)
      return
    }
    case 'item.served': {
      const lines = ev.payload.lineIds.map((id) => Object.values(state.tables).flatMap((t) => t.lines.map((l) => ({ t, l }))).find((x) => x.l.id === id)).filter(Boolean) as {
        t: EngineState['tables'][string]
        l: EngineState['tables'][string]['lines'][number]
      }[]
      const ready = lines.filter((x) => x.l.status === 'ready' && x.l.readyAt)
      if (!ready.length) return
      const t = ready[0].t
      const waited = ev.at - Math.min(...ready.map((x) => x.l.readyAt!))
      const g = grade(waited, sop.pickupWithinMin)
      if (waited <= 30_000) bump(game, t.serverId, 'fastPickups', ev.at, config)
      credit(t.serverId, GRADE_XP[g], g === 'swift' ? 'Hot to the table' : `${GRADE_WORD[g]}: served`, t.name, g, `a.served.${g}`)
      return
    }
    case 'guest.informed': {
      const t = Object.values(state.tables).find((x) => x.lines.some((l) => ev.payload.lineIds.includes(l.id)))
      if (!t) return
      bump(game, t.serverId, 'informs', ev.at, config)
      credit(t.serverId, 15, ev.payload.reason === 'delay' ? 'Heads-up given' : 'Guest kept in the loop', t.name, 'on_time', ev.payload.reason === 'delay' ? 'a.headsUp' : 'a.loop')
      return
    }
    case 'allergy.confirmed': {
      const t = tableOf(ev.payload.tableId)
      if (!t || t.allergyConfirmedAt) return
      bump(game, t.serverId, 'allergies', ev.at, config)
      credit(t.serverId, 20, 'Allergy flagged', t.name, 'on_time', 'a.allergy')
      return
    }
    case 'bill.presented': {
      const t = tableOf(ev.payload.tableId)
      if (!t?.billRequestedAt || t.billPresentedAt) return
      const g = grade(ev.at - t.billRequestedAt, sop.billPresentWithinMin)
      credit(t.serverId, GRADE_XP[g], `${GRADE_WORD[g]}: bill presented`, t.name, g, `a.bill.${g}`)
      return
    }
    case 'table.reset': {
      const t = tableOf(ev.payload.tableId)
      if (!t?.settledAt) return
      const g = grade(ev.at - t.settledAt, sop.resetWithinMin)
      if (ev.at - t.settledAt <= 3 * MIN) bump(game, t.serverId, 'fastResets', ev.at, config)
      credit(t.serverId, GRADE_XP[g], `${GRADE_WORD[g]}: table reset`, t.name, g, `a.reset.${g}`)
      return
    }
    case 'safety.resolved': {
      const t = tableOf(ev.payload.tableId)
      const fresh = t?.lines.filter((l) => ev.payload.lineIds.includes(l.id) && !l.safetyResolvedAt) ?? []
      if (!t || !fresh.length) return
      bump(game, t.serverId, 'safety', ev.at, config)
      credit(t.serverId, 20, 'Safety catch', t.name, 'on_time', 'a.safety')
      return
    }
    case 'guest.recovered': {
      const t = tableOf(ev.payload.tableId)
      if (!t || t.recoveredAt || t.mood?.value !== 'unhappy') return
      bump(game, t.serverId, 'recoveries', ev.at, config)
      credit(t.serverId, 15, 'Guest won back', t.name, 'on_time', 'a.recovered')
      return
    }
    case 'server.checkback':
    case 'course.cleared':
    case 'guest.farewelled': {
      const t = tableOf(ev.payload.tableId)
      if (!t) return
      const label = ev.type === 'server.checkback' ? 'Checked in' : ev.type === 'course.cleared' ? 'Course cleared' : 'Warm goodbye'
      const key = ev.type === 'server.checkback' ? 'a.checkin' : ev.type === 'course.cleared' ? 'a.cleared' : 'a.goodbye'
      credit(t.serverId, 5, label, t.name, undefined, key)
      return
    }
  }
}

/** Visits that closed on this event update streaks, shields and the team goal. */
export function afterEvent(game: GameState, newVisits: VisitRecord[], config: RestaurantConfig): void {
  for (const v of newVisits) {
    const p = game.players[v.serverId]
    if (!p) continue
    if (v.smooth) {
      game.teamSmooth++
      p.streak++
      p.bestStreak = Math.max(p.bestStreak, p.streak)
      bump(game, v.serverId, 'smooth', v.endedAt, config)
      setCounter(game, v.serverId, 'bestStreak', p.bestStreak, v.endedAt, config)
      award(game, v.serverId, v.endedAt, 25, 'xp', 'Table served to standard', `${v.tableName}, streak ${p.streak}`, config, { k: 'a.smooth', dk: 'd.streak', dp: { table: v.tableName, n: p.streak } })
      if (p.counters.smooth % 3 === 0) {
        p.shields = Math.min(3, p.shields + 1)
        award(game, v.serverId, v.endedAt, 0, 'shield', 'Streak shield earned', 'Protects your streak from one slip', config, { k: 'a.shieldEarned', dk: 'd.shieldEarned' })
      }
    } else if (p.shields > 0) {
      p.shields--
      award(game, v.serverId, v.endedAt, 0, 'shield', 'Shield used', `Your streak of ${p.streak} is safe`, config, { k: 'a.shieldUsed', dk: 'd.shieldUsed', dp: { n: p.streak } })
    } else {
      p.streak = 0
    }
  }
}

function name(config: RestaurantConfig, id: string) {
  return config.staff.find((s) => s.id === id)?.name ?? 'a teammate'
}

function award(
  game: GameState,
  staffId: string,
  at: number,
  xp: number,
  kind: Award['kind'],
  title: string,
  detail: string | undefined,
  config: RestaurantConfig,
  i18n: Pick<Award, 'k' | 'p' | 'dk' | 'dp'> = {},
) {
  const p = game.players[staffId]
  if (!p) return
  const before = levelFor(p.xp).level
  p.xp += xp
  push(game, { id: `a${++game.seq}`, staffId, at, kind, xp, title, detail, ...i18n })
  const after = levelFor(p.xp)
  if (after.level > before)
    push(game, { id: `a${++game.seq}`, staffId, at, kind: 'level', xp: 0, title: `Level ${after.level}: ${after.title}`, detail: 'New rank unlocked', k: 'a.level', p: { n: after.level, rank: `@rank.${after.index}` }, dk: 'd.newRank' })
  void config
}

function push(game: GameState, a: Award) {
  game.awards.push(a)
  if (game.awards.length > 300) game.awards.splice(0, game.awards.length - 300)
}

function bump(game: GameState, staffId: string, counter: string, at: number, config: RestaurantConfig) {
  const p = game.players[staffId]
  if (!p) return
  setCounter(game, staffId, counter, (p.counters[counter] ?? 0) + 1, at, config)
}

function setCounter(game: GameState, staffId: string, counter: string, value: number, at: number, config: RestaurantConfig) {
  const p = game.players[staffId]
  p.counters[counter] = value
  for (const b of BADGES)
    if (b.counter === counter && !p.badges[b.id] && value >= b.target) {
      p.badges[b.id] = at
      award(game, staffId, at, 30, 'badge', b.title, b.description, config, { k: `badge.${b.id}.t`, dk: `badge.${b.id}.d` })
    }
  for (const q of QUESTS)
    if (q.counter === counter && !p.quests[q.id] && value >= q.target) {
      p.quests[q.id] = at
      award(game, staffId, at, q.xp, 'quest', 'Quest complete', q.title, config, { k: 'a.quest', dk: `quest.${q.id}` })
    }
}

// ---------------------------------------------------------------------------
// Views

export interface PlayerView {
  player: PlayerState
  level: ReturnType<typeof levelFor>
  awards: Award[]
  badges: (BadgeDef & { earnedAt: number | null; progress: number })[]
  quests: (QuestDef & { done: boolean; progress: number })[]
}

export function playerView(game: GameState, staffId: string): PlayerView | null {
  const p = game.players[staffId]
  if (!p) return null
  return {
    player: p,
    level: levelFor(p.xp),
    awards: game.awards.filter((a) => a.staffId === staffId).slice(-25),
    badges: BADGES.map((b) => ({ ...b, earnedAt: p.badges[b.id] ?? null, progress: Math.min(b.target, p.counters[b.counter] ?? 0) })),
    quests: QUESTS.map((q) => ({ ...q, done: !!p.quests[q.id], progress: Math.min(q.target, p.counters[q.counter] ?? 0) })),
  }
}

/** What everyone can see: the shared goal and recognition between teammates. No individual scores. */
export function teamView(game: GameState) {
  return { smooth: game.teamSmooth, goal: TEAM_GOAL, kudos: game.kudos.slice(-12).reverse() }
}
