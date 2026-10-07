import { Bell, BellRing, ChefHat, CircleDollarSign, Clock, Hand, HandPlatter, HeartPulse, MessageCircle, Sparkles, Utensils, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import type { Task, TaskKind } from '../../shared/types.ts'
import { act } from '../lib/live.ts'
import { mmss } from '../lib/format.ts'

const ICON: Record<TaskKind, typeof Bell> = {
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

export function TaskCard({ task, now, lead, staffId }: { task: Task; now: number; lead?: boolean; staffId: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const Icon = ICON[task.kind]
  const left = task.dueAt - now
  const over = left < 0
  const total = Math.max(60_000, task.dueAt - task.createdAt)
  const frac = Math.min(1, Math.max(0, (now - task.createdAt) / total))

  async function run(event: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await act(event, event === 'task.snoozed' ? { ...payload, taskId: task.id, staffId } : payload)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`card-in relative overflow-hidden rounded-2xl border bg-surface ${lead ? 'border-saffron/60 p-5' : 'border-line p-4'}`}>
      {/* time-to-standard bar: fills toward the SOP time, warm amber once past it (never red) */}
      <div className="absolute inset-x-0 top-0 h-1 bg-line">
        <div className={`h-full transition-[width] duration-1000 ${over ? 'bg-warn' : 'bg-saffron/70'}`} style={{ width: `${frac * 100}%` }} />
      </div>
      <div className="flex items-start gap-3">
        <div className={`grid shrink-0 place-items-center rounded-xl ${lead ? 'size-12 bg-saffron/15 text-saffron' : 'size-10 bg-raised text-muted'}`}>
          <Icon className={lead ? 'size-6' : 'size-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            {task.tableName !== 'All' && <span className="rounded-md bg-raised px-1.5 py-0.5 font-semibold text-ink">{task.tableName}</span>}
            <span className={`inline-flex items-center gap-1 ${over ? 'text-warn' : ''}`}>
              <Clock className="size-3" />
              {over ? `${mmss(left)} past standard` : `within ${mmss(left)}`}
            </span>
          </div>
          <h3 className={`mt-1 font-semibold leading-snug ${lead ? 'text-lg' : 'text-base'}`}>{task.title}</h3>
          <p className="mt-1 text-sm text-muted">{task.hint}</p>
          {task.checklist && (
            <ul className="mt-2 space-y-1">
              {task.checklist.map((c, i) => (
                <li key={c}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--color-saffron)]" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
                    <span className={done[i] ? 'text-faint line-through' : ''}>{c}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {task.actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={busy}
            onClick={() => run(a.event, a.payload)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 ${a.primary ? 'bg-saffron text-bg hover:brightness-110' : 'bg-raised hover:bg-line'}`}
          >
            {a.label}
          </button>
        ))}
        {task.actions.every((a) => a.event !== 'task.snoozed') && (
          <button type="button" disabled={busy} onClick={() => run('task.snoozed', { minutes: 2 })} className="rounded-xl px-4 py-3 text-sm text-muted hover:bg-raised hover:text-ink">
            Later
          </button>
        )}
      </div>
    </article>
  )
}
