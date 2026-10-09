import { Plug, ChefHat, CircleCheck, History, Frown, HandHelping, Receipt as ReceiptIcon, ShieldAlert, Smile, HeartHandshake, Lightbulb, Loader2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { Owner, Segment, VisitRecord } from '../../shared/types.ts'
import { AiAnswerBox } from '../components/AiAnswer.tsx'
import { AppShell, LiveClock, ShellSkeleton, PanelTitle } from '../components/kit.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { FloorPlan } from '../components/FloorPlan.tsx'
import { IncidentSheet, NextFifteen, WhatIfCard, WhyTonight } from '../components/ManagerIntel.tsx'
import { TeamCard } from '../components/TeamCard.tsx'
import { liveVisit, reconstructVisit, type Reconstruction } from '../../shared/intel.ts'
import { AssistantDrawer } from '../components/Practice.tsx'
import { safetyIssues } from '../../shared/safety.ts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { clock, minutesAgo } from '../lib/format.ts'
import { act, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

const MIN = 60_000

const OWNER_COLOR: Record<Owner, string> = {
  floor: 'var(--floor-mark)',
  kitchen: 'var(--kitchen-mark)',
  guest: 'var(--muted-foreground)',
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle>
      <PanelTitle>{children}</PanelTitle>
    </CardTitle>
  )
}

export default function ManagerView() {
  useRolePage({ kind: 'manager' })
  const { snap, connected } = useSnapshot('manager')
  const summary = useAi()
  const [assist, setAssist] = useState(false)
  const [incident, setIncident] = useState<Reconstruction | null>(null)
  if (!snap || !snap.analytics) return <ShellSkeleton />
  const managerId = snap.config.staff.find((s) => s.role === 'manager')?.id ?? 'm_floor'
  const a = snap.analytics
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  const maxMin = Math.max(1, ...a.stages.map((s) => Math.max(s.avgMin, s.avgTargetMin)))

  return (
    <AppShell
      title="Service overview"
      sub={snap.config.name}
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="h-9 rounded-full" onClick={() => setAssist(true)} aria-label="Ask TableMate">
            <Sparkles /> <span className="hidden sm:inline">Ask TableMate</span>
          </Button>
          {/* The phone shows the time already; keep the header on one line. */}
          <span className="hidden sm:contents">
            <LiveClock now={snap.now} ok={connected} />
          </span>
        </div>
      }
    >
      <AssistantDrawer open={assist} onOpenChange={setAssist} staffId={managerId} provider={snap.ai.provider} role="manager" wide />
      <div className="space-y-5">
        <NeedsYou snap={snap} />
        <Pulse snap={snap} />
        <ConnectedSystems snap={snap} />
        <TeamCard snap={snap} meId={managerId} />
        {snap.intel && snap.forecast && (
          <div className="grid gap-5 lg:grid-cols-2">
            <WhyTonight intel={snap.intel} />
            <NextFifteen forecast={snap.forecast} name={name} />
          </div>
        )}
        <LiveFloor
          snap={snap}
          onReconstruct={(t) => {
            const v = liveVisit(t, snap.config, snap.now)
            if (v) setIncident(reconstructVisit(v, snap.config, true))
          }}
        />

        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <Heading>Where time goes: average vs standard</Heading>
            </CardHeader>
            <CardContent className="space-y-4">
              {a.stages.map((s) => (
                <Tooltip key={s.stage}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1.5" tabIndex={0}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span>
                          {s.label} <span className="text-xs text-muted-foreground">({s.owner})</span>
                        </span>
                        <span className="text-xs tabular text-muted-foreground">{s.count ? `${s.avgMin} / ${s.avgTargetMin} min · ${Math.round(s.lapseRate * 100)}% late` : 'no data yet'}</span>
                      </div>
                      <div className="relative h-3 rounded-full bg-muted">
                        <div className="h-full origin-left rounded-full transition-transform duration-700" style={{ transform: `scaleX(${s.avgMin / maxMin})`, background: OWNER_COLOR[s.owner] }} />
                        {s.count > 0 && <div className="absolute -top-0.5 h-4 w-0.5 rounded bg-foreground" style={{ left: `${(s.avgTargetMin / maxMin) * 100}%` }} />}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {s.label}: {s.count} steps, avg {s.avgMin} min vs standard {s.avgTargetMin} min
                  </TooltipContent>
                </Tooltip>
              ))}
              <Legend />
            </CardContent>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <Heading>Kitchen stations</Heading>
                <CardAction>
                  <ChefHat className="size-4 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                {a.stations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Station figures appear once tickets are completed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">Station</th>
                          <th className="pb-2 text-right font-medium">Tickets</th>
                          <th className="pb-2 text-right font-medium">Past standard</th>
                          <th className="pb-2 text-right font-medium">Avg over</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {a.stations.map((s) => (
                          <tr key={s.station}>
                            <td className="py-2 capitalize">{s.station}</td>
                            <td className="py-2 text-right">{s.tickets}</td>
                            <td className={cn('py-2 text-right', s.lapses > 0 && 'font-medium text-kitchen')}>{s.lapses}</td>
                            <td className="py-2 text-right text-muted-foreground">{s.avgOverMin} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
              {a.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <Heading>Suggestions</Heading>
                  <CardAction>
                    <Lightbulb className="size-4 text-primary" />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {a.suggestions.map((s) => (
                    <p key={s} className="rounded-lg bg-muted p-3 text-sm">
                      {s}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <GuestMood moods={a.moods} safety={a.safetyCatches} />
          <Card>
            <CardHeader>
              <Heading>Team goal and recognition</Heading>
              <CardDescription>Shared by the whole floor. Individual XP and badges stay on each server’s phone.</CardDescription>
              <CardAction>
                <Users className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span>Tables served fully to standard</span>
                  <span className="font-display text-2xl tabular">
                    {Math.min(snap.team.smooth, snap.team.goal)}
                    <span className="text-base text-muted-foreground">/{snap.team.goal}</span>
                  </span>
                </div>
                <Progress value={Math.min(100, (snap.team.smooth / snap.team.goal) * 100)} className="mt-2 h-2" aria-label="Team goal progress" />
              </div>
              <ul className="space-y-1.5">
                {snap.team.kudos.length === 0 && <li className="text-sm text-muted-foreground">Kudos staff send each other appear here.</li>}
                {snap.team.kudos.slice(0, 4).map((k) => (
                  <li key={k.id} className="flex items-center gap-2 text-sm">
                    <HeartHandshake className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 truncate">
                      <b className="font-medium">{name(k.from)}</b> thanked <b className="font-medium">{name(k.to)}</b>: {k.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <WhatIfCard servers={snap.config.staff.filter((s) => s.role === 'server')} />
        <Card>
          <CardHeader>
            <Heading>Shift summary</Heading>
            <CardDescription>A plain-English read of tonight’s bottlenecks, written by AI from the numbers on this page.</CardDescription>
            <CardAction>
              <Button variant="secondary" disabled={summary.loading} onClick={() => summary.ask('shift_summary')}>
                {summary.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {summary.answer ? 'Refresh' : 'Summarise'}
              </Button>
            </CardAction>
          </CardHeader>
          {(summary.answer || summary.error) && (
            <CardContent>
              <AiAnswerBox answer={summary.answer} error={summary.error} />
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <Heading>Delay receipts: recent tables</Heading>
            <CardDescription>Each bar is one step of the visit, coloured by who controlled it. Open one to see what happened, step by step.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.recentVisits.length === 0 ? <p className="text-sm text-muted-foreground">Receipts appear as tables finish.</p> : a.recentVisits.map((v) => <Receipt key={v.visitId} v={v} server={name(v.serverId)} onOpen={() => setIncident(reconstructVisit(v, snap.config))} />)}
            <Legend />
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-good" /> Process view only: stages, stations and load. Personal scores stay on each server’s phone, and every delay is attributed to whoever controlled that step.
        </p>
      </div>
      <IncidentSheet r={incident} onClose={() => setIncident(null)} server={incident ? name(incident.serverId) : ''} />
    </AppShell>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ background: OWNER_COLOR.floor }} /> Floor-controlled
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ background: OWNER_COLOR.kitchen }} /> Kitchen
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 rounded bg-foreground" /> Standard
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm border-2 border-warn" /> Past standard
      </span>
    </div>
  )
}

/** One table's visit: each measured step as a bar on the visit's timeline. */
function Receipt({ v, server, onOpen }: { v: VisitRecord; server: string; onOpen: () => void }) {
  const span = Math.max(1, v.endedAt - v.seatedAt)
  const pos = (t: number) => ((t - v.seatedAt) / span) * 100
  const lapses = v.segments.filter((s) => s.lapse)
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-xl border bg-background/50 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`What happened at ${v.tableName}, ${clock(v.seatedAt)}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-semibold">{v.tableName}</span> <span className="text-muted-foreground">{v.partySize} guests, served by {server}</span>
        </span>
        <span className="text-xs tabular text-muted-foreground">
          {clock(v.seatedAt)}–{clock(v.endedAt)}
        </span>
      </div>
      <div className="relative mt-2 h-4 rounded bg-muted">
        {v.segments.map((s: Segment, i) => (
          <div
            key={i}
            title={`${s.label}: ${((s.end - s.start) / 60_000).toFixed(1)} min (standard ${s.targetMin.toFixed(1)})${s.lapse ? ' · past standard' : ''}`}
            className={cn('absolute top-0 h-full rounded-sm', s.lapse && 'ring-2 ring-warn')}
            style={{ left: `${pos(s.start)}%`, width: `max(4px, ${pos(s.end) - pos(s.start)}%)`, background: OWNER_COLOR[s.owner] }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {lapses.length === 0
          ? 'Every step to standard.'
          : lapses.map((s) => `${s.label} +${((s.end - s.start) / 60_000 - s.targetMin).toFixed(1)} min (${s.owner}${s.station ? `, ${s.station}` : ''})`).join(' · ')}
      </p>
    </button>
  )
}

/** How guests felt at check-ins tonight, by table. Never broken down by server. */
function GuestMood({ moods, safety }: { moods: { happy: number; ok: number; unhappy: number; recovered: number }; safety: number }) {
  const total = moods.happy + moods.ok + moods.unhappy
  const rows = [
    { label: 'Happy', n: moods.happy, color: 'var(--good)' },
    { label: 'Okay', n: moods.ok, color: 'var(--muted-foreground)' },
    { label: 'Not happy', n: moods.unhappy, color: 'var(--warn)' },
  ]
  return (
    <Card>
      <CardHeader>
        <Heading>Guest mood and safety tonight</Heading>
        <CardDescription>From servers’ one-tap check-ins, counted per table. Unhappy tables get a recovery card straight away.</CardDescription>
        <CardAction>
          <Smile className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={rows.map((r) => `${r.label} ${r.n}`).join(', ')}>
                {rows.map((r) => (r.n ? <div key={r.label} style={{ width: `${(r.n / total) * 100}%`, background: r.color }} /> : null))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {rows.map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                    {r.label} <b className="tabular">{r.n}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <div className="text-2xl font-semibold tabular">{moods.unhappy ? `${moods.recovered}/${moods.unhappy}` : '—'}</div>
            <div className="text-xs text-muted-foreground">unhappy tables won back</div>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <div className="flex items-center gap-1.5 text-2xl font-semibold tabular">
              <ShieldAlert className="size-5 text-warn" /> {safety}
            </div>
            <div className="text-xs text-muted-foreground">allergy or diet clashes caught</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type Snap = NonNullable<ReturnType<typeof useSnapshot>['snap']>

const ago = (at: number, now: number) => (minutesAgo(at, now) < 1 ? 'just now' : `${minutesAgo(at, now)} min`)

/**
 * What needs the manager right now, most urgent first: visit requests from servers, tickets the
 * kitchen is behind on, bills waiting, unhappy tables and unresolved allergy or diet clashes.
 */
function NeedsYou({ snap }: { snap: Snap }) {
  const now = snap.now
  const sop = snap.config.sop
  const a = snap.analytics!
  const server = (id: string) => snap.config.staff.find((s) => s.id === id)
  const items: { key: string; icon: React.ReactNode; title: string; detail: string; at: number; action?: React.ReactNode }[] = []
  for (const r of a.managerRequests) {
    const t = snap.tables.find((x) => x.id === r.tableId)
    items.push({
      key: `visit-${r.tableId}`,
      icon: <HandHelping className="size-4 text-primary" />,
      title: `Visit ${r.tableName}`,
      detail: `${server(t?.serverId ?? '')?.name ?? 'A server'} asked you to see the guests`,
      at: r.at,
      action: (
        <Button size="sm" className="h-8 rounded-full" onClick={() => void act('manager.visited', { tableId: r.tableId }, 'manager')}>
          Visited
        </Button>
      ),
    })
  }
  for (const t of snap.tables) {
    if (!t.visitId) continue
    const clash = t.lines.filter((l) => !l.safetyResolvedAt && l.status !== 'served' && l.status !== 'unavailable' && safetyIssues(snap.config.menu.find((m) => m.id === l.menuItemId), t.party).length)
    if (clash.length)
      items.push({ key: `safety-${t.id}`, icon: <ShieldAlert className="size-4 text-warn" />, title: `${t.name}: allergy or diet clash`, detail: clash.map((l) => l.name).join(', '), at: Math.min(...clash.map((l) => l.firedAt)) })
    const late = t.lines.filter((l) => l.status === 'fired' && now > l.expectedReadyAt + sop.kitchenDelayToleranceMin * MIN)
    if (late.length)
      items.push({ key: `late-${t.id}`, icon: <ChefHat className="size-4 text-kitchen" />, title: `${t.name}: kitchen running late`, detail: late.map((l) => l.name).join(', '), at: Math.min(...late.map((l) => l.expectedReadyAt)) })
    if (t.billRequestedAt && !t.billPresentedAt && now > t.billRequestedAt + sop.billPresentWithinMin * MIN)
      items.push({ key: `bill-${t.id}`, icon: <ReceiptIcon className="size-4 text-warn" />, title: `${t.name}: waiting for the bill`, detail: `${server(t.serverId)?.name ?? ''}’s table`, at: t.billRequestedAt })
    if (t.mood?.value === 'unhappy' && !t.recoveredAt)
      items.push({ key: `mood-${t.id}`, icon: <Frown className="size-4 text-warn" />, title: `${t.name}: guests not happy`, detail: `${server(t.serverId)?.name ?? 'The server'} is putting it right`, at: t.mood.at })
  }
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
        Needs you now {items.length > 0 && <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular">{items.length}</span>}
      </h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-good" /> All calm. Nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary">{i.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{i.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.detail}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">{ago(i.at, now)}</span>
              {i.action}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Tonight in five numbers, in one strip. */
function Pulse({ snap }: { snap: Snap }) {
  const a = snap.analytics!
  const seated = snap.tables.filter((t) => t.visitId)
  const covers = seated.reduce((n, t) => n + (t.party?.size ?? 0), 0)
  const moods = a.moods.happy + a.moods.ok + a.moods.unhappy
  const items = [
    { label: 'Seated now', value: `${seated.length}/${snap.tables.length}`, sub: `${covers} guests` },
    { label: 'Tables served', value: a.visits, sub: snap.sim.waiting ? `${snap.sim.waiting} waiting for a table` : 'no one waiting' },
    { label: 'Served to standard', value: a.smoothRate == null ? '—' : `${Math.round(a.smoothRate * 100)}%`, sub: 'no floor-controlled lapse' },
    { label: 'Late steps', value: `${a.lapsesByOwner.floor} · ${a.lapsesByOwner.kitchen}`, sub: 'floor · kitchen' },
    { label: 'Happy check-ins', value: moods ? `${Math.round((a.moods.happy / moods) * 100)}%` : '—', sub: moods ? `${moods} check-ins` : 'none yet' },
  ]
  return (
    <section className="grid grid-cols-2 divide-border overflow-hidden rounded-2xl border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {items.map((i) => (
        <div key={i.label} className="p-4">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className="mt-1 font-display text-2xl tabular">{i.value}</div>
          <div className="text-[11px] text-muted-foreground">{i.sub}</div>
        </div>
      ))}
    </section>
  )
}

/** Every section as a floor plan, with its server and how loaded they are (load, never performance). */
function LiveFloor({ snap, onReconstruct }: { snap: Snap; onReconstruct: (t: Snap['tables'][number]) => void }) {
  const [picked, setPicked] = useState<string | undefined>()
  const a = snap.analytics!
  const sections = Object.entries(snap.config.sections)
  const table = snap.tables.find((t) => t.id === picked)
  return (
    <section>
      <h2 className="mb-2 font-display text-xl">Live floor</h2>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sections.map(([section, staffId]) => {
          const s = snap.config.staff.find((x) => x.id === staffId)
          const load = a.load.find((l) => l.staffId === staffId)
          const open = snap.openTasks?.[staffId] ?? 0
          const tables = snap.tables.filter((t) => t.section === section)
          return (
            <div key={section} className="rounded-2xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                {s && <Avatar staff={s} className="size-7 text-xs" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{s?.name ?? 'Unassigned'}</span>
                  <span className="block text-[11px] text-muted-foreground">Section {section}</span>
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] tabular', load?.overloaded ? 'bg-warn/15 text-warn' : 'bg-secondary text-muted-foreground')}>
                  {load?.activeTables ?? 0} {load?.activeTables === 1 ? 'table' : 'tables'} · {open} to do
                </span>
              </div>
              <FloorPlan snap={snap} tables={tables} tasks={[]} picked={picked} onPick={(id) => setPicked(id === picked ? undefined : id)} compact mini />
            </div>
          )
        })}
      </div>
      {table && <TableSummary snap={snap} table={table} onReconstruct={() => onReconstruct(table)} />}
    </section>
  )
}

function TableSummary({ snap, table: t, onReconstruct }: { snap: Snap; table: Snap['tables'][number]; onReconstruct: () => void }) {
  const server = snap.config.staff.find((s) => s.id === t.serverId)
  return (
    <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 text-sm">
      <div>
        <div className="font-display text-xl">{t.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{t.status.replace('_', ' ')}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Guests</div>
        {t.visitId ? `${t.party?.guestName ?? 'Party'} of ${t.party?.size ?? '?'}, seated ${t.seatedAt ? ago(t.seatedAt, snap.now) : ''}` : 'Free'}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Server</div>
        {server?.name}
      </div>
      {t.party?.allergies.length || t.party?.needs?.length ? (
        <div>
          <div className="text-xs text-muted-foreground">Needs</div>
          {[...(t.party?.allergies.map((x) => `${x} allergy`) ?? []), ...(t.party?.needs ?? [])].join(', ')}
        </div>
      ) : null}
      {t.lines.length > 0 && (
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Order</div>
          {t.lines.map((l) => `${l.qty}× ${l.name} (${l.status === 'fired' ? 'cooking' : l.status === 'ready' ? 'at the pass' : l.status})`).join(', ')}
        </div>
      )}
      {t.visitId && (
        <Button variant="outline" size="sm" className="ml-auto self-center" onClick={onReconstruct}>
          <History /> What’s happened so far
        </Button>
      )}
    </div>
  )
}

/** Which outside systems are feeding TableMate (or receiving alerts) right now, with a way in. */
function ConnectedSystems({ snap }: { snap: Snap }) {
  const ready = (snap.integrations ?? []).filter((i) => i.mode === 'live' && i.id !== 'export')
  const alerts = snap.config.alerts
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Plug className="size-4 text-primary" /> Connected
      </span>
      {ready.map((i) => {
        const on = i.id === 'webhook' ? !!alerts?.url : i.id === 'generic' ? i.eventCount > 0 : i.id === 'sim' ? snap.sim.startedAt !== null : i.eventCount > 0
        return (
          <span key={i.id} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn('size-2 rounded-full', on ? 'bg-good' : 'bg-muted-foreground/40')} aria-hidden />
            {i.id === 'webhook' ? 'Alerts out' : i.id === 'generic' ? 'POS / booking feed' : i.name}
            <span className="sr-only">{on ? '(active)' : '(not active)'}</span>
          </span>
        )
      })}
      <Link to="/demo?tab=integrations" className="ml-auto font-medium text-primary underline-offset-4 hover:underline">
        Integrations
      </Link>
    </div>
  )
}
