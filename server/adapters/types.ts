import type { IncomingEvent } from '../../shared/events.ts'
import type { IntegrationStatus } from '../../shared/snapshot.ts'
import type { RestaurantConfig } from '../../shared/types.ts'

export interface AdapterResult {
  events: IncomingEvent[]
  /** Body to answer the POS with (vendors often expect their own ack format). */
  reply: unknown
}

export interface PosAdapter {
  info: Omit<IntegrationStatus, 'lastEventAt' | 'eventCount'>
  /** Route suffix under /api/integrations/<id>/ -> translator. */
  routes: Record<string, (body: unknown, ctx: { config: RestaurantConfig; ticketForOrder: (orderId: string) => string }) => AdapterResult>
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export function obj(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdapterError('Expected a JSON object')
  return body as Record<string, unknown>
}

export function str(v: unknown, field: string): string {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number') return String(v)
  throw new AdapterError(`Missing or invalid "${field}"`)
}
