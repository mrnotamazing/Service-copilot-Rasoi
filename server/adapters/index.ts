import type { IntegrationStatus } from '../../shared/snapshot.ts'
import { petpooja } from './petpooja.ts'
import type { PosAdapter } from './types.ts'

export const ADAPTERS: Record<string, PosAdapter> = { petpooja }

type Entry = Omit<IntegrationStatus, 'lastEventAt' | 'eventCount'>
const planned = (id: string, name: string, category: Entry['category'], uses: string, note: string): Entry => ({ id, name, category, mode: 'planned', uses, note, endpoints: [] })

/**
 * The systems restaurants already run, grouped by what they do. "Ready" ones work today; partner
 * ones need the vendor's credentials; planned ones show where each fits. Anything not listed can
 * still send events through the open endpoint (or Zapier/n8n), and alerts can go out the same way.
 */
export const CATALOG: Entry[] = [
  // POS and billing: the core feed.
  {
    id: 'generic',
    name: 'Any POS, booking app or middleware',
    category: 'pos',
    mode: 'live',
    uses: 'Seated tables, orders, food ready, bills and stock in one JSON format: every card, ticket and receipt.',
    note: 'Send canonical events from any system, e.g. UrbanPiper, n8n/Zapier, or a small bridge script. Protected by COPILOT_INGEST_KEY when set.',
    endpoints: [{ method: 'POST', path: '/api/events', purpose: 'One event or {events:[...]} in the TableMate format' }],
  },
  petpooja.info,
  planned('restroworks', 'Restroworks (Posist)', 'pos', 'Dine-in orders and KOTs drive cards and kitchen tickets.', 'Partner API: dine-in order and KOT webhooks.'),
  planned('dotpe', 'DotPe', 'pos', 'QR orders and table status, so QR-ordering tables get the same cards.', 'Partner API for dine-in and QR orders.'),
  planned('toast', 'Toast', 'pos', 'Orders and item availability drive cards and the 86 board.', 'Orders and Restaurant Availability APIs via the Toast partner programme.'),
  planned('square', 'Square', 'pos', 'Orders and payments: bills, settle and reset cards.', 'Open Orders API with webhooks (order.created, order.updated, payment.updated).'),
  planned('lightspeed', 'Lightspeed Restaurant', 'pos', 'Orders, courses and payments.', 'Lightspeed K-Series order and payment webhooks.'),
  // Reservations and waitlist: who is coming and what they need.
  planned('dineout', 'Swiggy Dineout', 'bookings', 'Bookings arrive with name, party size, occasion and notes: allergies and needs reach the greeting card before the guest does.', 'Partner booking feed; until then bookings can be forwarded through /api/events.'),
  planned('eazydiner', 'EazyDiner', 'bookings', 'Bookings and special requests pre-fill the table.', 'Partner booking webhooks.'),
  planned('zomato-tr', 'Zomato table reservations', 'bookings', 'Bookings and occasions on the greeting card.', 'Partner feed.'),
  planned('opentable', 'OpenTable / SevenRooms', 'bookings', 'Guest notes, regulars and occasions; waitlist times feed the arrival forecast.', 'Partner APIs for reservations and guest profiles.'),
  // Online orders: kitchen load the floor doesn't see.
  planned('urbanpiper', 'UrbanPiper (Swiggy, Zomato orders)', 'orders', 'Delivery orders add to each station’s queue, so dine-in ETAs and the 15-minute forecast stay honest at peak.', 'Order webhooks through UrbanPiper, or any aggregator middleware via /api/events.'),
  // Staff rosters: who is on, which section.
  planned('rosters', '7shifts, Deputy or greytHR', 'staff', 'Tonight’s roster sets the sections and who is on; the what-if planner uses it for cover.', 'Roster APIs or a CSV import.'),
  // Stock: what is running out.
  planned('inventory', 'Inventory (Petpooja Inventory, MarketMan)', 'stock', 'Low stock warns the kitchen and floor before a dish is 86’d.', 'Stock-level webhooks; item.stock events work today.'),
  // Messaging: alerts out to where managers already are.
  {
    id: 'webhook',
    name: 'Alerts to WhatsApp, Slack or Sheets',
    category: 'messaging',
    mode: 'live',
    uses: 'Sends chosen alerts (manager needed, unhappy table, dish off, notes, kudos) to a webhook: connect it in Zapier or n8n to WhatsApp Business, Slack, Teams, email or Google Sheets.',
    note: 'Paste a webhook URL below and pick the alerts. Works when TableMate runs on a computer or server.',
    endpoints: [],
  },
  // Reviews: what guests say afterwards.
  planned('reviews', 'Google and Zomato reviews', 'reviews', 'Review themes become practice scenarios and training notes (never matched to a server).', 'Google Business Profile API; Zomato partner feed.'),
  // Data out: for accounts and owners.
  {
    id: 'export',
    name: 'CSV export (Excel, Google Sheets, Tally)',
    category: 'data',
    mode: 'live',
    uses: 'Every finished visit, step by step: time against standard and who controlled it (floor or kitchen). No per-person scores.',
    note: 'Download below, or fetch the raw event log for audits.',
    endpoints: [{ method: 'GET', path: '/api/events/export', purpose: 'The full event log (JSON)' }],
  },
  {
    id: 'sim',
    name: 'Service simulator',
    category: 'pos',
    mode: 'live',
    uses: 'Emits the same events a POS would, for demos, training and role-play studies.',
    note: 'Runs from the Run the demo tab.',
    endpoints: [],
  },
]
