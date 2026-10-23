// How the guest (or colleague) in a practice role-play feels, as a small drawn face: from upset (0)
// through unsure (2) to won over (4). Drawn in the theme's colours so it works in light and dark.

import { cn } from '@/lib/utils'

const TONE = ['var(--destructive)', 'var(--destructive)', 'var(--warn)', 'var(--good)', 'var(--good)']

/** Mouth curve from frown (-1) to big smile (1), brows from cross (1) to relaxed (0). */
const SHAPE: { mouth: number; brow: number; cheeks?: boolean }[] = [
  { mouth: -1, brow: 1 },
  { mouth: -0.55, brow: 0.5 },
  { mouth: 0, brow: 0.15 },
  { mouth: 0.6, brow: 0 },
  { mouth: 1, brow: 0, cheeks: true },
]

export function MoodFace({ level, className, label }: { level: number; className?: string; label?: string }) {
  const k = Math.max(0, Math.min(4, Math.round(level)))
  const { mouth, brow, cheeks } = SHAPE[k]
  const tone = TONE[k]
  // Mouth: a curve from (11,22) to (21,22) bending down for a smile.
  const bend = 22 + mouth * 4
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6 shrink-0', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="16" cy="16" r="14.5" fill={`color-mix(in oklab, ${tone} 18%, var(--card))`} stroke={tone} strokeWidth="1.5" />
      {/* brows */}
      <path d={`M9 ${10.5 + brow * 1.5} L13 ${10.5 - brow * 0.5}`} stroke="var(--foreground)" strokeWidth="1.6" strokeLinecap="round" opacity={brow ? 0.8 : 0.35} />
      <path d={`M23 ${10.5 + brow * 1.5} L19 ${10.5 - brow * 0.5}`} stroke="var(--foreground)" strokeWidth="1.6" strokeLinecap="round" opacity={brow ? 0.8 : 0.35} />
      {/* eyes */}
      {k === 4 ? (
        <>
          <path d="M9.5 14.5 Q11 12.8 12.5 14.5" stroke="var(--foreground)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M19.5 14.5 Q21 12.8 22.5 14.5" stroke="var(--foreground)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="11" cy="14.5" r="1.5" fill="var(--foreground)" />
          <circle cx="21" cy="14.5" r="1.5" fill="var(--foreground)" />
        </>
      )}
      {cheeks && (
        <>
          <circle cx="8.5" cy="19" r="1.8" fill="var(--tomato)" opacity="0.35" />
          <circle cx="23.5" cy="19" r="1.8" fill="var(--tomato)" opacity="0.35" />
        </>
      )}
      {/* mouth */}
      <path d={`M11 22 Q16 ${bend} 21 22`} stroke="var(--foreground)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}
