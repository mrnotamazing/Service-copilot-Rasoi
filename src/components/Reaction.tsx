import type { Mood } from '../../shared/types.ts'
import { cn } from '@/lib/utils'

/** Each mood's tone: sage for happy, neutral for okay, amber (never red) for not happy. */
export const MOOD_TONE: Record<Mood, string> = {
  happy: 'text-good',
  ok: 'text-muted-foreground',
  unhappy: 'text-warn',
}

/**
 * Vector reaction faces drawn to match the app's line icons, so they look the same on every
 * device (emoji differ by phone maker), follow the theme colours and scale with text size.
 */
export function Reaction({ mood, className, filled }: { mood: Mood; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cn('size-6', className)} aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.14 : 0} />
      {mood === 'happy' && (
        <>
          <path d="M8.2 10.2c.5-.9 1.7-.9 2.2 0" />
          <path d="M13.6 10.2c.5-.9 1.7-.9 2.2 0" />
          <path d="M7.8 13.6c1 2.2 2.5 3.3 4.2 3.3s3.2-1.1 4.2-3.3" />
        </>
      )}
      {mood === 'ok' && (
        <>
          <circle cx="9.2" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.8" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <path d="M8.6 15.2h6.8" />
        </>
      )}
      {mood === 'unhappy' && (
        <>
          <circle cx="9.2" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.8" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <path d="M8 16.6c1-1.6 2.4-2.4 4-2.4s3 .8 4 2.4" />
          <path d="M7.6 7.6l2.4.9M16.4 7.6l-2.4.9" />
        </>
      )}
    </svg>
  )
}
