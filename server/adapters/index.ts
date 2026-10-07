import type { IntegrationStatus } from '../../shared/snapshot.ts'
import { petpooja } from './petpooja.ts'
import type { PosAdapter } from './types.ts'

export const ADAPTERS: Record<string, PosAdapter> = { petpooja }

/** Integrations shown in setup. Planned ones have no adapter yet. */
export const CATALOG: Omit<IntegrationStatus, 'lastEventAt' | 'eventCount'>[] = [
  {
    id: 'generic',
    name: 'Any POS / middleware',
    mode: 'live',
    note: 'Send canonical events (JSON) from any system, e.g. UrbanPiper, n8n/Zapier, or a custom bridge.',
    endpoints: [{ method: 'POST', path: '/api/events', purpose: 'One event or {events:[...]} in the Copilot format' }],
  },
  petpooja.info,
  {
    id: 'restroworks',
    name: 'Restroworks (Posist)',
    mode: 'planned',
    note: 'Partner API. Adapter to be written against their dine-in order and KOT webhooks.',
    endpoints: [],
  },
  {
    id: 'toast',
    name: 'Toast',
    mode: 'planned',
    note: 'Orders and Restaurant Availability APIs via the Toast partner programme.',
    endpoints: [],
  },
  {
    id: 'square',
    name: 'Square',
    mode: 'planned',
    note: 'Open Orders API with webhooks (order.created / order.updated / payment.updated).',
    endpoints: [],
  },
  {
    id: 'sim',
    name: 'Service simulator',
    mode: 'live',
    note: 'Emits the same events a POS would, for demos and role-play studies.',
    endpoints: [],
  },
]
