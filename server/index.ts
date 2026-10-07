import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingEvent } from '../shared/events.ts'
import type { Role } from '../shared/snapshot.ts'
import { ADAPTERS } from './adapters/index.ts'
import { AdapterError } from './adapters/types.ts'
import { createApi } from './api.ts'
import { fileStore } from './fileStore.ts'
import { Hub } from './hub.ts'
import { Simulator } from './simulator.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.COPILOT_PORT ?? 4000)
const INGEST_KEY = process.env.COPILOT_INGEST_KEY // required for POS webhooks when set

const hub = new Hub(fileStore(join(root, 'data/events.ndjson'), join(root, 'data/config.json')))
const sim = new Simulator(hub)
const api = createApi(hub, sim)
const snapshot = api.snapshot

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

  // Generic POS/middleware ingest in the canonical format.
  'POST /api/events': (req, body) => {
    requireKey(req)
    const list = (Array.isArray(body.events) ? body.events : [body]) as IncomingEvent[]
    return ingestAll(list.map((e) => ({ ...e, source: e.source?.startsWith('pos:') ? e.source : 'pos:api' }) as IncomingEvent))
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
      const body = req.method === 'POST' ? await readJson(req) : {}
      if (req.method === 'POST' && (typeof body !== 'object' || body === null || Array.isArray(body))) throw new AdapterError('Expected a JSON object')
      if (req.method === 'POST') {
        const handled = api.post(url.pathname, body as Record<string, unknown>)
        if (handled) return send(res, 200, handled.result)
      }
      const handler = routes[`${req.method} ${url.pathname}`]
      if (!handler) return send(res, 404, { error: 'Not found' })
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
