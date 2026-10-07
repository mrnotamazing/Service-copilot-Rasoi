// Browser-only backend for the shareable demo: the same hub, simulator and API
// the Node server uses, running inside the page with an in-memory event log.

import { createApi, type ApiBody } from '../../server/api.ts'
import { Hub, memoryStore } from '../../server/hub.ts'
import { Simulator } from '../../server/simulator.ts'

const hub = new Hub(memoryStore())
const sim = new Simulator(hub)
export const localApi = createApi(hub, sim)
export const onLocalChange = (fn: () => void) => hub.onChange(fn)

export function localPost(path: string, body: ApiBody): unknown {
  const handled = localApi.post(path, body)
  if (!handled) throw new Error(`Not available in the demo: ${path}`)
  return handled.result
}

// Open straight into a running service so there is something to see.
sim.intensity = 1.6
sim.setSpeed(10)
sim.start()
