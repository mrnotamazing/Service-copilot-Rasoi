// What's happening on the floor, in plain words, for the demo control page's live feed.
// Pure: reads an event, the state just before it (to find the table and its server) and the config.

import type { CopilotEvent } from './events.ts'
import type { EngineState } from './engine.ts'
import type { RestaurantConfig } from './types.ts'

export type FeedKind = 'guest' | 'kitchen' | 'staff' | 'alert' | 'training' | 'demo'

export interface FeedItem {
  id: string
  at: number
  kind: FeedKind
  text: string
}

const NEED_WORDS: Record<string, string> = {
  wheelchair: 'wheelchair user',
  hearing: 'hard of hearing',
  vision: 'low vision',
  highchair: 'high chair',
  jain: 'Jain',
  halal: 'halal',
  vegan: 'vegan',
  quiet: 'quiet table',
  service_animal: 'assistance animal',
  no_beef: 'no beef',
  no_pork: 'no pork',
  fasting: 'fasting',
}

export function narrate(ev: CopilotEvent, state: EngineState, config: RestaurantConfig): FeedItem | null {
  const item = (kind: FeedKind, text: string): FeedItem => ({ id: ev.id, at: ev.at, kind, text })
  const table = (id: string) => state.tables[id]
  const tname = (id: string) => table(id)?.name ?? id
  const staff = (id?: string) => config.staff.find((s) => s.id === id)?.name ?? 'A server'
  const serverOf = (id: string) => staff(table(id)?.serverId)
  const dish = (menuItemId: string) => config.menu.find((m) => m.id === menuItemId)?.name ?? 'a dish'
  const lineOwner = (lineIds: string[]) => Object.values(state.tables).find((t) => t.lines.some((l) => lineIds.includes(l.id)))
  const byStaff = ev.source === 'app'

  switch (ev.type) {
    case 'table.seated': {
      const p = ev.payload
      const extras = [p.guestName, p.vip ? 'regular' : '', p.occasion, ...(p.allergies ?? []).map((a) => `${a === 'nuts' ? 'nut' : a} allergy`), ...(p.needs ?? []).map((n) => NEED_WORDS[n] ?? n)].filter(Boolean)
      return item('guest', `${tname(p.tableId)} seated: party of ${p.partySize}${extras.length ? ` · ${extras.join(' · ')}` : ''}`)
    }
    case 'order.fired': {
      const lines = ev.payload.lines.map((l) => `${l.qty}× ${dish(l.menuItemId)}`)
      return item('kitchen', `${tname(ev.payload.tableId)} ordered ${lines.join(', ')}`)
    }
    case 'item.ready': {
      const t = lineOwner(ev.payload.lineIds ?? [])
      const n = ev.payload.lineIds?.length ?? 0
      return item('kitchen', `Kitchen: ${n === 1 ? 'a dish' : `${n} dishes`} ready at the pass${t ? ` for ${t.name}` : ''}`)
    }
    case 'item.served': {
      const t = lineOwner(ev.payload.lineIds)
      if (!t) return null
      return item(byStaff ? 'staff' : 'alert', byStaff ? `${staff(t.serverId)} took ${t.name}'s food from the pass` : `${t.name}'s food was waiting; the manager ran it`)
    }
    case 'item.stock': {
      return item(ev.payload.available ? 'kitchen' : 'alert', `${dish(ev.payload.menuItemId)} is ${ev.payload.available ? 'back on' : 'off'} the menu`)
    }
    case 'server.greeted':
      return item('staff', `${serverOf(ev.payload.tableId)} greeted ${tname(ev.payload.tableId)}`)
    case 'guest.informed': {
      const t = lineOwner(ev.payload.lineIds)
      return t ? item('staff', `${staff(t.serverId)} told ${t.name} ${ev.payload.reason === 'delay' ? 'about a kitchen delay before they asked' : 'a dish had run out'}`) : null
    }
    case 'server.checkback': {
      const mood = ev.payload.mood
      const t = tname(ev.payload.tableId)
      if (mood === 'unhappy') return item('alert', `${t}: guests not happy at the check-in`)
      return item('staff', `${serverOf(ev.payload.tableId)} checked in at ${t}${mood === 'happy' ? ': happy' : mood === 'ok' ? ': fine' : ''}`)
    }
    case 'guest.recovered':
      return ev.payload.how === 'manager'
        ? item('alert', `${tname(ev.payload.tableId)} asked to see the manager`)
        : item('staff', `${serverOf(ev.payload.tableId)} won ${tname(ev.payload.tableId)} back`)
    case 'manager.visited':
      return item('staff', `The manager visited ${tname(ev.payload.tableId)}`)
    case 'safety.resolved':
      return item('staff', `${serverOf(ev.payload.tableId)} caught an allergy or diet clash at ${tname(ev.payload.tableId)}`)
    case 'allergy.confirmed':
      return item('staff', `${serverOf(ev.payload.tableId)} sent ${tname(ev.payload.tableId)}'s allergy to the kitchen`)
    case 'course.cleared':
      return byStaff ? item('staff', `${serverOf(ev.payload.tableId)} cleared ${ev.payload.course}s at ${tname(ev.payload.tableId)}`) : null
    case 'bill.requested':
      return item('guest', `${tname(ev.payload.tableId)} asked for the bill`)
    case 'bill.presented':
      return item(byStaff ? 'staff' : 'alert', byStaff ? `${serverOf(ev.payload.tableId)} brought ${tname(ev.payload.tableId)} the bill` : `${tname(ev.payload.tableId)}'s bill was late; the manager brought it`)
    case 'bill.settled':
      return item('guest', `${tname(ev.payload.tableId)} paid`)
    case 'guest.farewelled':
      return item('staff', `${serverOf(ev.payload.tableId)} said goodbye to ${tname(ev.payload.tableId)}`)
    case 'table.reset':
      return item('staff', `${tname(ev.payload.tableId)} reset and ready`)
    case 'note.sent':
      return item(ev.payload.direction === 'to_floor' ? 'kitchen' : 'staff', `${ev.payload.direction === 'to_floor' ? 'Kitchen → floor' : `${staff(ev.payload.from)} → kitchen`}: ${ev.payload.text}`)
    case 'kudos.sent':
      return item('staff', `${staff(ev.payload.from)} sent kudos to ${staff(ev.payload.to)}`)
    case 'practice.scored':
      return item('training', `${staff(ev.payload.staffId)} practised a tough moment: ${Math.round(ev.payload.score)}/100${ev.payload.final ? ' (finished)' : ''}`)
    default:
      return null
  }
}
