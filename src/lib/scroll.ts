// In-page links that work under both routers: the standalone demo uses hash routing, where a plain
// "#section" link would be read as a route. These scroll or move focus instead of changing the address.

import type { MouseEvent } from 'react'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function scrollToId(e: MouseEvent, id: string) {
  e.preventDefault()
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
}

/** The "Skip to main content" link: moves focus to the page's main region. */
export function skipToMain(e: MouseEvent) {
  e.preventDefault()
  const el = document.getElementById('main')
  if (!el) return
  el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: false })
}
