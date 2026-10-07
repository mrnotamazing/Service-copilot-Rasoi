// A table's story so far, from the timestamps the engine already keeps:
// what has been done for these guests, in order, with times.

import type { TableState, TaskText } from './types.ts'

export interface TimelineItem {
  at: number
  text: TaskText
  /** True when this step was the kitchen's (prep), not the floor's. */
  kitchen?: boolean
}

const k = (key: string, p?: Record<string, string | number>): TaskText => ({ k: key, p })

export function tableTimeline(t: TableState): TimelineItem[] {
  if (!t.visitId) return []
  const out: TimelineItem[] = []
  const push = (at: number | undefined, text: TaskText, kitchen?: boolean) => at && out.push({ at, text, kitchen })
  push(t.seatedAt, k('tl.seated', { n: t.party?.size ?? '?' }))
  push(t.greetedAt, k('tl.greeted'))
  push(t.allergyConfirmedAt, k('tl.allergy'))
  // Each kitchen ticket once: when it was sent, when it was ready, when it reached the table.
  const tickets = new Map<string, typeof t.lines>()
  for (const l of t.lines) tickets.set(l.ticketId, [...(tickets.get(l.ticketId) ?? []), l])
  for (const lines of tickets.values()) {
    const course = `@course.${lines[0].course}`
    push(Math.min(...lines.map((l) => l.firedAt)), k('tl.ordered', { course }))
    const ready = lines.filter((l) => l.readyAt).map((l) => l.readyAt!)
    if (ready.length === lines.length) push(Math.max(...ready), k('tl.ready', { course }), true)
    const served = lines.filter((l) => l.servedAt).map((l) => l.servedAt!)
    if (served.length) push(Math.max(...served), k('tl.served', { course }))
    const safety = lines.filter((l) => l.safetyResolvedAt).map((l) => l.safetyResolvedAt!)
    if (safety.length) push(Math.min(...safety), k('tl.safety'))
    const informed = lines.filter((l) => l.delayInformedAt || l.unavailableInformedAt).map((l) => (l.delayInformedAt ?? l.unavailableInformedAt)!)
    if (informed.length) push(Math.min(...informed), k('tl.informed'))
  }
  for (const [course, at] of Object.entries(t.checkbacks)) push(at, k('tl.checkback', { course: `@course.${course}` }))
  for (const [course, at] of Object.entries(t.courseClearedAt)) push(at, k('tl.cleared', { course: `@course.${course}` }))
  if (t.mood) push(t.mood.at, k('tl.mood', { mood: `@mood.${t.mood.value}` }))
  push(t.recoveredAt, k('tl.recovered'))
  push(t.billRequestedAt, k('tl.billAsked'))
  push(t.billPresentedAt, k('tl.billPresented'))
  push(t.settledAt, k('tl.paid'))
  push(t.farewelledAt, k('tl.farewell'))
  return out.sort((a, b) => a.at - b.at)
}
