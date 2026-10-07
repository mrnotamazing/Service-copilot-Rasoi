import { CakeSlice, HeartPulse, Monitor, Moon, Star, Sun, UtensilsCrossed } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { TableState } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STATUS_LABEL, STATUS_PROGRESS, mins } from '../lib/format.ts'
import { useTheme, type ThemeChoice } from '../lib/theme.ts'
import { cn } from '@/lib/utils'

export function Brand() {
  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <UtensilsCrossed className="size-4" />
      </span>
      <span className="font-display text-lg leading-none">
        Rasoi <span className="text-muted-foreground">Copilot</span>
      </span>
    </Link>
  )
}

const NAV = [
  { to: '/manager', label: 'Overview' },
  { to: '/kitchen', label: 'Kitchen' },
  { to: '/setup', label: 'Setup' },
]

export function AppHeader({ title, sub, right, nav = true }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; nav?: boolean }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Brand />
        {nav && (
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => cn('rounded-md px-2.5 py-1 text-sm transition-colors', isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {right}
          <ThemeToggle />
        </div>
      </div>
      {(title || sub) && (
        <div className="mx-auto max-w-6xl px-4 pb-3">
          {title && <h1 className="font-display text-2xl leading-tight">{title}</h1>}
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
      )}
    </header>
  )
}

const THEMES: { c: ThemeChoice; Icon: typeof Sun; label: string }[] = [
  { c: 'light', Icon: Sun, label: 'Light' },
  { c: 'dark', Icon: Moon, label: 'Dark' },
  { c: 'system', Icon: Monitor, label: 'Match device' },
]

export function ThemeToggle() {
  const { choice, setTheme } = useTheme()
  const i = THEMES.findIndex((t) => t.c === choice)
  const { Icon, label } = THEMES[i]
  const next = THEMES[(i + 1) % THEMES.length]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${label}. Switch to ${next.label}`} onClick={() => setTheme(next.c)}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Theme: {label}</TooltipContent>
    </Tooltip>
  )
}

export function LiveClock({ now, ok }: { now: number; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs tabular text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-good' : 'bg-warn pulse-soft')} aria-label={ok ? 'Live' : 'Reconnecting'} />
      {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h2>
      {right}
    </div>
  )
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
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'relative flex flex-col items-center rounded-xl border bg-card p-2 text-center transition-colors',
        active && 'border-primary ring-2 ring-primary/30',
        onClick && 'hover:bg-accent',
      )}
    >
      <svg viewBox="0 0 56 56" className="size-14" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        {!free && (
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke={color ?? 'var(--primary)'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${p * c} ${c}`}
            transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        )}
        <text x="28" y="32" textAnchor="middle" fill="currentColor" className="text-[13px] font-semibold">
          {t.name}
        </text>
      </svg>
      <div className={cn('text-[11px] font-medium', free && 'text-muted-foreground')}>{STATUS_LABEL[t.status]}</div>
      <div className="h-4 text-[10px] tabular text-muted-foreground">{t.seatedAt && !free ? mins(now - t.seatedAt) : `${t.seats} seats`}</div>
      <div className="absolute right-1.5 top-1.5 flex gap-0.5">
        {t.party?.allergies.length ? <HeartPulse className="size-3.5 text-warn" aria-label={`Allergy: ${t.party.allergies.join(', ')}`} /> : null}
        {t.party?.occasion ? <CakeSlice className="size-3.5 text-primary" aria-label={t.party.occasion} /> : null}
        {t.party?.vip ? <Star className="size-3.5 text-primary" aria-label="Regular guest" /> : null}
      </div>
      {late && <span className="absolute left-1.5 top-1.5 size-2 rounded-full bg-kitchen pulse-soft" title="Kitchen running late" />}
    </Comp>
  )
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="size-2 rounded-full bg-primary pulse-soft" />
        Connecting to service…
      </div>
    </div>
  )
}
