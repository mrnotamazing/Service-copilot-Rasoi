import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import { analytics, staffStats, tasksFor } from '../shared/engine.ts'
import type { IncomingEvent } from '../shared/events.ts'
import type { IntegrationStatus, Role, Snapshot } from '../shared/snapshot.ts'
import type { RestaurantConfig } from '../shared/types.ts'
import { ADAPTERS, CATALOG } from './adapters/index.ts'
import { AdapterError } from './adapters/types.ts'
import { Hub } from './hub.ts'
import { Simulator } from './simulator.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.COPILOT_PORT ?? 4000)
const INGEST_KEY = process.env.COPILOT_INGEST_KEY // required for POS webhooks when set

const hub = new Hub(join(root, 'data/events.ndjson'), join(root, 'data/config.json'))
const sim = new Simulator(hub)

// ---------------------------------------------------------------------------
// Snapshots, cut per role.

function integrations(): IntegrationStatus[] {
  return CATALOG.map((c) => {
    const s = hub.sourceStat(c.id === 'generic' ? 'api' : c.id)
    return { ...c, lastEventAt: s?.last ?? null, eventCount: s?.count ?? 0 }
  })
}

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

// ---------------------------------------------------------------------------
// Live updates over WebSocket (throttled, plus a 1s heartbeat so timers move).

interface Client {
  ws: WebSocket
  role: Role
  staffId?: string
}
const clients = new Set<Client>()
let pending = false

function broadcast() {
  for (const c of clients) if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(snapshot(c.role, c.staffId)))
}
function scheduleBroadcast() {
  if (pending) return
  pending = true
  setTimeout(() => {
    pending = false
    broadcast()
  }, 150)
}
hub.onChange(scheduleBroadcast)
setInterval(broadcast, 1000)

// ---------------------------------------------------------------------------
// HTTP API.

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > 1_000_000) throw new AdapterError('Body too large', 413)
    chunks.push(c as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new AdapterError('Invalid JSON')
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function requireKey(req: IncomingMessage) {
  if (INGEST_KEY && req.headers['x-copilot-key'] !== INGEST_KEY) throw new AdapterError('Invalid or missing x-copilot-key', 401)
}

function ingestAll(events: IncomingEvent[]) {
  return events.map((e) => hub.ingest(e))
}

type Handler = (req: IncomingMessage, body: Record<string, unknown>, url: URL) => unknown
const routes: Record<string, Handler> = {
  'GET /api/health': () => ({ ok: true, events: hub.events.length }),
  'GET /api/snapshot': (_r, _b, url) => snapshot((url.searchParams.get('role') as Role) ?? 'manager', url.searchParams.get('staffId') ?? undefined),
  'GET /api/events/export': () => hub.events,

  // Taps from the copilot apps (server phones, kitchen screen, manager).
  'POST /api/actions': (_r, body) => {
    const ev = body as unknown as IncomingEvent
    const source = body.source === 'kitchen' || body.source === 'manager' ? body.source : 'app'
    return ingestAll([{ ...ev, source } as IncomingEvent])
  },

  // Generic POS/middleware ingest in the canonical format.
  'POST /api/events': (req, body) => {
    requireKey(req)
    const list = (Array.isArray(body.events) ? body.events : [body]) as IncomingEvent[]
    return ingestAll(list.map((e) => ({ ...e, source: e.source?.startsWith('pos:') ? e.source : 'pos:api' }) as IncomingEvent))
  },

  'POST /api/sim/start': () => (sim.start(), sim.status()),
  'POST /api/sim/pause': () => (sim.pause(), sim.status()),
  'POST /api/sim/reset': () => (sim.reset(), sim.status()),
  'POST /api/sim/settings': (_r, body) => {
    if (typeof body.speed === 'number') sim.setSpeed(body.speed)
    if (typeof body.intensity === 'number') sim.intensity = Math.max(0.3, Math.min(3, body.intensity))
    if (typeof body.autoKitchen === 'boolean') sim.autoKitchen = body.autoKitchen
    if (typeof body.staffId === 'string' && typeof body.autopilot === 'boolean') sim.setAutopilot(body.staffId, body.autopilot)
    hub.emit()
    return sim.status()
  },

  'POST /api/config': (_r, body) => {
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

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (url.pathname.startsWith('/api/')) {
      const integ = url.pathname.match(/^\/api\/integrations\/([\w-]+)\/([\w-]+)$/)
      if (integ && req.method === 'POST') {
        requireKey(req)
        const adapter = ADAPTERS[integ[1]]
        const route = adapter?.routes[integ[2]]
        if (!route) return send(res, 404, { error: 'Unknown integration endpoint' })
        const { events, reply } = route(await readJson(req), { config: hub.config, ticketForOrder: (id) => `${integ[1]}_${id}` })
        ingestAll(events)
        return send(res, 200, reply)
      }
      const handler = routes[`${req.method} ${url.pathname}`]
      if (!handler) return send(res, 404, { error: 'Not found' })
      const body = req.method === 'POST' ? await readJson(req) : {}
      if (req.method === 'POST' && (typeof body !== 'object' || body === null || Array.isArray(body))) throw new AdapterError('Expected a JSON object')
      return send(res, 200, handler(req, body as Record<string, unknown>, url) ?? { ok: true })
    }
    serveStatic(url.pathname, res)
  } catch (e) {
    const status = e instanceof AdapterError ? e.status : 400
    send(res, status, { error: e instanceof Error ? e.message : String(e) })
  }
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
function serveStatic(pathname: string, res: ServerResponse) {
  const dist = join(root, 'dist')
  let file = normalize(join(dist, pathname))
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    return res.end('Web app not built. Run `npm run dev` (development) or `npm run build` first.')
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => void handle(req, res))
const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/ws', 'http://localhost')
  const role = (['server', 'kitchen', 'manager'] as Role[]).find((r) => r === url.searchParams.get('role')) ?? 'manager'
  const client: Client = { ws, role, staffId: url.searchParams.get('staffId') ?? undefined }
  clients.add(client)
  ws.send(JSON.stringify(snapshot(client.role, client.staffId)))
  ws.on('close', () => clients.delete(client))
})

server.listen(PORT, () => console.log(`Service Copilot API on http://localhost:${PORT}`))
