import { Bot, Check, HeartPulse, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Dot, Panel, TopBar } from '../components/ui.tsx'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'
import { clock, mmss } from '../lib/format.ts'
import { Loading } from './ServerView.tsx'
import type { OrderLine } from '../../shared/types.ts'

export default function KitchenView() {
  const { snap, connected } = useSnapshot('kitchen')
  const [text, setText] = useState('')
  const [table, setTable] = useState('')

  const tickets = useMemo(() => {
    if (!snap) return []
    const map = new Map<string, { ticketId: string; table: string; lines: OrderLine[] }>()
    for (const t of snap.tables)
      for (const l of t.lines) {
        if (l.status !== 'fired' && l.status !== 'ready') continue
        const e = map.get(l.ticketId) ?? { ticketId: l.ticketId, table: t.name, lines: [] }
        e.lines.push(l)
        map.set(l.ticketId, e)
      }
    return [...map.values()].sort((a, b) => a.lines[0].firedAt - b.lines[0].firedAt)
  }, [snap])

  if (!snap) return <Loading />
  const allergyByTable = Object.fromEntries(snap.tables.filter((t) => t.party?.allergies.length).map((t) => [t.name, t.party!.allergies]))
  const fromFloor = snap.notes.filter((n) => n.direction === 'to_kitchen').slice(-12).reverse()

  async function sendNote() {
    if (!text.trim()) return
    await act('note.sent', { noteId: noteId(), direction: 'to_floor', tableId: table || undefined, text: text.trim(), from: 'k_pass' }, 'kitchen')
    setText('')
  }

  return (
    <div className="min-h-screen pb-12">
      <TopBar
        title="Kitchen pass"
        sub={`${tickets.length} open tickets`}
        right={
          <>
            <span className="font-mono text-sm text-muted">{clock(snap.now)}</span>
            <Dot ok={connected} />
          </>
        }
      />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center text-muted">No open tickets</div>}
          {tickets.map((k) => {
            const fired = k.lines[0].firedAt
            const expected = Math.max(...k.lines.map((l) => l.expectedReadyAt))
            const late = snap.now > expected + snap.config.sop.kitchenDelayToleranceMin * 60_000
            const ready = k.lines.every((l) => l.status === 'ready')
            const allergies = allergyByTable[k.table]
            return (
              <article key={k.ticketId} className={`card-in rounded-2xl border bg-surface p-4 ${ready ? 'border-good/60' : late ? 'border-kitchen' : 'border-line'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl">{k.table}</span>
                  <span className={`font-mono text-sm ${late ? 'text-kitchen' : 'text-muted'}`}>
                    {mmss(snap.now - fired)} / {mmss(expected - fired)}
                  </span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted">{k.lines[0].course}</div>
                {allergies && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-warn/15 px-2 py-1 text-xs font-semibold text-warn">
                    <HeartPulse className="size-3.5" /> {allergies.join(', ')}
                  </div>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {k.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>
                        {l.qty}× {l.name}
                      </span>
                      <span className="text-[11px] text-faint">{l.station}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={ready}
                  onClick={() => void act('item.ready', { ticketId: k.ticketId }, 'kitchen')}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-raised py-2.5 text-sm font-semibold hover:bg-line disabled:bg-good/15 disabled:text-good"
                >
                  <Check className="size-4" /> {ready ? 'At the pass' : 'Ready'}
                </button>
              </article>
            )
          })}
        </div>

        <div className="space-y-4">
          <Panel title="From the floor">
            <ul className="space-y-2">
              {fromFloor.length === 0 && <li className="text-sm text-faint">No notes yet</li>}
              {fromFloor.map((n) => (
                <li key={n.id} className={`rounded-xl p-2.5 text-sm ${n.text.startsWith('ALLERGY') ? 'bg-warn/15 text-warn' : 'bg-raised'}`}>
                  <div className="text-[11px] text-muted">
                    {snap.config.staff.find((s) => s.id === n.from)?.name ?? n.from} · {n.tableId ?? 'general'} · {clock(n.at)}
                  </div>
                  {n.text}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Tell the floor">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendNote()
              }}
            >
              <select value={table} onChange={(e) => setTable(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                <option value="">Whole floor</option>
                {snap.tables.filter((t) => t.visitId).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. mains 5 min, grill backed up" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-saffron" />
                <button type="submit" className="rounded-xl bg-raised px-3 text-saffron hover:bg-line" aria-label="Send">
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Availability (86 board)">
            <ul className="divide-y divide-line">
              {snap.config.menu.map((m) => {
                const off = snap.unavailable.includes(m.id)
                return (
                  <li key={m.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className={off ? 'text-faint line-through' : ''}>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => void act('item.stock', { menuItemId: m.id, available: off }, 'kitchen')}
                      className={`rounded-lg px-2 py-0.5 text-xs ${off ? 'bg-warn/15 text-warn' : 'bg-raised text-muted'}`}
                    >
                      {off ? 'Off' : 'On'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {snap.sim.startedAt !== null && (
            <label className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <Bot className="size-4 text-muted" /> Demo: kitchen cooks automatically
              </span>
              <input type="checkbox" className="size-5 accent-[var(--color-saffron)]" checked={snap.sim.autoKitchen} onChange={(e) => void post('/api/sim/settings', { autoKitchen: e.target.checked })} />
            </label>
          )}
        </div>
      </main>
    </div>
  )
}
