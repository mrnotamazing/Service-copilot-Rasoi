// Browser-only backend for the shareable demo: the same hub, simulator and API
// the Node server uses, running inside the page with an in-memory event log.

import type { ChatModel } from '../../server/ai.ts'
import { createApi, type ApiBody } from '../../server/api.ts'
import { Hub, memoryStore } from '../../server/hub.ts'
import { Simulator } from '../../server/simulator.ts'

const hub = new Hub(memoryStore())
const sim = new Simulator(hub)

// On claude.ai the published demo can ask Claude on the viewer's own account (the artifact's `sample`
// capability): no API key needed. Anywhere else, or if the viewer declines, the built-in trainer answers.
type Sample = (input: { role: 'user' | 'assistant'; content: string }[], opts?: { cache?: boolean; modelTier?: string }) => Promise<{ text: string }>
let sample: Sample | null = null
const w = window as unknown as { claude?: { use(name: string): Promise<Sample | null> } }
w.claude
  ?.use('sample')
  .then((s) => {
    sample = s
  })
  .catch(() => {})

const SAMPLE_REASONS: Record<string, string> = {
  not_granted: 'Claude wasn’t allowed for this page',
  sampling_disabled: 'Claude isn’t available on this account',
  rate_limited: 'Claude is busy right now',
  refused: 'Claude declined that request',
  session_expired: 'Sign in to claude.ai again to use Claude',
}
const PERMANENT = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])

const viewerClaude: ChatModel = {
  name: 'claude',
  available: () => sample !== null,
  async reply(system, turns) {
    const s = sample
    if (!s) throw new Error('Claude isn’t connected')
    // There is no system role here: the standing instructions go first as a user turn.
    const input = [{ role: 'user' as const, content: `${system.stable}\n\n${system.live}` }, ...turns.map((t) => ({ role: t.role, content: t.text }))]
    try {
      const { text } = await s(input, { cache: false, modelTier: 'quick' })
      return text
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'upstream_error'
      if (PERMANENT.has(code)) sample = null
      throw new Error(SAMPLE_REASONS[code] ?? 'Couldn’t reach Claude')
    }
  },
}

export const localApi = createApi(hub, sim, { chat: viewerClaude })
export const onLocalChange = (fn: () => void) => hub.onChange(fn)

export async function localPost(path: string, body: ApiBody): Promise<unknown> {
  if (path === '/api/ai') return localApi.ask(body)
  const handled = localApi.post(path, body)
  if (!handled) throw new Error(`Not available in the demo: ${path}`)
  return handled.result
}

// The shared demo opens on the project explainer; every screen is one click away from there.
if (!location.hash || location.hash === '#/') history.replaceState(null, '', '#/about')

// Open straight into a running service so there is something to see.
sim.intensity = 1.6
sim.setSpeed(10)
sim.start()
