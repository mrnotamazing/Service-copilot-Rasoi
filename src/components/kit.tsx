import { Accessibility, BookOpen, CakeSlice, ChefHat, HeartPulse, LayoutDashboard, Monitor, Moon, Settings, Star, Sun, Users } from 'lucide-react'
import { Mark, Wordmark } from '../brand/marks.tsx'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { TableState } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STATUS_LABEL, STATUS_PROGRESS, clock, useWallClock } from '../lib/format.ts'
import { useTheme, type ThemeChoice } from '../lib/theme.ts'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { AccessButton } from './AccessPanel.tsx'
import { RoleSwitcher } from './RoleSwitcher.tsx'
import { useRole, type Role } from '../lib/role.ts'

export function Brand() {
  return (
    <Link to="/" className="inline-flex items-center gap-2" aria-label="TableMate home">
      <Mark className="h-6 w-auto text-tomato" />
      <Wordmark className="text-xl leading-none" />
    </Link>
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

/** The real time in IST (the restaurant's time zone) and whether the live connection is up. */
export function LiveClock({ ok }: { now?: number; ok: boolean }) {
  const now = useWallClock()
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs tabular text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-good' : 'bg-warn pulse-soft')} aria-label={ok ? 'Live' : 'Reconnecting'} />
      {clock(now)} IST
    </span>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
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
  const tr = useT()
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
      <div className={cn('text-[11px] font-medium', free && 'text-muted-foreground')}>{tr.any(`status.${t.status}`) || STATUS_LABEL[t.status]}</div>
      <div className="h-4 text-[10px] tabular text-muted-foreground">{t.seatedAt && !free ? tr('tile.min', { n: Math.max(1, Math.round((now - t.seatedAt) / 60_000)) }) : tr('tile.seats', { n: t.seats })}</div>
      <div className="absolute right-1.5 top-1.5 flex gap-0.5">
        {t.party?.allergies.length ? <HeartPulse className="size-3.5 text-warn" aria-label={tr('party.allergy', { list: t.party.allergies.join(', ') })} /> : null}
        {t.party?.occasion ? <CakeSlice className="size-3.5 text-primary" aria-label={tr.any(`occ.${t.party.occasion}`)} /> : null}
        {t.party?.needs?.length ? <Accessibility className="size-3.5 text-primary" aria-label={t.party.needs.map((n) => tr.any(`need.${n}`)).join('; ')} /> : null}
        {t.party?.vip ? <Star className="size-3.5 text-primary" aria-label={tr('tables.regular')} /> : null}
      </div>
      {late && <span className="absolute left-1.5 top-1.5 size-2 rounded-full bg-kitchen pulse-soft" title="Kitchen running late" />}
    </Comp>
  )
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3', className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}


/** Heading inside a card: sentence case, quiet, never a tracked-out all-caps label. */
export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-sans text-sm font-medium', className)}>{children}</h2>
}

type NavItem = { to: string; label: Key; Icon: typeof Users; end?: boolean }

/** Each role sees its own screens: the manager runs the floor, the kitchen runs the pass. */
function navFor(role: Role | null): NavItem[] {
  if (role?.kind === 'kitchen') return [{ to: '/kitchen', label: 'nav.kitchen', Icon: ChefHat }, { to: '/about', label: 'nav.how', Icon: BookOpen }]
  if (role?.kind === 'server') return [{ to: `/server/${role.staffId}`, label: 'nav.myShift', Icon: Users }, { to: '/about', label: 'nav.how', Icon: BookOpen }]
  if (role?.kind === 'manager')
    return [
      { to: '/manager', label: 'nav.overview', Icon: LayoutDashboard },
      { to: '/', label: 'nav.floorStaff', Icon: Users, end: true },
      { to: '/kitchen', label: 'nav.kitchen', Icon: ChefHat },
      { to: '/setup', label: 'nav.setup', Icon: Settings },
      { to: '/about', label: 'nav.how', Icon: BookOpen },
    ]
  return SHELL_NAV
}

const SHELL_NAV: NavItem[] = [
  { to: '/', label: 'nav.floorStaff', Icon: Users, end: true },
  { to: '/manager', label: 'nav.overview', Icon: LayoutDashboard },
  { to: '/kitchen', label: 'nav.kitchen', Icon: ChefHat },
  { to: '/setup', label: 'nav.setup', Icon: Settings },
  { to: '/about', label: 'nav.how', Icon: BookOpen },
]

/**
 * The frame every non-phone screen lives in: a sidebar on desktop, a top bar and
 * bottom tabs on phones, so it navigates like an installed app rather than a website.
 */
export function AppShell({ title, sub, right, children, wide = true, bare = false }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; wide?: boolean; bare?: boolean }) {
  const t = useT()
  const role = useRole()
  const nav = navFor(role)
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground">
        Skip to main content
      </a>
      {/* The column carries the background to the bottom of long pages; the sidebar inside stays put. */}
      <div className="hidden border-r bg-sidebar md:block">
      <aside className="sticky top-0 flex h-dvh flex-col px-3 py-4">
        <div className="px-2">
          <Brand />
        </div>
        <nav aria-label="Screens" className="mt-6 grid gap-0.5">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 rounded-2xl border bg-background/60 p-2">
          {/* Signed in as: switch between a server's app, the kitchen display and the manager console. */}
          <RoleSwitcher />
          <div className="flex items-center justify-between border-t px-1 pt-2">
            <span className="text-[11px] text-muted-foreground">Saffron House</span>
            <span className="flex items-center gap-1">
              <AccessButton />
              <ThemeToggle />
            </span>
          </div>
        </div>
      </aside>
      </div>

      <div className="flex min-w-0 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:pb-0">
        <header className="sticky top-0 z-20 border-b bg-background/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className={cn('mx-auto flex items-center gap-3 px-4 py-3 md:px-8', wide ? 'max-w-6xl' : 'max-w-3xl')}>
            <div className="md:hidden">
              <Brand />
            </div>
            <div className="hidden min-w-0 md:block">
              {title && <h1 className="truncate font-display text-xl leading-tight">{title}</h1>}
              {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {right}
              <span className="flex items-center md:hidden">
                <RoleSwitcher compact className="size-10" />
                <AccessButton />
                <ThemeToggle />
              </span>
            </div>
          </div>
        </header>
        {title && (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:hidden">
            <h1 className="font-display text-2xl leading-tight">{title}</h1>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
          </div>
        )}
        <main id="main" className={cn('w-full flex-1', !bare && 'mx-auto px-4 py-5 md:px-8 md:py-8', !bare && (wide ? 'max-w-6xl' : 'max-w-3xl'))}>
          {children}
        </main>
      </div>

      <nav aria-label="Screens" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1.5 backdrop-blur md:hidden">
        {nav.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate px-0.5">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Shown while the first snapshot arrives, in the shape of the page. */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]" aria-busy="true" aria-label="Loading">
      <div className="hidden border-r bg-sidebar p-5 md:block">
        <Mark className="h-6 w-auto text-primary pulse-soft" />
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}
