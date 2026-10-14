import { useT, L } from '../i18n/index.ts'
import { Languages, MessageCircleQuestion, Plug,
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
import { IntegrationsPanel } from '../components/IntegrationsPanel.tsx'
import { PresenterGuide } from '../components/PresenterGuide.tsx'
import { AppShell, LiveClock, ShellSkeleton } from '../components/kit.tsx'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { clock } from '../lib/format.ts'
import { post, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

type Kind = 'arrival' | 'allergy' | 'vip' | 'access' | 'language' | 'question' | 'kitchen_delay' | 'sold_out' | 'unhappy' | 'manager' | 'bill' | 'rush'

/** Moments a presenter can stage on cue, each showing off a different part of TableMate. */
const MOMENTS = (): { kind: Kind; title: string; shows: string; Icon: LucideIcon }[] => [
  { kind: 'allergy', title: L('Allergy guest'), shows: L('A nut allergy arrives: the safety check flags clashing dishes.'), Icon: ShieldAlert },
  { kind: 'kitchen_delay', title: L('Kitchen falls behind'), shows: L('Delay cards tell servers to warn tables before they ask.'), Icon: Flame },
  { kind: 'vip', title: L('Birthday regulars'), shows: L('A regular’s birthday: the greeting card picks it up.'), Icon: Sparkles },
  { kind: 'unhappy', title: L('Unhappy table'), shows: L('A bad check-in opens a recovery card.'), Icon: Frown },
  { kind: 'language', title: L('Guests prefer another language'), shows: L('The manager is offered a handover to a server who speaks it.'), Icon: Languages },
  { kind: 'question', title: L('Guest asks the kitchen'), shows: L('A question the menu notes don’t cover goes to the pass to answer once.'), Icon: MessageCircleQuestion },
  { kind: 'access', title: L('Access need'), shows: L('Wheelchair, hearing, vision or a quiet table.'), Icon: Accessibility },
  { kind: 'sold_out', title: L('Dish runs out'), shows: L('The 86 reaches every server with that dish on order.'), Icon: UtensilsCrossed },
  { kind: 'manager', title: L('Guest asks for manager'), shows: L('Shows up in the manager’s “Needs you now”.'), Icon: HandHelping },
  { kind: 'bill', title: L('Bill request'), shows: L('Starts the bill timer and the goodbye.'), Icon: Receipt },
  { kind: 'arrival', title: L('New arrival'), shows: L('Seats one party at the next free table.'), Icon: UserPlus },
  { kind: 'rush', title: L('Sudden rush'), shows: L('Fills every free table at once.'), Icon: Users },
]

type Tab = 'run' | 'setup' | 'integrations'
const TABS = (): { id: Tab; label: string; short?: string; Icon: LucideIcon }[] => [
  { id: 'run', label: L('Run the demo'), short: 'Run', Icon: Clapperboard },
  { id: 'setup', label: L('Setup'), Icon: Settings },
  { id: 'integrations', label: L('Integrations'), Icon: Plug },
]

const SPEEDS = [1, 2, 5, 10, 20, 30]
const PACES = (): { value: number; label: string }[] => [
  { value: 0.6, label: L('Quiet') },
  { value: 1, label: L('Normal') },
  { value: 1.6, label: L('Busy') },
  { value: 2.4, label: L('Rush') },
]

const FEED_ICON: Record<FeedKind, LucideIcon> = { guest: Users, kitchen: ChefHat, staff: HandPlatter, alert: TriangleAlert, training: GraduationCap, demo: Clapperboard }

/**
 * Demo & setup. Run the demo: run, pace and reset the simulated service, stage moments on cue, or
 * switch on showcase mode and let the whole restaurant run itself while you present. Setup: the
 * service standards, the AI behind the assistant, and POS integrations.
 */
export default function DemoView() {
  const tx = useT()
  useRolePage({ kind: 'manager' })
  const { snap, connected } = useSnapshot('manager')
  // The tab lives in the address, so /setup (and bookmarks to it) open the Setup tab.
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS().find((x) => x.id === params.get('tab'))?.id ?? 'run'
  if (!snap) return <ShellSkeleton />
  return (
    <AppShell title={tx('ui.demo.demo_setup')} sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />}>
      <div role="tablist" aria-label={tx('ui.demo.demo_and_setup')} className="mb-5 inline-grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 max-sm:w-full">
        {TABS().map(({ id, label, short, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setParams(id === 'run' ? {} : { tab: id }, { replace: true })}
            className={cn('flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium sm:px-4 transition-colors', tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            <Icon className="size-4" aria-hidden /> {short ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="max-sm:hidden">{label}</span>
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>
      {tab === 'integrations' ? (
        <div role="tabpanel" id="panel-integrations" aria-labelledby="tab-integrations">
          <IntegrationsPanel snap={snap} />
        </div>
      ) : tab === 'setup' ? (
        <div role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
          <SetupPanels snap={snap} />
        </div>
      ) : (
      <div role="tabpanel" id="panel-run" aria-labelledby="tab-run" className="space-y-5">
        <ControlBar snap={snap} />
        <PresenterGuide snap={snap} />
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
  const tx = useT()
  const sim = snap.sim
  const [confirm, setConfirm] = useState(false)
  const seated = snap.tables.filter((t) => t.visitId).length
  const fresh = async () => {
    await post('/api/sim/reset')
    await settings({ speed: 10, intensity: 1.6 })
    await settings({ showcase: true })
    toast.success(L('Fresh demo started: showcase mode is on'))
  }
  // Showcase: hands-free. Presenter mode (below) is for walking people through it yourself.
  return (
    <section className="bg-hero overflow-hidden rounded-3xl text-hero-foreground">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <span className={cn('size-2.5 rounded-full', sim.running ? 'animate-pulse bg-good' : 'bg-hero-foreground/40')} aria-hidden />
            {sim.running ? L('Service running') : sim.startedAt ? 'Paused' : L('Not started')}
            {sim.showcase && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{tx('ui.demo.showcase')}</span>}
          </div>
          <div className="mt-1 font-display text-3xl leading-tight sm:text-4xl">
            {seated} {tx('ui.demo.of')} {snap.tables.length} {tx('ui.demo.tables_seated')}
          </div>
          <div className="mt-1 text-sm opacity-75 tabular">
            {sim.speed}{tx('ui.demo.speed')} {sim.waiting} {tx('ui.demo.waiting_for_a_table')} {clock(snap.now)} {tx('ui.demo.ist')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sim.running ? (
            <Button size="lg" variant="secondary" className="h-12 rounded-full px-6" onClick={() => void post('/api/sim/pause')}>
              <Pause /> {tx('ui.demo.pause')}
            </Button>
          ) : (
            <Button size="lg" className="h-12 rounded-full px-6" onClick={() => void post('/api/sim/start')}>
              <Play /> {sim.startedAt ? 'Resume' : L('Start service')}
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
                  void post('/api/sim/reset').then(() => toast.success(L('Service reset: every table is free')))
                }}
              >
                {tx('ui.demo.clear_everything')}
              </Button>
              <Button size="lg" variant="ghost" className="h-12 rounded-full text-hero-foreground hover:bg-white/10 hover:text-hero-foreground" onClick={() => setConfirm(false)}>
                {tx('ui.demo.keep_going')}
              </Button>
            </>
          ) : (
            <Button size="lg" variant="ghost" className="h-12 rounded-full text-hero-foreground hover:bg-white/10 hover:text-hero-foreground" onClick={() => setConfirm(true)}>
              <RotateCcw /> {tx('ui.demo.reset')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 bg-black/15 px-5 py-4 sm:px-6">
        <label htmlFor="showcase" className="flex min-w-0 basis-full cursor-pointer items-start gap-3 sm:basis-0 sm:flex-1">
          <Clapperboard className="mt-0.5 size-5 shrink-0 text-primary-2" aria-hidden />
          <span>
            <span className="block font-medium">{tx('ui.demo.showcase_mode')}</span>
            <span className="block text-sm opacity-75">{tx('ui.demo.hands_free_the_whole')}</span>
          </span>
        </label>
        <Switch id="showcase" checked={sim.showcase} onCheckedChange={(v) => void settings({ showcase: v }).then(() => toast.success(v ? L('Showcase mode on') : L('Showcase mode off')))} />
        <Button variant="secondary" className="rounded-full" onClick={() => void fresh()}>
          <Sparkles /> {tx('ui.demo.start_a_fresh_demo')}
        </Button>
      </div>
    </section>
  )
}

function Moments({ snap }: { snap: Snapshot }) {
  const tx = useT()
  const [busy, setBusy] = useState<Kind | null>(null)
  const stage = async (kind: Kind) => {
    setBusy(kind)
    try {
      const r = await post<{ ok: boolean; text: string }>('/api/sim/moment', { kind })
      if (r.ok) toast.success(`Staged: ${r.text}`)
      else toast(r.text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : L('Couldn’t stage that'))
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-display text-xl">{tx('ui.demo.stage_a_moment')}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{tx('ui.demo.make_something_happen_on')}{!snap.sim.startedAt && L(' The service starts by itself.')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MOMENTS().map(({ kind, title, shows, Icon }) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => void stage(kind)}
            className="lift group flex min-h-16 items-start gap-3 rounded-xl border bg-background p-3 text-left hover:border-primary/40 hover:bg-accent disabled:opacity-60"
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
  const tx = useT()
  const sim = snap.sim
  const pace = PACES().reduce((best, p) => (Math.abs(p.value - sim.intensity) < Math.abs(best.value - sim.intensity) ? p : best), PACES()[0])
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">{tx('ui.demo.pace')}</h2>
      <div className="mt-3 text-sm">{tx('ui.demo.speed_2')}</div>
      <Choice label={tx('ui.demo.speed_2')} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} value={sim.speed} onChange={(speed) => void settings({ speed })} />
      <p className="mt-1 text-xs text-muted-foreground">{tx('ui.demo.10_is_good_for')}</p>
      <div className="mt-4 text-sm">{tx('ui.demo.how_busy')}</div>
      <Choice label={tx('ui.demo.how_busy')} options={PACES()} value={pace.value} onChange={(intensity) => void settings({ intensity })} />
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
  const tx = useT()
  const sim = snap.sim
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const all = servers.every((s) => sim.autopilot.includes(s.id))
  const row = 'flex items-center justify-between gap-3 px-3 py-2.5 text-sm'
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">{tx('ui.demo.who_s_on_autopilot')}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{tx('ui.demo.switch_someone_off_to')}</p>
      <div className="mt-3 divide-y rounded-xl border">
        <label htmlFor="ap-all" className={cn(row, 'font-medium')}>
          {tx('ui.demo.all_servers')}
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
            <ChefHat className="size-4 text-kitchen" aria-hidden /> {tx('ui.demo.kitchen_cooks_by_itself')}
          </span>
          <Switch id="ap-kitchen" checked={sim.autoKitchen} onCheckedChange={(v) => void settings({ autoKitchen: v })} />
        </label>
        <label htmlFor="ap-manager" className={row}>
          <span className="inline-flex items-center gap-2">
            <LayoutDashboard className="size-4 text-primary" aria-hidden /> {tx('ui.demo.manager_answers_visit_requests')}
          </span>
          <Switch id="ap-manager" checked={sim.autoManager} onCheckedChange={(v) => void settings({ autoManager: v })} />
        </label>
      </div>
    </section>
  )
}

/** What's happening, newest first, so the audience can follow along. */
function Feed({ feed }: { feed: FeedItem[] }) {
  const tx = useT()
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
        <h2 className="font-display text-xl">{tx('ui.demo.live_feed')}</h2>
        <span className="text-xs text-muted-foreground">{tx('ui.demo.newest_first')}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{tx('ui.demo.nothing_yet_start_the')}</p>
      ) : (
        <ol tabIndex={0} aria-label={tx('ui.demo.service_log')} className="mt-3 max-h-[420px] space-y-0.5 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-live="polite">
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
  const tx = useT()
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const link = 'flex min-h-11 items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent'
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg">{tx('ui.demo.open_the_screens')}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{tx('ui.demo.each_opens_in_a')}</p>
      <div className="mt-3 divide-y overflow-hidden rounded-xl border">
        {servers.map((s) => (
          <Link key={s.id} to={`/server/${s.id}?device=phone`} target="_blank" rel="noopener" className={link}>
            <Avatar staff={s} className="size-6 text-[10px]" />
            <span className="flex-1">{L('{name}’s phone', { name: s.name })}</span>
            <Smartphone className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        <Link to="/kitchen" target="_blank" rel="noopener" className={link}>
          <ChefHat className="size-5 text-kitchen" aria-hidden />
          <span className="flex-1">{tx('ui.demo.kitchen_pass')}</span>
        </Link>
        <Link to="/manager" target="_blank" rel="noopener" className={link}>
          <LayoutDashboard className="size-5 text-primary" aria-hidden />
          <span className="flex-1">{tx('ui.demo.manager_console')}</span>
        </Link>
        <Link to="/about" target="_blank" rel="noopener" className={link}>
          <BellRing className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex-1">{tx('ui.demo.how_it_works_for')}</span>
        </Link>
      </div>
    </section>
  )
}
