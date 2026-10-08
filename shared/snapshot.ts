import type { FeedItem } from './narrate.ts'
import type { Forecast, LearningPlan, ShiftIntel } from './intel.ts'
import type { Analytics } from './engine.ts'
import type { PlayerView, teamView } from './game.ts'
import type { Instruction, Note, RestaurantConfig, StaffStats, TableState, Task, TaskText, Upcoming, VisitRecord } from './types.ts'

export type Role = 'server' | 'kitchen' | 'manager'

export interface SimStatus {
  running: boolean
  speed: number
  intensity: number
  autopilot: string[]
  autoKitchen: boolean
  autoManager: boolean
  showcase: boolean
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
  me?: { staffId: string; top: Task[]; queued: number; stats: StaffStats | null; myVisits: VisitRecord[]; game: PlayerView | null; upcoming: Upcoming[]; tasks: Task[]; why?: TaskText[]; learning?: LearningPlan }
  /** manager role: process analytics, no per-person stats */
  analytics?: Analytics
  /** manager role: why tonight is going the way it is, and what the next 15 minutes look like. */
  intel?: ShiftIntel
  forecast?: Forecast
  integrations?: IntegrationStatus[]
  /** manager/kitchen: how many open cards each server has (load, not performance) */
  openTasks?: Record<string, number>
  /** manager: notes sent to servers, newest first, with who has seen each. */
  instructions?: Instruction[]
  /** Manager / demo control: what's been happening, in plain words (newest last). */
  feed?: FeedItem[]
}
