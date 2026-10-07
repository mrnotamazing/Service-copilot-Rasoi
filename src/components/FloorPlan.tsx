import { Accessibility, CakeSlice, ChefHat, HeartPulse, Star } from 'lucide-react'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { TableState, Task } from '../../shared/types.ts'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/index.ts'
import { STATUS_PROGRESS } from '../lib/format.ts'
import { MOOD_TONE, Reaction } from './Reaction.tsx'

// A top-down seating chart, drawn in SVG units and overlaid with HTML for text and taps.
const W = 400
const CHAIR_GAP = 7 // between table edge and chair
const CHAIR_DEPTH = 13 // seat + back

/** Table top size by seats: round two-top, square four-top, long tables for six and eight. */
function topSize(seats: number) {
  if (seats <= 2) return { w: 50, h: 50, round: true }
  if (seats <= 4) return { w: 56, h: 56, round: false }
  if (seats <= 6) return { w: 104, h: 54, round: false }
  return { w: 140, h: 54, round: false }
}

/** Chair centres and facing (0 = above the table, back on the outside) around a table top. */
function chairSpots(seats: number, w: number, h: number) {
  const dy = h / 2 + CHAIR_GAP + CHAIR_DEPTH / 2
  const dx = w / 2 + CHAIR_GAP + CHAIR_DEPTH / 2
  const top = (x: number) => ({ x, y: -dy, rot: 0 })
  const bottom = (x: number) => ({ x, y: dy, rot: 180 })
  const left = { x: -dx, y: 0, rot: -90 }
  const right = { x: dx, y: 0, rot: 90 }
  if (seats <= 2) return [left, right]
  if (seats <= 4) return [top(0), right, bottom(0), left]
  if (seats <= 6) return [top(-w / 4), top(w / 4), right, bottom(w / 4), bottom(-w / 4), left]
  return [top(-w / 3), top(0), top(w / 3), right, bottom(w / 3), bottom(0), bottom(-w / 3), left]
}

/** Fallback layout for tables without a saved position: a tidy grid. */
function autoPos(i: number, n: number) {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { x: ((i % cols) + 0.5) * (100 / cols), y: 22 + ((Math.floor(i / cols) + 0.5) * 62) / rows }
}

function fillFor(t: TableState) {
  if (t.status === 'available') return 'var(--background)'
  if (t.status === 'needs_reset') return 'url(#fp-hatch)'
  if (t.status === 'bill' || t.status === 'paid') return 'color-mix(in oklab, var(--warn) 16%, var(--card))'
  return 'color-mix(in oklab, var(--primary) 13%, var(--card))'
}

/**
 * The section as a room: the kitchen pass at the top, the door at the bottom, a service aisle
 * between them, and each table drawn as furniture. Chairs fill in for every seated guest, the
 * table's edge traces how far the meal has come, and badges show what the table needs.
 */
export function FloorPlan({ snap, tables, tasks, picked, onPick, compact }: { snap: Snapshot; tables: TableState[]; tasks: Task[]; picked?: string; onPick: (id: string) => void; compact?: boolean }) {
  const t = useT()
  const H = compact ? 320 : 280
  const defs = snap.config.tables
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  const items = tables.map((table, i) => {
    const pos = defs.find((d) => d.id === table.id)?.pos ?? autoPos(i, tables.length)
    const size = topSize(table.seats)
    return { table, cx: (pos.x / 100) * W, cy: (pos.y / 100) * H, ...size }
  })

  return (
    <div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <pattern id="fp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--muted)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="2.5" />
            </pattern>
          </defs>

          {/* Room: floor and walls, with the door cut into the bottom wall */}
          <rect x="3" y="3" width={W - 6} height={H - 6} rx="22" fill="var(--card)" stroke="var(--border)" strokeWidth="3" />
          <rect x={W / 2 - 26} y={H - 8} width="52" height="10" fill="var(--card)" />
          <path d={`M ${W / 2 - 26} ${H - 3} L ${W / 2 - 26} ${H - 41}`} stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${W / 2 - 26} ${H - 41} A 38 38 0 0 1 ${W / 2 + 12} ${H - 3}`} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="2 4" />

          {/* Kitchen pass: the counter food comes out of */}
          <rect x={W / 2 - 78} y="3" width="156" height="24" rx="8" fill="var(--secondary)" stroke="var(--border)" strokeWidth="1.5" />

          {/* Service aisle: the walk from the pass to the door */}
          <path d={`M ${W / 2} 34 L ${W / 2} ${H - 48}`} stroke="var(--border)" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />

          {items.map(({ table, cx, cy, w, h, round }) => {
            const free = table.status === 'available'
            const guests = Math.min(table.seats, table.party?.size ?? 0)
            const progress = free ? 0 : (STATUS_PROGRESS[table.status] ?? 0)
            const selected = picked === table.id
            return (
              <g key={table.id} transform={`translate(${cx} ${cy})`}>
                {/* Selected: a soft halo hugging the table top */}
                {selected &&
                  (round ? (
                    <circle r={w / 2 + 6} fill="none" stroke="var(--primary)" strokeOpacity="0.45" strokeWidth="5" />
                  ) : (
                    <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx="17" fill="none" stroke="var(--primary)" strokeOpacity="0.45" strokeWidth="5" />
                  ))}
                {chairSpots(table.seats, w, h).map((c, n) => {
                  const taken = n < guests
                  return (
                    <g key={n} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
                      {/* seat */}
                      <rect x="-10" y="-4" width="20" height="10" rx="3.5" fill={taken ? 'var(--primary)' : 'var(--card)'} stroke={taken ? 'var(--primary)' : 'var(--border)'} strokeWidth="1.5" />
                      {/* back rest, on the side away from the table */}
                      <rect x="-9" y="-7.5" width="18" height="3" rx="1.5" fill={taken ? 'var(--primary)' : 'var(--border)'} />
                    </g>
                  )
                })}
                {round ? (
                  <>
                    <circle r={w / 2} fill={fillFor(table)} stroke="var(--border)" strokeWidth="1.5" strokeDasharray={free ? '4 4' : undefined} />
                    {progress > 0 && (
                      <circle r={w / 2} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${progress * 100} 100`} transform="rotate(-90)" />
                    )}
                  </>
                ) : (
                  <>
                    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="12" fill={fillFor(table)} stroke="var(--border)" strokeWidth="1.5" strokeDasharray={free ? '4 4' : undefined} />
                    {progress > 0 && (
                      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="12" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${progress * 100} 100`} />
                    )}
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {/* Landmark labels */}
        <span className="pointer-events-none absolute inline-flex -translate-x-1/2 items-center gap-1 text-[11px] font-medium text-muted-foreground" style={{ left: '50%', top: pct(8, H) }}>
          <ChefHat className="size-3.5 text-kitchen" /> {t('floor.pass')}
        </span>
        <span className="pointer-events-none absolute -translate-y-full text-[11px] text-muted-foreground" style={{ left: pct(W / 2 + 32, W), top: pct(H - 9, H) }}>
          {t('floor.entrance')}
        </span>

        {/* Tables: the tap target, the name and the badges */}
        {items.map(({ table, cx, cy, w, h }) => {
          const open = tasks.filter((k) => k.tableId === table.id).length
          const free = table.status === 'available'
          const late = table.lines.some((l) => l.status === 'fired' && snap.now > l.expectedReadyAt)
          const minutes = table.seatedAt && !free ? Math.max(1, Math.round((snap.now - table.seatedAt) / 60_000)) : null
          const reach = CHAIR_GAP + CHAIR_DEPTH
          // Two-tops only have chairs at the sides, so nothing sits above or below them.
          const reachY = table.seats <= 2 ? 6 : reach
          const flags = [
            table.party?.allergies.length ? <HeartPulse key="a" className="size-3.5 text-warn" /> : null,
            table.party?.needs?.length ? <Accessibility key="n" className="size-3.5 text-primary" /> : null,
            table.party?.occasion ? <CakeSlice key="o" className="size-3.5 text-primary" /> : null,
            table.party?.vip ? <Star key="v" className="size-3.5 text-primary" /> : null,
          ].filter(Boolean)
          const label = [table.name, t.any(`status.${table.status}`), table.party?.size ? t('party.of', { n: table.party.size }) : '', open ? t('table.tasks', { n: open }) : ''].filter(Boolean).join(', ')
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onPick(table.id)}
              aria-pressed={picked === table.id}
              aria-label={label}
              className="group absolute rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              style={{ left: pct(cx - w / 2 - reach, W), top: pct(cy - h / 2 - reachY, H), width: pct(w + 2 * reach, W), height: pct(h + 2 * reachY, H) }}
            >
              <span className="absolute inset-0 grid place-items-center">
                <span className={cn('font-display text-base leading-none', free && 'text-muted-foreground')}>{table.name}</span>
              </span>
              {/* Status under the table, clear of chairs */}
              <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] leading-tight text-muted-foreground">
                <span className="font-medium text-foreground/80">{t.any(`status.${table.status}`)}</span> {minutes ? t('tile.min', { n: minutes }) : t('tile.seats', { n: table.seats })}
              </span>
              {open > 0 && (
                <span className="absolute grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-card tabular" style={{ left: pct(reach - 8, w + 2 * reach), top: pct(reachY - 8, h + 2 * reachY) }} aria-hidden>
                  {open}
                </span>
              )}
              {flags.length > 0 && (
                <span className="absolute flex gap-0.5 rounded-full bg-card px-1 py-0.5 shadow-sm ring-1 ring-border" style={{ right: pct(reach - 10, w + 2 * reach), top: pct(reachY - 10, h + 2 * reachY) }} aria-hidden>
                  {flags}
                </span>
              )}
              {table.mood && (
                <span className={cn('absolute rounded-full bg-card', MOOD_TONE[table.mood.value])} style={{ right: pct(reach - 9, w + 2 * reach), bottom: pct(reachY - 9, h + 2 * reachY) }} aria-hidden>
                  <Reaction mood={table.mood.value} filled className="size-5" />
                </span>
              )}
              {late && <span className="absolute size-2.5 rounded-full bg-kitchen ring-2 ring-card pulse-soft" style={{ left: pct(reach - 4, w + 2 * reach), bottom: pct(reachY - 4, h + 2 * reachY) }} aria-hidden />}
            </button>
          )
        })}
      </div>

      {/* One quiet line explaining the drawing */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="-11 -9 22 16" className="h-3 w-4" aria-hidden>
            <rect x="-10" y="-4" width="20" height="10" rx="3.5" fill="var(--primary)" />
            <rect x="-9" y="-7.5" width="18" height="3" rx="1.5" fill="var(--primary)" />
          </svg>
          {t('floor.legendGuest')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" strokeWidth="2" />
            <circle cx="8" cy="8" r="6" fill="none" stroke="var(--primary)" strokeWidth="2" pathLength={100} strokeDasharray="60 100" transform="rotate(-90 8 8)" />
          </svg>
          {t('floor.legendProgress')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-3.5 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">1</span>
          {t('floor.legendTodo')}
        </span>
      </div>
    </div>
  )
}
