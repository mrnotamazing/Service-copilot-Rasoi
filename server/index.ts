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
import { loadProviders } from './providers.ts'
import { createRanker } from './ranker.ts'
import { createTts, TtsError } from './tts.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.COPILOT_PORT ?? 4000)
const INGEST_KEY = process.env.COPILOT_INGEST_KEY // required for POS webhooks when set

const hub = new Hub(fileStore(join(root, 'data/events.ndjson'), join(root, 'data/config.json')))
const sim = new Simulator(hub)
// The assistant's language models, best first (Claude, Gemini, a free cloud AI, Ollama): when one is
// busy, rate limited or offline the next answers, and the built-in trainer is the last resort.
const providers = await loadProviders()
// AI_PRIORITY pins the order; otherwise models are ordered by job (quick answers favour fast models, judging favours careful ones).
const ranker = createRanker({ file: join(root, 'data/ai-ranking.json'), fixed: !!process.env.AI_PRIORITY })
const api = createApi(hub, sim, {
  url: process.env.DIFY_API_URL,
  key: process.env.DIFY_API_KEY,
  chat: providers.map((p) => p.model),
  ranker,
  chatErrorReason: (e, m) => providers.find((p) => p.model === m)?.reason(e) ?? (e instanceof Error ? e.message : String(e)),
})
const snapshot = api.snapshot
// Natural read-aloud voice (ElevenLabs). Without a key the app uses the device's own voice.
const tts = process.env.ELEVENLABS_API_KEY ? createTts({ key: process.env.ELEVENLABS_API_KEY, voiceId: process.env.ELEVENLABS_VOICE_ID, model: process.env.ELEVENLABS_MODEL }) : null

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

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS })
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
  'GET /api/health': () => ({ ok: true, events: hub.events.length, ai: api.provider, lineup: api.lineup, voice: tts ? 'elevenlabs' : 'device' }),
  'GET /api/tts/status': () => ({ enabled: !!tts }),
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
      // The same, streamed: one JSON line per update ({ text }), then { answer } or { error }.
      if (req.method === 'POST' && url.pathname === '/api/ai/stream') {
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' })
        try {
          const answer = await api.ask(body as Record<string, unknown>, (text) => res.write(`${JSON.stringify({ text })}\n`))
          res.end(`${JSON.stringify({ answer })}\n`)
        } catch (e) {
          res.end(`${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n`)
        }
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/tts') {
        if (!tts) return send(res, 503, { error: 'Voice is not set up' })
        try {
          const caller = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'anon').split(',')[0].trim()
          const audio = await tts.synth(String((body as Record<string, unknown>).text ?? ''), caller)
          res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': audio.length, 'cache-control': 'private, max-age=86400', ...SECURITY_HEADERS })
          return void res.end(audio)
        } catch (e) {
          return send(res, e instanceof TtsError ? e.status : 502, { error: e instanceof Error ? e.message : 'The voice service failed' })
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/ai') {
        try {
          return send(res, 200, await api.ask(body as Record<string, unknown>))
        } catch (e) {
          return send(res, 400, { error: e instanceof Error ? e.message : String(e) })
        }
      }
      if (req.method === 'POST') {
        const handled = api.post(url.pathname, body as Record<string, unknown>)
        if (handled) return send(res, 200, await handled.result)
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

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' }
function serveStatic(pathname: string, res: ServerResponse) {
  const dist = join(root, 'dist')
  let file = normalize(join(dist, pathname))
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    return res.end('Web app not built. Run `npm run dev` (development) or `npm run build` first.')
  }
  // Hashed build assets never change; the page itself must always be fresh.
  const immutable = /[\\/]assets[\\/]/.test(file)
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ...SECURITY_HEADERS })
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

server.listen(PORT, async () => {
  const lines = await Promise.all(providers.map(async (p) => `${await p.describe()}`))
  console.log(`Service Copilot API on http://localhost:${PORT} · AI: ${lines.length ? lines.join(' → ') + ' → built-in' : 'built-in (add GROQ_API_KEY for free, fast AI; or GEMINI_API_KEY; or start Ollama; or ANTHROPIC_API_KEY for Claude)'}`)
})
