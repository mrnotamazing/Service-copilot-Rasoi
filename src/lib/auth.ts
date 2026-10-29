// Demo sign-in. One screen, one person: a server sees only their own app, the kitchen pass only
// the kitchen, the manager only the manager's view, so a room full of people can each be on their
// own device without wandering into each other's pages.
//
// This is a front-of-house gate for presentations, not security: the password sits in the app and
// the live data is still reachable from the API. For a real roll-out, sign people in on the server
// with their own passwords (the account list below is where they would be checked).

import { L } from '../i18n/index.ts'
import { useSyncExternalStore } from 'react'
import type { Role } from './role.ts'
import { homeFor } from './role.ts'

/** Everyone shares this for now. Change it here, or give each person their own in `passwordFor`. */
export const DEMO_PASSWORD = 'appleisyum'
const passwordFor = (_role: Role) => DEMO_PASSWORD

export interface Session {
  role: Role
  name: string
}

const KEY = 'tablemate-session'
const listeners = new Set<() => void>()

// Per tab (sessionStorage): closing the tab signs out, and one laptop can show several roles side by side.
function read(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null
    const r = s?.role
    return s && typeof s.name === 'string' && r && (r.kind === 'kitchen' || r.kind === 'manager' || (r.kind === 'server' && typeof r.staffId === 'string')) ? s : null
  } catch {
    return null
  }
}
let current: Session | null = read()
const emit = () => listeners.forEach((l) => l())

export const getSession = () => current

export function useSession(): Session | null {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  )
}

let misses = 0
let lockedUntil = 0

/** Returns null on success, otherwise what to tell the person. */
export function signIn(role: Role, name: string, password: string): string | null {
  const now = Date.now()
  if (now < lockedUntil) return L('Too many tries. Wait {n} seconds.', { n: Math.ceil((lockedUntil - now) / 1000) })
  if (password.trim() !== passwordFor(role)) {
    if (++misses >= 5) {
      misses = 0
      lockedUntil = now + 10_000
      return L('Too many tries. Wait 10 seconds.')
    }
    return L('That password isn’t right. Try again.')
  }
  misses = 0
  current = { role, name }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // storage blocked: the sign-in lasts until the page is reloaded
  }
  emit()
  return null
}

export function signOut() {
  current = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
  emit()
}

/** May this session open the page for `role`? Servers only their own; managers also see the servers overview. */
export function mayOpen(s: Session | null, page: Role | { kind: 'servers' }): boolean {
  if (!s) return false
  if (page.kind === 'servers') return s.role.kind === 'manager'
  if (page.kind === 'server') return s.role.kind === 'server' && s.role.staffId === page.staffId
  return s.role.kind === page.kind
}

export const homeOf = (s: Session) => homeFor(s.role)

/** A warm, time-of-day greeting and one short line of encouragement for the role, different each day. */
export function welcome(s: Session, now = new Date()): { title: string; line: string } {
  const h = now.getHours()
  const part = h < 5 ? L('Hello') : h < 12 ? L('Good morning') : h < 17 ? L('Good afternoon') : L('Good evening')
  const lines = LINES()[s.role.kind]
  const day = Math.floor(now.getTime() / 86_400_000)
  const seed = [...s.name].reduce((n, c) => n + c.charCodeAt(0), day)
  return { title: `${part}, ${s.name}`, line: lines[seed % lines.length] }
}

const LINES = (): Record<Role['kind'], string[]> => ({
  server: [
    L('Every table you look after tonight is someone’s special occasion.'),
    L('You’ve got this. Three small moves at a time, and the night takes care of itself.'),
    L('A sincere smile is the best garnish on the menu.'),
    L('Calm hands, kind words, and the whole floor feels it.'),
    L('The best service is the kind guests never see you rushing for.'),
  ],
  kitchen: [
    L('Great plates start with a calm pass. Let’s send out something beautiful.'),
    L('Hot food, on time, every time. The floor is counting on you.'),
    L('One ticket at a time. You’re the heartbeat of the night.'),
    L('Taste, plate, smile, pass. You make the magic.'),
    L('A clear call at the pass saves a hundred steps on the floor.'),
  ],
  manager: [
    L('A calm manager makes a calm floor. Lead the night with a steady voice.'),
    L('Look for who needs help, not who needs fixing.'),
    L('Praise out loud tonight, coach in private. Your team will remember it.'),
    L('Small decisions, made early, keep the whole room smooth.'),
    L('Your team gets better when they feel backed. Back them tonight.'),
  ],
})

export function goodbye(s: Session, now = new Date()): { title: string; line: string } {
  const night = now.getHours() >= 17 || now.getHours() < 4
  return {
    title: L('Thank you, {name}', { name: s.name }),
    line: night ? L('That was a night well served. Rest up, you’ve earned it.') : L('Thanks for a great shift. See you next time!'),
  }
}

/** A goodbye shown once on the sign-in screen after someone finishes their shift. */
let pendingBye: { title: string; line: string } | null = null
export const goodbyeNote = {
  set: (b: { title: string; line: string }) => void (pendingBye = b),
  peek: () => pendingBye,
  clear: () => void (pendingBye = null),
}
