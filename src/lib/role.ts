// Who is using this device: a server, the kitchen pass, or the manager. Chosen from the
// "signed in as" switcher; each role gets its own navigation and its own colours.

import { useEffect, useSyncExternalStore } from 'react'

export type Role = { kind: 'server'; staffId: string } | { kind: 'kitchen' } | { kind: 'manager' }

const KEY = 'tablemate-role'
const listeners = new Set<() => void>()
let current: Role | null = load()

function load(): Role | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Role | null
    return r && (r.kind === 'kitchen' || r.kind === 'manager' || (r.kind === 'server' && typeof r.staffId === 'string')) ? r : null
  } catch {
    return null
  }
}

export function getRole(): Role | null {
  return current
}

export function setRole(r: Role) {
  if (current && JSON.stringify(current) === JSON.stringify(r)) return
  current = r
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // storage blocked: the choice lasts for this visit
  }
  for (const l of listeners) l()
}

export function useRole(): Role | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

/** Where each role lands. */
export function homeFor(r: Role): string {
  return r.kind === 'server' ? `/server/${r.staffId}` : r.kind === 'kitchen' ? '/kitchen' : '/manager'
}

/**
 * A page belongs to one role: opening it signs this device in as that role and switches the
 * colour theme (servers tomato, kitchen saffron, manager blue) via <html data-role>.
 */
export function useRolePage(r: Role | null) {
  const key = r ? JSON.stringify(r) : ''
  useEffect(() => {
    if (r) setRole(r)
    const role = r?.kind ?? current?.kind
    if (role) document.documentElement.dataset.role = role
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
