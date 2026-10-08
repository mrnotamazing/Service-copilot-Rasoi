import { Accessibility, BookOpen, CakeSlice, ChefHat, Clapperboard, HeartPulse, LayoutDashboard, Menu, Monitor, Moon, Star, Sun, Users } from 'lucide-react'
import { Mark, Wordmark } from '../brand/marks.tsx'
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { TableState } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STATUS_LABEL, STATUS_PROGRESS, clock, useWallClock } from '../lib/format.ts'
import { useTheme, type ThemeChoice } from '../lib/theme.ts'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { AccessButton } from './AccessPanel.tsx'

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

/** Light, dark or match the device, as three plain buttons (used in the phone menu). */
function ThemeChoices() {
  const { choice, setTheme } = useTheme()
  return (
    <div role="group" aria-label="Theme" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
      {THEMES.map(({ c, Icon, label }) => (
        <button
          key={c}
          type="button"
          aria-pressed={choice === c}
          onClick={() => setTheme(c)}
          className={cn('flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px]', choice === c ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
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

/** The four parts of TableMate. The same menu on every screen, in the same order. */
export const SECTIONS: { to: string; label: Key; Icon: typeof Users; match: (path: string) => boolean }[] = [
  { to: '/servers', label: 'nav.servers', Icon: Users, match: (p) => p === '/servers' || p.startsWith('/server/') },
  { to: '/manager', label: 'nav.manager', Icon: LayoutDashboard, match: (p) => p.startsWith('/manager') },
  { to: '/kitchen', label: 'nav.kitchen', Icon: ChefHat, match: (p) => p.startsWith('/kitchen') },
  { to: '/demo', label: 'nav.demo', Icon: Clapperboard, match: (p) => p.startsWith('/demo') },
]

/**
 * The main menu: logo, the four sections, "How it works", then language, access and theme.
 * On phones the sections fold into a menu button.
 */
export function TopNav() {
  const t = useT()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const current = SECTIONS.find((x) => x.match(pathname))
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground">
        Skip to main content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:gap-6 md:px-6">
        <Brand />
        {current && (
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium md:hidden">
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <span className="truncate">{t(current.label)}</span>
          </span>
        )}
        <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
          {SECTIONS.map(({ to, label, Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors',
                  active ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <Icon className={cn('size-4', active && 'text-primary')} />
                {t(label)}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/about"
            aria-current={pathname.startsWith('/about') ? 'page' : undefined}
            className={cn('hidden h-9 items-center rounded-lg px-3 text-sm transition-colors lg:inline-flex', pathname.startsWith('/about') ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t('nav.how')}
          </Link>
          <AccessButton />
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.menu')}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{t('nav.menu')}</SheetTitle>
              </SheetHeader>
              <nav aria-label={t('nav.main')} className="grid gap-1 px-3">
                {SECTIONS.map(({ to, label, Icon, match }) => {
                  const active = match(pathname)
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn('flex h-12 items-center gap-3 rounded-xl px-3 text-base', active ? 'bg-secondary font-medium' : 'hover:bg-secondary/60')}
                    >
                      <Icon className="size-5 text-primary" />
                      {t(label)}
                    </Link>
                  )
                })}
                <div className="my-2 border-t" role="separator" />
                <Link to="/about" onClick={() => setOpen(false)} className="flex h-12 items-center gap-3 rounded-xl px-3 text-base text-muted-foreground hover:bg-secondary/60">
                  <BookOpen className="size-5" />
                  {t('nav.how')}
                </Link>
                <ThemeChoices />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

/** Every screen except the server's phone app: the main menu, a page heading, and the page. */
export function AppShell({ title, sub, right, children, wide = true, bare = false }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; wide?: boolean; bare?: boolean }) {
  const width = wide ? 'max-w-7xl' : 'max-w-4xl'
  return (
    <div className="min-h-dvh bg-background">
      <TopNav />
      <main id="main" className="w-full">
        {(title || right) && (
          <div className={cn('mx-auto flex flex-wrap items-end justify-between gap-3 px-4 pt-6 md:px-6', width)}>
            <div className="min-w-0">
              {title && <h1 className="font-display text-2xl leading-tight md:text-3xl">{title}</h1>}
              {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
            </div>
            {right && <div className="flex items-center gap-2">{right}</div>}
          </div>
        )}
        <div className={cn(!bare && 'mx-auto px-4 py-5 md:px-6 md:py-6', !bare && width)}>{children}</div>
      </main>
    </div>
  )
}

/** Shown while the first snapshot arrives, in the shape of the page. */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="h-14 border-b" />
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 md:px-6">
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
