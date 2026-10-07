import { AlertTriangle, ChefHat, HeartHandshake, Lightbulb, Loader2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { Owner, Segment, VisitRecord } from '../../shared/types.ts'
import { AiAnswerBox } from '../components/AiAnswer.tsx'
import { AppShell, LiveClock, ShellSkeleton, PanelTitle, Stat, TableTile } from '../components/kit.tsx'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { clock } from '../lib/format.ts'
import { useSnapshot } from '../lib/live.ts'

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
  const { snap, connected } = useSnapshot('manager')
  const summary = useAi()
  if (!snap || !snap.analytics) return <ShellSkeleton />
  const a = snap.analytics
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  const color = (id: string) => snap.config.staff.find((s) => s.id === id)?.color
  const lapses = a.lapsesByOwner.floor + a.lapsesByOwner.kitchen
  const maxMin = Math.max(1, ...a.stages.map((s) => Math.max(s.avgMin, s.avgTargetMin)))

  return (
    <AppShell title="Service overview" sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />}>
      <div className="space-y-5">
        <Alert>
          <ShieldCheck className="text-good" />
          <AlertDescription>
            This view shows how the process is running: stages, stations and load. Personal scores stay on each server’s own phone, and every delay is attributed to whoever controlled that step.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Tables served" value={a.visits} sub={`${snap.tables.filter((t) => t.visitId).length} seated now`} />
          <Stat label="Served to standard" value={a.smoothRate == null ? '—' : `${Math.round(a.smoothRate * 100)}%`} sub="no floor-controlled lapse" />
          <Stat label="Floor lapses" value={a.lapsesByOwner.floor} sub={lapses ? `${Math.round((a.lapsesByOwner.floor / lapses) * 100)}% of all lapses` : 'none yet'} />
          <Stat label="Kitchen lapses" value={a.lapsesByOwner.kitchen} sub={lapses ? `${Math.round((a.lapsesByOwner.kitchen / lapses) * 100)}% of all lapses` : 'none yet'} />
        </div>

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

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <Heading>Floor</Heading>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {snap.tables.map((t) => (
                <TableTile key={t.id} t={t} now={snap.now} color={color(t.serverId)} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Heading>Load right now</Heading>
              <CardAction>
                <Users className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {a.load.map((l) => {
                const open = snap.openTasks?.[l.staffId] ?? 0
                return (
                  <div key={l.staffId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: color(l.staffId) }} />
                        {name(l.staffId)}
                      </span>
                      <span className={cn('inline-flex items-center gap-1 text-xs tabular', l.overloaded ? 'text-warn' : 'text-muted-foreground')}>
                        {l.overloaded && <AlertTriangle className="size-3.5" />}
                        {l.activeTables} {l.activeTables === 1 ? 'table' : 'tables'}, {open} open {open === 1 ? 'card' : 'cards'}
                      </span>
                    </div>
                    <Progress value={Math.min(100, (l.activeTables / (snap.config.sop.maxActiveTablesPerServer + 2)) * 100)} className={cn(l.overloaded && '[&>div]:bg-warn')} />
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground">Section limit: {snap.config.sop.maxActiveTablesPerServer} active tables per server</p>
            </CardContent>
          </Card>
        </div>

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

        <div className="grid gap-5 lg:grid-cols-2">
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
        </div>

        <Card>
          <CardHeader>
            <Heading>Delay receipts: recent tables</Heading>
            <CardDescription>Each bar is one step of the visit, coloured by who controlled it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.recentVisits.length === 0 ? <p className="text-sm text-muted-foreground">Receipts appear as tables finish.</p> : a.recentVisits.map((v) => <Receipt key={v.visitId} v={v} server={name(v.serverId)} />)}
            <Legend />
          </CardContent>
        </Card>
      </div>
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
function Receipt({ v, server }: { v: VisitRecord; server: string }) {
  const span = Math.max(1, v.endedAt - v.seatedAt)
  const pos = (t: number) => ((t - v.seatedAt) / span) * 100
  const lapses = v.segments.filter((s) => s.lapse)
  return (
    <div className="rounded-xl border bg-background/50 p-3">
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
    </div>
  )
}
