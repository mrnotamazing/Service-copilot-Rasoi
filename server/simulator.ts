// A fine-dining evening rush, emitted as the same events a real POS would send.
// Guests arrive, order course by course, the kitchen cooks (sometimes slowly),
// an item runs out, guests ask for the bill and leave. Servers can be played by
// people on their phones, or by "autopilot" so the demo runs on its own.

import { newId, type FiredLine, type IncomingEvent, type PayloadOf } from '../shared/events.ts'
import type { SimStatus } from '../shared/snapshot.ts'
import type { Course, TableState } from '../shared/types.ts'
import type { Hub } from './hub.ts'

const MIN = 60_000
// Names as a guest gives them when booking; no honorific is assumed.
const GUEST_NAMES = ['Aarav Kapoor', 'Mx. Iyer', 'the Sharmas', 'Dr. Menon', 'Ria D’Souza', 'Sam Banerjee', 'Ms. Reddy']
const NEEDS = ['wheelchair', 'hearing', 'vision', 'highchair', 'jain', 'halal', 'vegan', 'quiet', 'service_animal', 'no_beef', 'no_pork', 'fasting']
const OCCASIONS = ['anniversary', 'birthday', 'business dinner']
const ALLERGIES = ['nuts', 'shellfish', 'gluten', 'dairy']

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
const chance = (p: number) => Math.random() < p

type Party = Omit<PayloadOf<'table.seated'>, 'tableId'>

/** Moments the presenter can stage on cue (and that showcase mode stages by itself). */
export const MOMENTS = ['arrival', 'allergy', 'vip', 'access', 'kitchen_delay', 'sold_out', 'unhappy', 'manager', 'bill', 'rush'] as const
export type MomentKind = (typeof MOMENTS)[number]
/** The order showcase mode works through: each one shows off a different part of the app. */
const SHOWCASE: MomentKind[] = ['allergy', 'kitchen_delay', 'vip', 'unhappy', 'access', 'sold_out', 'manager', 'bill']

interface Plan {
  orderAt?: number
  billAt?: number
  settleAt?: number
  wantsDessert: boolean
  courseFiredFor: Set<Course>
  reordered: Set<string>
}

export class Simulator {
  running = false
  intensity = 1 // arrivals multiplier
  autopilot = new Set<string>()
  autoKitchen = true
  /** The manager answers visit requests by themselves (for showcase mode). */
  autoManager = false
  /** Runs itself and stages a key moment every few minutes of service time. */
  showcase = false
  /** What-if knobs: how fast the kitchen cooks (1 = as usual) and an extra cook on the grill. */
  kitchenSpeed = 1
  extraGrill = false
  /** Parties who gave up waiting for a table. */
  walkouts = 0
  private nextMoment = 0
  private momentIndex = 0
  private startedAt: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private waitlist: { size: number; since: number; party?: Partial<Party> }[] = []
  private nextArrival = 0
  private plans = new Map<string, Plan>() // visitId -> plan
  private readyPlan = new Map<string, number>() // lineId -> when kitchen will finish
  private reaction = new Map<string, number>() // taskId -> reaction delay
  private busyUntil = new Map<string, number>()
  private stockOutDone = false

  constructor(private hub: Hub) {
    for (const s of hub.config.staff) if (s.role === 'server') this.autopilot.add(s.id)
  }

  status(): SimStatus {
    return {
      running: this.running,
      speed: this.hub.clock.speed,
      intensity: this.intensity,
      autopilot: [...this.autopilot],
      autoKitchen: this.autoKitchen,
      autoManager: this.autoManager,
      showcase: this.showcase,
      waiting: this.waitlist.length,
      startedAt: this.startedAt,
    }
  }

  start() {
    if (this.running) return
    if (this.startedAt === null) {
      // Service starts now, in real time, so the app's clocks match the wall clock (IST is applied
      // when times are shown). At a demo speed above 1× service time runs ahead; clocks stay real.
      // A restored service picks up where it stopped (see Hub); a fresh one starts at the real time.
      const last = this.hub.events.at(-1)?.at
      this.hub.clock.set(last && Date.now() - last > 10 * MIN ? last : Math.max(Date.now(), last ?? 0))
      this.startedAt = this.hub.clock.now()
      this.nextArrival = this.startedAt + 0.2 * MIN
    }
    this.hub.clock.resume()
    this.running = true
    this.timer = setInterval(() => this.tick(), 250)
    this.hub.emit()
  }

  pause() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
    this.hub.clock.pause()
    this.hub.emit()
  }

  reset() {
    this.pause()
    this.hub.reset()
    this.startedAt = null
    this.waitlist = []
    this.plans.clear()
    this.readyPlan.clear()
    this.reaction.clear()
    this.busyUntil.clear()
    this.stockOutDone = false
    this.walkouts = 0
    this.momentIndex = 0
    this.nextMoment = 0
    this.hub.clock.set(Date.now())
    this.hub.clock.resume()
    this.hub.emit()
  }

  setSpeed(speed: number) {
    this.hub.clock.setSpeed(Math.max(0.5, Math.min(30, speed)))
    if (!this.running) this.hub.clock.pause()
    this.hub.emit()
  }

  setAutopilot(staffId: string, on: boolean) {
    if (on) this.autopilot.add(staffId)
    else this.autopilot.delete(staffId)
    this.hub.emit()
  }

  /** Showcase mode: everyone on autopilot, the service running, and a staged moment every few minutes. */
  setShowcase(on: boolean) {
    this.showcase = on
    if (on) {
      for (const st of this.hub.config.staff) if (st.role === 'server') this.autopilot.add(st.id)
      this.autoKitchen = true
      this.autoManager = true
      if (!this.running) this.start()
      this.nextMoment = this.hub.clock.now() + 1.5 * MIN
    }
    this.hub.emit()
  }

  /** Stage a moment now. Returns what happened, or why it couldn't (e.g. no free table). */
  moment(kind: MomentKind): { ok: boolean; text: string } {
    const hub = this.hub
    const now = hub.clock.now()
    if (this.startedAt === null) this.start()
    const tables = Object.values(hub.state.tables)
    const eating = tables.filter((t) => t.visitId && !t.billRequestedAt && t.lines.some((l) => l.servedAt))
    const say = (ok: boolean, text: string) => {
      if (ok) {
        hub.feed.push({ id: newId('demo'), at: now, kind: 'demo', text: `Staged: ${text}` })
        hub.emit()
      }
      return { ok, text }
    }
    switch (kind) {
      case 'arrival':
        return this.seat({}, 'a new party arrives') ? say(true, 'a new party arrives') : say(false, 'No free table right now; they’ll be seated when one frees up.')
      case 'allergy':
        return say(this.seat({ allergies: ['nuts'], guestName: 'Sam Banerjee' }, 'nut allergy'), 'a guest with a nut allergy arrives')
      case 'vip':
        return say(this.seat({ vip: true, occasion: 'birthday', guestName: 'Ria D’Souza', partySize: 4 }, 'birthday'), 'regulars arrive for a birthday')
      case 'access':
        return say(this.seat({ needs: [pick(['wheelchair', 'hearing', 'vision', 'quiet', 'service_animal'])] }, 'access need'), 'a guest with an access need arrives')
      case 'kitchen_delay': {
        const cooking = tables.flatMap((t) => t.lines.filter((l) => l.status === 'fired'))
        if (!cooking.length) return say(false, 'Nothing is cooking right now; try again once orders are in.')
        const extra = rand(6, 9) * MIN
        for (const l of cooking) this.readyPlan.set(l.id, (this.readyPlan.get(l.id) ?? l.expectedReadyAt) + extra)
        this.send({ type: 'note.sent', source: 'kitchen', payload: { noteId: newId('note'), direction: 'to_floor', text: `Grill is backed up, about ${Math.round(extra / MIN)} minutes behind`, from: 'k_pass' } })
        return say(true, 'the kitchen falls behind')
      }
      case 'sold_out': {
        const fired = new Set(tables.flatMap((t) => t.lines.filter((l) => l.status === 'fired').map((l) => l.menuItemId)))
        const options = hub.config.menu.filter((m) => m.course !== 'dessert' && hub.state.unavailable[m.id] === undefined)
        const item = options.find((m) => fired.has(m.id)) ?? pick(options)
        if (!item) return say(false, 'Everything is already off.')
        this.send({ type: 'item.stock', source: 'pos:sim', payload: { menuItemId: item.id, available: false } })
        this.send({ type: 'note.sent', source: 'kitchen', payload: { noteId: newId('note'), direction: 'to_floor', text: `${item.name} is off for tonight`, from: 'k_pass' } })
        return say(true, `${item.name} runs out`)
      }
      case 'unhappy': {
        const t = eating.find((x) => x.mood?.value !== 'unhappy')
        if (!t) return say(false, 'No table is eating yet; try again once food is out.')
        const course = [...t.lines].reverse().find((l) => l.servedAt)!.course
        this.send({ type: 'server.checkback', source: 'sim', payload: { tableId: t.id, course, mood: 'unhappy' } })
        return say(true, `${t.name} isn’t happy with their food`)
      }
      case 'manager': {
        const t = eating.find((x) => !x.managerRequestedAt)
        if (!t) return say(false, 'No table is eating yet; try again once food is out.')
        this.send({ type: 'guest.recovered', source: 'sim', payload: { tableId: t.id, how: 'manager' } })
        return say(true, `${t.name} asks to see the manager`)
      }
      case 'bill': {
        const t = tables.find((x) => x.visitId && !x.billRequestedAt && x.lines.some((l) => l.course === 'main' && l.servedAt))
        if (!t) return say(false, 'No table has finished mains yet.')
        this.send({ type: 'bill.requested', source: 'pos:sim', payload: { tableId: t.id } })
        return say(true, `${t.name} asks for the bill`)
      }
      case 'rush': {
        let n = 0
        while (this.seat({}, 'rush')) n++
        for (let i = 0; i < 2; i++) this.waitlist.push({ size: pick([2, 4]), since: now })
        return say(n > 0, n ? `a rush: ${n} parties seated at once, more waiting` : 'Every table is full already.')
      }
    }
  }

  /**
   * Run service forward by `minutes` of service time at once, without real timers (for what-if runs
   * and tests). The clock stays paused afterwards.
   */
  fastForward(minutes: number, onMinute?: () => void) {
    if (this.startedAt === null) {
      this.startedAt = this.hub.clock.now()
      this.nextArrival = this.startedAt + 0.2 * MIN
    }
    this.hub.clock.pause()
    for (let i = 0; i < minutes * 4; i++) {
      this.hub.clock.set(this.hub.clock.now() + MIN / 4)
      this.tick()
      if (i % 4 === 3) onMinute?.()
    }
  }

  /** Like a host: the smallest free table that fits, in the section with the fewest guests right now. */
  private freeTable(size: number): TableState | undefined {
    const tables = Object.values(this.hub.state.tables)
    const load = (section: string) => tables.filter((t) => t.section === section && t.visitId).length
    return tables.filter((t) => t.status === 'available' && t.seats >= size).sort((a, b) => a.seats - b.seats || load(a.section) - load(b.section))[0]
  }

  /** Seat a party at the smallest free table that fits; false if none is free. */
  private seat(party: Partial<Party>, _why: string): boolean {
    const size = party.partySize ?? pick([2, 2, 3, 4, 4])
    const free = this.freeTable(size)
    if (!free) return false
    this.send({ type: 'table.seated', source: 'pos:sim', payload: { allergies: [], needs: [], ...party, partySize: size, tableId: free.id } })
    return true
  }

  private send(e: IncomingEvent) {
    this.hub.ingest({ ...e, source: e.source ?? 'sim' } as IncomingEvent)
  }

  private plan(t: TableState): Plan {
    let p = this.plans.get(t.visitId!)
    if (!p) {
      p = { wantsDessert: chance(0.55), courseFiredFor: new Set(), reordered: new Set() }
      this.plans.set(t.visitId!, p)
    }
    return p
  }

  private fire(t: TableState, course: Course, now: number) {
    const p = this.plan(t)
    if (p.courseFiredFor.has(course)) return
    p.courseFiredFor.add(course)
    const options = this.hub.config.menu.filter((m) => m.course === course)
    const size = Math.max(1, t.party?.size ?? 2)
    const counts = new Map<string, number>()
    for (let i = 0; i < size; i++) {
      const m = pick(options)
      counts.set(m.id, (counts.get(m.id) ?? 0) + 1)
    }
    const lines: FiredLine[] = [...counts].map(([menuItemId, qty]) => ({ id: newId('ln'), menuItemId, qty }))
    // Plan when the kitchen finishes the whole ticket (they send a course together).
    const prep = Math.max(...lines.map((l) => this.hub.config.menu.find((m) => m.id === l.menuItemId)!.prepMin))
    const grill = lines.some((l) => this.hub.config.menu.find((m) => m.id === l.menuItemId)!.station === 'grill')
    const busy = Object.values(this.hub.state.tables).filter((x) => x.visitId).length >= 6
    // Stations work on a couple of dishes at once; a queue at the station adds real time.
    const station = (id: string) => this.hub.config.menu.find((m) => m.id === id)!.station
    const queued = Object.values(this.hub.state.tables).flatMap((x) => x.lines).filter((l) => l.status === 'fired' && lines.some((n) => station(n.menuItemId) === l.station)).length
    // A second grill cook halves the grill's queue and mostly stops it backing up at peak.
    let cook = prep * rand(0.8, 1.15) + Math.max(0, queued - 1) * 0.75 * (grill && this.extraGrill ? 0.5 : 1)
    if (grill && busy && chance(this.extraGrill ? 0.1 : 0.45)) cook += rand(5, 10) // grill backs up at peak
    else if (chance(0.12)) cook += rand(4, 8)
    const doneAt = now + (cook / this.kitchenSpeed) * MIN
    for (const l of lines) this.readyPlan.set(l.id, doneAt)
    this.send({ type: 'order.fired', source: 'pos:sim', payload: { tableId: t.id, ticketId: newId('kot'), lines } })
  }

  private tick() {
    const hub = this.hub
    const now = hub.clock.now()
    const tables = Object.values(hub.state.tables)
    const elapsed = now - (this.startedAt ?? now)

    // Arrivals: busiest between 20 and 60 min into service.
    if (now >= this.nextArrival) {
      const size = pick([2, 2, 2, 2, 3, 4, 4, 4, 5, 6])
      this.waitlist.push({ size, since: now })
      const peak = elapsed > 15 * MIN && elapsed < 70 * MIN ? 1.8 : 1
      // Arrivals scale with the size of the floor (the pace was set for a 10-table room).
      const floorSize = Math.max(0.5, tables.length / 10)
      this.nextArrival = now + (rand(5, 10) * MIN) / (peak * this.intensity * floorSize)
    }
    // Guests who wait too long for a table leave.
    const before = this.waitlist.length
    this.waitlist = this.waitlist.filter((g) => now - g.since < 25 * MIN)
    this.walkouts += before - this.waitlist.length
    for (const g of [...this.waitlist]) {
      const free = this.freeTable(g.size)
      if (!free) continue
      this.waitlist.splice(this.waitlist.indexOf(g), 1)
      this.send({
        type: 'table.seated',
        source: 'pos:sim',
        payload: {
          tableId: free.id,
          partySize: g.size,
          guestName: chance(0.45) ? pick(GUEST_NAMES) : undefined,
          occasion: chance(0.18) ? pick(OCCASIONS) : undefined,
          allergies: chance(0.2) ? [pick(ALLERGIES)] : [],
          vip: chance(0.12),
          needs: chance(0.22) ? [pick(NEEDS)] : [],
          ...g.party,
        },
      })
    }

    // One item runs out mid-service.
    if (!this.stockOutDone && elapsed > 30 * MIN) {
      this.stockOutDone = true
      this.send({ type: 'item.stock', source: 'pos:sim', payload: { menuItemId: 'm_risotto', available: false } })
      this.send({ type: 'note.sent', source: 'kitchen', payload: { noteId: newId('note'), direction: 'to_floor', text: 'Truffle risotto is off for tonight', from: 'k_pass' } })
    }

    for (const t of Object.values(hub.state.tables)) {
      if (!t.visitId) continue
      const p = this.plan(t)

      // Ordering: after being greeted, or eventually flag someone down anyway.
      if (!t.firstOrderAt) {
        if (t.greetedAt && !p.orderAt) p.orderAt = t.greetedAt + rand(3, 6) * MIN
        if ((p.orderAt && now >= p.orderAt) || now >= (t.seatedAt ?? now) + 9 * MIN) this.fire(t, 'starter', now)
        continue
      }

      // Next courses follow the server clearing the previous one.
      if (t.courseClearedAt.starter) this.fire(t, 'main', now)
      if (t.courseClearedAt.main && !p.courseFiredFor.has('dessert') && !t.billRequestedAt) {
        if (p.wantsDessert) this.fire(t, 'dessert', now)
        else p.billAt ??= now + rand(2, 4) * MIN
      }
      if (t.courseClearedAt.dessert) p.billAt ??= now + rand(1, 3) * MIN
      if (p.billAt && now >= p.billAt && !t.billRequestedAt) this.send({ type: 'bill.requested', source: 'pos:sim', payload: { tableId: t.id } })

      // Guests pay a little after the bill arrives.
      if (t.billPresentedAt && !t.settledAt) {
        p.settleAt ??= t.billPresentedAt + rand(2, 5) * MIN
        if (now >= p.settleAt) this.send({ type: 'bill.settled', source: 'pos:sim', payload: { tableId: t.id } })
      }

      // Safety valves so an unattended section doesn't stall forever (and the lapse is recorded).
      for (const l of t.lines) if (l.status === 'ready' && now > (l.readyAt ?? now) + 6 * MIN) this.send({ type: 'item.served', source: 'manager', payload: { lineIds: [l.id] } })
      if (t.billRequestedAt && !t.billPresentedAt && now > t.billRequestedAt + 10 * MIN) this.send({ type: 'bill.presented', source: 'manager', payload: { tableId: t.id } })
      if (t.settledAt && now > t.settledAt + 15 * MIN) this.send({ type: 'table.reset', source: 'manager', payload: { tableId: t.id } })
      for (const c of ['starter', 'main', 'dessert'] as const) {
        const cl = t.lines.filter((l) => l.course === c && l.status !== 'unavailable')
        if (cl.length && cl.every((l) => l.servedAt) && !t.courseClearedAt[c] && now > Math.max(...cl.map((l) => l.servedAt!)) + 28 * MIN)
          this.send({ type: 'course.cleared', source: 'manager', payload: { tableId: t.id, course: c } })
      }
      // A guest whose dish ran out re-orders once told.
      const off = t.lines.filter((l) => l.status === 'unavailable' && l.unavailableInformedAt && !p.reordered.has(l.id))
      for (const l of off) {
        p.reordered.add(l.id)
        const alt = hub.config.menu.find((m) => m.course === l.course && m.id !== l.menuItemId && hub.state.unavailable[m.id] === undefined)
        if (alt) {
          const line: FiredLine = { id: newId('ln'), menuItemId: alt.id, qty: l.qty }
          this.readyPlan.set(line.id, now + alt.prepMin * MIN)
          this.send({ type: 'order.fired', source: 'pos:sim', payload: { tableId: t.id, ticketId: newId('kot'), lines: [line] } })
        }
      }
    }

    // Showcase: stage the next key moment every few minutes (skipping any that can't happen yet).
    if (this.showcase && now >= this.nextMoment) {
      for (let i = 0; i < SHOWCASE.length; i++) {
        const kind = SHOWCASE[this.momentIndex++ % SHOWCASE.length]
        if (this.moment(kind).ok) break
      }
      this.nextMoment = now + rand(5, 7) * MIN
    }

    // A manager on autopilot visits a table that asked for them after a couple of minutes.
    if (this.autoManager)
      for (const t of Object.values(hub.state.tables))
        if (t.managerRequestedAt && !(t.managerVisitedAt && t.managerVisitedAt >= t.managerRequestedAt) && now > t.managerRequestedAt + 2.5 * MIN)
          this.send({ type: 'manager.visited', source: 'manager', payload: { tableId: t.id } })

    // Notes: the kitchen (and the manager on autopilot) tap "Got it" a minute or so after a note arrives.
    const reader = (id: string) => (this.autoKitchen && hub.config.staff.find((s) => s.id === id)?.role === 'kitchen') || (this.autoManager && hub.config.staff.find((s) => s.id === id)?.role === 'manager')
    for (const n of hub.state.instructions)
      for (const id of n.to) if (!n.acks[id] && reader(id) && now > n.at + 1.2 * MIN) this.send({ type: 'instruction.acked', source: 'kitchen', payload: { instructionId: n.id, staffId: id } })
    if (this.autoKitchen) for (const n of hub.state.notes) if (n.direction === 'to_kitchen' && !n.ackAt && now > n.at + 1 * MIN) this.send({ type: 'note.acked', source: 'kitchen', payload: { noteId: n.id } })

    // Kitchen.
    if (this.autoKitchen) {
      const due: string[] = []
      for (const t of Object.values(hub.state.tables))
        for (const l of t.lines) if (l.status === 'fired' && now >= (this.readyPlan.get(l.id) ?? l.expectedReadyAt)) due.push(l.id)
      if (due.length) this.send({ type: 'item.ready', source: 'pos:sim', payload: { lineIds: due } })
    }

    // Autopilot servers: act on their top card after a human-ish reaction time.
    if (this.autopilot.size) {
      const tasks = hub.tasks(now)
      for (const staffId of this.autopilot) {
        if ((this.busyUntil.get(staffId) ?? 0) > now) continue
        const task = tasks.find((k) => k.staffId === staffId)
        if (!task) continue
        if (!this.reaction.has(task.id)) this.reaction.set(task.id, (chance(0.08) ? rand(2.5, 5) : rand(0.2, 1.1)) * MIN)
        if (now < task.createdAt + this.reaction.get(task.id)!) continue
        let action = task.actions.find((a) => a.primary) ?? task.actions[0]
        // Most tables are happy at a check-in; a few aren't, so recovery gets exercised.
        if (task.kind === 'checkback') action = task.actions[chance(0.78) ? 0 : chance(0.6) ? 1 : 2] ?? action
        const payload = action.event === 'task.snoozed' ? { ...action.payload, taskId: task.id, staffId } : action.payload
        this.send({ type: action.event, source: 'app', payload } as IncomingEvent)
        this.busyUntil.set(staffId, now + rand(0.3, 0.7) * MIN)
      }
    }
  }
}
