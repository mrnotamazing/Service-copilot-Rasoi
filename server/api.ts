// Transport-free API: builds per-role snapshots and handles app actions.
// The Node server exposes it over HTTP/WebSocket; the browser demo calls it directly.

import { analytics, staffStats, tasksFor } from '../shared/engine.ts'
import { predictReady, upcomingFor } from '../shared/predict.ts'
import { crunchAhead, forecast, learningPlan, shiftIntel, whyFirst } from '../shared/intel.ts'
import { cleanProfile } from '../shared/profile.ts'
import { playerView, teamView } from '../shared/game.ts'
import type { IncomingEvent } from '../shared/events.ts'
import type { IntegrationStatus, Role, Snapshot } from '../shared/snapshot.ts'
import type { RestaurantConfig } from '../shared/types.ts'
import { CATALOG } from './adapters/index.ts'
import { AiError, createAi, type AiKind, type AiRequest, type DifyOptions } from './ai.ts'
import type { Hub } from './hub.ts'
import { MOMENTS, type Simulator } from './simulator.ts'
import { runWhatIf, type WhatIf } from './whatif.ts'
import { ALERT_KINDS, createOutbound } from './outbound.ts'
import type { AlertKind } from '../shared/types.ts'

export type ApiBody = Record<string, unknown>

export function createApi(hub: Hub, sim: Simulator, dify: DifyOptions = {}) {
  const ai = createAi(hub, dify)
  const outbound = createOutbound(hub)

  function integrations(): IntegrationStatus[] {
    return CATALOG.map((c) => {
      if (c.id === 'webhook') return { ...c, lastEventAt: outbound.stat.lastAt, eventCount: outbound.stat.sent, note: outbound.stat.error ? `Last delivery failed: ${outbound.stat.error}` : c.note }
      const s = hub.sourceStat(c.id === 'generic' ? 'api' : c.id)
      return { ...c, lastEventAt: s?.last ?? null, eventCount: s?.count ?? 0 }
    })
  }

  /** Cut per role, so personal performance data never reaches the manager's screen. */
  function snapshot(role: Role, staffId?: string): Snapshot {
    const now = hub.clock.now()
    const tasks = hub.tasks(now)
    const openTasks: Record<string, number> = {}
    for (const t of tasks) openTasks[t.staffId] = (openTasks[t.staffId] ?? 0) + 1
    const base: Snapshot = {
      role,
      now,
      config: hub.config,
      // Each dish still cooking carries its forecast ready time.
      tables: Object.values(hub.state.tables).map((t) =>
        t.lines.some((l) => l.status === 'fired') ? { ...t, lines: t.lines.map((l) => (l.status === 'fired' ? { ...l, etaAt: predictReady(hub.state, hub.config, l, now) } : l)) } : t,
      ),
      unavailable: Object.keys(hub.state.unavailable),
      notes: hub.state.notes.slice(-40),
      sim: sim.status(),
      ai: { provider: ai.provider, model: ai.modelLabel },
      team: teamView(hub.game),
    }
    if (role === 'server' && staffId) {
      const { top, queued } = tasksFor(tasks, staffId, 3, hub.state.tables)
      const mine = tasks.filter((t) => t.staffId === staffId)
      const upcoming = upcomingFor(hub.state, hub.config, staffId, now, mine)
      const crunch = crunchAhead(upcoming, mine, now)
      const myVisits = hub.state.visits.filter((v) => v.serverId === staffId)
      const myTables = Object.values(hub.state.tables).filter((t) => t.serverId === staffId && t.visitId)
      return {
        ...base,
        me: {
          staffId,
          top,
          queued,
          stats: staffStats(hub.state, hub.config).find((s) => s.staffId === staffId) ?? null,
          myVisits: myVisits.slice(-40).reverse(),
          game: playerView(hub.game, staffId),
          upcoming: crunch ? [crunch, ...upcoming] : upcoming,
          // Every open task of mine (not just the top three), for the per-table view on the floor plan.
          tasks: mine.slice(0, 30),
          // Why the top card comes first, and a private learning journey built from this shift.
          why: top[0] ? whyFirst(top[0], mine, hub.state.tables[top[0].tableId], now) : [],
          learning: learningPlan(hub.game.players[staffId]?.practiceLog ?? [], myVisits, myTables, 'server'),
        },
      }
    }
    if (role === 'manager')
      return { ...base, analytics: analytics(hub.state, hub.config), intel: shiftIntel(hub.state, hub.config), forecast: forecast(hub.state, hub.config, now, tasks), integrations: integrations(), openTasks, feed: hub.feed.slice(-40), instructions: hub.state.instructions.slice(-30).reverse() }
    return { ...base, openTasks, instructions: hub.state.instructions.slice(-30).reverse() }
  }

  const routes: Record<string, (body: ApiBody) => unknown> = {
    // Taps from the copilot apps (server phones, kitchen screen, manager).
    '/api/actions': (body) => {
      const source = body.source === 'kitchen' || body.source === 'manager' ? body.source : 'app'
      return hub.ingest({ ...(body as unknown as IncomingEvent), source } as IncomingEvent)
    },
    '/api/sim/start': () => (sim.start(), sim.status()),
    '/api/sim/pause': () => (sim.pause(), sim.status()),
    '/api/sim/reset': () => (sim.reset(), sim.status()),
    // Stage a moment for a presentation: an allergy guest, the kitchen falling behind, a rush…
    '/api/sim/moment': (body) => {
      const kind = MOMENTS.find((m) => m === body.kind)
      if (!kind) throw new Error('Unknown moment.')
      return { ...sim.moment(kind), status: sim.status() }
    },
    '/api/sim/settings': (body) => {
      if (typeof body.speed === 'number') sim.setSpeed(body.speed)
      if (typeof body.intensity === 'number') sim.intensity = Math.max(0.3, Math.min(3, body.intensity))
      if (typeof body.autoKitchen === 'boolean') sim.autoKitchen = body.autoKitchen
      if (typeof body.staffId === 'string' && typeof body.autopilot === 'boolean') sim.setAutopilot(body.staffId, body.autopilot)
      // Everyone at once (the demo page's "all servers on autopilot").
      if (body.allServers === true || body.allServers === false) for (const st of hub.config.staff) if (st.role === 'server') sim.setAutopilot(st.id, body.allServers)
      if (typeof body.autoManager === 'boolean') sim.autoManager = body.autoManager
      if (typeof body.showcase === 'boolean') sim.setShowcase(body.showcase)
      hub.emit()
      return sim.status()
    },
    // Run tonight in a sandbox, as it is and with one thing changed, and compare (never touches live service).
    '/api/whatif': (body) => {
      const w: WhatIf = {}
      if (typeof body.covers === 'number') w.covers = Math.max(0.5, Math.min(2.5, body.covers))
      if (typeof body.sickServer === 'string' && hub.config.staff.some((s) => s.id === body.sickServer && s.role === 'server')) w.sickServer = body.sickServer
      if (body.extraGrill === true) w.extraGrill = true
      if (typeof body.kitchenSpeed === 'number') w.kitchenSpeed = Math.max(0.5, Math.min(1.5, body.kitchenSpeed))
      return runWhatIf(hub.config, w)
    },
    // Integrations tab: show data arriving from an outside system, as a booking app would send it.
    '/api/integrations/test': () => {
      const free = Object.values(hub.state.tables).filter((t) => t.status === 'available' && t.seats >= 2).sort((a, b) => a.seats - b.seats)[0]
      if (!free) throw new Error('Every table is taken. Free one up, or reset the demo, and try again.')
      hub.ingest({ type: 'table.seated', source: 'pos:api', payload: { tableId: free.id, partySize: 2, guestName: 'Neha Gupta', occasion: 'anniversary', allergies: ['shellfish'], needs: [] } })
      return { ok: true, text: `A booking for Neha Gupta (party of 2, anniversary, shellfish allergy) was seated at ${free.name}.` }
    },
    // Alerts out: save the webhook and which alerts to send; test the connection.
    '/api/alerts': (body) => {
      const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
      if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new Error('Use a full https:// webhook address.')
      const kinds = Array.isArray(body.kinds) ? body.kinds.filter((k): k is AlertKind => ALERT_KINDS.some((a) => a.id === k)) : []
      hub.updateConfig({ alerts: url ? { url, kinds } : undefined })
      return hub.config.alerts ?? null
    },
    '/api/alerts/test': async (body) => {
      const url = typeof body.url === 'string' ? body.url.trim() : hub.config.alerts?.url
      if (!url || !/^https:\/\/[^\s]+$/.test(url)) throw new Error('Paste a full https:// webhook address first.')
      return outbound.test(url)
    },
    // Data out: every finished visit, step by step (process data only, no per-person scores).
    '/api/export/visits': () =>
      hub.state.visits.flatMap((v) =>
        v.segments.map((s) => ({
          date: new Date(v.seatedAt + 5.5 * 3_600_000).toISOString().slice(0, 10),
          table: v.tableName,
          guests: v.partySize,
          seated: new Date(v.seatedAt).toISOString(),
          step: s.label,
          controlled_by: s.owner,
          station: s.station ?? '',
          minutes: Math.round(((s.end - s.start) / 60_000) * 10) / 10,
          standard_minutes: Math.round(s.targetMin * 10) / 10,
          past_standard: s.lapse ? 'yes' : 'no',
          guest_mood: v.mood ?? '',
        })),
      ),
    // A staff member's own profile: name, pronouns, colour, avatar, languages. Only fields sent are changed.
    '/api/staff/profile': (body) => {
      const id = typeof body.staffId === 'string' ? body.staffId : ''
      if (!hub.config.staff.some((s) => s.id === id)) throw new Error('Unknown staff member.')
      const patch = cleanProfile(body)
      if (typeof patch === 'string') throw new Error(patch)
      hub.updateConfig({
        staff: hub.config.staff.map((s) => {
          if (s.id !== id) return s
          const next = { ...s, ...patch }
          // Empty means "not shown": drop the field rather than store blanks.
          if (!next.pronouns) delete next.pronouns
          if (!next.avatar) delete next.avatar
          return next
        }),
      })
      return hub.config.staff.find((s) => s.id === id)
    },
    '/api/config': (body) => {
      const patch: Partial<RestaurantConfig> = {}
      if (body.sop && typeof body.sop === 'object') {
        const sop: Record<string, number> = {}
        for (const [k, v] of Object.entries(body.sop)) if (k in hub.config.sop && typeof v === 'number' && v >= 0 && v < 240) sop[k] = v
        patch.sop = { ...hub.config.sop, ...sop }
      }
      if (typeof body.name === 'string') patch.name = body.name.slice(0, 80)
      if (body.sections && typeof body.sections === 'object') patch.sections = { ...hub.config.sections, ...(body.sections as Record<string, string>) }
      hub.updateConfig(patch)
      return hub.config
    },
  }

  const AI_KINDS: AiKind[] = ['guest_script', 'briefing', 'shift_summary', 'ask_sop', 'coach', 'practice', 'chat', 'complaint', 'incident']

  return {
    snapshot,
    /** AI assistance (async: may call Dify). Throws AiError for a bad request. */
    async ask(body: ApiBody, onText?: (text: string) => void) {
      const kind = AI_KINDS.find((k) => k === body.kind)
      if (!kind) throw new AiError('Unknown kind of AI request.')
      const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : undefined)
      const history = Array.isArray(body.history)
        ? body.history
            .slice(-8)
            .filter((h): h is { role: 'guest' | 'server'; text: string } => !!h && typeof h === 'object' && (h.role === 'guest' || h.role === 'server') && typeof h.text === 'string')
            .map((h) => ({ role: h.role, text: h.text.slice(0, 400) }))
        : undefined
      const messages = Array.isArray(body.messages)
        ? body.messages
            .slice(-16)
            .filter((m): m is { role: 'user' | 'assistant'; text: string; score?: unknown } => !!m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
            .map((m) => ({ role: m.role, text: m.text.slice(0, 1500), ...(typeof m.score === 'number' && m.score >= 0 && m.score <= 100 ? { score: m.score } : {}) }))
        : undefined
      const mode = body.mode === 'practice' ? 'practice' : body.mode === 'ask' ? 'ask' : undefined
      const req: AiRequest = { kind, staffId: str(body.staffId), taskId: str(body.taskId), question: str(body.question), lang: str(body.lang), scenario: str(body.scenario), history, messages, mode, finish: body.finish === true, simple: body.simple === true, tableId: str(body.tableId), visitId: str(body.visitId) }
      let answer: Awaited<ReturnType<typeof ai.ask>>
      try {
        answer = await ai.ask(req, onText)
      } catch (e) {
        if (e instanceof AiError) throw e
        // Never show staff a crash: log it, and answer with a calm, useful line instead.
        console.error('AI request failed', e)
        answer = { text: req.mode === 'practice' ? 'Sorry, that turn didn’t go through. Please send your reply again.' : 'Sorry, I couldn’t answer that just now. Please ask again, or try one of the suggestions.', source: 'built-in', notice: 'Something went wrong on our side.' }
      }
      // Practice is training: each scored reply, and the finish, earns XP (capped per day by the game).
      if (kind === 'chat' && mode === 'practice' && req.staffId && req.scenario && typeof answer.score === 'number' && hub.game.players[req.staffId]) {
        const before = hub.game.players[req.staffId].xp
        hub.ingest({ type: 'practice.scored', source: 'app', payload: { staffId: req.staffId, scenario: req.scenario, score: answer.score, final: req.finish || undefined, outcome: answer.outcome } })
        answer.xp = hub.game.players[req.staffId].xp - before
      }
      return answer
    },
    /** Returns undefined when the path isn't one of the app routes. */
    post(path: string, body: ApiBody): { result: unknown } | undefined {
      const route = routes[path]
      return route ? { result: route(body) ?? { ok: true } } : undefined
    },
  }
}
