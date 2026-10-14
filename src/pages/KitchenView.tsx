import { CrewCard } from '../components/CrewCard.tsx'
import { MessageCircleQuestion, BellRing, RefreshCw, Sparkles, Bot, Check, Flame, HandPlatter, HeartPulse, Send, ShieldAlert, Timer, UtensilsCrossed } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useAlertOnNew } from '../lib/useAlerts.ts'
import { useKitchenAlerts } from '../lib/useKitchenAlerts.ts'
import { priorityOf, ticketPriority, type Level, type TicketPriority } from '../../shared/priority.ts'
import { useAi } from '../lib/ai.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { safetyIssues } from '../../shared/safety.ts'
import type { OrderLine, Station, TableState } from '../../shared/types.ts'
import { Avatar } from '../components/Avatar.tsx'
import { AppShell, LiveClock, ShellSkeleton, BrandEmpty } from '../components/kit.tsx'
import { TeamCard } from '../components/TeamCard.tsx'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { minutesAgo, mmss } from '../lib/format.ts'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

const FLOOR = '__floor'
const STATIONS: Station[] = ['grill', 'hot', 'cold', 'pastry', 'bar']
const MIN = 60_000

interface Ticket {
  ticketId: string
  table: TableState
  lines: OrderLine[]
}

/**
 * The kitchen display: tickets on the line (oldest first, late ones flagged), food waiting at
 * the pass, what's cooking all day by dish, and two-way notes with the floor. Allergy and diet
 * clashes sit at the top of every ticket they affect.
 */
export default function KitchenView() {
  useRolePage({ kind: 'kitchen' })
  const { snap, connected } = useSnapshot('kitchen')
  const [station, setStation] = useState<Station | 'all'>('all')
  // New tickets, guest questions and notes from the floor alert the pass (as chosen in Settings).
  useAlertOnNew(
    snap
      ? [
          ...new Set(snap.tables.flatMap((t) => t.lines.filter((l) => l.status === 'fired').map((l) => `k:${l.ticketId}`))),
          ...(snap.questions ?? []).filter((q) => !q.answer).map((q) => `q:${q.id}`),
          ...snap.notes.filter((n) => n.direction === 'to_kitchen' && !n.ackAt).map((n) => `n:${n.id}`),
        ]
      : null,
  )

  const tickets = useMemo(() => {
    if (!snap) return { line: [] as Ticket[], pass: [] as Ticket[] }
    const map = new Map<string, Ticket>()
    for (const t of snap.tables)
      for (const l of t.lines) {
        if (l.status !== 'fired' && l.status !== 'ready') continue
        const e = map.get(l.ticketId) ?? { ticketId: l.ticketId, table: t, lines: [] }
        e.lines.push(l)
        map.set(l.ticketId, e)
      }
    const all = [...map.values()].sort((a, b) => a.lines[0].firedAt - b.lines[0].firedAt)
    return { line: all.filter((k) => k.lines.some((l) => l.status === 'fired')), pass: all.filter((k) => k.lines.every((l) => l.status === 'ready')) }
  }, [snap])

  // Tickets ordered by what the restaurant said matters most (see Setup → Kitchen priorities), most urgent first.
  const ranked = useMemo(() => {
    if (!snap) return null
    return tickets.line
      .map((k) => ({ k, p: ticketPriority(k.table, k.lines, snap.config, snap.now) }))
      .sort((a, b) => b.p.score - a.p.score || Math.min(...a.k.lines.map((l) => l.firedAt)) - Math.min(...b.k.lines.map((l) => l.firedAt)))
  }, [snap, tickets.line])
  useKitchenAlerts(
    ranked && snap
      ? ranked.map(({ k, p }) => ({ id: k.ticketId, table: k.table.name, dishes: k.lines.filter((l) => l.status === 'fired').map((l) => `${l.qty}× ${l.name}`).join(', '), level: p.level, minsOver: p.minsOver, reasons: p.reasons }))
      : null,
    snap?.now ?? 0,
    snap ? priorityOf(snap.config).realertMin : 2,
  )

  if (!snap || !ranked) return <ShellSkeleton />
  const now = snap.now
  const tol = snap.config.sop.kitchenDelayToleranceMin * MIN
  const isLate = (k: Ticket) => k.lines.some((l) => l.status === 'fired' && now > l.expectedReadyAt + tol)
  const inStation = (k: Ticket) => station === 'all' || k.lines.some((l) => l.station === station)
  const lineRanked = ranked.filter(({ k }) => inStation(k))
  const line = lineRanked.map(({ k }) => k)
  // "Running late" counts every ticket past its standard time (the guest-warning tolerance is separate).
  const late = ranked.filter(({ p }) => p.level === 'late' || p.level === 'critical').length
  const stationCount = (s: Station) => tickets.line.filter((k) => k.lines.some((l) => l.station === s && l.status === 'fired')).length

  return (
    <AppShell title="Kitchen pass" sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />}>
      {/* Service at a glance, and the station filter */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-4 py-3">
        <Count icon={<Flame className="size-4 text-primary" />} n={tickets.line.length} label="on the line" />
        <Count icon={<Timer className={cn('size-4', late ? 'text-kitchen' : 'text-muted-foreground')} />} n={late} label="running late" tone={late ? 'text-kitchen' : undefined} />
        <Count icon={<HandPlatter className="size-4 text-good" />} n={tickets.pass.length} label="waiting at the pass" />
        {(snap.questions ?? []).some((q) => !q.answer) && (
          <Count icon={<MessageCircleQuestion className="size-4 text-primary" />} n={(snap.questions ?? []).filter((q) => !q.answer).length} label="guest questions" tone="text-primary" />
        )}
        <div className="ml-auto flex flex-wrap gap-1.5" role="radiogroup" aria-label="Station">
          {(['all', ...STATIONS] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={station === s}
              onClick={() => setStation(s)}
              className={cn('min-h-9 pointer-coarse:min-h-11 rounded-full border px-3 text-sm capitalize transition-colors', station === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground')}
            >
              {s === 'all' ? 'All stations' : s}
              {s !== 'all' && stationCount(s) > 0 && <span className="ml-1 tabular">{stationCount(s)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <LaneTitle icon={<Flame className="size-4" />} title="On the line" n={line.length} />
            {line.length === 0 ? (
              <BrandEmpty title={`Nothing cooking${station !== 'all' ? ` on ${station}` : ''}`}>New tickets land here the second they’re fired, with the clock already running.</BrandEmpty>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {lineRanked.map(({ k, p }, i) => (
                    <TicketCard key={k.ticketId} k={k} now={now} late={isLate(k)} station={station} snap={snap} pri={p} rank={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          <section>
            <LaneTitle icon={<HandPlatter className="size-4" />} title="At the pass" n={tickets.pass.length} />
            {tickets.pass.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">The pass is clear.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {tickets.pass.map((k) => (
                  <PassCard key={k.ticketId} k={k} now={now} snap={snap} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          <ChefsCall ranked={ranked} />
          {snap.crew && <CrewCard crew={snap.crew} muted={snap.sim.autoKitchen} />}
          <Questions snap={snap} />
          <AllDay tickets={tickets.line} station={station} />
          <TeamCard snap={snap} meId={snap.config.staff.find((s) => s.role === 'kitchen')?.id ?? 'k_pass'} compact />
          <TellFloor snap={snap} />
          <EightySix snap={snap} />
          {snap.sim.startedAt !== null && (
            <label htmlFor="auto-kitchen" className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Bot className="size-4 text-muted-foreground" /> Demo: kitchen cooks automatically
              </span>
              <Switch id="auto-kitchen" checked={snap.sim.autoKitchen} onCheckedChange={(v) => void post('/api/sim/settings', { autoKitchen: v })} />
            </label>
          )}
        </div>
      </div>
    </AppShell>
  )
}

type Snap = NonNullable<ReturnType<typeof useSnapshot>['snap']>

function Count({ icon, n, label, tone }: { icon: React.ReactNode; n: number; label: string; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span className={cn('font-display text-2xl leading-none tabular', tone)}>
        <span key={n} className="tick">{n}</span>
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </span>
  )
}

function LaneTitle({ icon, title, n }: { icon: React.ReactNode; title: string; n: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
      <span className="text-primary">{icon}</span> {title} <span className="font-sans text-sm font-normal text-muted-foreground tabular">{n}</span>
    </h2>
  )
}

function TicketCard({ k, now, late, station, snap, pri, rank }: { k: Ticket; now: number; late: boolean; station: Station | 'all'; snap: Snap; pri: TicketPriority; rank: number }) {
  const fired = Math.min(...k.lines.map((l) => l.firedAt))
  const expected = Math.max(...k.lines.map((l) => l.expectedReadyAt))
  const frac = Math.min(1, (now - fired) / Math.max(1, expected - fired))
  const over = Math.max(0, Math.round((now - expected) / MIN))
  const server = snap.config.staff.find((s) => s.id === k.table.serverId)
  const allergies = k.table.party?.allergies ?? []
  const clashes = k.lines.flatMap((l) =>
    l.safetyResolution === 'guest_ok' ? [] : safetyIssues(snap.config.menu.find((m) => m.id === l.menuItemId), k.table.party).map((i) => ({ dish: l.name, ...i })),
  )
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn('flex flex-col overflow-hidden rounded-2xl border bg-card', LEVEL_RING[pri.level], pri.level === 'critical' && 'pulse-soft')}
    >
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div>
          <div className="font-display text-3xl leading-none">{k.table.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {server && <Avatar staff={server} className="size-4 text-[9px]" />}
            {server?.name} · <span className="capitalize">{k.lines[0].course}s</span>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('font-display text-xl tabular', late ? 'text-kitchen' : 'text-foreground')}>{mmss(now - fired)}</div>
          <div className="text-[11px] text-muted-foreground tabular">{over > 0 ? `${over} min over` : `of ${mmss(expected - fired)}`}</div>
        </div>
      </div>
      {(rank === 0 || pri.reasons.length > 0) && (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-1.5">
          {rank === 0 && <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Do first</span>}
          {pri.level !== 'normal' && <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', LEVEL_CHIP[pri.level])}>{LEVEL_LABEL[pri.level]}</span>}
          {pri.reasons.map((r) => (
            <span key={r} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {r}
            </span>
          ))}
        </div>
      )}
      <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn('h-full rounded-full transition-[width] duration-1000', late ? 'bg-kitchen' : 'bg-primary/70')} style={{ width: `${frac * 100}%` }} />
      </div>

      {(allergies.length > 0 || clashes.length > 0) && (
        <div className="mx-4 mt-3 space-y-1 rounded-lg bg-warn/12 p-2 text-xs font-medium text-warn">
          {allergies.length > 0 && (
            <div className="flex items-center gap-1.5">
              <HeartPulse className="size-3.5 shrink-0" /> Allergy: {allergies.join(', ')}
            </div>
          )}
          {clashes.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <ShieldAlert className="mt-px size-3.5 shrink-0" /> {c.dish}: {c.tag} ({c.because === 'allergy' ? 'allergy' : `${c.because} guest`})
            </div>
          ))}
        </div>
      )}

      <ul className="flex-1 space-y-1.5 p-4 text-[15px]">
        {k.lines.map((l) => {
          const dim = station !== 'all' && l.station !== station
          return (
            <li key={l.id} className={cn('flex items-baseline gap-2', dim && 'opacity-40', l.status === 'ready' && 'text-muted-foreground line-through')}>
              <span className="w-6 shrink-0 font-display text-lg tabular">{l.qty}×</span>
              <span className="min-w-0 flex-1">{l.name}</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{l.station}</span>
            </li>
          )
        })}
      </ul>
      <div className="p-3 pt-0">
        <Button className="h-11 w-full text-base" onClick={() => void act('item.ready', { ticketId: k.ticketId }, 'kitchen')}>
          <Check /> Ready
        </Button>
      </div>
    </motion.article>
  )
}

/**
 * The chef's call: the first few tickets in the order the restaurant's priorities give, and, when something is
 * nearing or past its time, the AI's short read of what to send first and why. The order never depends on the AI:
 * if it's busy or offline the same list is shown with a plain-words summary.
 */
function ChefsCall({ ranked }: { ranked: { k: Ticket; p: TicketPriority }[] }) {
  const ai = useAi()
  const top = ranked.slice(0, 3)
  const urgent = ranked.some(({ p }) => p.level !== 'normal')
  const sig = top.map(({ k, p }) => `${k.ticketId}${p.level}`).join(',')
  const last = useRef(0)
  useEffect(() => {
    // Asked when the picture changes and something is nearing or late, at most once every 45 seconds.
    if (!urgent || Date.now() - last.current < 45_000) return
    last.current = Date.now()
    void ai.ask('kitchen_triage')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, urgent])
  if (!top.length) return null
  const dishes = (k: Ticket) => k.lines.filter((l) => l.status === 'fired').map((l) => `${l.qty}× ${l.name}`).join(', ')
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label="Chef’s call">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Chef’s call
        </h2>
        <button
          type="button"
          onClick={() => {
            last.current = Date.now()
            void ai.ask('kitchen_triage')
          }}
          disabled={ai.loading}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label="Ask the AI again"
        >
          <RefreshCw className={cn('size-3.5', ai.loading && 'animate-spin')} /> Refresh
        </button>
      </div>
      <ol className="mt-2 space-y-2">
        {top.map(({ k, p }, i) => (
          <li key={k.ticketId} className="flex items-start gap-2.5 text-sm">
            <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold', i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
            <span className="min-w-0">
              <span className="font-medium">{k.table.name}</span> <span className="text-muted-foreground">{dishes(k)}</span>
              {p.reasons.length > 0 && <span className={cn('block text-xs', p.level === 'late' || p.level === 'critical' ? 'text-kitchen' : 'text-muted-foreground')}>{p.reasons.join(' · ')}</span>}
            </span>
          </li>
        ))}
      </ol>
      {(ai.answer || ai.loading) && (
        <p className="mt-3 border-t pt-3 text-sm text-pretty" aria-live="polite">
          {ai.answer?.text ?? <span className="text-muted-foreground">Thinking it through…</span>}
          {ai.answer && <span className="mt-1 block text-[11px] text-muted-foreground">{ai.answer.source === 'built-in' ? 'Summary from your priorities' : `AI assessment, weighed with your kitchen priorities`}</span>}
        </p>
      )}
    </section>
  )
}

const LEVEL_RING: Record<Level, string> = {
  normal: '',
  soon: 'border-warn/60',
  late: 'border-kitchen ring-1 ring-kitchen/40',
  critical: 'border-kitchen ring-2 ring-kitchen/60',
}
const LEVEL_CHIP: Record<Level, string> = { normal: '', soon: 'bg-warn/15 text-warn', late: 'bg-kitchen/15 text-kitchen', critical: 'bg-kitchen text-white' }
const LEVEL_LABEL: Record<Level, string> = { normal: '', soon: 'Nearly due', late: 'Late', critical: 'Critical' }

/** Food at the pass: how long it has waited, and a nudge to the table's server. */
function PassCard({ k, now, snap }: { k: Ticket; now: number; snap: Snap }) {
  const readyAt = Math.min(...k.lines.map((l) => l.readyAt ?? now))
  const waited = now - readyAt
  const slow = waited > snap.config.sop.pickupWithinMin * MIN
  const server = snap.config.staff.find((s) => s.id === k.table.serverId)
  return (
    <div className={cn('rounded-2xl border bg-card p-3', slow ? 'border-warn/60' : 'border-good/50')}>
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl leading-none">{k.table.name}</span>
        <span className={cn('text-sm tabular', slow ? 'font-semibold text-warn' : 'text-good')}>{mmss(waited)}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{k.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {server && <Avatar staff={server} className="size-5 text-[10px]" />} {server?.name}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-full"
          onClick={async () => {
            await act('note.sent', { noteId: noteId(), direction: 'to_floor', tableId: k.table.id, text: `${k.table.name} ${k.lines[0].course}s are waiting at the pass`, from: 'k_pass' }, 'kitchen')
            toast.success(`Nudged ${server?.name ?? 'the server'}`)
          }}
        >
          <BellRing /> Nudge
        </Button>
      </div>
    </div>
  )
}

/** "All day": how many of each dish are cooking right now. */
function AllDay({ tickets, station }: { tickets: Ticket[]; station: Station | 'all' }) {
  const counts = new Map<string, { n: number; station: Station }>()
  for (const k of tickets)
    for (const l of k.lines) {
      if (l.status !== 'fired' || (station !== 'all' && l.station !== station)) continue
      const c = counts.get(l.name) ?? { n: 0, station: l.station }
      c.n += l.qty
      counts.set(l.name, c)
    }
  const rows = [...counts].sort((a, b) => b[1].n - a[1].n)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <UtensilsCrossed className="size-4 text-primary" /> All day
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing cooking right now.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(([name, c]) => (
            <li key={name} className="flex items-baseline gap-2 text-sm">
              <span className="w-7 font-display text-lg tabular">{c.n}</span>
              <span className="flex-1">{name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.station}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TellFloor({ snap }: { snap: Snap }) {
  const [text, setText] = useState('')
  const [table, setTable] = useState(FLOOR)
  async function send(body = text) {
    if (!body.trim()) return
    const tableId = table === FLOOR ? undefined : table
    await act('note.sent', { noteId: noteId(), direction: 'to_floor', tableId, text: body.trim(), from: 'k_pass' }, 'kitchen')
    toast.success(tableId ? `Sent to ${tableId}'s server` : 'Sent to the whole floor')
    setText('')
  }
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">Quick update to the floor</h2>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {['Mains in 5 min', 'Grill is backed up', 'Ready to fire', 'Running low on bread'].map((q) => (
          <button key={q} type="button" onClick={() => void send(q)} className="rounded-full border bg-background px-2.5 py-1 text-xs pointer-coarse:min-h-11 pointer-coarse:px-3.5 text-muted-foreground hover:text-foreground">
            {q}
          </button>
        ))}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <Select value={table} onValueChange={setTable}>
          <SelectTrigger id="note-table" className="w-full" aria-label="Who to tell">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FLOOR}>Whole floor</SelectItem>
            {snap.tables
              .filter((t) => t.visitId)
              .map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input id="floor-note" name="floor-note" aria-label="Note to the floor" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. mains 5 min, grill backed up…" />
          <Button type="submit" size="icon" aria-label="Send to floor" disabled={!text.trim()}>
            <Send />
          </Button>
        </div>
      </form>
    </section>
  )
}

/** The 86 board: switch a dish off and every affected table gets a "tell the guest" card. */
function EightySix({ snap }: { snap: Snap }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Availability (86 board)</h2>
      <p className="mb-2 text-xs text-muted-foreground">Switch a dish off and servers with it on an order are told straight away.</p>
      <ul className="divide-y">
        {snap.config.menu.map((m) => {
          const off = snap.unavailable.includes(m.id)
          return (
            <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-sm pointer-coarse:min-h-12">
              <label htmlFor={`stock-${m.id}`} className={cn('flex min-h-8 flex-1 cursor-pointer items-center', off && 'text-muted-foreground line-through')}>
                {m.name}
              </label>
              <Switch id={`stock-${m.id}`} checked={!off} onCheckedChange={(on) => void act('item.stock', { menuItemId: m.id, available: on }, 'kitchen')} aria-label={`${m.name} available`} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const QUICK_ANSWERS = ['Yes', 'No', 'Not spicy', 'Mild', 'Medium spicy', 'Hot', 'Can be made mild', 'Chef will come to the table']

/**
 * Guests' questions the menu notes couldn't answer, sent by servers. Answer in a tap or a line;
 * the answer goes back to the server as a card and, if kept, joins the dish's notes for next time.
 */
function Questions({ snap }: { snap: Snap }) {
  const all = snap.questions ?? []
  const open = all.filter((q) => !q.answer)
  const recent = all.filter((q) => q.answer).slice(0, 3)
  if (!all.length) return null
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  return (
    <section className={cn('rounded-2xl border bg-card p-4', open.length && 'border-primary/50 ring-2 ring-primary/15')} aria-label="Guest questions">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <MessageCircleQuestion className="size-4 text-primary" /> Guest questions
        {open.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular">{open.length}</span>}
      </h2>
      <ul className="space-y-3">
        {open.map((q) => (
          <QuestionRow key={q.id} q={q} snap={snap} who={name(q.from)} />
        ))}
        {recent.map((q) => (
          <li key={q.id} className="rounded-lg bg-muted/60 p-2.5 text-sm">
            <div className="text-[11px] text-muted-foreground">
              {name(q.from)} asked{q.tableId ? ` for ${q.tableId}` : ''}
            </div>
            <div>{q.text}</div>
            <div className="mt-1 font-medium">→ {q.answer}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuestionRow({ q, snap, who }: { q: NonNullable<Snap['questions']>[number]; snap: Snap; who: string }) {
  const [answer, setAnswer] = useState('')
  const [save, setSave] = useState(!!q.menuItemId)
  const [busy, setBusy] = useState(false)
  const dish = snap.config.menu.find((m) => m.id === q.menuItemId)
  async function send(text = answer) {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await post('/api/kitchen/answer', { questionId: q.id, answer: text.trim(), save })
      toast.success(save && dish ? `Answered ${who}, and saved to ${dish.name}` : `Answered ${who}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className="rounded-xl border border-primary/30 bg-background p-3">
      <div className="text-[11px] text-muted-foreground">
        {who}
        {q.tableId ? `, ${q.tableId}` : ''}
        {dish ? ` · ${dish.name}` : ''} · {minutesAgo(q.at, snap.now) < 1 ? 'just now' : `${minutesAgo(q.at, snap.now)} min ago`}
      </div>
      <p className="mt-0.5 font-medium">{q.text}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_ANSWERS.map((a) => (
          <button key={a} type="button" disabled={busy} onClick={() => void send(a)} className="rounded-full border bg-background px-2.5 py-1 text-xs pointer-coarse:min-h-11 pointer-coarse:px-3.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            {a}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Or type an answer…" aria-label={`Answer ${who}`} autoComplete="off" />
        <Button type="submit" size="icon" aria-label="Send answer" disabled={!answer.trim() || busy}>
          <Send />
        </Button>
      </form>
      {dish && (
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={save} onCheckedChange={(v) => setSave(!!v)} /> Save to {dish.name}’s notes so it’s answered at once next time
        </label>
      )}
    </li>
  )
}
