import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'tablemate-theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let choice: ThemeChoice = readChoice()
let resolved: 'light' | 'dark' = 'light'
const listeners = new Set<() => void>()

function resolve(): 'light' | 'dark' {
  // An artifact host may set data-theme on <html>; respect it when the viewer chose "system".
  const host = document.documentElement.dataset.theme
  if (choice === 'system' && (host === 'light' || host === 'dark')) return host
  if (choice !== 'system') return choice
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply() {
  resolved = resolve()
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  apply()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}

export function setTheme(c: ThemeChoice) {
  choice = c
  try {
    localStorage.setItem(KEY, c)
  } catch {
    // storage blocked: still switch for this visit
  }
  apply()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Light/dark/system theme, applied as the `dark` class shadcn/ui expects. */
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, () => `${choice}:${resolved}`)
  const [c, r] = snap.split(':') as [ThemeChoice, 'light' | 'dark']
  return { choice: c, resolved: r, setTheme }
}
