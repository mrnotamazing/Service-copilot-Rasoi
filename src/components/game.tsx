import confetti from 'canvas-confetti'
import { Crown, Flame, Hand, HeartHandshake, Lock, Megaphone, Shield, ShieldCheck, Sparkles, Star, Sun, Timer, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Award, PlayerView } from '../../shared/game.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { haptic } from '../lib/haptics.ts'

export const BADGE_ICONS: Record<string, typeof Hand> = { Hand, Sun, ShieldCheck, Megaphone, Flame, Timer, Sparkles, HeartHandshake, Crown }

/** Avatar wrapped in a ring that fills toward the next rank. */
export function LevelRing({ name, color, progress, level, size = 44 }: { name: string; color: string; progress: number; level: number; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.02, progress) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <span className="absolute inset-[5px] grid place-items-center rounded-full font-display text-base text-white" style={{ background: color }}>
        {name[0]}
      </span>
      <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground tabular">
        {level}
      </span>
    </div>
  )
}

export function StreakChip({ streak, shields }: { streak: number; shields: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary" title={`Streak: ${streak} tables to standard. Shields: ${shields}`}>
      <Flame className={cn('size-3.5', streak > 0 && 'fill-primary/30')} />
      <span className="tabular">{streak}</span>
      {shields > 0 && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 text-good">
          <Shield className="size-3.5" />
          <span className="tabular">{shields}</span>
        </span>
      )}
    </span>
  )
}

export function BadgeTile({ b }: { b: PlayerView['badges'][number] }) {
  const Icon = BADGE_ICONS[b.icon] ?? Star
  const earned = b.earnedAt !== null
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border p-3 text-center', earned ? 'bg-card' : 'bg-muted/40')}>
      <span className={cn('relative grid size-12 place-items-center rounded-full', earned ? 'bg-gradient-to-br from-primary to-primary-2 text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-6" />
        {!earned && <Lock className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-background p-0.5" />}
      </span>
      <span className={cn('mt-2 text-xs font-medium leading-tight', !earned && 'text-muted-foreground')}>{b.title}</span>
      <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{earned ? b.description : `${b.progress}/${b.target}`}</span>
    </div>
  )
}

/**
 * Turns new awards into feedback: a floating "+XP" pill for small wins, a sheet with
 * confetti for badges, ranks and quests. Awards already present on first load are not replayed,
 * and nothing is celebrated while the demo autopilot is playing.
 */
export function Celebrations({ awards, muted = false }: { awards: Award[]; muted?: boolean }) {
  const seen = useRef<Set<string> | null>(null)
  const [pills, setPills] = useState<Award[]>([])
  const [big, setBig] = useState<Award[]>([])

  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(awards.map((a) => a.id))
      return
    }
    const fresh = awards.filter((a) => !seen.current!.has(a.id))
    if (!fresh.length) return
    for (const a of fresh) seen.current.add(a.id)
    // Autopilot's wins are recorded but not celebrated: the person watching didn't earn them.
    if (muted) return
    const small = fresh.filter((a) => a.kind === 'xp' || a.kind === 'kudos' || a.kind === 'shield')
    const large = fresh.filter((a) => a.kind === 'badge' || a.kind === 'level' || a.kind === 'quest')
    if (small.length) {
      haptic.done()
      setPills((p) => [...p, ...small].slice(-3))
      for (const a of small) setTimeout(() => setPills((p) => p.filter((x) => x.id !== a.id)), 2600)
    }
    if (large.length) setBig((b) => [...b, ...large])
  }, [awards, muted])

  const current = big[0]
  useEffect(() => {
    if (!current) return
    haptic.celebrate()
    void confetti({ particleCount: 90, spread: 70, origin: { y: 0.75 }, colors: ['#d34f2f', '#ec7a3a', '#f4c26b', '#34251d', '#2f8a5f'], disableForReducedMotion: true, zIndex: 60 })
  }, [current])

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+76px)] z-40 flex flex-col items-center gap-1.5" aria-live="polite">
        <AnimatePresence>
          {pills.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex items-center gap-2 rounded-full border bg-popover/95 px-3 py-1.5 text-sm shadow-lg backdrop-blur"
            >
              {a.kind === 'shield' ? <Shield className="size-4 text-good" /> : a.kind === 'kudos' ? <HeartHandshake className="size-4 text-primary" /> : <Sparkles className="size-4 text-primary" />}
              {a.xp > 0 && <span className="font-semibold text-primary tabular">+{a.xp} XP</span>}
              <span className="text-muted-foreground">{a.title}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Drawer open={!!current} onOpenChange={(o) => !o && setBig((b) => b.slice(1))}>
        <DrawerContent className="mx-auto max-w-[440px]">
          {current && (
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader className="items-center text-center">
                <motion.span
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className="mb-2 grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-2 text-primary-foreground shadow-xl shadow-primary/30"
                >
                  {current.kind === 'level' ? <Crown className="size-10" /> : current.kind === 'quest' ? <Trophy className="size-10" /> : <Star className="size-10" />}
                </motion.span>
                <p className="text-sm text-muted-foreground">{current.kind === 'level' ? 'You ranked up' : current.kind === 'quest' ? 'Quest complete' : 'Badge unlocked'}</p>
                <DrawerTitle className="font-display text-2xl">{current.kind === 'quest' ? current.detail : current.title}</DrawerTitle>
                <DrawerDescription>{current.kind === 'quest' ? `+${current.xp} XP` : current.detail}</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button size="lg" className="h-11" onClick={() => setBig((b) => b.slice(1))}>
                  Back to service
                </Button>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
