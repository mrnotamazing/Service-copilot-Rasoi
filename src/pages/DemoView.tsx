import {
  Accessibility,
  BellRing,
  ChefHat,
  Clapperboard,
  Flame,
  Frown,
  GraduationCap,
  HandHelping,
  HandPlatter,
  LayoutDashboard,
  Pause,
  Play,
  Receipt,
  RotateCcw,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { FeedItem, FeedKind } from '../../shared/narrate.ts'
import type { Snapshot } from '../../shared/snapshot.ts'
import { Avatar } from '../components/Avatar.tsx'
import { SetupPanels } from '../components/SetupPanels.tsx'
import { AppShell, LiveClock, ShellSkeleton } from '../components/kit.tsx'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { clock } from '../lib/format.ts'
import { post, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

type Kind = 'arrival' | 'allergy' | 'vip' | 'access' | 'kitchen_delay' | 'sold_out' | 'unhappy' | 'manager' | 'bill' | 'rush'

/** Moments a presenter can stage on cue, each showing off a different part of TableMate. */
const MOMENTS: { kind: Kind; title: string; shows: string; Icon: LucideIcon }[] = [
  { kind: 'allergy', title: 'Allergy guest', shows: 'A nut allergy arrives: the safety check flags clashing dishes.', Icon: ShieldAlert },
  { kind: 'kitchen_delay', title: 'Kitchen falls behind', shows: 'Delay cards tell servers to warn tables before they ask.', Icon: Flame },
  { kind: 'vip', title: 'Birthday regulars', shows: 'A regular’s birthday: the greeting card picks it up.', Icon: Sparkles },
  { kind: 'unhappy', title: 'Unhappy table', shows: 'A bad check-in opens a recovery card.', Icon: Frown },
  { kind: 'access', title: 'Access need', shows: 'Wheelchair, hearing, vision or a quiet table.', Icon: Accessibility },
  { kind: 'sold_out', title: 'Dish runs out', shows: 'The 86 reaches every server with that dish on order.', Icon: UtensilsCrossed },
  { kind: 'manager', title: 'Guest asks for manager', shows: 'Shows up in the manager’s “Needs you now”.', Icon: HandHelping },
  { kind: 'bill', title: 'Bill request', shows: 'Starts the bill timer and the goodbye.', Icon: Receipt },
  { kind: 'arrival', title: 'New arrival', shows: 'Seats one party at the next free table.', Icon: UserPlus },
  { kind: 'rush', title: 'Sudden rush', shows: 'Fills every free table at once.', Icon: Users },
]

type Tab = 'run' | 'setup'
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'run', label: 'Run the demo', Icon: Clapperboard },
  { id: 'setup', label: 'Setup', Icon: Settings },
]

const SPEEDS = [1, 2, 5, 10, 20, 30]
const PACES: { value: number; label: string }[] = [
  { value: 0.6, label: 'Quiet' },
  { value: 1, label: 'Normal' },
  { value: 1.6, label: 'Busy' },
  { value: 2.4, label: 'Rush' },
]

const FEED_ICON: Record<FeedKind, LucideIcon> = { guest: Users, kitchen: ChefHat, staff: HandPlatter, alert: TriangleAlert, training: GraduationCap, demo: Clapperboard }

/**
 * Demo & setup. Run the demo: run, pace and reset the simulated service, stage moments on cue, or
 * switch on showcase mode and let the whole restaurant run itself while you present. Setup: the
 * service standards, the AI behind the assistant, and POS integrations.
 */
export default function DemoView() {
  useRolePage({ kind: 'manager' })
  const { snap, connected } = useSnapshot('manager')
  // The tab lives in the address, so /setup (and bookmarks to it) open the Setup tab.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'setup' ? 'setup' : 'run'
  if (!snap) return <ShellSkeleton />
  return (
    <AppShell title="Demo & setup" sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />}>
      <div role="tablist" aria-label="Demo and setup" className="mb-5 inline-grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setParams(id === 'run' ? {} : { tab: id }, { replace: true })}
            className={cn('flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors', tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === 'setup' ? (
        <div role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
          <SetupPanels snap={snap} />
        </div>
      ) : (
      <div role="tabpanel" id="panel-run" aria-labelledby="tab-run" className="space-y-5">
        <ControlBar snap={snap} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Moments snap={snap} />
          <div className="space-y-5">
            <Pace snap={snap} />
            <WhoPlays snap={snap} />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Feed feed={snap.feed ?? []} />
          <Screens snap={snap} />
        </div>
      </div>
      )}
    </AppShell>
  )
}

async function settings(body: Record<string, unknown>) {
  await post('/api/sim/settings', body)
}

/** The memorable part: one dark bar with everything a presenter reaches for. */
function ControlBar({ snap }: { snap: Snapshot }) {
  const sim = snap.sim
  const [confirm, setConfirm] = useState(false)
  const seated = snap.tables.filter((t) => t.visitId).length
  const fresh = async () => {
    await post('/api/sim/reset')
    await settings({ speed: 10, intensity: 1.6 })
    await settings({ showcase: true })
    toast.success('Fresh demo started: showcase mode is on')
  }
  return (
    <section className="bg-hero overflow-hidden rounded-3xl text-hero-foreground">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <span className={cn('size-2.5 rounded-full', sim.running ? 'animate-pulse bg-good' : 'bg-hero-foreground/40')} aria-hidden />
            {sim.running ? 'Service running' : sim.startedAt ? 'Paused' : 'Not started'}
            {sim.showcase && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Showcase</span>}
          </div>
          <div className="mt-1 font-display text-3xl leading-tight sm:text-4xl">
            {seated} of {snap.tables.length} tables seated
          </div>
          <div className="mt-1 text-sm opacity-75 tabular">
            {sim.speed}× speed · {sim.waiting} waiting for a table · {clock(snap.now)} IST
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sim.running ? (
            <Button size="lg" variant="secondary" className="h-12 rounded-full px-6" onClick={() => void post('/api/sim/pause')}>
              <Pause /> Pause
            </Button>
          ) : (
            <Button size="lg" className="h-12 rounded-full px-6" onClick={() => void post('/api/sim/start')}>
              <Play /> {sim.startedAt ? 'Resume' : 'Start service'}
            </Button>
          )}
          {confirm ? (
            <>
              <Button
                size="lg"
                variant="destructive"
                className="h-12 rounded-full"
                onClick={() => {
                  setConfirm(false)
                  void post('/api/sim/reset').then(() => toast.success('Service reset: every table is free'))
                }}
              >
                Clear everything
              </Button>
              <Button size="lg" variant="ghost" className="h-12 rounded-full text-hero-foreground hover:bg-white/10 hover:text-hero-foreground" onClick={() => setConfirm(false)}>
                Keep going
              </Button>
            </>
          ) : (
            <Button size="lg" variant="ghost" className="h-12 rounded-full text-hero-foreground hover:bg-white/10 hover:text-hero-foreground" onClick={() => setConfirm(true)}>
              <RotateCcw /> Reset
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 bg-black/15 px-5 py-4 sm:px-6">
        <label htmlFor="showcase" className="flex min-w-0 basis-full cursor-pointer items-start gap-3 sm:basis-0 sm:flex-1">
          <Clapperboard className="mt-0.5 size-5 shrink-0 text-primary-2" aria-hidden />
          <span>
            <span className="block font-medium">Showcase mode</span>
            <span className="block text-sm opacity-75">The whole restaurant runs on autopilot and stages a new moment every few minutes, so you can present hands-free.</span>
          </span>
        </label>
        <Switch id="showcase" checked={sim.showcase} onCheckedChange={(v) => void settings({ showcase: v }).then(() => toast.success(v ? 'Showcase mode on' : 'Showcase mode off'))} />
        <Button variant="secondary" className="rounded-full" onClick={() => void fresh()}>
          <Sparkles /> Start a fresh demo
        </Button>
      </div>
    </section>
  )
}

function Moments({ snap }: { snap: Snapshot }) {
  const [busy, setBusy] = useState<Kind | null>(null)
  const stage = async (kind: Kind) => {
    setBusy(kind)
    try {
      const r = await post<{ ok: boolean; text: string }>('/api/sim/moment', { kind })
      if (r.ok) toast.success(`Staged: ${r.text}`)
      else toast(r.text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t stage that')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-display text-xl">Stage a moment</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Make something happen on cue, then show it on the server, kitchen or manager screen.{!snap.sim.startedAt && ' The service starts by itself.'}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MOMENTS.map(({ kind, title, shows, Icon }) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => void stage(kind)}
            className="group flex min-h-16 items-start gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{shows}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Pace({ snap }: { snap: Snapshot }) {
  const sim = snap.sim
  const pace = PACES.reduce((best, p) => (Math.abs(p.value - sim.intensity) < Math.abs(best.value - sim.intensity) ? p : best), PACES[0])
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">Pace</h2>
      <div className="mt-3 text-sm">Speed</div>
      <Choice label="Speed" options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} value={sim.speed} onChange={(speed) => void settings({ speed })} />
      <p className="mt-1 text-xs text-muted-foreground">10× is good for presenting: a three-course visit takes about 8 minutes.</p>
      <div className="mt-4 text-sm">How busy</div>
      <Choice label="How busy" options={PACES} value={pace.value} onChange={(intensity) => void settings({ intensity })} />
    </section>
  )
}

function Choice({ label, options, value, onChange }: { label: string; options: { value: number; label: string }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-1.5 grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('min-h-9 rounded-lg px-1 text-sm font-medium tabular transition-colors', o.value === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function WhoPlays({ snap }: { snap: Snapshot }) {
  const sim = snap.sim
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const all = servers.every((s) => sim.autopilot.includes(s.id))
  const row = 'flex items-center justify-between gap-3 px-3 py-2.5 text-sm'
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">Who’s on autopilot</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Switch someone off to play them yourself on their phone or screen.</p>
      <div className="mt-3 divide-y rounded-xl border">
        <label htmlFor="ap-all" className={cn(row, 'font-medium')}>
          All servers
          <Switch id="ap-all" checked={all} onCheckedChange={(v) => void settings({ allServers: v })} />
        </label>
        {servers.map((s) => (
          <label key={s.id} htmlFor={`ap-${s.id}`} className={row}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <Avatar staff={s} className="size-6 text-[10px]" />
              <span className="truncate">{s.name}</span>
            </span>
            <Switch id={`ap-${s.id}`} checked={sim.autopilot.includes(s.id)} onCheckedChange={(v) => void settings({ staffId: s.id, autopilot: v })} />
          </label>
        ))}
        <label htmlFor="ap-kitchen" className={row}>
          <span className="inline-flex items-center gap-2">
            <ChefHat className="size-4 text-kitchen" aria-hidden /> Kitchen cooks by itself
          </span>
          <Switch id="ap-kitchen" checked={sim.autoKitchen} onCheckedChange={(v) => void settings({ autoKitchen: v })} />
        </label>
        <label htmlFor="ap-manager" className={row}>
          <span className="inline-flex items-center gap-2">
            <LayoutDashboard className="size-4 text-primary" aria-hidden /> Manager answers visit requests
          </span>
          <Switch id="ap-manager" checked={sim.autoManager} onCheckedChange={(v) => void settings({ autoManager: v })} />
        </label>
      </div>
    </section>
  )
}

/** What's happening, newest first, so the audience can follow along. */
function Feed({ feed }: { feed: FeedItem[] }) {
  const items = [...feed].reverse()
  const top = useRef<string | undefined>(undefined)
  const [fresh, setFresh] = useState<string | undefined>()
  // Briefly highlight what just arrived.
  useEffect(() => {
    if (items[0]?.id !== top.current) {
      top.current = items[0]?.id
      setFresh(items[0]?.id)
    }
  }, [items])
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">Live feed</h2>
        <span className="text-xs text-muted-foreground">Newest first</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing yet. Start the service or stage a moment, and every step appears here in plain words.</p>
      ) : (
        <ol className="mt-3 max-h-[420px] space-y-0.5 overflow-y-auto pr-1" aria-live="polite">
          {items.map((f) => {
            const Icon = FEED_ICON[f.kind]
            return (
              <li key={f.id} className={cn('flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-700', f.id === fresh && 'bg-accent', f.kind === 'demo' && 'font-medium')}>
                <span className="w-16 shrink-0 pt-px text-xs text-muted-foreground tabular">{clock(f.at)}</span>
                <Icon className={cn('mt-0.5 size-4 shrink-0', f.kind === 'alert' ? 'text-warn' : f.kind === 'kitchen' ? 'text-kitchen' : f.kind === 'demo' ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                <span className="min-w-0">{f.text}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Each screen in its own tab, to put side by side or on another device while presenting. */
function Screens({ snap }: { snap: Snapshot }) {
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const link = 'flex min-h-11 items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent'
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">Open the screens</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Each opens in a new tab. Put a server’s phone next to the kitchen and the manager to show the whole loop.</p>
      <div className="mt-3 divide-y overflow-hidden rounded-xl border">
        {servers.map((s) => (
          <Link key={s.id} to={`/server/${s.id}?device=phone`} target="_blank" rel="noopener" className={link}>
            <Avatar staff={s} className="size-6 text-[10px]" />
            <span className="flex-1">{s.name}’s phone</span>
            <Smartphone className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        <Link to="/kitchen" target="_blank" rel="noopener" className={link}>
          <ChefHat className="size-5 text-kitchen" aria-hidden />
          <span className="flex-1">Kitchen pass</span>
        </Link>
        <Link to="/manager" target="_blank" rel="noopener" className={link}>
          <LayoutDashboard className="size-5 text-primary" aria-hidden />
          <span className="flex-1">Manager console</span>
        </Link>
        <Link to="/about" target="_blank" rel="noopener" className={link}>
          <BellRing className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex-1">How it works (for the audience)</span>
        </Link>
      </div>
    </section>
  )
}
