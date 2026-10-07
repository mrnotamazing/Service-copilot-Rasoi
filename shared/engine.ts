// The copilot engine: folds canonical events into floor state, derives the
// server's prioritised task cards from the SOPs, and attributes every delay to
// the part of the process that owned it (floor, kitchen or guest).
//
// It is pure: same events + same "now" => same output. That keeps it testable
// and lets the server rebuild state by replaying the event log.

import type { CopilotEvent } from './events.ts'
import type {
  Course,
  MenuItem,
  Note,
  OrderLine,
  Owner,
  RestaurantConfig,
  Segment,
  StaffStats,
  Station,
  TableState,
  Task,
  TaskAction,
  TaskKind,
  VisitRecord,
} from './types.ts'

const MIN = 60_000

export interface EngineState {
  tables: Record<string, TableState>
  unavailable: Record<string, number> // menuItemId -> since
  notes: Note[]
  snoozes: Record<string, number> // taskId -> snoozed until
  visits: VisitRecord[]
  eventCount: number
}

export function initialState(config: RestaurantConfig): EngineState {
  const tables: Record<string, TableState> = {}
  for (const t of config.tables) tables[t.id] = emptyTable(t.id, config)
  return { tables, unavailable: {}, notes: [], snoozes: {}, visits: [], eventCount: 0 }
}

function emptyTable(id: string, config: RestaurantConfig, keepServer?: string): TableState {
  const def = config.tables.find((t) => t.id === id)!
  return {
    id,
    name: def.name,
    seats: def.seats,
    section: def.section,
    serverId: keepServer ?? config.sections[def.section] ?? '',
    status: 'available',
    checkbacks: {},
    courseClearedAt: {},
    lines: [],
  }
}

const menuById = (config: RestaurantConfig, id: string): MenuItem | undefined =>
  config.menu.find((m) => m.id === id)

function findLine(state: EngineState, lineId: string): [TableState, OrderLine] | undefined {
  for (const t of Object.values(state.tables)) {
    const l = t.lines.find((x) => x.id === lineId)
    if (l) return [t, l]
  }
  return undefined
}

function touch(t: TableState, at: number) {
  t.lastAttentionAt = at
}

/** Applies one event to the state (mutates and returns it). Unknown tables/lines are ignored. */
export function applyEvent(state: EngineState, ev: CopilotEvent, config: RestaurantConfig): EngineState {
  state.eventCount++
  const at = ev.at
  const table = (id: string | undefined) => (id ? state.tables[id] : undefined)

  switch (ev.type) {
    case 'table.seated': {
      const prev = table(ev.payload.tableId)
      if (!prev) break
      if (prev.visitId) closeVisit(state, prev, config, at)
      const t = state.tables[prev.id]
      const p = ev.payload
      t.status = 'seated'
      t.visitId = `${t.id}@${at}`
      t.seatedAt = at
      t.lastAttentionAt = at
      t.party = { size: p.partySize, guestName: p.guestName, allergies: p.allergies ?? [], occasion: p.occasion, vip: p.vip }
      break
    }
    case 'table.assigned': {
      const t = table(ev.payload.tableId)
      if (t) t.serverId = ev.payload.serverId
      break
    }
    case 'server.greeted': {
      const t = table(ev.payload.tableId)
      if (t && !t.greetedAt) t.greetedAt = at
      if (t) touch(t, at)
      break
    }
    case 'order.fired': {
      const t = table(ev.payload.tableId)
      if (!t) break
      if (!t.visitId) {
        // POS fired an order on a table we never saw seated: open a visit now.
        t.visitId = `${t.id}@${at}`
        t.seatedAt = at
        t.party = { size: 0, allergies: [] }
      }
      t.firstOrderAt ??= at
      if (t.status === 'seated' || t.status === 'ordering') t.status = 'dining'
      for (const fl of ev.payload.lines) {
        const m = menuById(config, fl.menuItemId)
        const prepMin = m?.prepMin ?? 10
        const off = state.unavailable[fl.menuItemId] !== undefined
        t.lines.push({
          id: fl.id,
          ticketId: ev.payload.ticketId,
          menuItemId: fl.menuItemId,
          name: fl.name ?? m?.name ?? fl.menuItemId,
          course: fl.course ?? m?.course ?? 'main',
          station: m?.station ?? 'hot',
          qty: fl.qty,
          firedAt: at,
          expectedReadyAt: at + prepMin * MIN,
          status: off ? 'unavailable' : 'fired',
          unavailableAt: off ? at : undefined,
        })
      }
      break
    }
    case 'item.ready': {
      const ids = new Set(ev.payload.lineIds ?? [])
      for (const t of Object.values(state.tables))
        for (const l of t.lines)
          if (l.status === 'fired' && (ids.has(l.id) || (ev.payload.ticketId && l.ticketId === ev.payload.ticketId))) {
            l.status = 'ready'
            l.readyAt = at
          }
      break
    }
    case 'item.served': {
      for (const id of ev.payload.lineIds) {
        const hit = findLine(state, id)
        if (!hit) continue
        const [t, l] = hit
        if (l.status === 'unavailable') continue
        l.readyAt ??= at
        l.status = 'served'
        l.servedAt = at
        touch(t, at)
      }
      break
    }
    case 'item.stock': {
      const { menuItemId, available } = ev.payload
      if (available) {
        delete state.unavailable[menuItemId]
      } else {
        state.unavailable[menuItemId] = at
        for (const t of Object.values(state.tables))
          for (const l of t.lines)
            if (l.menuItemId === menuItemId && l.status === 'fired') {
              l.status = 'unavailable'
              l.unavailableAt = at
            }
      }
      break
    }
    case 'guest.informed': {
      for (const id of ev.payload.lineIds) {
        const hit = findLine(state, id)
        if (!hit) continue
        const [t, l] = hit
        if (ev.payload.reason === 'delay') l.delayInformedAt = at
        else l.unavailableInformedAt = at
        touch(t, at)
      }
      break
    }
    case 'server.checkback': {
      const t = table(ev.payload.tableId)
      if (t) {
        t.checkbacks[ev.payload.course] = at
        touch(t, at)
      }
      break
    }
    case 'course.cleared': {
      const t = table(ev.payload.tableId)
      if (t) {
        t.courseClearedAt[ev.payload.course] = at
        touch(t, at)
      }
      break
    }
    case 'allergy.confirmed': {
      const t = table(ev.payload.tableId)
      if (!t || t.allergyConfirmedAt) break
      t.allergyConfirmedAt = at
      touch(t, at)
      state.notes.push({
        id: `allergy_${t.visitId}`,
        at,
        direction: 'to_kitchen',
        tableId: t.id,
        text: `ALLERGY ${t.name}: ${t.party?.allergies.join(', ')}`,
        from: t.serverId,
      })
      break
    }
    case 'bill.requested': {
      const t = table(ev.payload.tableId)
      if (t && t.visitId) {
        t.billRequestedAt ??= at
        t.status = 'bill'
      }
      break
    }
    case 'bill.presented': {
      const t = table(ev.payload.tableId)
      if (t) {
        t.billRequestedAt ??= at
        t.billPresentedAt ??= at
        touch(t, at)
      }
      break
    }
    case 'bill.settled': {
      const t = table(ev.payload.tableId)
      if (t && t.visitId) {
        t.billRequestedAt ??= at
        t.billPresentedAt ??= at
        t.settledAt = at
        t.status = 'paid'
      }
      break
    }
    case 'guest.farewelled': {
      const t = table(ev.payload.tableId)
      if (t) {
        t.farewelledAt = at
        if (t.status === 'paid') t.status = 'needs_reset'
        touch(t, at)
      }
      break
    }
    case 'table.reset': {
      const t = table(ev.payload.tableId)
      if (t?.visitId) closeVisit(state, t, config, at)
      else if (t) state.tables[t.id] = emptyTable(t.id, config, t.serverId)
      break
    }
    case 'task.snoozed': {
      state.snoozes[ev.payload.taskId] = at + ev.payload.minutes * MIN
      break
    }
    case 'note.sent': {
      const p = ev.payload
      state.notes.push({ id: p.noteId, at, direction: p.direction, tableId: p.tableId, text: p.text, from: p.from })
      if (state.notes.length > 200) state.notes.splice(0, state.notes.length - 200)
      break
    }
    case 'note.acked': {
      const n = state.notes.find((x) => x.id === ev.payload.noteId)
      if (n) n.ackAt ??= at
      break
    }
  }
  return state
}

function closeVisit(state: EngineState, t: TableState, config: RestaurantConfig, at: number) {
  const segments = segmentsFor(t, config, at)
  state.visits.push({
    visitId: t.visitId!,
    tableId: t.id,
    tableName: t.name,
    serverId: t.serverId,
    partySize: t.party?.size ?? 0,
    seatedAt: t.seatedAt ?? at,
    endedAt: at,
    segments,
    smooth: segments.every((s) => s.owner !== 'floor' || !s.lapse),
  })
  if (state.visits.length > 500) state.visits.splice(0, state.visits.length - 500)
  state.tables[t.id] = emptyTable(t.id, config, t.serverId)
}

// ---------------------------------------------------------------------------
// Attribution: break a visit into measured steps, each with an owner.

/** Completed segments of a visit. `resetAt` closes the reset step when the visit ends. */
export function segmentsFor(t: TableState, config: RestaurantConfig, resetAt?: number): Segment[] {
  const sop = config.sop
  const out: Segment[] = []
  const seg = (s: Omit<Segment, 'lapse'>) => out.push({ ...s, lapse: (s.end - s.start) / MIN > s.targetMin })

  const greetEnd = t.greetedAt ?? t.firstOrderAt
  if (t.seatedAt && greetEnd)
    seg({ stage: 'greet', owner: 'floor', label: 'Seated → greeted', start: t.seatedAt, end: greetEnd, targetMin: sop.greetWithinMin })

  const tickets = new Map<string, OrderLine[]>()
  for (const l of t.lines) if (l.status !== 'unavailable') tickets.set(l.ticketId, [...(tickets.get(l.ticketId) ?? []), l])
  for (const lines of tickets.values()) {
    if (lines.some((l) => l.readyAt === undefined)) continue
    const fired = Math.min(...lines.map((l) => l.firedAt))
    const ready = Math.max(...lines.map((l) => l.readyAt!))
    const expected = Math.max(...lines.map((l) => l.expectedReadyAt))
    const slowest = lines.reduce((a, b) => (b.readyAt! - b.expectedReadyAt > a.readyAt! - a.expectedReadyAt ? b : a))
    const course = lines[0].course
    seg({
      stage: 'kitchen',
      owner: 'kitchen',
      label: `${cap(course)} in kitchen`,
      start: fired,
      end: ready,
      targetMin: (expected - fired) / MIN + sop.kitchenDelayToleranceMin,
      station: slowest.station,
    })
    if (lines.every((l) => l.servedAt !== undefined)) {
      const served = Math.max(...lines.map((l) => l.servedAt!))
      seg({ stage: 'pickup', owner: 'floor', label: `${cap(course)} pass → table`, start: ready, end: served, targetMin: sop.pickupWithinMin })
    }
  }

  if (t.billRequestedAt && t.billPresentedAt)
    seg({ stage: 'bill', owner: 'floor', label: 'Bill asked → presented', start: t.billRequestedAt, end: t.billPresentedAt, targetMin: sop.billPresentWithinMin })
  if (t.settledAt && resetAt)
    seg({ stage: 'reset', owner: 'floor', label: 'Paid → table reset', start: t.settledAt, end: resetAt, targetMin: sop.resetWithinMin })
  return out.sort((a, b) => a.start - b.start)
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

// ---------------------------------------------------------------------------
// Tasks: the "next three moves" for each server.

const COURSE_ORDER: Course[] = ['starter', 'main', 'dessert']
const RESET_CHECKLIST = ['Clear & wipe down', 'Fresh linen & napkins', 'Cutlery & glassware', 'Condiments, salt & pepper topped up', 'Menus & candle']

function alternativesFor(state: EngineState, config: RestaurantConfig, line: OrderLine): string[] {
  return config.menu
    .filter((m) => m.course === line.course && m.id !== line.menuItemId && state.unavailable[m.id] === undefined)
    .slice(0, 2)
    .map((m) => m.name)
}

function describeParty(t: TableState): string {
  const p = t.party
  if (!p) return ''
  const bits = [p.size ? `Party of ${p.size}` : '']
  if (p.guestName) bits.push(p.guestName)
  if (p.vip) bits.push('regular guest')
  if (p.occasion) bits.push(p.occasion)
  if (p.allergies.length) bits.push(`allergy: ${p.allergies.join(', ')}`)
  return bits.filter(Boolean).join(' · ')
}

function minutes(ms: number): string {
  const m = Math.round(ms / MIN)
  return `${m} min`
}

export function deriveTasks(state: EngineState, config: RestaurantConfig, now: number): Task[] {
  const sop = config.sop
  const tasks: Task[] = []
  const available = Object.values(state.tables).filter((t) => t.status === 'available').length

  for (const t of Object.values(state.tables)) {
    if (!t.visitId) continue
    const add = (
      kind: TaskKind,
      suffix: string,
      o: { title: string; hint: string; impact: number; dueAt: number; createdAt: number; actions: TaskAction[]; checklist?: string[]; staffId?: string },
    ) => {
      const staffId = o.staffId ?? t.serverId
      tasks.push({
        id: `${kind}:${t.visitId}:${suffix}${o.staffId ? `:${o.staffId}` : ''}`,
        kind,
        tableId: t.id,
        tableName: t.name,
        staffId,
        title: o.title,
        hint: o.hint,
        checklist: o.checklist,
        impact: o.impact,
        dueAt: o.dueAt,
        createdAt: o.createdAt,
        score: 0,
        actions: o.actions,
      })
    }
    const lines = t.lines

    // Greet newly seated guests.
    if (t.seatedAt && !t.greetedAt && !t.firstOrderAt && t.status === 'seated')
      add('greet', '', {
        title: `Welcome ${t.name}`,
        hint: [describeParty(t), 'Water, menus, today’s specials'].filter(Boolean).join(' · '),
        impact: t.party?.vip ? 4 : 3,
        createdAt: t.seatedAt,
        dueAt: t.seatedAt + sop.greetWithinMin * MIN,
        actions: [{ label: 'Greeted', event: 'server.greeted', payload: { tableId: t.id }, primary: true }],
      })

    // Greeted but no order yet.
    if (t.greetedAt && !t.firstOrderAt) {
      const due = t.greetedAt + sop.orderNudgeAfterMin * MIN
      if (now >= due - 2 * MIN)
        add('take_order', '', {
          title: `${t.name} may be ready to order`,
          hint: 'Menus have been down a while. Offer recommendations if they’re undecided.',
          impact: 2,
          createdAt: due - 2 * MIN,
          dueAt: due,
          actions: [{ label: 'Not ready yet', event: 'task.snoozed', payload: { minutes: 4 }, primary: true }],
        })
    }

    // Allergy confirmation once the first order is in.
    if (t.party?.allergies.length && t.firstOrderAt && !t.allergyConfirmedAt)
      add('allergy', '', {
        title: `Flag ${t.name}’s allergy to the kitchen`,
        hint: `${t.party.allergies.join(', ')}: one tap sends it to the pass and confirms it on the ticket.`,
        impact: 5,
        createdAt: t.firstOrderAt,
        dueAt: t.firstOrderAt + 1 * MIN,
        actions: [{ label: 'Send to kitchen', event: 'allergy.confirmed', payload: { tableId: t.id }, primary: true }],
      })

    // Unavailable items the guest still expects.
    const off = lines.filter((l) => l.status === 'unavailable' && !l.unavailableInformedAt)
    if (off.length) {
      const since = Math.min(...off.map((l) => l.unavailableAt ?? now))
      const alts = alternativesFor(state, config, off[0])
      add('unavailable', off.map((l) => l.id).join(','), {
        title: `${off.map((l) => l.name).join(', ')} is off: tell ${t.name}`,
        hint: alts.length ? `Suggest instead: ${alts.join(' or ')}` : 'Offer the guest a choice from the menu.',
        impact: 5,
        createdAt: since,
        dueAt: since + 1 * MIN,
        actions: [{ label: 'Told guest', event: 'guest.informed', payload: { lineIds: off.map((l) => l.id), reason: 'unavailable' }, primary: true }],
      })
    }

    // Kitchen running late on a ticket: give the guest a heads-up.
    const tickets = new Map<string, OrderLine[]>()
    for (const l of lines) tickets.set(l.ticketId, [...(tickets.get(l.ticketId) ?? []), l])
    for (const [ticketId, tl] of tickets) {
      const late = tl.filter((l) => l.status === 'fired' && !l.delayInformedAt && now > l.expectedReadyAt + sop.kitchenDelayToleranceMin * MIN)
      if (!late.length) continue
      const over = Math.max(...late.map((l) => now - l.expectedReadyAt))
      const appear = Math.min(...late.map((l) => l.expectedReadyAt)) + sop.kitchenDelayToleranceMin * MIN
      add('kitchen_delay', ticketId, {
        title: `${t.name} ${late[0].course}s running ${minutes(over)} late`,
        hint: `Kitchen is behind on ${late.map((l) => l.name).join(', ')}. A heads-up now beats an apology later.`,
        impact: 4,
        createdAt: appear,
        dueAt: appear + 1 * MIN,
        actions: [{ label: 'Told them', event: 'guest.informed', payload: { lineIds: late.map((l) => l.id), reason: 'delay' }, primary: true }],
      })
    }

    // Food waiting at the pass.
    const ready = lines.filter((l) => l.status === 'ready')
    if (ready.length) {
      const readyAt = Math.min(...ready.map((l) => l.readyAt ?? now))
      add('pickup', ready.map((l) => l.id).join(','), {
        title: `Pick up ${t.name} ${ready[0].course}s from the pass`,
        hint: ready.map((l) => `${l.qty}× ${l.name}`).join(', '),
        impact: 4,
        createdAt: readyAt,
        dueAt: readyAt + sop.pickupWithinMin * MIN,
        actions: [{ label: 'Served', event: 'item.served', payload: { lineIds: ready.map((l) => l.id) }, primary: true }],
      })
    }

    // Per course: check back after serving, then clear and move the meal on.
    for (const course of COURSE_ORDER) {
      const cl = lines.filter((l) => l.course === course && l.status !== 'unavailable')
      if (!cl.length || cl.some((l) => l.status !== 'served') || t.courseClearedAt[course]) continue
      const servedAt = Math.max(...cl.map((l) => l.servedAt!))
      const checkAt = servedAt + sop.checkbackAfterMin * MIN
      if (!t.checkbacks[course] && now >= checkAt)
        add('checkback', course, {
          title: `Check in on ${t.name}’s ${course}s`,
          hint: 'A quick “how is everything?”. Catch issues while they can still be fixed.',
          impact: 2,
          createdAt: checkAt,
          dueAt: checkAt + 2 * MIN,
          actions: [{ label: 'Checked in', event: 'server.checkback', payload: { tableId: t.id, course }, primary: true }],
        })
      const clearAt = servedAt + sop.courseCheckAfterMin * MIN
      if (now >= clearAt - 1 * MIN && !t.billRequestedAt) {
        const next = course === 'starter' ? 'fire mains' : course === 'main' ? 'offer desserts' : 'offer coffee'
        add('clear_course', course, {
          title: `${t.name} done with ${course}s? Clear & ${next}`,
          hint: 'Clear once the whole table has finished.',
          impact: 2,
          createdAt: clearAt - 1 * MIN,
          dueAt: clearAt + 2 * MIN,
          actions: [{ label: 'Cleared', event: 'course.cleared', payload: { tableId: t.id, course }, primary: true }],
        })
      }
    }

    // Bill.
    if (t.billRequestedAt && !t.billPresentedAt && !t.settledAt)
      add('present_bill', '', {
        title: `${t.name} asked for the bill`,
        hint: 'Bill is printed. Present it and check how the evening went.',
        impact: 4,
        createdAt: t.billRequestedAt,
        dueAt: t.billRequestedAt + sop.billPresentWithinMin * MIN,
        actions: [{ label: 'Presented', event: 'bill.presented', payload: { tableId: t.id }, primary: true }],
      })

    // Goodbye: only while guests are plausibly still at the door.
    if (t.settledAt && !t.farewelledAt && now < t.settledAt + 8 * MIN)
      add('farewell', '', {
        title: `Say goodbye to ${t.name}`,
        hint: [t.party?.guestName ? `Thank ${t.party.guestName}` : 'Thank them', t.party?.occasion ? `wish them a happy ${t.party.occasion}` : 'invite them back']
          .join(', '),
        impact: 3,
        createdAt: t.settledAt,
        dueAt: t.settledAt + sop.farewellWithinMin * MIN,
        actions: [{ label: 'Done', event: 'guest.farewelled', payload: { tableId: t.id }, primary: true }],
      })

    // Turn the table.
    if (t.settledAt && (t.farewelledAt || now >= t.settledAt + 3 * MIN)) {
      const start = t.farewelledAt ?? t.settledAt + 3 * MIN
      add('reset', '', {
        title: `Reset ${t.name} for the next guests`,
        hint: available <= 1 ? 'Guests are waiting. This table is needed soon.' : 'Get it guest-ready.',
        impact: available <= 1 ? 4 : 2,
        createdAt: start,
        dueAt: t.settledAt + sop.resetWithinMin * MIN,
        checklist: RESET_CHECKLIST,
        actions: [{ label: 'Table ready', event: 'table.reset', payload: { tableId: t.id }, primary: true }],
      })
    }
  }

  // Messages from the kitchen to the floor.
  const servers = config.staff.filter((s) => s.role === 'server')
  for (const n of state.notes) {
    if (n.direction !== 'to_floor' || n.ackAt) continue
    const t = n.tableId ? state.tables[n.tableId] : undefined
    const targets = t?.serverId ? [t.serverId] : servers.map((s) => s.id)
    for (const staffId of targets)
      tasks.push({
        id: `kitchen_message:${n.id}:${staffId}`,
        kind: 'kitchen_message',
        tableId: t?.id ?? '',
        tableName: t?.name ?? 'All',
        staffId,
        title: `Kitchen: ${n.text}`,
        hint: t ? `About ${t.name}` : 'For the whole floor',
        impact: 4,
        createdAt: n.at,
        dueAt: n.at + 1 * MIN,
        score: 0,
        actions: [{ label: 'Got it', event: 'note.acked', payload: { noteId: n.id }, primary: true }],
      })
  }

  return tasks
    .filter((k) => !(state.snoozes[k.id] > now))
    .map((k) => ({ ...k, score: scoreTask(k, state.tables[k.tableId], now) }))
    .sort((a, b) => b.score - a.score)
}

/**
 * Priority = guest impact × urgency against the SOP deadline, plus a small boost
 * for tables that haven't had attention in a while. Overdue tasks keep climbing.
 */
export function scoreTask(task: Task, table: TableState | undefined, now: number): number {
  const horizon = 3 * MIN
  const lead = task.dueAt - now
  const urgency = lead > 0 ? Math.max(0, 1 - lead / horizon) : 1 + Math.min(3, (-lead / MIN) * 0.5)
  const since = table?.lastAttentionAt ?? table?.seatedAt ?? now
  const neglect = Math.min(0.6, ((now - since) / MIN) * 0.04)
  const vip = table?.party?.vip ? 0.5 : 0
  return Math.round((task.impact * (0.6 + urgency) + neglect + vip) * 100) / 100
}

export function tasksFor(tasks: Task[], staffId: string, limit = 3): { top: Task[]; queued: number } {
  const mine = tasks.filter((t) => t.staffId === staffId)
  return { top: mine.slice(0, limit), queued: Math.max(0, mine.length - limit) }
}

// ---------------------------------------------------------------------------
// Personal stats (shown only to the staff member themselves).

export function staffStats(state: EngineState, config: RestaurantConfig): StaffStats[] {
  return config.staff
    .filter((s) => s.role === 'server')
    .map((s) => {
      const visits = state.visits.filter((v) => v.serverId === s.id)
      let streak = 0
      let best = 0
      let run = 0
      for (const v of visits) {
        run = v.smooth ? run + 1 : 0
        best = Math.max(best, run)
      }
      streak = run
      const greets = visits.flatMap((v) => v.segments.filter((g) => g.stage === 'greet').map((g) => (g.end - g.start) / 1000))
      return {
        staffId: s.id,
        activeTables: Object.values(state.tables).filter((t) => t.serverId === s.id && t.visitId).length,
        smoothTables: visits.filter((v) => v.smooth).length,
        completedTables: visits.length,
        streak,
        bestStreak: best,
        avgGreetSec: greets.length ? Math.round(greets.reduce((a, b) => a + b, 0) / greets.length) : null,
      }
    })
}

// ---------------------------------------------------------------------------
// Manager view: process bottlenecks, never individual rankings.

export interface StageSummary {
  stage: Segment['stage']
  label: string
  owner: Owner
  count: number
  avgMin: number
  avgTargetMin: number
  lapseRate: number
}

export interface Analytics {
  visits: number
  smoothRate: number | null
  stages: StageSummary[]
  lapsesByOwner: Record<Owner, number>
  stations: { station: Station; tickets: number; lapses: number; avgOverMin: number }[]
  load: { staffId: string; activeTables: number; overloaded: boolean }[]
  suggestions: string[]
  recentVisits: VisitRecord[]
}

const STAGE_LABELS: Record<Segment['stage'], string> = {
  greet: 'Greeting',
  kitchen: 'Kitchen prep',
  pickup: 'Pass to table',
  bill: 'Bill presentation',
  reset: 'Table reset',
}

export function analytics(state: EngineState, config: RestaurantConfig): Analytics {
  const live = Object.values(state.tables).filter((t) => t.visitId).flatMap((t) => segmentsFor(t, config))
  const all = [...state.visits.flatMap((v) => v.segments), ...live]

  const stages: StageSummary[] = (Object.keys(STAGE_LABELS) as Segment['stage'][]).map((stage) => {
    const s = all.filter((x) => x.stage === stage)
    const avg = (f: (x: Segment) => number) => (s.length ? s.reduce((a, x) => a + f(x), 0) / s.length : 0)
    return {
      stage,
      label: STAGE_LABELS[stage],
      owner: stage === 'kitchen' ? 'kitchen' : 'floor',
      count: s.length,
      avgMin: round1(avg((x) => (x.end - x.start) / MIN)),
      avgTargetMin: round1(avg((x) => x.targetMin)),
      lapseRate: s.length ? s.filter((x) => x.lapse).length / s.length : 0,
    }
  })

  const lapsesByOwner: Record<Owner, number> = { floor: 0, kitchen: 0, guest: 0 }
  for (const s of all) if (s.lapse) lapsesByOwner[s.owner]++

  const stationMap = new Map<Station, { tickets: number; lapses: number; over: number }>()
  for (const s of all.filter((x) => x.stage === 'kitchen' && x.station)) {
    const e = stationMap.get(s.station!) ?? { tickets: 0, lapses: 0, over: 0 }
    e.tickets++
    if (s.lapse) e.lapses++
    e.over += Math.max(0, (s.end - s.start) / MIN - s.targetMin)
    stationMap.set(s.station!, e)
  }
  const stations = [...stationMap.entries()]
    .map(([station, e]) => ({ station, tickets: e.tickets, lapses: e.lapses, avgOverMin: round1(e.over / e.tickets) }))
    .sort((a, b) => b.lapses - a.lapses)

  const stats = staffStats(state, config)
  const load = stats.map((s) => ({ staffId: s.staffId, activeTables: s.activeTables, overloaded: s.activeTables > config.sop.maxActiveTablesPerServer }))

  const suggestions: string[] = []
  const name = (id: string) => config.staff.find((s) => s.id === id)?.name ?? id
  const lightest = [...load].sort((a, b) => a.activeTables - b.activeTables)[0]
  for (const l of load.filter((x) => x.overloaded)) {
    const candidate = Object.values(state.tables).find((t) => t.serverId === l.staffId && t.status === 'seated')
    suggestions.push(
      `${name(l.staffId)}'s section has ${l.activeTables} active tables (SOP limit ${config.sop.maxActiveTablesPerServer}).` +
        (candidate && lightest && lightest.staffId !== l.staffId ? ` Consider handing ${candidate.name} to ${name(lightest.staffId)} (${lightest.activeTables} active).` : ''),
    )
  }
  const worst = stations[0]
  if (worst && worst.lapses >= 2)
    suggestions.push(`${cap(worst.station)} station ran past target on ${worst.lapses} of ${worst.tickets} tickets (avg ${worst.avgOverMin} min over). Consider extra cover there at peak.`)
  const pickup = stages.find((s) => s.stage === 'pickup')!
  if (pickup.count >= 4 && pickup.lapseRate > 0.3)
    suggestions.push(`Plates wait at the pass on ${Math.round(pickup.lapseRate * 100)}% of courses. A food runner during peak would free servers up.`)
  const reset = stages.find((s) => s.stage === 'reset')!
  if (reset.count >= 3 && reset.lapseRate > 0.4)
    suggestions.push(`Table resets are slow (${reset.avgMin} min vs ${reset.avgTargetMin} target). Busser support at turn time would raise covers.`)

  return {
    visits: state.visits.length,
    smoothRate: state.visits.length ? state.visits.filter((v) => v.smooth).length / state.visits.length : null,
    stages,
    lapsesByOwner,
    stations,
    load,
    suggestions,
    recentVisits: state.visits.slice(-15).reverse(),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
