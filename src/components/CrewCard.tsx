// The kitchen's and the manager's team game: a rank, a shift goal, a streak (kitchen) and badges.
// It is about the work and the team, never about ranking people, and it stays on this screen.

import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'motion/react'
import { Crown, Flame, Lock, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { CrewView } from '../../shared/crew.ts'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { haptic } from '../lib/haptics.ts'
import { usePrefs } from '../lib/prefs.ts'
import { BADGE_ICONS } from './game.tsx'

/** Wins feel like something: a small tap for each, a toast with confetti and a buzz for a badge or a new rank. */
function useCrewCelebrations(crew: CrewView, muted: boolean) {
  const seen = useRef<Set<string> | null>(null)
  const { quietCelebrations } = usePrefs()
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(crew.awards.map((a) => a.id))
      return
    }
    const fresh = crew.awards.filter((a) => !seen.current!.has(a.id))
    for (const a of fresh) seen.current.add(a.id)
    // The demo's autopilot plays the kitchen: its wins are counted but not celebrated.
    if (!fresh.length || muted || quietCelebrations) return
    const big = fresh.filter((a) => a.kind !== 'xp')
    if (!big.length) return haptic.done()
    haptic.celebrate()
    for (const a of big) toast.success(a.kind === 'badge' ? `Badge earned: ${a.title}` : `New rank: ${a.title}`, { description: a.detail, duration: 5000 })
    if (!document.documentElement.dataset.motion?.startsWith('reduce')) void confetti({ particleCount: 70, spread: 65, origin: { y: 0.3 }, colors: ['#d34f2f', '#ec7a3a', '#f4c26b', '#34251d', '#2f8a5f'], disableForReducedMotion: true, zIndex: 60 })
  }, [crew.awards, muted, quietCelebrations])
}

export function CrewCard({ crew, muted = false, className }: { crew: CrewView; muted?: boolean; className?: string }) {
  useCrewCelebrations(crew, muted)
  const { level, goal } = crew
  const done = goal.done >= goal.target
  const kitchen = crew.kind === 'kitchen'
  const [open, setOpen] = useState(false)
  const earned = crew.badges.filter((b) => b.earnedAt !== null).length
  return (
    <section className={cn('@container rounded-2xl border bg-card p-4', className)} aria-label={kitchen ? 'Kitchen team game' : 'Floor team game'}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-2 text-primary-foreground shadow-md shadow-primary/20" aria-hidden>
          <Crown className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight">{level.title}</div>
          <div className="text-xs text-muted-foreground tabular">
            {crew.xp} XP{level.next ? ` · ${level.next - crew.xp} to ${level.nextTitle}` : ' · top rank'}
          </div>
        </div>
        {kitchen && (
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular', crew.streak >= 3 ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground')} title="Dishes in a row sent out on time">
            <Flame className={cn('size-3.5', crew.streak >= 3 && 'pulse-soft')} /> {crew.streak}
            <span className="sr-only"> dishes in a row on time</span>
          </span>
        )}
      </div>
      <Progress value={Math.round(level.progress * 100)} className="mt-3 h-1.5" aria-label="Progress to the next rank" />

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className={cn(done && 'font-medium text-good')}>{goal.title}</span>
          <span className="tabular text-xs text-muted-foreground">
            {goal.done}/{goal.target}
          </span>
        </div>
        <Progress value={(goal.done / goal.target) * 100} className="mt-1.5 h-2" aria-label={goal.title} />
        <p className="mt-1.5 text-xs text-muted-foreground">{done ? 'Goal reached. Brilliant teamwork.' : kitchen ? `Best streak tonight: ${crew.bestStreak}. A late dish only resets the streak, nothing else.` : 'Every handover, note and thank-you counts. This is about the team, not a ranking.'}</p>
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Star className="size-3.5" /> Badges {earned}/{crew.badges.length}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.215, 0.61, 0.355, 1] }} className="mt-2 grid grid-cols-3 gap-2 overflow-hidden @xl:grid-cols-5">
            {crew.badges.map((b) => {
              const Icon = BADGE_ICONS[b.icon] ?? Star
              const got = b.earnedAt !== null
              return (
                <li key={b.id} className={cn('flex flex-col items-center rounded-xl border p-2 text-center', got ? 'bg-card' : 'bg-muted/40')}>
                  <span className={cn('relative grid size-9 place-items-center rounded-full', got ? 'bg-gradient-to-br from-primary to-primary-2 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    <Icon className="size-4.5" />
                    {!got && <Lock className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-background p-0.5" />}
                  </span>
                  <span className={cn('mt-1.5 text-[11px] font-medium leading-tight', !got && 'text-muted-foreground')}>{b.title}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{got ? b.description : `${b.progress}/${b.target}`}</span>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}
