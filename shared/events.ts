// Canonical event format. Every POS adapter (Petpooja, Restroworks, Toast, ...)
// translates its own payloads into these, so the engine never sees vendor formats.

import type { Course } from './types.ts'

export type EventSource = 'sim' | 'app' | 'kitchen' | 'manager' | `pos:${string}`

interface Base<T extends string, P> {
  id: string
  type: T
  at: number
  source: EventSource
  payload: P
}

export interface FiredLine {
  id: string
  menuItemId: string
  name?: string
  course?: Course
  qty: number
}

export type CopilotEvent =
  // From the POS / table management
  | Base<'table.seated', { tableId: string; partySize: number; guestName?: string; allergies?: string[]; occasion?: string; vip?: boolean }>
  | Base<'order.fired', { tableId: string; ticketId: string; lines: FiredLine[] }>
  | Base<'item.ready', { lineIds?: string[]; ticketId?: string }>
  | Base<'item.stock', { menuItemId: string; available: boolean }>
  | Base<'bill.requested', { tableId: string }>
  | Base<'bill.settled', { tableId: string }>
  | Base<'table.reset', { tableId: string }>
  | Base<'table.assigned', { tableId: string; serverId: string }>
  // From the server's copilot (the server's own taps)
  | Base<'server.greeted', { tableId: string }>
  | Base<'item.served', { lineIds: string[] }>
  | Base<'guest.informed', { lineIds: string[]; reason: 'delay' | 'unavailable' }>
  | Base<'server.checkback', { tableId: string; course: string }>
  | Base<'course.cleared', { tableId: string; course: string }>
  | Base<'bill.presented', { tableId: string }>
  | Base<'guest.farewelled', { tableId: string }>
  | Base<'allergy.confirmed', { tableId: string }>
  | Base<'task.snoozed', { taskId: string; staffId: string; minutes: number }>
  // Two-way notes between floor and kitchen
  | Base<'note.sent', { noteId: string; direction: 'to_kitchen' | 'to_floor'; tableId?: string; text: string; from: string }>
  | Base<'note.acked', { noteId: string }>

export type EventType = CopilotEvent['type']
export type PayloadOf<T extends EventType> = Extract<CopilotEvent, { type: T }>['payload']

/** Shape accepted by the ingest API; id/at are filled in when missing. */
export type IncomingEvent = {
  [T in EventType]: { type: T; payload: PayloadOf<T>; source?: EventSource; at?: number; id?: string }
}[EventType]

export const EVENT_TYPES: EventType[] = [
  'table.seated', 'order.fired', 'item.ready', 'item.stock', 'bill.requested', 'bill.settled',
  'table.reset', 'table.assigned', 'server.greeted', 'item.served', 'guest.informed',
  'server.checkback', 'course.cleared', 'bill.presented', 'guest.farewelled', 'allergy.confirmed',
  'task.snoozed', 'note.sent', 'note.acked',
]

let counter = 0
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
