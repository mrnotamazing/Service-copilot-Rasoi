import { BellRing, Check, ChefHat, CircleDollarSign, Clock, Hand, HandPlatter, HeartPulse, Loader2, MessageCircle, Sparkles, TimerReset, Utensils, UtensilsCrossed, Volume2, Wand2 } from 'lucide-react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { forwardRef, useState } from 'react'
import { toast } from 'sonner'
import type { Task, TaskKind } from '../../shared/types.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { useAi } from '../lib/ai.ts'
import { mmss } from '../lib/format.ts'
import { haptic } from '../lib/haptics.ts'
import { act } from '../lib/live.ts'
import { usePrefs } from '../lib/prefs.ts'
import { speak } from '../lib/speech.ts'
import { AiAnswerBox } from './AiAnswer.tsx'

const ICON: Record<TaskKind, typeof Hand> = {
  greet: Hand,
  take_order: Utensils,
  allergy: HeartPulse,
  unavailable: UtensilsCrossed,
  kitchen_delay: ChefHat,
  pickup: HandPlatter,
  checkback: MessageCircle,
  clear_course: Sparkles,
  present_bill: CircleDollarSign,
  farewell: Hand,
  reset: Sparkles,
  kitchen_message: BellRing,
}

/** Cards where the server talks to a guest: offer a suggested line. */
const GUEST_FACING: TaskKind[] = ['greet', 'kitchen_delay', 'unavailable', 'farewell']

const DONE_TOAST: Partial<Record<string, Key>> = {
  'allergy.confirmed': 'toast.allergy',
  'note.acked': 'toast.acked',
  'task.snoozed': 'toast.snoozed',
}

/** A card's words in the device's language. Older events without text keys fall back to the English the engine wrote. */
export function useTaskWords(task: Task) {
  const t = useT()
  return {
    title: task.text ? t.text(task.text.title) : task.title,
    hint: task.text ? t.text(task.text.hint) : task.hint,
    checklist: task.text?.checklist ? task.text.checklist.map((c) => t.any(c)) : task.checklist,
    action: (kind: string, fallback: string) => (task.text ? t.any(`action.${kind}`) : fallback),
  }
}

export const TaskCard = forwardRef<HTMLDivElement, { task: Task; now: number; lead?: boolean; staffId: string }>(function TaskCard({ task, now, lead, staffId }, ref) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const ai = useAi()
  const t = useT()
  const prefs = usePrefs()
  const words = useTaskWords(task)
  const Icon = ICON[task.kind]
  const left = task.dueAt - now
  const over = left < 0
  const total = Math.max(60_000, task.dueAt - task.createdAt)
  const frac = Math.min(1, Math.max(0, (now - task.createdAt) / total))

  // Swipe right to do the primary action, left to push it to later. Buttons stay as the tap/keyboard path.
  const x = useMotionValue(0)
  const doneOpacity = useTransform(x, [20, 110], [0, 1])
  const laterOpacity = useTransform(x, [-110, -20], [1, 0])
  const primary = task.actions.find((a) => a.primary) ?? task.actions[0]
  const SWIPE = 110

  async function run(event: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      if (event !== 'task.snoozed') haptic.done()
      await act(event, event === 'task.snoozed' ? { ...payload, taskId: task.id, staffId } : payload)
      const msg = DONE_TOAST[event]
      if (msg) toast.success(t(msg))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="relative"
    >
      {/* What a swipe will do, revealed under the card. */}
      <motion.div style={{ opacity: doneOpacity }} className="absolute inset-0 flex items-center rounded-2xl bg-good/90 pl-6 text-sm font-semibold text-background" aria-hidden>
        <Check className="mr-2 size-5" /> {primary && words.action(task.kind, primary.label)}
      </motion.div>
      <motion.div style={{ opacity: laterOpacity }} className="absolute inset-0 flex items-center justify-end rounded-2xl bg-muted pr-6 text-sm font-semibold text-muted-foreground" aria-hidden>
        {t('card.later')} <TimerReset className="ml-2 size-5" />
      </motion.div>
    <motion.article
      drag={busy ? false : 'x'}
      dragDirectionLock
      dragSnapToOrigin
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x, touchAction: 'pan-y' }}
      whileTap={{ scale: 0.995 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE && primary) void run(primary.event, primary.payload)
        else if (info.offset.x < -SWIPE) void run('task.snoozed', { minutes: 2 })
      }}
      className={cn('relative cursor-grab overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs active:cursor-grabbing', lead ? 'border-primary/50 p-5 shadow-md shadow-primary/5' : 'p-4')}
    >
      {/* Time against the SOP standard: fills toward the deadline, turns amber after it (never red). */}
      <div className="absolute inset-x-0 top-0 h-1 bg-muted" aria-hidden>
        <div className={cn('h-full origin-left transition-transform duration-1000 ease-linear', over ? 'bg-warn' : 'bg-primary/70')} style={{ transform: `scaleX(${frac})` }} />
      </div>

      <div className="flex items-start gap-3">
        <div className={cn('grid shrink-0 place-items-center rounded-xl', lead ? 'size-12 bg-primary/15 text-primary' : 'size-10 bg-muted text-muted-foreground')}>
          <Icon className={lead ? 'size-6' : 'size-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {task.tableName !== 'All' && <Badge variant="secondary" className="font-semibold">{task.tableName}</Badge>}
            <span className={cn('inline-flex items-center gap-1 text-xs tabular', over ? 'text-warn' : 'text-muted-foreground')}>
              <Clock className="size-3" />
              {over ? t('card.past', { t: mmss(left) }) : t('card.within', { t: mmss(left) })}
            </span>
            <button
              type="button"
              onClick={() => speak(`${task.tableName !== 'All' ? task.tableName + '. ' : ''}${words.title}. ${words.hint}`)}
              className="-my-1 ml-auto grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('card.read')}
              title={t('card.read')}
            >
              <Volume2 className="size-4" />
            </button>
          </div>
          <h3 className={cn('mt-1.5 font-semibold leading-snug', lead ? 'text-lg' : 'text-base')}>{words.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{words.hint}</p>
          {words.checklist && (
            <ul className="mt-3 grid gap-2">
              {words.checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Checkbox id={`${task.id}-${i}`} checked={!!done[i]} onCheckedChange={(v) => setDone({ ...done, [i]: v === true })} />
                  <label htmlFor={`${task.id}-${i}`} className={cn('cursor-pointer', done[i] && 'text-muted-foreground line-through')}>
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <AiAnswerBox answer={ai.answer} error={ai.error} quote className="mt-3" />
        </div>
      </div>

      {/* Main button sits under the thumb: right by default, left in the left-handed layout. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {task.actions.map((a) => (
          <Button key={a.label} size="lg" disabled={busy} variant={a.primary ? 'default' : 'secondary'} className={cn('h-11 flex-1 text-sm font-semibold', a.primary && (prefs.leftHanded ? 'order-first' : 'order-last'))} onClick={() => run(a.event, a.payload)}>
            {words.action(task.kind, a.label)}
          </Button>
        ))}
        {GUEST_FACING.includes(task.kind) && ai.answer?.source !== 'built-in' && (
          <Button size="lg" variant="outline" className="h-11" disabled={ai.loading} onClick={() => ai.ask('guest_script', { taskId: task.id, staffId })}>
            {ai.loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {ai.answer ? t('card.another') : t('card.whatSay')}
          </Button>
        )}
        {task.actions.every((a) => a.event !== 'task.snoozed') && (
          <Button size="lg" variant="ghost" className="h-11 text-muted-foreground" disabled={busy} onClick={() => run('task.snoozed', { minutes: 2 })}>
            {t('card.later')}
          </Button>
        )}
      </div>
    </motion.article>
    </motion.div>
  )
})
