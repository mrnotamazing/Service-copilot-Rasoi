import { BellRing, ChefHat, CircleDollarSign, Clock, Hand, HandPlatter, HeartPulse, Loader2, MessageCircle, Sparkles, Utensils, UtensilsCrossed, Wand2 } from 'lucide-react'
import { motion } from 'motion/react'
import { forwardRef, useState } from 'react'
import { toast } from 'sonner'
import type { Task, TaskKind } from '../../shared/types.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { mmss } from '../lib/format.ts'
import { act } from '../lib/live.ts'
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

const DONE_TOAST: Partial<Record<string, string>> = {
  'allergy.confirmed': 'Allergy sent to the kitchen',
  'note.acked': 'Marked as seen',
  'task.snoozed': 'Moved to later',
}

export const TaskCard = forwardRef<HTMLDivElement, { task: Task; now: number; lead?: boolean; staffId: string }>(function TaskCard({ task, now, lead, staffId }, ref) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const ai = useAi()
  const Icon = ICON[task.kind]
  const left = task.dueAt - now
  const over = left < 0
  const total = Math.max(60_000, task.dueAt - task.createdAt)
  const frac = Math.min(1, Math.max(0, (now - task.createdAt) / total))

  async function run(event: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await act(event, event === 'task.snoozed' ? { ...payload, taskId: task.id, staffId } : payload)
      const msg = DONE_TOAST[event]
      if (msg) toast.success(msg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save that. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={cn('relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs', lead ? 'border-primary/50 p-5 shadow-md shadow-primary/5' : 'p-4')}
    >
      {/* Time against the SOP standard: fills toward the deadline, turns amber after it (never red). */}
      <div className="absolute inset-x-0 top-0 h-1 bg-muted" aria-hidden>
        <div className={cn('h-full transition-[width] duration-1000', over ? 'bg-warn' : 'bg-primary/70')} style={{ width: `${frac * 100}%` }} />
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
              {over ? `${mmss(left)} past standard` : `within ${mmss(left)}`}
            </span>
          </div>
          <h3 className={cn('mt-1.5 font-semibold leading-snug', lead ? 'text-lg' : 'text-base')}>{task.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{task.hint}</p>
          {task.checklist && (
            <ul className="mt-3 grid gap-2">
              {task.checklist.map((c, i) => (
                <li key={c} className="flex items-center gap-2.5 text-sm">
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

      <div className="mt-4 flex flex-wrap gap-2">
        {task.actions.map((a) => (
          <Button key={a.label} size="lg" disabled={busy} variant={a.primary ? 'default' : 'secondary'} className="h-11 flex-1 text-sm font-semibold" onClick={() => run(a.event, a.payload)}>
            {a.label}
          </Button>
        ))}
        {GUEST_FACING.includes(task.kind) && ai.answer?.source !== 'built-in' && (
          <Button size="lg" variant="outline" className="h-11" disabled={ai.loading} onClick={() => ai.ask('guest_script', { taskId: task.id, staffId })}>
            {ai.loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {ai.answer ? 'Another line' : 'What do I say?'}
          </Button>
        )}
        {task.actions.every((a) => a.event !== 'task.snoozed') && (
          <Button size="lg" variant="ghost" className="h-11 text-muted-foreground" disabled={busy} onClick={() => run('task.snoozed', { minutes: 2 })}>
            Later
          </Button>
        )}
      </div>
    </motion.article>
  )
})
