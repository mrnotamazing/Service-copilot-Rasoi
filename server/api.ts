// Transport-free API: builds per-role snapshots and handles app actions.
// The Node server exposes it over HTTP/WebSocket; the browser demo calls it directly.

import { analytics, staffStats, tasksFor } from '../shared/engine.ts'
import { predictReady, upcomingFor } from '../shared/predict.ts'
import { cleanProfile } from '../shared/profile.ts'
import { playerView, teamView } from '../shared/game.ts'
import type { IncomingEvent } from '../shared/events.ts'
import type { IntegrationStatus, Role, Snapshot } from '../shared/snapshot.ts'
import type { RestaurantConfig } from '../shared/types.ts'
import { CATALOG } from './adapters/index.ts'
import { AiError, createAi, type AiKind, type AiRequest, type DifyOptions } from './ai.ts'
import type { Hub } from './hub.ts'
import type { Simulator } from './simulator.ts'

export type ApiBody = Record<string, unknown>

export function createApi(hub: Hub, sim: Simulator, dify: DifyOptions = {}) {
  const ai = createAi(hub, dify)

  function integrations(): IntegrationStatus[] {
    return CATALOG.map((c) => {
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
      return {
        ...base,
        me: {
          staffId,
          top,
          queued,
          stats: staffStats(hub.state, hub.config).find((s) => s.staffId === staffId) ?? null,
          myVisits: hub.state.visits.filter((v) => v.serverId === staffId).slice(-40).reverse(),
          game: playerView(hub.game, staffId),
          upcoming: upcomingFor(hub.state, hub.config, staffId, now, tasks.filter((t) => t.staffId === staffId)),
          // Every open task of mine (not just the top three), for the per-table view on the floor plan.
          tasks: tasks.filter((t) => t.staffId === staffId).slice(0, 30),
        },
      }
    }
    if (role === 'manager') return { ...base, analytics: analytics(hub.state, hub.config), integrations: integrations(), openTasks }
    return { ...base, openTasks }
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
    '/api/sim/settings': (body) => {
      if (typeof body.speed === 'number') sim.setSpeed(body.speed)
      if (typeof body.intensity === 'number') sim.intensity = Math.max(0.3, Math.min(3, body.intensity))
      if (typeof body.autoKitchen === 'boolean') sim.autoKitchen = body.autoKitchen
      if (typeof body.staffId === 'string' && typeof body.autopilot === 'boolean') sim.setAutopilot(body.staffId, body.autopilot)
      hub.emit()
      return sim.status()
    },
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

  const AI_KINDS: AiKind[] = ['guest_script', 'briefing', 'shift_summary', 'ask_sop', 'coach', 'practice', 'chat']

  return {
    snapshot,
    /** AI assistance (async: may call Dify). Throws AiError for a bad request. */
    async ask(body: ApiBody) {
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
      const req: AiRequest = { kind, staffId: str(body.staffId), taskId: str(body.taskId), question: str(body.question), lang: str(body.lang), scenario: str(body.scenario), history, messages, mode, finish: body.finish === true, simple: body.simple === true }
      const answer = await ai.ask(req)
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
