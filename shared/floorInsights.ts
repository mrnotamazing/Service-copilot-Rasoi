// Suggestions for the manager to keep the floor working as one team: hand a table to a server who
// speaks the guests' language, take load off a server over the table limit, bring a teammate over
// to help, or nudge the kitchen about a guest's question. Each one is a suggestion with a reason
// and a one-tap way to do it; the manager decides. Built from load and language only, never from
// how well anyone is doing, so nothing here ranks people.

import type { EngineState } from './engine.ts'
import { languageName } from './profile.ts'
import { bestFit } from './match.ts'
import type { RestaurantConfig, Staff, TableState, Task } from './types.ts'

const MIN = 60_000

export type FloorAction =
  /** Hand the table to another server for this visit (it goes back afterwards). */
  | { type: 'move'; tableId: string; serverId: string; reason: 'language' | 'load' | 'first_visit' }
  /** A note from the manager to a teammate, e.g. "join Table 5 to welcome them in Tamil". */
  | { type: 'note'; to: string; tableId?: string; text: string }
  /** A note to the kitchen pass. */
  | { type: 'kitchen'; tableId?: string; text: string }

export interface FloorInsight {
  id: string
  kind: 'first_visit' | 'language_move' | 'language_help' | 'language_gap' | 'load_move' | 'question_wait'
  tableId?: string
  /** What to do, in one line. */
  title: string
  /** Why, from what TableMate can see. */
  why: string
  /** The one-tap version; none when it's advice only. */
  action?: FloorAction
  /** Label for the button. */
  cta?: string
}

const first = (s?: Staff) => s?.name ?? 'the server'

/** Servers on tonight: everyone who has a section or a table. */
function onShift(state: EngineState, config: RestaurantConfig): Staff[] {
  const ids = new Set([...Object.values(config.sections), ...Object.values(state.tables).map((t) => t.serverId)])
  return config.staff.filter((s) => s.role === 'server' && ids.has(s.id))
}

export function floorInsights(state: EngineState, config: RestaurantConfig, now: number, tasks: Task[] = []): FloorInsight[] {
  const out: FloorInsight[] = []
  const servers = onShift(state, config)
  const staff = (id: string) => config.staff.find((s) => s.id === id)
  const seated = Object.values(state.tables).filter((t) => t.visitId)
  const active = (id: string) => seated.filter((t) => t.serverId === id).length
  const open = (id: string) => tasks.filter((t) => t.staffId === id).length
  const max = config.sop.maxActiveTablesPerServer
  const speaks = (s: Staff | undefined, lang: string) => lang === 'en' || !!s?.languages?.includes(lang)
  /** The teammate with most room: fewest tables, then fewest open cards. */
  const roomiest = (xs: Staff[]) => [...xs].sort((a, b) => active(a.id) - active(b.id) || open(a.id) - open(b.id))[0]
  const tablesWord = (n: number) => (n === 0 ? 'no tables' : `${n} ${n === 1 ? 'table' : 'tables'}`)
  const moved = new Set<string>()

  // First-time guests: suggest the server who fits them best for the welcome, until they've been greeted.
  if ((config.firstVisit ?? 'suggest') !== 'off') {
    for (const t of seated) {
      if (!t.party?.firstVisit || t.greetedAt || t.firstOrderAt || t.handover || now - (t.seatedAt ?? now) > 8 * MIN) continue
      const fit = bestFit(state, config, t.id, tasks)
      if (!fit || fit.server.id === t.serverId) continue
      moved.add(t.id)
      out.push({
        id: `first-${t.id}-${fit.server.id}`,
        kind: 'first_visit',
        tableId: t.id,
        title: `First visit at ${t.name}: ${fit.server.name} for the welcome`,
        why: `${fit.reasons.join('; ')}. ${first(staff(t.serverId))} introduces ${first(fit.server)}, and the table goes back afterwards.`,
        action: { type: 'move', tableId: t.id, serverId: fit.server.id, reason: 'first_visit' },
        cta: `Give to ${fit.server.name}`,
      })
    }
  }

  // Language: guests who'd be more at ease in a language their server doesn't list.
  for (const t of seated) {
    const lang = t.party?.language
    if (!lang || lang === 'en' || moved.has(t.id)) continue
    const mine = staff(t.serverId)
    if (speaks(mine, lang)) continue
    const name = languageName(lang)
    const who = servers.filter((s) => s.id !== t.serverId && speaks(s, lang))
    if (!who.length) {
      out.push({
        id: `gap-${t.id}`,
        kind: 'language_gap',
        tableId: t.id,
        title: `${t.name}: no one on tonight lists ${name}`,
        why: `The guests prefer ${name}. ${first(mine)} can use the assistant to say the welcome and read the menu notes in ${name}, and keep sentences short and clear.`,
      })
      continue
    }
    const early = !t.firstOrderAt
    const helper = roomiest(who.filter((s) => active(s.id) < max)) ?? roomiest(who)
    if (early && active(helper.id) < max) {
      moved.add(t.id)
      out.push({
        id: `lang-${t.id}-${helper.id}`,
        kind: 'language_move',
        tableId: t.id,
        title: `Hand ${t.name} to ${helper.name}`,
        why: `The guests prefer ${name}; ${helper.name} speaks it and has ${tablesWord(active(helper.id))}. They haven't ordered yet, so it's an easy handover. ${first(mine)} introduces ${helper.name}, and the table goes back to ${first(mine)} after this visit.`,
        action: { type: 'move', tableId: t.id, serverId: helper.id, reason: 'language' },
        cta: `Hand to ${helper.name}`,
      })
    } else {
      out.push({
        id: `langhelp-${t.id}-${helper.id}`,
        kind: 'language_help',
        tableId: t.id,
        title: `Ask ${helper.name} to stop by ${t.name}`,
        why: `The guests prefer ${name}, which ${helper.name} speaks. ${early ? `${helper.name} is at the table limit, so` : 'They have already ordered, so'} ${first(mine)} keeps the table and ${helper.name} joins for a minute at the next check-back.`,
        action: { type: 'note', to: helper.id, tableId: t.id, text: `Could you stop by ${t.name} for a minute at the next check-back? The guests prefer ${name}. ${first(mine)} is looking after them.` },
        cta: `Ask ${helper.name}`,
      })
    }
  }

  // Load: a server over the table limit, while a teammate has room.
  for (const s of servers) {
    const n = active(s.id)
    if (n <= max) continue
    const theirs = seated.filter((t) => t.serverId === s.id && !moved.has(t.id))
    // The table easiest to hand over: just seated and not ordered yet, the most recent first.
    const easy = theirs.filter((t) => !t.firstOrderAt).sort((a, b) => (b.seatedAt ?? 0) - (a.seatedAt ?? 0))
    for (const t of easy) {
      const lang = t.party?.language
      const room = servers.filter((x) => x.id !== s.id && active(x.id) < max && (!lang || speaks(x, lang) || !speaks(s, lang)))
      const to = roomiest(room)
      if (!to) continue
      moved.add(t.id)
      out.push({
        id: `load-${t.id}-${to.id}`,
        kind: 'load_move',
        tableId: t.id,
        title: `Hand ${t.name} to ${to.name}`,
        why: `${s.name} has ${tablesWord(n)}, over tonight's limit of ${max}; ${to.name} has ${tablesWord(active(to.id))}. ${t.name} was seated ${Math.max(1, Math.round((now - (t.seatedAt ?? now)) / MIN))} min ago and hasn't ordered, so it's the easiest to hand over.`,
        action: { type: 'move', tableId: t.id, serverId: to.id, reason: 'load' },
        cta: `Hand to ${to.name}`,
      })
      break
    }
  }

  // A guest's question the kitchen hasn't answered for a few minutes: the server is waiting at the table.
  for (const q of state.questions) {
    if (q.answer || now - q.at < 3 * MIN) continue
    const t = q.tableId ? state.tables[q.tableId] : undefined
    const mins = Math.round((now - q.at) / MIN)
    out.push({
      id: `q-${q.id}`,
      kind: 'question_wait',
      tableId: t?.id,
      title: `Nudge the kitchen about “${q.text.length > 48 ? `${q.text.slice(0, 46)}…` : q.text}”`,
      why: `${first(staff(q.from))} asked ${mins} min ago${t ? ` for ${t.name}` : ''} and is still waiting for an answer for the guests.`,
      action: { type: 'kitchen', tableId: t?.id, text: `A guest is waiting on this: “${q.text}”. Could someone answer on the Kitchen screen?` },
      cta: 'Nudge the kitchen',
    })
  }

  const order: FloorInsight['kind'][] = ['question_wait', 'first_visit', 'load_move', 'language_move', 'language_help', 'language_gap']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 6)
}

/** The messages a handover sends, so both servers know what's happening and the guests are introduced. */
export function handoverNotes(t: TableState, fromName: string, toName: string, reason: 'language' | 'load' | 'first_visit' | 'manager', homeName = fromName): { toNew: string; toOld: string } {
  const lang = t.party?.language && t.party.language !== 'en' ? languageName(t.party.language) : ''
  const why = reason === 'language' && lang ? `the guests prefer ${lang}` : reason === 'load' ? `${fromName} has a full section` : reason === 'first_visit' ? 'their first visit, so we want the best welcome' : ''
  return {
    toNew: `${t.name} is yours for this visit${why ? `: ${why}` : ''}. ${fromName} will introduce you; it goes back to ${homeName} afterwards.`,
    toOld: `${t.name} goes to ${toName} for this visit${why ? ` (${why})` : ''}. Please introduce ${toName} to the guests and pass on anything they've told you.`,
  }
}
