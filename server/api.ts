// Transport-free API: builds per-role snapshots and handles app actions.
// The Node server exposes it over HTTP/WebSocket; the browser demo calls it directly.

import { analytics, staffStats, tasksFor } from '../shared/engine.ts'
import type { IncomingEvent } from '../shared/events.ts'
import type { IntegrationStatus, Role, Snapshot } from '../shared/snapshot.ts'
import type { RestaurantConfig } from '../shared/types.ts'
import { CATALOG } from './adapters/index.ts'
import type { Hub } from './hub.ts'
import type { Simulator } from './simulator.ts'

export type ApiBody = Record<string, unknown>

export function createApi(hub: Hub, sim: Simulator) {
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
      tables: Object.values(hub.state.tables),
      unavailable: Object.keys(hub.state.unavailable),
      notes: hub.state.notes.slice(-40),
      sim: sim.status(),
    }
    if (role === 'server' && staffId) {
      const { top, queued } = tasksFor(tasks, staffId)
      return {
        ...base,
        me: {
          staffId,
          top,
          queued,
          stats: staffStats(hub.state, hub.config).find((s) => s.staffId === staffId) ?? null,
          myVisits: hub.state.visits.filter((v) => v.serverId === staffId).slice(-10).reverse(),
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

  return {
    snapshot,
    /** Returns undefined when the path isn't one of the app routes. */
    post(path: string, body: ApiBody): { result: unknown } | undefined {
      const route = routes[path]
      return route ? { result: route(body) ?? { ok: true } } : undefined
    },
  }
}
