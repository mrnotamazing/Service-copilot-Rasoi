// Petpooja POS adapter.
//
// Two of these endpoints follow Petpooja's published Online Ordering API v2.1
// (https://onlineorderingapisv210.docs.apiary.io/):
//   - item stock toggle: Petpooja calls the integrator with {restID, inStock, type, itemID}
//   - order status callback: {restID, orderID, status} where 5 = Food Ready, -1 = Cancelled
//
// Dine-in floor events (table occupied, KOT created, bill printed/settled) are NOT
// in the public docs; they need Petpooja partner access. The `dine-in` route below
// accepts a proposed shape so the rest of the pipeline is ready. Adjust the field
// names once Petpooja shares the real partner payload.

import { newId, type FiredLine, type IncomingEvent } from '../../shared/events.ts'
import type { RestaurantConfig } from '../../shared/types.ts'
import { AdapterError, obj, str, type PosAdapter } from './types.ts'

const SRC = 'pos:petpooja' as const

function menuIdFor(config: RestaurantConfig, posItemId: string): string | undefined {
  return config.menu.find((m) => m.posItemId === posItemId)?.id
}

function tableIdFor(config: RestaurantConfig, posTableId: string): string {
  const t = config.tables.find((x) => x.posTableId === posTableId || x.id === posTableId || x.name === posTableId)
  if (!t) throw new AdapterError(`Unknown table "${posTableId}". Map it in the table setup (posTableId).`, 422)
  return t.id
}

export const petpooja: PosAdapter = {
  info: {
    id: 'petpooja',
    name: 'Petpooja',
    mode: 'needs-partner-access',
    note: 'Stock and food-ready callbacks follow Petpooja’s public API. Dine-in table/KOT/bill events need Petpooja partner credentials; the endpoint accepts a proposed format until then.',
    endpoints: [
      { method: 'POST', path: '/api/integrations/petpooja/stock', purpose: 'Item in/out of stock (public API)' },
      { method: 'POST', path: '/api/integrations/petpooja/order-status', purpose: 'Order status callback, 5 = food ready (public API)' },
      { method: 'POST', path: '/api/integrations/petpooja/dine-in', purpose: 'Table, KOT and bill events (partner feed, proposed format)' },
    ],
  },
  routes: {
    stock(body, { config }) {
      const b = obj(body)
      const inStock = b.inStock === true || b.inStock === 'true' || b.inStock === 1 || b.inStock === '1'
      const raw = b.itemID
      const ids = Array.isArray(raw) ? raw.map(String) : raw && typeof raw === 'object' ? Object.values(raw).map(String) : [str(raw, 'itemID')]
      const events: IncomingEvent[] = []
      const unknown: string[] = []
      for (const id of ids) {
        const menuItemId = menuIdFor(config, id)
        if (menuItemId) events.push({ type: 'item.stock', source: SRC, payload: { menuItemId, available: inStock } })
        else unknown.push(id)
      }
      return {
        events,
        reply: { code: '200', status: 'success', message: unknown.length ? `Stock updated; unmapped items ignored: ${unknown.join(', ')}` : 'Stock status updated successfully' },
      }
    },

    'order-status'(body, { ticketForOrder }) {
      const b = obj(body)
      const orderID = str(b.orderID, 'orderID')
      const status = str(b.status, 'status')
      const events: IncomingEvent[] = status === '5' ? [{ type: 'item.ready', source: SRC, payload: { ticketId: ticketForOrder(orderID) } }] : []
      return { events, reply: { success: true, message: 'Status received' } }
    },

    'dine-in'(body, { config, ticketForOrder }) {
      const b = obj(body)
      const event = str(b.event, 'event')
      const tableId = () => tableIdFor(config, str(b.table_no, 'table_no'))
      switch (event) {
        case 'table_occupied':
          return {
            events: [{ type: 'table.seated', source: SRC, payload: { tableId: tableId(), partySize: Number(b.pax ?? 2), guestName: typeof b.customer_name === 'string' ? b.customer_name : undefined } }],
            reply: { success: true },
          }
        case 'kot_created': {
          const items = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : []
          if (!items.length) throw new AdapterError('kot_created needs items[]')
          const lines: FiredLine[] = items.map((it) => {
            const posId = str(it.itemid, 'items[].itemid')
            return {
              id: typeof it.kot_item_id === 'string' ? it.kot_item_id : newId('ln'),
              menuItemId: menuIdFor(config, posId) ?? `pp_${posId}`,
              name: typeof it.name === 'string' ? it.name : undefined,
              qty: Number(it.qty ?? 1),
            }
          })
          return {
            events: [{ type: 'order.fired', source: SRC, payload: { tableId: tableId(), ticketId: ticketForOrder(str(b.kot_id, 'kot_id')), lines } }],
            reply: { success: true },
          }
        }
        case 'kot_ready':
          return { events: [{ type: 'item.ready', source: SRC, payload: { ticketId: ticketForOrder(str(b.kot_id, 'kot_id')) } }], reply: { success: true } }
        case 'bill_printed':
          return { events: [{ type: 'bill.requested', source: SRC, payload: { tableId: tableId() } }], reply: { success: true } }
        case 'bill_settled':
          return { events: [{ type: 'bill.settled', source: SRC, payload: { tableId: tableId() } }], reply: { success: true } }
        case 'table_available':
          return { events: [{ type: 'table.reset', source: SRC, payload: { tableId: tableId() } }], reply: { success: true } }
        default:
          throw new AdapterError(`Unsupported dine-in event "${event}"`)
      }
    },
  },
}
