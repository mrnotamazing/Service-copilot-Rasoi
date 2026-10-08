// The manager's side of the reasoning layer, all about process (stages, stations, section load):
// why tonight is going the way it is, what the next 15 minutes look like, what happened at one
// table, and what would change with more guests, a server off sick or an extra cook.

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
const RISK_WORD: Record<Risk, string> = { ok: 'On track', watch: 'Watch', likely: 'Act now' }

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
  const total = intel.overMin.floor + intel.overMin.kitchen
  return (
    <Card>
      <CardHeader>
        <Heading>Why is this happening?</Heading>
        <CardDescription>Read from every step measured tonight, attributed to whoever controlled it.</CardDescription>
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
                  <RiskDot risk={l.level} /> {l.label}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{RISK_WORD[l.level]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{l.text}</p>
            </li>
          ))}
        </ul>
        {total >= 1 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground tabular">
              <span>Kitchen {Math.round(intel.overMin.kitchen)} min over</span>
              <span>Floor {Math.round(intel.overMin.floor)} min over</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Time past standard: kitchen ${Math.round(intel.overMin.kitchen)} minutes, floor ${Math.round(intel.overMin.floor)} minutes`}>
              <div style={{ width: `${(intel.overMin.kitchen / total) * 100}%`, background: OWNER_COLOR.kitchen }} />
              <div style={{ width: `${(intel.overMin.floor / total) * 100}%`, background: OWNER_COLOR.floor }} />
            </div>
          </div>
        )}
        <ul className="space-y-1.5 text-sm">
          {intel.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        {intel.actions.length > 0 && (
          <div className="rounded-xl bg-accent/60 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">What would help</div>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {intel.actions.map((a) => (
                <li key={a}>{a}</li>
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
  return (
    <Card>
      <CardHeader>
        <Heading>Next 15 minutes</Heading>
        <CardDescription>Forecast from what’s cooking, the courses about to be ordered, and how each station has run tonight.</CardDescription>
        <CardAction>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ChefHat className="size-3.5" /> Kitchen stations
          </h3>
          {forecast.stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing cooking or about to be ordered.</p>
          ) : (
            <ul className="space-y-2">
              {forecast.stations.map((s) => (
                <li key={s.station} className="flex items-start gap-2 text-sm">
                  <RiskDot risk={s.risk} />
                  <span className="-mt-1 min-w-0">{s.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UsersRound className="size-3.5" /> Section load (cards open now plus food landing in 10 min)
          </h3>
          <ul className="grid grid-cols-3 gap-2">
            {forecast.sections.map((s) => (
              <li key={s.section} className="rounded-xl border p-2.5 text-sm">
                <div className="flex items-center gap-1.5 font-medium">
                  <RiskDot risk={s.risk} /> Section {s.section}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{name(s.staffId)}</div>
                <div className="mt-1 text-xs tabular">
                  {s.active} {s.active === 1 ? 'table' : 'tables'} · {s.jobs} {s.jobs === 1 ? 'job' : 'jobs'}
                </div>
              </li>
            ))}
          </ul>
          {forecast.rebalance && <p className="mt-2 rounded-xl bg-accent/60 p-3 text-sm">{forecast.rebalance}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/** One table's visit, step by step: what took how long, against the standard, and who controlled it. */
export function IncidentSheet({ r, onClose, server }: { r: Reconstruction | null; onClose: () => void; server: string }) {
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
                <History className="size-5 text-primary" /> {r.tableName}: what happened
              </SheetTitle>
              <SheetDescription>
                Party of {r.partySize}, served by {server}. {clock(r.seatedAt)}–{r.live ? 'now' : clock(r.endedAt)}.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <ol className="space-y-3">
                {r.steps.map((s, i) => (
                  <li key={i} className={cn('rounded-xl border p-3', s === r.biggest && 'border-warn')}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {s.label}
                        {s.station && <span className="font-normal text-muted-foreground"> · {s.station}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">{clock(s.start)}</span>
                    </div>
                    <div className="relative mt-2 h-2.5 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${(s.min / max) * 100}%`, background: OWNER_COLOR[s.owner] }} />
                      <div className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-foreground" style={{ left: `${(s.targetMin / max) * 100}%` }} aria-hidden />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs tabular">
                      <span className="text-muted-foreground">
                        {s.min} min vs {s.targetMin} standard · {s.owner === 'kitchen' ? 'kitchen' : 'floor'}
                      </span>
                      {s.overMin > 0.25 ? <span className="font-medium text-warn">+{s.overMin} min</span> : <span className="text-good">to standard</span>}
                    </div>
                  </li>
                ))}
                {r.steps.length === 0 && <li className="text-sm text-muted-foreground">No steps finished yet.</li>}
              </ol>
              <div className="rounded-xl border p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Time past standard</div>
                Kitchen {r.overByOwner.kitchen} min · Floor {r.overByOwner.floor} min
                {r.biggest && (
                  <p className="mt-1">
                    Biggest delay: <b className="font-medium">{r.biggest.label}</b>
                    {r.biggest.station ? ` (${r.biggest.station})` : ''}, +{r.biggest.overMin} min, {r.biggest.owner === 'kitchen' ? 'kitchen' : 'floor'}-controlled.
                  </p>
                )}
              </div>
              {r.helped.length > 0 && (
                <div className="rounded-xl bg-accent/60 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">What would have helped</div>
                  <ul className="list-disc space-y-1 pl-4">
                    {r.helped.map((h) => (
                      <li key={h}>{h}</li>
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
                  {ai.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Tell me the story
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

const PRESETS: { id: string; label: string; w: (sick: string) => WhatIf }[] = [
  { id: 'busy', label: '30% more guests', w: () => ({ covers: 1.3 }) },
  { id: 'sick', label: 'A server off sick', w: (sick) => ({ sickServer: sick }) },
  { id: 'grill', label: 'An extra grill cook', w: () => ({ extraGrill: true }) },
  { id: 'slow', label: 'Kitchen 20% slower', w: () => ({ kitchenSpeed: 0.8 }) },
  { id: 'busySick', label: 'Busy night and a server off', w: (sick) => ({ covers: 1.3, sickServer: sick }) },
]

const pct = (x: number) => `${Math.round(x * 100)}%`
const ROWS: { key: keyof WhatIfResult['base']; label: string; fmt: (x: number) => string; better: 'lower' | 'higher' }[] = [
  { key: 'covers', label: 'Guests seated', fmt: (x) => String(Math.round(x)), better: 'higher' },
  { key: 'foodWaitMin', label: 'Average food wait', fmt: (x) => `${x.toFixed(1)} min`, better: 'lower' },
  { key: 'kitchenLate', label: 'Kitchen tickets past standard', fmt: pct, better: 'lower' },
  { key: 'floorLate', label: 'Floor steps past standard', fmt: pct, better: 'lower' },
  { key: 'peakTables', label: 'Most tables one server had', fmt: (x) => String(Math.round(x)), better: 'lower' },
  { key: 'walkouts', label: 'Parties who gave up waiting', fmt: (x) => x.toFixed(1), better: 'lower' },
]

/** Decide before service: run tonight in a sandbox with one thing changed and compare. */
export function WhatIfCard({ servers }: { servers: { id: string; name: string }[] }) {
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
        <Heading>What if…?</Heading>
        <CardDescription>Runs 2½ hours of service three times in a sandbox, as it is and with one change, with the same guests both ways. Live service isn’t touched.</CardDescription>
        <CardAction>
          <FlaskConical className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button key={p.id} variant={active === p.id ? 'default' : 'outline'} size="sm" className="h-9 rounded-full" disabled={!!running} onClick={() => void run(p.id, p.w(sick))}>
              {running === p.id ? <Loader2 className="animate-spin" /> : <Play />} {p.label}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Off sick:
            <Select value={sick} onValueChange={setSick}>
              <SelectTrigger className="h-9 w-32" aria-label="Server off sick">
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
                <caption className="mb-2 text-left text-sm font-medium">What if: {result.label}</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium" />
                    <th className="pb-2 text-right font-medium">As planned</th>
                    <th className="pb-2 text-right font-medium">What if</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ROWS.map((row) => {
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
            <p className="text-xs text-muted-foreground">A simulation of a typical evening, not a promise. Use it to compare options, then decide.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
