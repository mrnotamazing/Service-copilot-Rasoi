import { Accessibility, CakeSlice, ChefHat, DoorOpen, HeartPulse, Star } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { TableState, Task } from '../../shared/types.ts'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/index.ts'
import { STATUS_PROGRESS } from '../lib/format.ts'
import { MOOD_TONE, Reaction } from './Reaction.tsx'

/** Where chairs go around a table, by number of seats (as % of the table box). */
function chairs(seats: number): CSSProperties[] {
  const top = (x: number): CSSProperties => ({ left: `${x}%`, top: 0, transform: 'translate(-50%, -135%)' })
  const bottom = (x: number): CSSProperties => ({ left: `${x}%`, bottom: 0, transform: 'translate(-50%, 135%)' })
  const left: CSSProperties = { left: 0, top: '50%', transform: 'translate(-135%, -50%) rotate(90deg)' }
  const right: CSSProperties = { right: 0, top: '50%', transform: 'translate(135%, -50%) rotate(90deg)' }
  if (seats <= 2) return [left, right]
  if (seats <= 4) return [top(50), bottom(50), left, right]
  if (seats <= 6) return [top(30), top(70), bottom(30), bottom(70), left, right]
  return [top(20), top(50), top(80), bottom(20), bottom(50), bottom(80), left, right]
}

/** Fallback layout for tables without a saved position: a tidy grid. */
function autoPos(i: number, n: number) {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { x: ((i % cols) + 0.5) * (100 / cols), y: 18 + ((Math.floor(i / cols) + 0.5) * 70) / rows }
}

/**
 * The section as a room: the kitchen pass at the top, the entrance at the bottom, every table
 * drawn to its size with chairs. Each table shows its state, how many things it needs, guest
 * flags and the last mood. Tapping a table opens everything about it.
 */
export function FloorPlan({ snap, tables, tasks, picked, onPick, compact }: { snap: Snapshot; tables: TableState[]; tasks: Task[]; picked?: string; onPick: (id: string) => void; compact?: boolean }) {
  const t = useT()
  const defs = snap.config.tables
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-3xl border bg-card', compact ? 'aspect-[5/4]' : 'aspect-[16/11]')}
      style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1.2px)', backgroundSize: '18px 18px' }}
      role="group"
      aria-label={t('tables.mySection')}
    >
      {/* Landmarks so "next door" and "the pass" mean something on screen */}
      <div className="absolute inset-x-0 top-0 flex justify-center">
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <ChefHat className="size-3.5 text-kitchen" /> {t('floor.pass')}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <DoorOpen className="size-3.5" /> {t('floor.entrance')}
        </span>
      </div>

      {tables.map((table, i) => {
        const pos = defs.find((d) => d.id === table.id)?.pos ?? autoPos(i, tables.length)
        const open = tasks.filter((k) => k.tableId === table.id).length
        const free = table.status === 'available'
        const late = table.lines.some((l) => l.status === 'fired' && snap.now > l.expectedReadyAt)
        const seats = table.seats
        const shape = seats <= 2 ? 'size-14 rounded-full' : seats <= 4 ? 'size-[4.25rem] rounded-2xl' : 'h-[4.25rem] w-28 rounded-2xl'
        const tone = free
          ? 'border-dashed bg-background text-muted-foreground'
          : table.status === 'bill' || table.status === 'paid'
            ? 'border-warn/50 bg-warn/12'
            : table.status === 'needs_reset'
              ? 'bg-muted'
              : 'border-primary/40 bg-primary/12'
        const minutes = table.seatedAt && !free ? Math.max(1, Math.round((snap.now - table.seatedAt) / 60_000)) : null
        const label = [table.name, t.any(`status.${table.status}`), open ? t('table.tasks', { n: open }) : ''].filter(Boolean).join(', ')
        return (
          <button
            key={table.id}
            type="button"
            onClick={() => onPick(table.id)}
            aria-pressed={picked === table.id}
            aria-label={label}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl p-1 outline-none"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <span
              className={cn(
                'relative grid place-items-center border-2 transition-all group-hover:scale-[1.04] group-focus-visible:ring-2 group-focus-visible:ring-ring',
                shape,
                tone,
                picked === table.id && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
              )}
            >
              {chairs(seats).map((style, c) => (
                <span key={c} className={cn('absolute h-1.5 w-4 rounded-full', free ? 'bg-border' : 'bg-primary/35')} style={style} aria-hidden />
              ))}
              <span className="text-center leading-tight">
                <span className="block font-display text-base">{table.name}</span>
                <span className="block text-[10px] text-muted-foreground">{t.any(`status.${table.status}`)}</span>
              </span>
              {/* How far through the visit */}
              {!free && (
                <span className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-background/70" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(STATUS_PROGRESS[table.status] ?? 0) * 100}%` }} />
                </span>
              )}
              {open > 0 && (
                <span className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow tabular" aria-hidden>
                  {open}
                </span>
              )}
              <span className="absolute -right-2 -top-2 flex gap-0.5 rounded-full bg-card/90 px-0.5" aria-hidden>
                {table.party?.allergies.length ? <HeartPulse className="size-3.5 text-warn" /> : null}
                {table.party?.needs?.length ? <Accessibility className="size-3.5 text-primary" /> : null}
                {table.party?.occasion ? <CakeSlice className="size-3.5 text-primary" /> : null}
                {table.party?.vip ? <Star className="size-3.5 text-primary" /> : null}
              </span>
              {table.mood && (
                <span className={cn('absolute -bottom-2 -right-2 rounded-full bg-card', MOOD_TONE[table.mood.value])} aria-hidden>
                  <Reaction mood={table.mood.value} filled className="size-5" />
                </span>
              )}
              {late && <span className="absolute -bottom-1 -left-1 size-2.5 rounded-full bg-kitchen pulse-soft" aria-hidden />}
            </span>
            <span className="text-[10px] text-muted-foreground tabular">{minutes ? t('tile.min', { n: minutes }) : t('tile.seats', { n: seats })}</span>
          </button>
        )
      })}
    </div>
  )
}
