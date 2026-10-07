// Domain model shared by the server (engine, adapters, simulator) and the web app.

export type Course = 'starter' | 'main' | 'dessert' | 'drink'
export type Station = 'grill' | 'hot' | 'cold' | 'pastry' | 'bar'

export interface MenuItem {
  id: string
  name: string
  course: Course
  station: Station
  prepMin: number
  /** Item id in the restaurant's POS (e.g. Petpooja itemid), used by adapters. */
  posItemId?: string
}

export interface Staff {
  id: string
  name: string
  role: 'server' | 'kitchen' | 'manager'
  color: string
}

export interface TableDef {
  id: string
  name: string
  seats: number
  section: string
  /** Table identifier in the POS (e.g. Petpooja table_no). */
  posTableId?: string
}

/** Service standards, in minutes. Every task the copilot raises comes from one of these. */
export interface Sop {
  greetWithinMin: number
  orderNudgeAfterMin: number
  kitchenDelayToleranceMin: number
  pickupWithinMin: number
  checkbackAfterMin: number
  courseCheckAfterMin: number
  billPresentWithinMin: number
  farewellWithinMin: number
  resetWithinMin: number
  maxActiveTablesPerServer: number
}

export interface RestaurantConfig {
  name: string
  sections: Record<string, string> // section -> staffId
  staff: Staff[]
  tables: TableDef[]
  menu: MenuItem[]
  sop: Sop
}

export type TableStatus =
  | 'available'
  | 'seated'
  | 'ordering'
  | 'dining'
  | 'bill'
  | 'paid'
  | 'needs_reset'

export type ItemStatus = 'fired' | 'ready' | 'served' | 'unavailable'

export interface OrderLine {
  id: string
  ticketId: string
  menuItemId: string
  name: string
  course: Course
  station: Station
  qty: number
  firedAt: number
  expectedReadyAt: number
  readyAt?: number
  servedAt?: number
  status: ItemStatus
  delayInformedAt?: number
  unavailableAt?: number
  unavailableInformedAt?: number
}

export interface Party {
  size: number
  guestName?: string
  allergies: string[]
  occasion?: string
  vip?: boolean
}

export interface TableState {
  id: string
  name: string
  seats: number
  section: string
  serverId: string
  status: TableStatus
  visitId?: string
  party?: Party
  seatedAt?: number
  greetedAt?: number
  firstOrderAt?: number
  lastAttentionAt?: number
  checkbacks: Record<string, number> // course -> at
  courseClearedAt: Record<string, number>
  billRequestedAt?: number
  billPresentedAt?: number
  settledAt?: number
  farewelledAt?: number
  allergyConfirmedAt?: number
  lines: OrderLine[]
}

export type Owner = 'floor' | 'kitchen' | 'guest'

/** One measured step of a visit, compared against its SOP target. */
export interface Segment {
  stage: 'greet' | 'kitchen' | 'pickup' | 'bill' | 'reset'
  owner: Owner
  label: string
  start: number
  end: number
  targetMin: number
  lapse: boolean
  station?: Station
}

export interface VisitRecord {
  visitId: string
  tableId: string
  tableName: string
  serverId: string
  partySize: number
  seatedAt: number
  endedAt: number
  segments: Segment[]
  smooth: boolean
}

export type TaskKind =
  | 'greet'
  | 'take_order'
  | 'allergy'
  | 'unavailable'
  | 'kitchen_delay'
  | 'pickup'
  | 'checkback'
  | 'clear_course'
  | 'present_bill'
  | 'farewell'
  | 'reset'
  | 'kitchen_message'

export interface TaskAction {
  label: string
  /** Event type emitted when the server taps this action. */
  event: string
  payload: Record<string, unknown>
  primary?: boolean
}

export interface Task {
  id: string
  kind: TaskKind
  tableId: string
  tableName: string
  staffId: string
  title: string
  hint: string
  checklist?: string[]
  impact: number
  dueAt: number
  createdAt: number
  score: number
  actions: TaskAction[]
}

export interface Note {
  id: string
  at: number
  direction: 'to_kitchen' | 'to_floor'
  tableId?: string
  text: string
  from: string
  ackAt?: number
}

export interface StaffStats {
  staffId: string
  activeTables: number
  smoothTables: number
  completedTables: number
  streak: number
  bestStreak: number
  avgGreetSec: number | null
}
