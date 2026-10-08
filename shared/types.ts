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
  /**
   * What the dish contains, for the safety check: allergens (nuts, shellfish, gluten, dairy,
   * fish, egg, soy, sesame) and diet tags (meat, root, alcohol, pork, nonhalal).
   */
  contains?: string[]
}

export interface Staff {
  id: string
  name: string
  role: 'server' | 'kitchen' | 'manager'
  color: string
  /** Optional, chosen by the person (e.g. "they/them"). Shown next to their name to teammates. */
  pronouns?: string
  /** Chosen by the person: a small photo (data URL), "icon:<id>" for an illustration, or unset for their initial. */
  avatar?: string
  /** Languages they're happy to speak with guests and teammates (see shared/profile.ts). */
  languages?: string[]
}

export interface TableDef {
  id: string
  name: string
  seats: number
  section: string
  /** Table identifier in the POS (e.g. Petpooja table_no). */
  posTableId?: string
  /** Where the table sits in its section, in % of the floor plan (x left→right, y pass→entrance). */
  pos?: { x: number; y: number }
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
  /** Safety check on this line was handled: kitchen told, or the guest confirmed it is fine. */
  safetyResolvedAt?: number
  safetyResolution?: 'kitchen' | 'guest_ok'
  /** Forecast ready time (station load and tonight's real prep times), filled in snapshots. */
  etaAt?: number
}

export interface Party {
  size: number
  guestName?: string
  allergies: string[]
  /** Accessibility needs and dietary practices, e.g. wheelchair, hearing, vision, highchair, jain, halal, vegan. */
  needs?: string[]
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
  /** Latest mood the server noted at a check-in, and whether an unhappy table was won back. */
  mood?: { value: Mood; at: number }
  recoveredAt?: number
  managerRequestedAt?: number
  managerVisitedAt?: number
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
  mood?: Mood
  recovered?: boolean
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
  | 'safety_check'
  | 'recovery'

export interface TaskAction {
  label: string
  /** Event type emitted when the server taps this action. */
  event: string
  payload: Record<string, unknown>
  primary?: boolean
  /** Translation key for the label when a card has more than one action. */
  k?: string
}

/** Another open task that can be done on the same trip: same table, next door, or also at the pass. */
export interface RelatedTask {
  id: string
  kind: TaskKind
  tableName: string
  where: 'same' | 'near' | 'pass'
  title: string
  text?: TaskText
  action: TaskAction
}

/** Something the copilot expects soon, shown quietly so the server can get ahead of it. */
export interface Upcoming {
  id: string
  kind: 'food_ready' | 'course_end' | 'bill_soon' | 'crunch'
  tableId: string
  tableName: string
  at: number
  text: TaskText
}

export type Mood = 'happy' | 'ok' | 'unhappy'

export interface Task {
  id: string
  kind: TaskKind
  tableId: string
  tableName: string
  staffId: string
  title: string
  hint: string
  checklist?: string[]
  /** The same text as translation keys, so each device renders it in its own language. */
  text?: { title: TaskText; hint: TaskText; checklist?: string[] }
  impact: number
  dueAt: number
  createdAt: number
  score: number
  actions: TaskAction[]
  /** Filled for the top cards: tasks worth doing on the same trip. */
  related?: RelatedTask[]
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

/**
 * Language-neutral task text. `k` is a translation key with params; a param value that
 * starts with "@" is itself a key (e.g. "@course.main"). `parts` are joined in order;
 * `raw` is shown as-is (dish names, guest names, kitchen messages).
 */
export type TaskText = { k: string; p?: Record<string, string | number> } | { parts: TaskText[]; sep?: string } | { raw: string }
