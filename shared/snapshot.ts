import type { Analytics } from './engine.ts'
import type { PlayerView, teamView } from './game.ts'
import type { Note, RestaurantConfig, StaffStats, TableState, Task, Upcoming, VisitRecord } from './types.ts'

export type Role = 'server' | 'kitchen' | 'manager'

export interface SimStatus {
  running: boolean
  speed: number
  intensity: number
  autopilot: string[]
  autoKitchen: boolean
  waiting: number
  startedAt: number | null
}

export interface IntegrationStatus {
  id: string
  name: string
  mode: 'live' | 'needs-partner-access' | 'planned'
  note: string
  endpoints: { method: string; path: string; purpose: string }[]
  lastEventAt: number | null
  eventCount: number
}

/**
 * What each client receives. It is cut per role on the server, so personal
 * performance data physically never reaches the manager's screen.
 */
export interface Snapshot {
  role: Role
  now: number
  config: RestaurantConfig
  tables: TableState[]
  unavailable: string[]
  notes: Note[]
  sim: SimStatus
  /** Where AI answers come from: a connected Dify app, or the built-in writer. */
  ai: { provider: 'claude' | 'ollama' | 'dify' | 'built-in'; model?: string }
  /** Shared with everyone: the team goal and kudos. Never individual scores. */
  team: ReturnType<typeof teamView>
  /** server role: own top tasks and private stats */
  me?: { staffId: string; top: Task[]; queued: number; stats: StaffStats | null; myVisits: VisitRecord[]; game: PlayerView | null; upcoming: Upcoming[]; tasks: Task[] }
  /** manager role: process analytics, no per-person stats */
  analytics?: Analytics
  integrations?: IntegrationStatus[]
  /** manager/kitchen: how many open cards each server has (load, not performance) */
  openTasks?: Record<string, number>
}
