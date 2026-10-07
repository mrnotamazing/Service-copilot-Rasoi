import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Sop } from '../../shared/types.ts'
import { Btn, Dot, Panel, TopBar } from '../components/ui.tsx'
import { post, useSnapshot } from '../lib/live.ts'
import { clock } from '../lib/format.ts'
import { Loading } from './ServerView.tsx'

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

export default function SetupView() {
  const { snap, connected } = useSnapshot('manager')
  const [sop, setSop] = useState<Sop | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (snap && !sop) setSop(snap.config.sop)
  }, [snap, sop])

  if (!snap || !sop) return <Loading />
  const sim = snap.sim
  const servers = snap.config.staff.filter((s) => s.role === 'server')

  return (
    <div className="min-h-screen pb-12">
      <TopBar title="Setup" sub={snap.config.name} right={<><span className="font-mono text-sm text-muted">{clock(snap.now)}</span><Dot ok={connected} /></>} />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-2">
        <Panel title="Service simulator">
          <p className="mb-3 text-sm text-muted">
            Runs a dinner rush through the same pipeline a real POS uses. Use it for demos, training and the role-play study. Each server can be played by a person
            on their phone (turn their autopilot off) or by autopilot.
          </p>
          <div className="flex flex-wrap gap-2">
            {sim.running ? (
              <Btn kind="soft" onClick={() => void post('/api/sim/pause')}>
                <span className="inline-flex items-center gap-1.5"><Pause className="size-4" /> Pause</span>
              </Btn>
            ) : (
              <Btn kind="primary" onClick={() => void post('/api/sim/start')}>
                <span className="inline-flex items-center gap-1.5"><Play className="size-4" /> {sim.startedAt ? 'Resume' : 'Start service'}</span>
              </Btn>
            )}
            <Btn
              kind="ghost"
              onClick={() => {
                if (confirm('Clear all tables and events for a fresh service?')) void post('/api/sim/reset')
              }}
            >
              <span className="inline-flex items-center gap-1.5"><RotateCcw className="size-4" /> Reset</span>
            </Btn>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <div className="flex justify-between"><span>Speed</span><span className="text-muted">{sim.speed}× real time</span></div>
              <input type="range" min={1} max={20} value={sim.speed} onChange={(e) => void post('/api/sim/settings', { speed: Number(e.target.value) })} className="w-full accent-[var(--color-saffron)]" />
            </label>
            <label className="block">
              <div className="flex justify-between"><span>Rush intensity</span><span className="text-muted">{sim.intensity.toFixed(1)}×</span></div>
              <input type="range" min={0.3} max={3} step={0.1} value={sim.intensity} onChange={(e) => void post('/api/sim/settings', { intensity: Number(e.target.value) })} className="w-full accent-[var(--color-saffron)]" />
            </label>
            <div className="text-muted">Guests waiting for a table: {sim.waiting}</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {servers.map((s) => (
                <label key={s.id} className="flex items-center justify-between px-3 py-2">
                  <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.name} on autopilot</span>
                  <input type="checkbox" className="size-4 accent-[var(--color-saffron)]" checked={sim.autopilot.includes(s.id)} onChange={(e) => void post('/api/sim/settings', { staffId: s.id, autopilot: e.target.checked })} />
                </label>
              ))}
              <label className="flex items-center justify-between px-3 py-2">
                <span>Kitchen cooks automatically</span>
                <input type="checkbox" className="size-4 accent-[var(--color-saffron)]" checked={sim.autoKitchen} onChange={(e) => void post('/api/sim/settings', { autoKitchen: e.target.checked })} />
              </label>
            </div>
          </div>
        </Panel>

        <Panel title="Service standards (SOPs)">
          <p className="mb-3 text-sm text-muted">Every card the copilot raises comes from one of these. Changing them re-scores the whole service.</p>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault()
              await post('/api/config', { sop })
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            }}
          >
            {SOP_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{f.label}</span>
                <span className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={sop[f.key]}
                    onChange={(e) => setSop({ ...sop, [f.key]: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-line bg-bg px-2 py-1 text-right"
                  />
                  <span className="w-10 text-xs text-muted">{f.unit}</span>
                </span>
              </label>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="rounded-xl bg-saffron px-4 py-2 text-sm font-semibold text-bg">Save standards</button>
              {saved && <span className="text-sm text-good">Saved</span>}
            </div>
          </form>
        </Panel>

        <Panel title="POS integrations" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            {snap.integrations?.map((i) => (
              <div key={i.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{i.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${i.mode === 'live' ? 'bg-good/15 text-good' : i.mode === 'needs-partner-access' ? 'bg-saffron/15 text-saffron' : 'bg-raised text-muted'}`}
                  >
                    {i.mode === 'live' ? 'Ready' : i.mode === 'needs-partner-access' ? 'Needs partner access' : 'Planned'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{i.note}</p>
                {i.endpoints.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {i.endpoints.map((e) => (
                      <li key={e.path} className="text-xs">
                        <code className="rounded bg-bg px-1.5 py-0.5 text-[11px] text-saffron">{e.method} {e.path}</code>
                        <div className="mt-0.5 text-faint">{e.purpose}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-[11px] text-faint">
                  {i.eventCount ? `${i.eventCount} events · last ${i.lastEventAt ? clock(i.lastEventAt) : '—'}` : 'No events received yet'}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  )
}
