import { Bot, Check, HeartPulse, Send } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { OrderLine } from '../../shared/types.ts'
import { AppShell, LiveClock, ShellSkeleton, PanelTitle } from '../components/kit.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { clock, mmss } from '../lib/format.ts'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'

const FLOOR = '__floor'

export default function KitchenView() {
  const { snap, connected } = useSnapshot('kitchen')
  const [text, setText] = useState('')
  const [table, setTable] = useState(FLOOR)

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

  if (!snap) return <ShellSkeleton />
  const allergyByTable = Object.fromEntries(snap.tables.filter((t) => t.party?.allergies.length).map((t) => [t.name, t.party!.allergies]))
  const fromFloor = snap.notes.filter((n) => n.direction === 'to_kitchen').slice(-12).reverse()

  async function sendNote() {
    if (!text.trim()) return
    const tableId = table === FLOOR ? undefined : table
    await act('note.sent', { noteId: noteId(), direction: 'to_floor', tableId, text: text.trim(), from: 'k_pass' }, 'kitchen')
    toast.success(tableId ? `Sent to ${tableId}'s server` : 'Sent to the whole floor')
    setText('')
  }

  return (
    <AppShell title="Kitchen pass" sub={`${tickets.length} open ${tickets.length === 1 ? 'ticket' : 'tickets'}`} right={<LiveClock now={snap.now} ok={connected} />}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.length === 0 && <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No open tickets. New orders appear here the moment they’re fired.</div>}
          <AnimatePresence mode="popLayout" initial={false}>
            {tickets.map((k) => {
              const fired = k.lines[0].firedAt
              const expected = Math.max(...k.lines.map((l) => l.expectedReadyAt))
              const late = snap.now > expected + snap.config.sop.kitchenDelayToleranceMin * 60_000
              const ready = k.lines.every((l) => l.status === 'ready')
              const allergies = allergyByTable[k.table]
              const frac = Math.min(1, (snap.now - fired) / Math.max(1, expected - fired))
              return (
                <motion.article
                  key={k.ticketId}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={cn('flex flex-col rounded-2xl border bg-card p-4', ready ? 'border-good/60' : late && 'border-kitchen')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl">{k.table}</span>
                    <span className={cn('text-sm tabular', late ? 'font-semibold text-kitchen' : 'text-muted-foreground')}>
                      {mmss(snap.now - fired)} / {mmss(expected - fired)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full origin-left transition-transform duration-1000 ease-linear', late ? 'bg-kitchen' : 'bg-primary/70')} style={{ transform: `scaleX(${frac})` }} />
                  </div>
                  <div className="mt-2 text-xs capitalize text-muted-foreground">{k.lines[0].course}s</div>
                  {allergies && (
                    <Badge variant="outline" className="mt-2 w-fit gap-1 border-warn/50 text-warn">
                      <HeartPulse className="size-3.5" /> {allergies.join(', ')}
                    </Badge>
                  )}
                  <ul className="mt-2 flex-1 space-y-1 text-sm">
                    {k.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2">
                        <span>
                          {l.qty}× {l.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{l.station}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn('mt-3 h-10 w-full', ready && 'bg-good/15 text-good hover:bg-good/15')}
                    variant={ready ? 'secondary' : 'default'}
                    disabled={ready}
                    onClick={() => void act('item.ready', { ticketId: k.ticketId }, 'kitchen')}
                  >
                    <Check /> {ready ? 'At the pass' : 'Ready'}
                  </Button>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><PanelTitle>From the floor</PanelTitle></CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {fromFloor.length === 0 && <li className="text-sm text-muted-foreground">Notes from servers will appear here.</li>}
                {fromFloor.map((n) => (
                  <li key={n.id} className={cn('rounded-lg p-2.5 text-sm', n.text.startsWith('ALLERGY') ? 'bg-warn/15 font-medium text-warn' : 'bg-muted')}>
                    <div className="text-[11px] font-normal text-muted-foreground">
                      {snap.config.staff.find((s) => s.id === n.from)?.name ?? n.from}, {n.tableId ?? 'general'}, {clock(n.at)}
                    </div>
                    {n.text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><PanelTitle>Tell the floor</PanelTitle></CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendNote()
                }}
              >
                <Select value={table} onValueChange={setTable}>
                  <SelectTrigger id="note-table" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FLOOR}>Whole floor</SelectItem>
                    {snap.tables.filter((t) => t.visitId).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input id="floor-note" name="floor-note" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. mains 5 min, grill backed up…" />
                  <Button type="submit" size="icon" aria-label="Send to floor" disabled={!text.trim()}>
                    <Send />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><PanelTitle>Availability (86 board)</PanelTitle></CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {snap.config.menu.map((m) => {
                  const off = snap.unavailable.includes(m.id)
                  return (
                    <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <label htmlFor={`stock-${m.id}`} className={cn('cursor-pointer', off && 'text-muted-foreground line-through')}>
                        {m.name}
                      </label>
                      <Switch id={`stock-${m.id}`} checked={!off} onCheckedChange={(on) => void act('item.stock', { menuItemId: m.id, available: on }, 'kitchen')} aria-label={`${m.name} available`} />
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

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
