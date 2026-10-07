import { ChefHat, Lightbulb, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import type { Snapshot } from '../../shared/snapshot.ts'
import { segmentsFor } from '../../shared/engine.ts'
import type { Segment } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { useAi } from '../lib/ai.ts'
import { mmss } from '../lib/format.ts'
import { useAwardText } from './game.tsx'
import { MOOD_TONE, Reaction } from './Reaction.tsx'

const MIN = 60_000
const FLOOR_STAGES: Segment['stage'][] = ['greet', 'pickup', 'bill', 'reset']

/** Per step of service, from this server's own tables (finished and still going): average time against the standard. */
function stageInsights(all: Segment[]) {
  return FLOOR_STAGES.map((stage) => {
    const segs = all.filter((s) => s.stage === stage && s.owner === 'floor')
    const avg = segs.length ? segs.reduce((a, s) => a + (s.end - s.start), 0) / segs.length : 0
    const std = segs.length ? (segs.reduce((a, s) => a + s.targetMin, 0) / segs.length) * MIN : 0
    return { stage, n: segs.length, lapses: segs.filter((s) => s.lapse).length, avg, std }
  }).filter((s) => s.n > 0)
}

/**
 * "Your shift, wrapped": a private debrief. Numbers, where the time went step by step,
 * the strongest step and the one to work on, and one tip from the coach. Only this server sees it.
 */
export function ShiftRecap({ snap, staffId, open, onOpenChange }: { snap: Snapshot; staffId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const words = useAwardText()
  const coach = useAi()
  const me = snap.me!
  const game = me.game!
  const { player, level } = game
  const visits = me.myVisits
  // Steps already finished at tables still being served count too, so insights appear early in the shift.
  const live = snap.tables.filter((t) => t.serverId === staffId && t.visitId).flatMap((t) => segmentsFor(t, snap.config))
  const segments = [...visits.flatMap((v) => v.segments), ...live]
  const stages = stageInsights(segments)
  // Praise only a step that beat its standard; point at the one that most often ran over.
  const best = [...stages].filter((s) => s.avg <= s.std).sort((a, b) => a.avg / a.std - b.avg / b.std)[0]
  const focus = [...stages].filter((s) => s.lapses > 0).sort((a, b) => b.lapses / b.n - a.lapses / a.n)[0]
  const kitchenLate = segments.filter((s) => s.owner === 'kitchen' && s.lapse).length
  const moods = visits.filter((v) => v.mood)
  const happy = moods.filter((v) => v.mood === 'happy').length
  const earned = game.badges.filter((b) => b.earnedAt !== null).length
  const stageName = (s: string) => t(`stage.${s}` as Key)

  // The coach's tip is fetched when the recap opens, so it is ready by the time it is read.
  useEffect(() => {
    if (open && !coach.answer && !coach.loading) void coach.ask('coach', { staffId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-xl">
        <DrawerHeader className="text-center">
          <DrawerDescription>{t('recap.title')}</DrawerDescription>
          <DrawerTitle className="font-display text-3xl">{words.rank(level.index)}</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={player.xp} label={t('recap.xp')} />
            <Stat value={`${me.stats?.smoothTables ?? 0}/${me.stats?.completedTables ?? 0}`} label={t('recap.smooth')} />
            <Stat value={player.bestStreak} label={t('recap.bestStreak')} />
            <Stat value={player.counters.safety ?? 0} label={t('recap.safety')} />
            <Stat value={player.counters.recoveries ?? 0} label={t('recap.wonBack')} />
            <Stat value={earned} label={t('recap.badges')} />
          </div>

          {stages.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">{t('recap.noData')}</p>
          ) : (
            <>
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <TrendingUp className="size-4 text-primary" /> {t('recap.where')}
                </h3>
                <ul className="space-y-3">
                  {stages.map((s) => {
                    const max = Math.max(s.avg, s.std) * 1.15
                    const over = s.avg > s.std
                    return (
                      <li key={s.stage}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span>{stageName(s.stage)}</span>
                          <span className={cn('text-xs tabular', over ? 'text-warn' : 'text-muted-foreground')}>{t('recap.vs', { avg: mmss(s.avg), std: mmss(s.std) })}</span>
                        </div>
                        <div className="relative mt-1 h-2 rounded-full bg-muted" role="img" aria-label={`${stageName(s.stage)}: ${t('recap.vs', { avg: mmss(s.avg), std: mmss(s.std) })}`}>
                          <div className={cn('h-full rounded-full', over ? 'bg-warn' : 'bg-good')} style={{ width: `${(s.avg / max) * 100}%` }} />
                          {/* The standard, as a tick on the bar */}
                          <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-foreground/60" style={{ left: `${(s.std / max) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" /> {t('recap.insights')}
                </h3>
                {best && <Insight icon={<TrendingUp className="size-4 text-good" />}>{t('recap.fastest', { stage: stageName(best.stage), avg: mmss(best.avg), std: mmss(best.std) })}</Insight>}
                {focus && <Insight icon={<Lightbulb className="size-4 text-primary" />}>{t('recap.focus', { stage: stageName(focus.stage), n: focus.lapses, m: focus.n })}</Insight>}
                {moods.length > 0 && (
                  <Insight icon={<Reaction mood="happy" filled className={cn('size-4', MOOD_TONE.happy)} />}>{t('recap.happy', { n: happy, m: moods.length })}</Insight>
                )}
                <Insight icon={<ChefHat className="size-4 text-kitchen" />}>{kitchenLate ? t('recap.kitchenAbsorbed', { n: kitchenLate }) : t('recap.note')}</Insight>
              </section>
            </>
          )}

          <section className="rounded-2xl border border-primary/30 bg-accent/60 p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="size-4 text-primary" /> {t('recap.next')}
            </h3>
            {coach.loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <p className="whitespace-pre-line text-sm leading-relaxed">{coach.answer?.text ?? coach.error}</p>}
          </section>
        </div>
        <DrawerFooter>
          <Button size="lg" className="h-11" onClick={() => onOpenChange(false)}>
            {t('common.done')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3 text-center">
      <div className="font-display text-2xl tabular">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  )
}

function Insight({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}
