// Who should welcome a first-time guest? A fit for this table right now, built from things a manager would
// weigh by eye: a shared language, room in the section, how busy their cards are, whether the party needs
// extra care (VIP, allergies, access) and whose turn it is to host newcomers. It never looks at how well
// anyone has performed, and it returns one suggestion with its reasons, not a ranking of people.

import type { EngineState } from './engine.ts'
import { languageName } from './profile.ts'
import type { RestaurantConfig, Staff, Task } from './types.ts'

export interface Fit {
  server: Staff
  reasons: string[]
}

export function bestFit(state: EngineState, config: RestaurantConfig, tableId: string, tasks: Task[] = []): Fit | null {
  const t = state.tables[tableId]
  if (!t?.party) return null
  const ids = new Set([...Object.values(config.sections), ...Object.values(state.tables).map((x) => x.serverId)])
  const servers = config.staff.filter((s) => s.role === 'server' && ids.has(s.id))
  if (!servers.length) return null
  const seated = Object.values(state.tables).filter((x) => x.visitId)
  const active = (id: string) => seated.filter((x) => x.serverId === id).length
  const open = (id: string) => tasks.filter((x) => x.staffId === id).length
  // How many first-time tables each server has welcomed tonight: newcomers rotate, so no one always gets them.
  const hosted = (id: string) => seated.filter((x) => x.party?.firstVisit && x.serverId === id && x.id !== t.id).length + state.visits.filter((v) => v.firstVisit && v.serverId === id).length
  const max = config.sop.maxActiveTablesPerServer
  const lang = t.party.language && t.party.language !== 'en' ? t.party.language : null
  const careful = !!t.party.vip || t.party.size >= 6 || (t.party.allergies?.length ?? 0) > 0 || (t.party.needs?.length ?? 0) > 0

  const scored = servers.map((s) => {
    const own = s.id === t.serverId
    // This table is not counted against its own server.
    const n = active(s.id) - (own ? 1 : 0)
    const reasons: string[] = []
    let score = 0
    if (lang && s.languages?.includes(lang)) {
      score += 40
      reasons.push(`${s.name} speaks ${languageName(lang)}, which the guests prefer`)
    }
    score += Math.max(-30, (max - n) * 8)
    if (n >= max) score -= 25
    score -= open(s.id) * (careful ? 4 : 2)
    score -= hosted(s.id) * 6
    if (own) score += 3
    if (n === 0) reasons.push(`${s.name} has no tables right now`)
    else if (n < max - 1) reasons.push(`${s.name} has room (${n} ${n === 1 ? 'table' : 'tables'})`)
    if (open(s.id) === 0) reasons.push(`${s.name} has no open cards`)
    if (hosted(s.id) === 0) reasons.push(`${s.name} hasn’t welcomed a newcomer tonight`)
    return { server: s, score, reasons }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  const shown = top.reasons.slice(0, 3)
  return { server: top.server, reasons: shown.length ? shown : [`${top.server.name} is the best fit right now`] }
}
