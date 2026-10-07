// A fine-dining evening rush, emitted as the same events a real POS would send.
// Guests arrive, order course by course, the kitchen cooks (sometimes slowly),
// an item runs out, guests ask for the bill and leave. Servers can be played by
// people on their phones, or by "autopilot" so the demo runs on its own.

import { newId, type FiredLine, type IncomingEvent } from '../shared/events.ts'
import type { SimStatus } from '../shared/snapshot.ts'
import type { Course, TableState } from '../shared/types.ts'
import type { Hub } from './hub.ts'

const MIN = 60_000
const GUEST_NAMES = ['Mr. Kapoor', 'Ms. Iyer', 'the Sharmas', 'Dr. Menon', 'Mrs. D’Souza', 'Mr. Banerjee', 'Ms. Reddy']
const OCCASIONS = ['anniversary', 'birthday', 'business dinner']
const ALLERGIES = ['nuts', 'shellfish', 'gluten', 'dairy']

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
const chance = (p: number) => Math.random() < p

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
  private startedAt: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private waitlist: { size: number; since: number }[] = []
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
      waiting: this.waitlist.length,
      startedAt: this.startedAt,
    }
  }

  start() {
    if (this.running) return
    if (this.startedAt === null) {
      // Start the evening at 19:00 today (service time).
      const d = new Date()
      d.setHours(19, 0, 0, 0)
      this.hub.clock.set(Math.max(d.getTime(), this.hub.events.at(-1)?.at ?? 0))
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
    let cook = prep * rand(0.8, 1.15)
    if (grill && busy && chance(0.45)) cook += rand(5, 10) // grill backs up at peak
    else if (chance(0.12)) cook += rand(4, 8)
    const doneAt = now + cook * MIN
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
      this.nextArrival = now + (rand(2, 5) * MIN) / (peak * this.intensity)
    }
    for (const g of [...this.waitlist]) {
      const free = tables.filter((t) => t.status === 'available' && t.seats >= g.size).sort((a, b) => a.seats - b.seats)[0]
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
        if (!this.reaction.has(task.id)) this.reaction.set(task.id, (chance(0.18) ? rand(2.5, 5) : rand(0.3, 1.6)) * MIN)
        if (now < task.createdAt + this.reaction.get(task.id)!) continue
        const action = task.actions.find((a) => a.primary) ?? task.actions[0]
        const payload = action.event === 'task.snoozed' ? { ...action.payload, taskId: task.id, staffId } : action.payload
        this.send({ type: action.event, source: 'app', payload } as IncomingEvent)
        this.busyUntil.set(staffId, now + rand(0.3, 0.7) * MIN)
      }
    }
  }
}
