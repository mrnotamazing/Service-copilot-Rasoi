import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Sop } from '../../shared/types.ts'
import { AppShell, LiveClock, ShellSkeleton } from '../components/kit.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { clock } from '../lib/format.ts'
import { STANDALONE, post, useSnapshot } from '../lib/live.ts'

const SOP_FIELDS: { key: keyof Sop; label: string; unit: string }[] = [
  { key: 'greetWithinMin', label: 'Greet a seated table within', unit: 'min' },
  { key: 'orderNudgeAfterMin', label: 'Nudge to take order after greeting', unit: 'min' },
  { key: 'kitchenDelayToleranceMin', label: 'Warn guests when kitchen is late by', unit: 'min' },
  { key: 'pickupWithinMin', label: 'Pick up food from the pass within', unit: 'min' },
  { key: 'checkbackAfterMin', label: 'Check back after serving', unit: 'min' },
  { key: 'courseCheckAfterMin', label: 'Check if a course is finished after', unit: 'min' },
  { key: 'billPresentWithinMin', label: 'Present the bill within', unit: 'min' },
  { key: 'farewellWithinMin', label: 'Say goodbye within', unit: 'min' },
  { key: 'resetWithinMin', label: 'Reset a table within', unit: 'min' },
  { key: 'maxActiveTablesPerServer', label: 'Max active tables per server', unit: 'tables' },
]

function Heading({ children }: { children: React.ReactNode }) {
  return <CardTitle className="font-display text-lg">{children}</CardTitle>
}

export default function SetupView() {
  const { snap, connected } = useSnapshot('manager')
  const [sop, setSop] = useState<Sop | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (snap && !sop) setSop(snap.config.sop)
  }, [snap, sop])

  if (!snap || !sop) return <ShellSkeleton />
  const sim = snap.sim
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const dify = snap.ai.provider === 'dify'

  return (
    <AppShell title="Setup" sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Heading>Service simulator</Heading>
            <CardDescription>
              Runs a dinner rush through the same pipeline a real POS uses. Use it for demos, training and the role-play study. Each server can be played by a person on their phone, or left on
              autopilot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {sim.running ? (
                <Button variant="secondary" onClick={() => void post('/api/sim/pause')}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button onClick={() => void post('/api/sim/start')}>
                  <Play /> {sim.startedAt ? 'Resume' : 'Start service'}
                </Button>
              )}
              {confirmReset ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setConfirmReset(false)
                      void post('/api/sim/reset').then(() => toast.success('Service cleared'))
                    }}
                  >
                    Clear all tables
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                    Keep service
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                  <RotateCcw /> Reset
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-speed">Speed</label>
                <span className="tabular text-muted-foreground">{sim.speed}× real time</span>
              </div>
              <Slider id="sim-speed" min={1} max={20} step={1} value={[sim.speed]} onValueChange={([v]) => void post('/api/sim/settings', { speed: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-intensity">Rush intensity</label>
                <span className="tabular text-muted-foreground">{sim.intensity.toFixed(1)}×</span>
              </div>
              <Slider id="sim-intensity" min={0.3} max={3} step={0.1} value={[sim.intensity]} onValueChange={([v]) => void post('/api/sim/settings', { intensity: v })} />
            </div>
            <p className="text-sm text-muted-foreground">Guests waiting for a table: {sim.waiting}</p>
            <div className="divide-y rounded-xl border">
              {servers.map((s) => (
                <label key={s.id} htmlFor={`ap-${s.id}`} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    {s.name} on autopilot
                  </span>
                  <Switch id={`ap-${s.id}`} checked={sim.autopilot.includes(s.id)} onCheckedChange={(v) => void post('/api/sim/settings', { staffId: s.id, autopilot: v })} />
                </label>
              ))}
              <label htmlFor="ap-kitchen" className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span>Kitchen cooks automatically</span>
                <Switch id="ap-kitchen" checked={sim.autoKitchen} onCheckedChange={(v) => void post('/api/sim/settings', { autoKitchen: v })} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Heading>Service standards (SOPs)</Heading>
            <CardDescription>Every card the copilot raises comes from one of these. Saving re-scores the whole service.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-2.5"
              onSubmit={async (e) => {
                e.preventDefault()
                await post('/api/config', { sop })
                toast.success('Standards saved')
              }}
            >
              {SOP_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
                  <label htmlFor={`sop-${f.key}`}>{f.label}</label>
                  <span className="inline-flex items-center gap-1.5">
                    <Input
                      id={`sop-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      name={`sop-${f.key}`}
                      min={0}
                      step={0.5}
                      value={sop[f.key]}
                      onChange={(e) => setSop({ ...sop, [f.key]: Number(e.target.value) })}
                      className="h-8 w-20 text-right tabular"
                    />
                    <span className="w-10 text-xs text-muted-foreground">{f.unit}</span>
                  </span>
                </div>
              ))}
              <Separator className="my-3" />
              <Button type="submit">Save standards</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <Heading>AI assistance</Heading>
            <CardDescription>Suggested lines for guests, section briefings, SOP answers and the manager’s shift summary.</CardDescription>
            <CardAction>
              <Badge variant={dify ? 'default' : 'secondary'} className="gap-1">
                <Sparkles className="size-3" /> {dify ? 'Dify connected' : 'Built-in writer'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm">
            {dify ? (
              <p className="text-muted-foreground">Requests go to your Dify app. If Dify is unreachable, the copilot falls back to the built-in writer and says so on the answer.</p>
            ) : STANDALONE ? (
              <p className="text-muted-foreground">This shareable demo runs entirely in the browser, so it uses the built-in writer. Run the app on a computer with a Dify key to get AI-written answers.</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>In Dify, create a <span className="text-foreground">Chatbot</span> app, paste the system prompt from <code className="rounded bg-muted px-1">docs/dify-setup.md</code>, and publish it.</li>
                <li>
                  Copy its API key (App → <span className="text-foreground">API Access</span>).
                </li>
                <li>
                  In the project folder, copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code> and set <code className="rounded bg-muted px-1">DIFY_API_URL</code> and{' '}
                  <code className="rounded bg-muted px-1">DIFY_API_KEY</code>.
                </li>
                <li>Restart <code className="rounded bg-muted px-1">npm run dev</code>. This badge turns to “Dify connected”.</li>
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <Heading>POS integrations</Heading>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {snap.integrations?.map((i) => (
              <div key={i.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{i.name}</span>
                  <Badge variant={i.mode === 'live' ? 'default' : i.mode === 'needs-partner-access' ? 'outline' : 'secondary'} className={cn(i.mode === 'live' && 'bg-good text-background')}>
                    {i.mode === 'live' ? 'Ready' : i.mode === 'needs-partner-access' ? 'Needs partner access' : 'Planned'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.note}</p>
                {i.endpoints.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {i.endpoints.map((e) => (
                      <li key={e.path} className="text-xs">
                        <code className="break-all rounded bg-muted px-1.5 py-0.5 text-[11px] text-primary">
                          {e.method} {e.path}
                        </code>
                        <div className="mt-0.5 text-muted-foreground">{e.purpose}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-[11px] text-muted-foreground">{i.eventCount ? `${i.eventCount} events, last at ${i.lastEventAt ? clock(i.lastEventAt) : '—'}` : 'No events received yet'}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
