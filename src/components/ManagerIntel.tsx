// The manager's side of the reasoning layer, all about process (stages, stations, section load):
// why tonight is going the way it is, what the next 15 minutes look like, what happened at one
// table, and what would change with more guests, a server off sick or an extra cook.

import { S } from '../i18n/sentences.ts'
import { useT, L } from '../i18n/index.ts'
import { ChefHat, CircleHelp, FlaskConical, History, Loader2, Play, Sparkles, TrendingUp, UsersRound } from 'lucide-react'
import { useState } from 'react'
import type { Forecast, Reconstruction, Risk, ShiftIntel } from '../../shared/intel.ts'
import type { Owner } from '../../shared/types.ts'
import type { WhatIf, WhatIfResult } from '../../server/whatif.ts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { clock } from '../lib/format.ts'
import { post } from '../lib/live.ts'
import { AiAnswerBox } from './AiAnswer.tsx'
import { PanelTitle } from './kit.tsx'

const OWNER_COLOR: Record<Owner, string> = { floor: 'var(--floor-mark)', kitchen: 'var(--kitchen-mark)', guest: 'var(--muted-foreground)' }
const RISK_DOT: Record<Risk, string> = { ok: 'bg-good', watch: 'bg-warn', likely: 'bg-destructive' }
const RISK_WORD = (): Record<Risk, string> => ({ ok: L('On track'), watch: L('Watch'), likely: L('Act now') })

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle>
      <PanelTitle>{children}</PanelTitle>
    </CardTitle>
  )
}

function RiskDot({ risk }: { risk: Risk }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', RISK_DOT[risk])} aria-hidden />
}

/** Why tonight is going the way it is: three lights, the reasons, and what to do. */
export function WhyTonight({ intel }: { intel: ShiftIntel }) {
  const tx = useT()
  const total = intel.overMin.floor + intel.overMin.kitchen
  return (
    <Card>
      <CardHeader>
        <Heading>{tx('ui.managerintel.why_is_this_happening')}</Heading>
        <CardDescription>{tx('ui.managerintel.read_from_every_step')}</CardDescription>
        <CardAction>
          <CircleHelp className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-3">
          {intel.lights.map((l) => (
            <li key={l.id} className="rounded-xl border p-2.5">
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <RiskDot risk={l.level} /> {S(l.label)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{RISK_WORD()[l.level]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{S(l.text)}</p>
            </li>
          ))}
        </ul>
        {total >= 1 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground tabular">
              <span>{tx('ui.manager.kitchen')} {Math.round(intel.overMin.kitchen)} {tx('ui.managerintel.min_over')}</span>
              <span>{tx('ui.managerintel.floor')} {Math.round(intel.overMin.floor)} {tx('ui.managerintel.min_over')}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={L('Time past standard: kitchen {k} minutes, floor {f} minutes', { k: Math.round(intel.overMin.kitchen), f: Math.round(intel.overMin.floor) })}>
              <div style={{ width: `${(intel.overMin.kitchen / total) * 100}%`, background: OWNER_COLOR.kitchen }} />
              <div style={{ width: `${(intel.overMin.floor / total) * 100}%`, background: OWNER_COLOR.floor }} />
            </div>
          </div>
        )}
        <ul className="space-y-1.5 text-sm">
          {intel.why.map((w) => (
            <li key={w}>{S(w)}</li>
          ))}
        </ul>
        {intel.actions.length > 0 && (
          <div className="rounded-xl bg-accent/60 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{tx('ui.managerintel.what_would_help')}</div>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {intel.actions.map((a) => (
                <li key={a}>{S(a)}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The next quarter of an hour: which station is about to fall behind, which section is about to be swamped. */
export function NextFifteen({ forecast, name }: { forecast: Forecast; name: (id: string) => string }) {
  const tx = useT()
  return (
    <Card>
      <CardHeader>
        <Heading>{tx('ui.managerintel.next_15_minutes')}</Heading>
        <CardDescription>{tx('ui.managerintel.forecast_from_what_s')}</CardDescription>
        <CardAction>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ChefHat className="size-3.5" /> {tx('ui.manager.kitchen_stations')}
          </h3>
          {forecast.stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tx('ui.managerintel.nothing_cooking_or_about')}</p>
          ) : (
            <ul className="space-y-2">
              {forecast.stations.map((s) => (
                <li key={s.station} className="flex items-start gap-2 text-sm">
                  <RiskDot risk={s.risk} />
                  <span className="-mt-1 min-w-0">{S(s.text)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UsersRound className="size-3.5" /> {tx('ui.managerintel.section_load_cards_open')}
          </h3>
          <ul className="grid grid-cols-3 gap-2">
            {forecast.sections.map((s) => (
              <li key={s.section} className="rounded-xl border p-2.5 text-sm">
                <div className="flex items-center gap-1.5 font-medium">
                  <RiskDot risk={s.risk} /> {tx('ui.manager.section')} {s.section}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{name(s.staffId)}</div>
                <div className="mt-1 text-xs tabular">
                  {S(`${s.active} ${s.active === 1 ? 'table' : 'tables'}`)} · {s.jobs === 1 ? S('1 job') : S(`${s.jobs} jobs`)}
                </div>
              </li>
            ))}
          </ul>
          {forecast.rebalance && <p className="mt-2 rounded-xl bg-accent/60 p-3 text-sm">{S(forecast.rebalance)}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/** One table's visit, step by step: what took how long, against the standard, and who controlled it. */
export function IncidentSheet({ r, onClose, server }: { r: Reconstruction | null; onClose: () => void; server: string }) {
  const tx = useT()
  const ai = useAi()
  const [asked, setAsked] = useState<string | null>(null)
  const max = Math.max(1, ...(r?.steps.map((s) => Math.max(s.min, s.targetMin)) ?? []))
  return (
    <Sheet
      open={!!r}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          ai.clear()
          setAsked(null)
        }
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {r && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-display text-2xl">
                <History className="size-5 text-primary" /> {r.tableName}{tx('ui.managerintel.what_happened')}
              </SheetTitle>
              <SheetDescription>
                {tx('ui.managerintel.party_of')} {r.partySize}{tx('ui.managerintel.served_by')} {server}. {clock(r.seatedAt)}–{r.live ? 'now' : clock(r.endedAt)}.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <ol className="space-y-3">
                {r.steps.map((s, i) => (
                  <li key={i} className={cn('rounded-xl border p-3', s === r.biggest && 'border-warn')}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {S(s.label)}
                        {s.station && <span className="font-normal text-muted-foreground"> · {S(s.station)}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">{clock(s.start)}</span>
                    </div>
                    <div className="relative mt-2 h-2.5 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${(s.min / max) * 100}%`, background: OWNER_COLOR[s.owner] }} />
                      <div className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-foreground" style={{ left: `${(s.targetMin / max) * 100}%` }} aria-hidden />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs tabular">
                      <span className="text-muted-foreground">
                        {s.min} {tx('ui.managerintel.min_vs')} {s.targetMin} {tx('ui.managerintel.standard')} {s.owner === 'kitchen' ? 'kitchen' : 'floor'}
                      </span>
                      {s.overMin > 0.25 ? <span className="font-medium text-warn">+{s.overMin} {tx('ui.manager.min')}</span> : <span className="text-good">{tx('ui.managerintel.to_standard')}</span>}
                    </div>
                  </li>
                ))}
                {r.steps.length === 0 && <li className="text-sm text-muted-foreground">{tx('ui.managerintel.no_steps_finished_yet')}</li>}
              </ol>
              <div className="rounded-xl border p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{tx('ui.managerintel.time_past_standard')}</div>
                {tx('ui.manager.kitchen')} {r.overByOwner.kitchen} {tx('ui.managerintel.min_floor')} {r.overByOwner.floor} {tx('ui.manager.min')}
                {r.biggest && (
                  <p className="mt-1">
                    {tx('ui.managerintel.biggest_delay')} <b className="font-medium">{S(r.biggest.label)}</b>
                    {r.biggest.station ? ` (${r.biggest.station})` : ''}, +{r.biggest.overMin} {tx('ui.managerintel.min')} {r.biggest.owner === 'kitchen' ? 'kitchen' : 'floor'}{tx('ui.managerintel.controlled')}
                  </p>
                )}
              </div>
              {r.helped.length > 0 && (
                <div className="rounded-xl bg-accent/60 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{tx('ui.managerintel.what_would_have_helped')}</div>
                  <ul className="list-disc space-y-1 pl-4">
                    {r.helped.map((h) => (
                      <li key={h}>{S(h)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <Button
                  variant="secondary"
                  disabled={ai.loading}
                  onClick={() => {
                    setAsked(r.visitId)
                    void ai.ask('incident', { visitId: r.visitId })
                  }}
                >
                  {ai.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {tx('ui.managerintel.tell_me_the_story')}
                </Button>
                {asked === r.visitId && <AiAnswerBox answer={ai.answer} error={ai.error} className="mt-3" />}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const PRESETS = (): { id: string; label: string; w: (sick: string) => WhatIf }[] => [
  { id: 'busy', label: L('30% more guests'), w: () => ({ covers: 1.3 }) },
  { id: 'sick', label: L('A server off sick'), w: (sick) => ({ sickServer: sick }) },
  { id: 'grill', label: L('An extra grill cook'), w: () => ({ extraGrill: true }) },
  { id: 'slow', label: L('Kitchen 20% slower'), w: () => ({ kitchenSpeed: 0.8 }) },
  { id: 'busySick', label: L('Busy night and a server off'), w: (sick) => ({ covers: 1.3, sickServer: sick }) },
]

const pct = (x: number) => `${Math.round(x * 100)}%`
const ROWS = (): { key: keyof WhatIfResult['base']; label: string; fmt: (x: number) => string; better: 'lower' | 'higher' }[] => [
  { key: 'covers', label: L('Guests seated'), fmt: (x) => String(Math.round(x)), better: 'higher' },
  { key: 'foodWaitMin', label: L('Average food wait'), fmt: (x) => `${x.toFixed(1)} min`, better: 'lower' },
  { key: 'kitchenLate', label: L('Kitchen tickets past standard'), fmt: pct, better: 'lower' },
  { key: 'floorLate', label: L('Floor steps past standard'), fmt: pct, better: 'lower' },
  { key: 'peakTables', label: L('Most tables one server had'), fmt: (x) => String(Math.round(x)), better: 'lower' },
  { key: 'walkouts', label: L('Parties who gave up waiting'), fmt: (x) => x.toFixed(1), better: 'lower' },
]

/** Decide before service: run tonight in a sandbox with one thing changed and compare. */
export function WhatIfCard({ servers }: { servers: { id: string; name: string }[] }) {
  const tx = useT()
  const [sick, setSick] = useState(servers[0]?.id ?? '')
  const [running, setRunning] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run(id: string, w: WhatIf) {
    setRunning(id)
    setActive(id)
    setError(null)
    try {
      setResult(await post<WhatIfResult>('/api/whatif', w))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(null)
    }
  }
  return (
    <Card>
      <CardHeader>
        <Heading>{tx('ui.managerintel.what_if')}</Heading>
        <CardDescription>{tx('ui.managerintel.runs_2_hours_of')}</CardDescription>
        <CardAction>
          <FlaskConical className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS().map((p) => (
            <Button key={p.id} variant={active === p.id ? 'default' : 'outline'} size="sm" className="h-9 rounded-full" disabled={!!running} onClick={() => void run(p.id, p.w(sick))}>
              {running === p.id ? <Loader2 className="animate-spin" /> : <Play />} {p.label}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {tx('ui.managerintel.off_sick')}
            <Select value={sick} onValueChange={setSick}>
              <SelectTrigger className="h-9 w-32" aria-label={tx('ui.managerintel.server_off_sick')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className={cn('space-y-3 transition-opacity', running && 'opacity-50')} aria-live="polite">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <caption className="mb-2 text-left text-sm font-medium">{tx('ui.managerintel.what_if_2')} {result.label}</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium" />
                    <th className="pb-2 text-right font-medium">{tx('ui.managerintel.as_planned')}</th>
                    <th className="pb-2 text-right font-medium">{tx('ui.managerintel.what_if_3')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ROWS().map((row) => {
                    const b = result.base[row.key]
                    const c = result.changed[row.key]
                    const d = c - b
                    const meaningful = Math.abs(d) >= (row.fmt === pct ? 0.03 : 0.5)
                    const good = meaningful && (row.better === 'lower' ? d < 0 : d > 0)
                    return (
                      <tr key={row.key}>
                        <td className="py-2">{row.label}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.fmt(b)}</td>
                        <td className={cn('py-2 text-right font-medium', meaningful && (good ? 'text-good' : 'text-warn'))}>{row.fmt(c)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="space-y-1.5 rounded-xl bg-accent/60 p-3 text-sm">
              {result.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{tx('ui.managerintel.a_simulation_of_a')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
