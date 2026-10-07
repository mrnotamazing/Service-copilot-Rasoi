import { CakeSlice, HeartPulse, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { TableState } from '../../shared/types.ts'
import { STATUS_LABEL, STATUS_PROGRESS, mins } from '../lib/format.ts'

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function TopBar({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link to="/" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron">
            Service Copilot
          </Link>
          <div className="truncate font-display text-xl">{title}</div>
          {sub && <div className="truncate text-xs text-muted">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </header>
  )
}

export function Dot({ ok }: { ok: boolean }) {
  return <span title={ok ? 'Live' : 'Reconnecting'} className={`inline-block size-2 rounded-full ${ok ? 'bg-good' : 'bg-warn pulse-soft'}`} />
}

/** How far through the meal a table is: driven by courses served, not just status. */
export function tableProgress(t: TableState): number {
  if (t.status !== 'dining' || !t.lines.length) return STATUS_PROGRESS[t.status] ?? 0
  const live = t.lines.filter((l) => l.status !== 'unavailable')
  const served = live.filter((l) => l.status === 'served').length
  const cleared = Object.keys(t.courseClearedAt).length
  return Math.min(0.78, 0.22 + (served / Math.max(1, live.length)) * 0.3 + cleared * 0.1)
}

export function TableTile({ t, now, color, onClick, active }: { t: TableState; now: number; color?: string; onClick?: () => void; active?: boolean }) {
  const p = tableProgress(t)
  const r = 22
  const c = 2 * Math.PI * r
  const free = t.status === 'available'
  const late = t.lines.some((l) => l.status === 'fired' && now > l.expectedReadyAt)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center rounded-xl border p-2 text-center transition ${active ? 'border-saffron bg-raised' : 'border-line bg-raised/50'} ${onClick ? 'hover:border-muted' : 'cursor-default'}`}
    >
      <svg viewBox="0 0 56 56" className="size-14" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
        {!free && (
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke={color ?? 'var(--color-saffron)'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${p * c} ${c}`}
            transform="rotate(-90 28 28)"
          />
        )}
        <text x="28" y="32" textAnchor="middle" className="fill-ink text-[13px] font-semibold">
          {t.name}
        </text>
      </svg>
      <div className={`text-[11px] font-medium ${free ? 'text-faint' : 'text-ink'}`}>{STATUS_LABEL[t.status]}</div>
      <div className="h-4 text-[10px] text-muted">{t.seatedAt && !free ? mins(now - t.seatedAt) : `${t.seats} seats`}</div>
      <div className="absolute right-1.5 top-1.5 flex gap-0.5">
        {t.party?.allergies.length ? <HeartPulse className="size-3.5 text-warn" aria-label="Allergy" /> : null}
        {t.party?.occasion ? <CakeSlice className="size-3.5 text-saffron" aria-label={t.party.occasion} /> : null}
        {t.party?.vip ? <Star className="size-3.5 text-saffron" aria-label="Regular" /> : null}
      </div>
      {late && <span className="absolute left-1.5 top-1.5 size-2 rounded-full bg-kitchen pulse-soft" title="Kitchen running late" />}
    </button>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-raised/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  )
}

export function Btn({ children, onClick, kind = 'ghost', className = '', disabled }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'soft'; className?: string; disabled?: boolean }) {
  const styles = {
    primary: 'bg-saffron text-bg hover:brightness-110 font-semibold',
    soft: 'bg-raised text-ink hover:bg-line',
    ghost: 'text-muted hover:text-ink hover:bg-raised',
  }[kind]
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl px-3 py-2 text-sm transition active:scale-[.98] disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  )
}
