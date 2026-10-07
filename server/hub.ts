// Holds the restaurant config and the append-only event log, keeps the engine
// state in sync, and notifies listeners whenever something changes.

import { DEMO_CONFIG } from '../shared/config.ts'
import { applyEvent, deriveTasks, initialState, type EngineState } from '../shared/engine.ts'
import { EVENT_TYPES, newId, type CopilotEvent, type IncomingEvent } from '../shared/events.ts'
import { afterEvent, beforeEvent, initialGame, type GameState } from '../shared/game.ts'
import type { RestaurantConfig, Task } from '../shared/types.ts'
import { Clock } from './clock.ts'

/** Where events and config are kept: a file on the server, memory in the browser demo. */
export interface HubStore {
  loadEvents(): CopilotEvent[]
  append(ev: CopilotEvent): void
  clear(): void
  loadConfig(): Partial<RestaurantConfig> | null
  saveConfig(config: RestaurantConfig): void
}

export const memoryStore = (): HubStore => ({
  loadEvents: () => [],
  append: () => {},
  clear: () => {},
  loadConfig: () => null,
  saveConfig: () => {},
})

export class Hub {
  config: RestaurantConfig
  state: EngineState
  game: GameState
  events: CopilotEvent[] = []
  readonly clock = new Clock()
  private listeners = new Set<() => void>()
  private sourceStats = new Map<string, { count: number; last: number }>()

  constructor(private store: HubStore) {
    const saved = store.loadConfig()
    this.config = saved ? withDefaults({ ...DEMO_CONFIG, ...saved }) : structuredClone(DEMO_CONFIG)
    this.state = initialState(this.config)
    this.game = initialGame(this.config)
    for (const ev of store.loadEvents()) this.ingestStored(ev)
    const last = this.events.at(-1)
    if (last) this.clock.set(Math.max(last.at, Date.now()))
  }

  private ingestStored(ev: CopilotEvent) {
    this.events.push(ev)
    this.apply(ev)
    this.track(ev)
  }

  /** Engine and game advance together; the game reads timings from the state before the event. */
  private apply(ev: CopilotEvent) {
    const closed = this.state.visits.length
    beforeEvent(this.game, ev, this.state, this.config)
    applyEvent(this.state, ev, this.config)
    afterEvent(this.game, this.state.visits.slice(closed), this.config)
  }

  private track(ev: CopilotEvent) {
    const key = ev.source.startsWith('pos:') ? ev.source.slice(4) : ev.source
    const s = this.sourceStats.get(key) ?? { count: 0, last: 0 }
    s.count++
    s.last = ev.at
    this.sourceStats.set(key, s)
  }

  sourceStat(key: string) {
    return this.sourceStats.get(key) ?? null
  }

  /** Validates, stamps, stores and applies an event. Returns the stored event. */
  ingest(input: IncomingEvent): CopilotEvent {
    if (!EVENT_TYPES.includes(input.type)) throw new Error(`Unknown event type: ${String(input.type)}`)
    if (!input.payload || typeof input.payload !== 'object') throw new Error('payload must be an object')
    const ev = {
      id: input.id ?? newId('ev'),
      at: input.at ?? this.clock.now(),
      source: input.source ?? 'app',
      type: input.type,
      payload: input.payload,
    } as CopilotEvent
    this.events.push(ev)
    this.apply(ev)
    this.track(ev)
    this.store.append(ev)
    this.emit()
    return ev
  }

  tasks(now = this.clock.now()): Task[] {
    return deriveTasks(this.state, this.config, now)
  }

  /** Clears the service (new shift / new simulation). */
  reset() {
    this.events = []
    this.sourceStats.clear()
    this.state = initialState(this.config)
    this.game = initialGame(this.config)
    this.store.clear()
    this.emit()
  }

  updateConfig(patch: Partial<RestaurantConfig>) {
    this.config = { ...this.config, ...patch, sop: { ...this.config.sop, ...(patch.sop ?? {}) } }
    this.store.saveConfig(this.config)
    // Rebuild from the log so SOP changes re-score history consistently.
    this.state = initialState(this.config)
    this.game = initialGame(this.config)
    for (const ev of this.events) this.apply(ev)
    this.emit()
  }

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }
}

/**
 * Configs saved by an older version miss newer fields. Fill them from the built-in menu by id
 * (e.g. ingredient tags for the safety check) without touching anything the restaurant set.
 */
export function withDefaults(config: RestaurantConfig): RestaurantConfig {
  return {
    ...config,
    tables: config.tables.map((t) => {
      const base = DEMO_CONFIG.tables.find((d) => d.id === t.id)
      return t.pos || !base?.pos ? t : { ...t, pos: base.pos }
    }),
    menu: config.menu.map((m) => {
      const base = DEMO_CONFIG.menu.find((d) => d.id === m.id)
      return m.contains || !base?.contains ? m : { ...m, contains: base.contains }
    }),
  }
}
