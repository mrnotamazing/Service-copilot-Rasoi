import { AlertTriangle, ChefHat, Lightbulb, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Owner, Segment, VisitRecord } from '../../shared/types.ts'
import { Dot, Panel, Stat, TableTile, TopBar } from '../components/ui.tsx'
import { useSnapshot } from '../lib/live.ts'
import { clock } from '../lib/format.ts'
import { Loading } from './ServerView.tsx'

const OWNER_COLOR: Record<Owner, string> = {
  floor: 'var(--color-floor-mark)',
  kitchen: 'var(--color-kitchen-mark)',
  guest: 'var(--color-faint)',
}

export default function ManagerView() {
  const { snap, connected } = useSnapshot('manager')
  if (!snap || !snap.analytics) return <Loading />
  const a = snap.analytics
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  const color = (id: string) => snap.config.staff.find((s) => s.id === id)?.color
  const lapses = a.lapsesByOwner.floor + a.lapsesByOwner.kitchen
  const maxMin = Math.max(1, ...a.stages.map((s) => Math.max(s.avgMin, s.avgTargetMin)))

  return (
    <div className="min-h-screen pb-12">
      <TopBar
        title="Service overview"
        sub={snap.config.name}
        right={
          <>
            <Link to="/setup" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-raised hover:text-ink">
              Setup
            </Link>
            <span className="font-mono text-sm text-muted">{clock(snap.now)}</span>
            <Dot ok={connected} />
          </>
        }
      />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" />
          This view shows how the process is running: stages, stations and load. Personal scores stay on each server’s own phone, and delays are attributed to whoever controlled that step.
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Tables served" value={a.visits} sub={`${snap.tables.filter((t) => t.visitId).length} seated now`} />
          <Stat label="Served to standard" value={a.smoothRate == null ? '—' : `${Math.round(a.smoothRate * 100)}%`} sub="no floor-controlled lapse" />
          <Stat label="Floor lapses" value={a.lapsesByOwner.floor} sub={lapses ? `${Math.round((a.lapsesByOwner.floor / lapses) * 100)}% of all lapses` : 'none yet'} />
          <Stat label="Kitchen lapses" value={a.lapsesByOwner.kitchen} sub={lapses ? `${Math.round((a.lapsesByOwner.kitchen / lapses) * 100)}% of all lapses` : 'none yet'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Floor">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {snap.tables.map((t) => (
                <TableTile key={t.id} t={t} now={snap.now} color={color(t.serverId)} />
              ))}
            </div>
          </Panel>

          <Panel title="Load right now" right={<Users className="size-4 text-faint" />}>
            <ul className="space-y-3">
              {a.load.map((l) => {
                const open = snap.openTasks?.[l.staffId] ?? 0
                return (
                  <li key={l.staffId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: color(l.staffId) }} />
                        {name(l.staffId)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs ${l.overloaded ? 'text-warn' : 'text-muted'}`}>
                        {l.overloaded && <AlertTriangle className="size-3.5" />}
                        {l.activeTables} tables · {open} open cards
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised">
                      <div
                        className={`h-full rounded-full ${l.overloaded ? 'bg-warn' : 'bg-muted'}`}
                        style={{ width: `${Math.min(100, (l.activeTables / (snap.config.sop.maxActiveTablesPerServer + 2)) * 100)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[11px] text-faint">Section limit: {snap.config.sop.maxActiveTablesPerServer} active tables per server</p>
          </Panel>
        </div>

        {a.suggestions.length > 0 && (
          <Panel title="Suggestions" right={<Lightbulb className="size-4 text-saffron" />}>
            <ul className="space-y-2">
              {a.suggestions.map((s) => (
                <li key={s} className="rounded-xl bg-raised/60 p-3 text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Where time goes: average vs standard">
            <ul className="space-y-3">
              {a.stages.map((s) => (
                <li key={s.stage} title={`${s.label}: avg ${s.avgMin} min vs standard ${s.avgTargetMin} min over ${s.count} steps; ${Math.round(s.lapseRate * 100)}% past standard`}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>
                      {s.label} <span className="text-[11px] text-faint">· {s.owner}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {s.count ? `${s.avgMin} / ${s.avgTargetMin} min · ${Math.round(s.lapseRate * 100)}% late` : 'no data yet'}
                    </span>
                  </div>
                  <div className="relative mt-1 h-3 rounded-full bg-raised">
                    <div className="h-full rounded-full" style={{ width: `${(s.avgMin / maxMin) * 100}%`, background: OWNER_COLOR[s.owner] }} />
                    {s.count > 0 && <div className="absolute -top-0.5 h-4 w-0.5 rounded bg-ink" style={{ left: `${(s.avgTargetMin / maxMin) * 100}%` }} title="Standard" />}
                  </div>
                </li>
              ))}
            </ul>
            <Legend />
          </Panel>

          <Panel title="Kitchen stations" right={<ChefHat className="size-4 text-faint" />}>
            {a.stations.length === 0 ? (
              <p className="text-sm text-faint">No completed tickets yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Station</th>
                    <th className="pb-2 text-right font-medium">Tickets</th>
                    <th className="pb-2 text-right font-medium">Past standard</th>
                    <th className="pb-2 text-right font-medium">Avg over</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {a.stations.map((s) => (
                    <tr key={s.station}>
                      <td className="py-1.5 capitalize">{s.station}</td>
                      <td className="py-1.5 text-right">{s.tickets}</td>
                      <td className={`py-1.5 text-right ${s.lapses ? 'text-kitchen' : ''}`}>{s.lapses}</td>
                      <td className="py-1.5 text-right text-muted">{s.avgOverMin} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel title="Delay receipts: recent tables">
          {a.recentVisits.length === 0 ? (
            <p className="text-sm text-faint">Receipts appear as tables finish.</p>
          ) : (
            <ul className="space-y-3">
              {a.recentVisits.map((v) => (
                <Receipt key={v.visitId} v={v} server={name(v.serverId)} />
              ))}
            </ul>
          )}
          <Legend />
        </Panel>
      </main>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ background: OWNER_COLOR.floor }} /> Floor-controlled
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ background: OWNER_COLOR.kitchen }} /> Kitchen
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 rounded bg-ink" /> Standard
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
    <li className="rounded-xl bg-raised/40 p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className="font-semibold">{v.tableName}</span> <span className="text-muted">· {v.partySize} guests · {server}</span>
        </span>
        <span className="text-xs text-muted">
          {clock(v.seatedAt)}–{clock(v.endedAt)}
        </span>
      </div>
      <div className="relative mt-2 h-4 rounded bg-bg">
        {v.segments.map((s: Segment, i) => (
          <div
            key={i}
            title={`${s.label}: ${((s.end - s.start) / 60_000).toFixed(1)} min (standard ${s.targetMin.toFixed(1)})${s.lapse ? ' · past standard' : ''}`}
            className={`absolute top-0 h-full rounded-sm ${s.lapse ? 'ring-2 ring-warn' : ''}`}
            style={{ left: `${pos(s.start)}%`, width: `max(4px, ${pos(s.end) - pos(s.start)}%)`, background: OWNER_COLOR[s.owner] }}
          />
        ))}
      </div>
      <div className="mt-1.5 text-xs text-muted">
        {lapses.length === 0
          ? 'Every step to standard.'
          : lapses.map((s) => `${s.label} +${((s.end - s.start) / 60_000 - s.targetMin).toFixed(1)} min (${s.owner}${s.station ? `, ${s.station}` : ''})`).join(' · ')}
      </div>
    </li>
  )
}
