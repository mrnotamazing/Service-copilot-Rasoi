// Alerts out to where managers already are. TableMate posts a small JSON message to one webhook
// URL for the alerts the restaurant picked; Zapier, n8n or Make turn it into a WhatsApp Business
// message, a Slack or Teams post, an email or a Google Sheets row. Best effort: a failed delivery
// is noted on the Integrations tab and never slows the service down.

import type { CopilotEvent } from '../shared/events.ts'
import type { FeedItem } from '../shared/narrate.ts'
import type { AlertKind } from '../shared/types.ts'
import type { Hub } from './hub.ts'

export const ALERT_KINDS: { id: AlertKind; label: string }[] = [
  { id: 'manager', label: 'A table asks for the manager' },
  { id: 'unhappy', label: 'Guests unhappy at a check-in' },
  { id: 'sold_out', label: 'A dish runs out' },
  { id: 'kitchen', label: 'Kitchen updates to the floor' },
  { id: 'note', label: 'Team notes' },
  { id: 'kudos', label: 'Kudos' },
]

export function alertFor(ev: CopilotEvent): AlertKind | null {
  switch (ev.type) {
    case 'guest.recovered':
      return ev.payload.how === 'manager' ? 'manager' : null
    case 'server.checkback':
      return ev.payload.mood === 'unhappy' ? 'unhappy' : null
    case 'item.stock':
      return ev.payload.available ? null : 'sold_out'
    case 'note.sent':
      return ev.payload.direction === 'to_floor' ? 'kitchen' : null
    case 'manager.instruction':
      return 'note'
    case 'kudos.sent':
      return 'kudos'
    default:
      return null
  }
}

export interface OutboundStat {
  sent: number
  lastAt: number | null
  error: string | null
}

export function createOutbound(hub: Hub, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const stat: OutboundStat = { sent: 0, lastAt: null, error: null }

  async function deliver(url: string, message: Record<string, unknown>) {
    try {
      const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message), signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`The webhook answered ${res.status}`)
      stat.sent++
      stat.lastAt = Date.now()
      stat.error = null
    } catch (e) {
      stat.error = e instanceof Error ? (e.name === 'TimeoutError' ? 'The webhook didn’t answer in 5 seconds' : e.message) : String(e)
    }
  }

  const message = (kind: string, text: string, at: number) => ({ restaurant: hub.config.name, kind, text: `${hub.config.name}: ${text}`, at: new Date(at).toISOString() })

  hub.onEvent((ev: CopilotEvent, said: FeedItem | null) => {
    const alerts = hub.config.alerts
    const kind = alertFor(ev)
    if (!alerts?.url || !kind || !alerts.kinds.includes(kind)) return
    void deliver(alerts.url, message(kind, said?.text ?? ev.type, ev.at))
  })

  return {
    stat,
    /** Send a sample alert now, to check the connection. */
    async test(url: string) {
      await deliver(url, message('test', 'Test alert from TableMate. Alerts are connected.', Date.now()))
      return { ...stat }
    },
  }
}
