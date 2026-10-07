import { useEffect, useState } from 'react'
import { istClock } from '../../shared/time.ts'

/** The real time now, ticking every 10 seconds. Clocks show this, not the (possibly sped-up) demo service time. */
export function useWallClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Wall-clock time in IST (the restaurant's time), e.g. "8:24 pm". */
export function clock(ms: number): string {
  return istClock(ms)
}

/** "1:05" style duration. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Minutes since an event, by service time: stays right even when the demo runs sped up. */
export function minutesAgo(at: number, now: number): number {
  return Math.max(0, Math.round((now - at) / 60_000))
}

export function mins(ms: number): string {
  const m = Math.abs(ms) / 60_000
  return m < 1 ? '<1 min' : `${Math.round(m)} min`
}

export const STATUS_LABEL: Record<string, string> = {
  available: 'Free',
  seated: 'Seated',
  ordering: 'Ordering',
  dining: 'Dining',
  bill: 'Bill',
  paid: 'Paid',
  needs_reset: 'Reset',
}

/** Rough progress through a visit, 0..1, for the table ring. */
export const STATUS_PROGRESS: Record<string, number> = {
  available: 0,
  seated: 0.12,
  ordering: 0.2,
  dining: 0.5,
  bill: 0.82,
  paid: 0.92,
  needs_reset: 0.97,
}
