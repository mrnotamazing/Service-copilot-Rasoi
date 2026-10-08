// The server's side of the reasoning layer: why the top card comes first, help with an upset
// guest built from the table's real situation, and a private learning journey.

import { ArrowDownRight, ArrowRight, ArrowUpRight, Compass, Drama, GraduationCap, LifeBuoy, Loader2, Lock, RotateCcw, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { LearningPlan } from '../../shared/intel.ts'
import type { TaskText } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { useAi, type AiAnswer } from '../lib/ai.ts'
import { AiAnswerBox } from './AiAnswer.tsx'
import { AssistantDrawer } from './Practice.tsx'

/** A suggestion explained is easier to trust, and easier to overrule when you know better. */
export function WhyFirst({ why }: { why?: TaskText[] }) {
  const t = useT()
  if (!why?.length) return null
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs" aria-label={t('why.title')}>
      <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
        <Compass className="size-3.5 text-primary" aria-hidden /> {t('why.title')}:
      </span>
      {why.map((w, i) => (
        <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          {t.text(w)}
        </span>
      ))}
    </div>
  )
}

/** "Guest upset? Get help": what to say and do, from what is really happening at this table. */
export function ComplaintHelp({ tableId, staffId }: { tableId: string; staffId: string }) {
  const t = useT()
  const ai = useAi()
  const [open, setOpen] = useState(false)
  const ask = () => {
    setOpen(true)
    void ai.ask('complaint', { tableId, staffId })
  }
  if (!open)
    return (
      <Button variant="outline" className="mt-3 h-11 w-full rounded-xl" onClick={ask}>
        <LifeBuoy /> {t('complaint.button')}
      </Button>
    )
  return (
    <section className="mt-3 rounded-xl border border-primary/30 bg-card p-3" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 font-medium">
            <LifeBuoy className="size-4 text-primary" /> {t('complaint.title')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('complaint.sub')}</p>
        </div>
        <Button size="sm" variant="ghost" className="h-8 shrink-0" disabled={ai.loading} onClick={ask} aria-label={t('complaint.again')}>
          {ai.loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        </Button>
      </div>
      {ai.loading && !ai.answer ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 animate-pulse text-primary" /> {t('chat.thinking')}
        </p>
      ) : (
        <AiAnswerBox answer={ai.answer as AiAnswer | null} error={ai.error} className="mt-2" />
      )}
    </section>
  )
}

const TREND = {
  up: { Icon: ArrowUpRight, key: 'journey.up', tone: 'text-good' },
  down: { Icon: ArrowDownRight, key: 'journey.down', tone: 'text-warn' },
  flat: { Icon: ArrowRight, key: 'journey.flat', tone: 'text-muted-foreground' },
} as const

/** Private: practice over time, practice picked from tonight's real service, and one habit to focus on. */
export function LearningJourney({ plan, staffId, provider }: { plan?: LearningPlan; staffId: string; provider: AiAnswer['source'] }) {
  const t = useT()
  const [scenario, setScenario] = useState<string | null>(null)
  if (!plan) return null
  const tried = plan.skills.filter((s) => s.replies > 0)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <GraduationCap className="size-5 text-primary" /> {t('journey.title')}
      </h2>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> {t('journey.sub')}
      </p>

      {tried.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('journey.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {plan.skills.map((s) => {
            const trend = s.trend ? TREND[s.trend] : null
            return (
              <li key={s.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{t(`skill.${s.id}` as Key)}</span>
                  <span className="text-xs text-muted-foreground tabular">{s.replies ? t('journey.replies', { n: s.replies }) : '–'}</span>
                </div>
                {s.latest !== null && (
                  <div className="mt-1 flex items-center gap-2">
                    {/* First score as a faint marker, latest as the bar: progress at a glance. */}
                    <div className="relative h-2 flex-1 rounded-full bg-muted" role="img" aria-label={`${s.first} → ${s.latest} / 100`}>
                      <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${s.latest}%` }} transition={{ duration: 0.6 }} />
                      {s.first !== null && s.first !== s.latest && <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-foreground/60" style={{ left: `${s.first}%` }} aria-hidden />}
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs tabular">
                      {s.first !== s.latest && <span className="text-muted-foreground">{s.first}→</span>}
                      <b className="font-semibold">{s.latest}</b>
                    </span>
                    {trend && (
                      <span className={cn('inline-flex w-24 shrink-0 items-center gap-0.5 text-xs', trend.tone)}>
                        <trend.Icon className="size-3.5" aria-hidden /> {t(trend.key)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {plan.focus && (
        <div className="mt-4 rounded-xl bg-accent/60 p-3 text-sm">
          <div className="mb-0.5 text-xs font-medium text-muted-foreground">{t('journey.focus')}</div>
          {t.text(plan.focus.text)}
        </div>
      )}

      {plan.recommended.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-4 text-sm font-medium">{t('journey.suggested')}</h3>
          <ul className="space-y-2">
            {plan.recommended.map((r) => (
              <li key={r.scenario} className="flex items-center gap-3 rounded-xl border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t(`sc.${r.scenario}` as Key)}</div>
                  <div className="text-xs text-muted-foreground">{t.text(r.why)}</div>
                </div>
                <Button size="sm" variant="secondary" className="h-9 shrink-0 rounded-lg" onClick={() => setScenario(r.scenario)}>
                  <Drama /> {t('journey.practise')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <AssistantDrawer open={!!scenario} onOpenChange={(o) => !o && setScenario(null)} staffId={staffId} provider={provider} initialMode="practice" initialScenario={scenario ?? undefined} />
    </section>
  )
}
