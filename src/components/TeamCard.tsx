// The team desk, shared by the manager and the kitchen: notes for you (tap "Got it" so the sender
// knows), send a note to anyone (it shows as a card on a server's phone, or on the manager's and
// kitchen's screens, until they tap "Got it"), and thank people with kudos (XP for servers, and a
// line on the team board). Load is shown so notes go to people with room, never as a ranking.

import { useT, L } from '../i18n/index.ts'
import { Check, ChefHat, HeartHandshake, Inbox, LayoutDashboard, Megaphone, MessageSquarePlus, Send, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { Staff } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { en } from '../i18n/en.ts'
import { minutesAgo } from '../lib/format.ts'
import { act, noteId } from '../lib/live.ts'
import { Avatar } from './Avatar.tsx'
import { PanelTitle } from './kit.tsx'

type Mode = 'note' | 'kudos'
type Source = 'manager' | 'kitchen'

const MANAGER_IDEAS = () => [
  L('Push the dessert specials tonight'),
  L('Please help run food from the pass'),
  L('Take your break now; I’ll cover your section'),
  L('Regulars arriving soon; give them a warm welcome'),
  L('Double-check allergies before firing mains'),
  L('Big party at 8:30; please hold the grill for them'),
]
const KITCHEN_IDEAS = () => [
  L('Grill is backed up; mains about 10 minutes behind'),
  L('Need a runner at the pass, please'),
  L('Running low on sea bass; about 4 portions left'),
  L('Ready for mains whenever you are'),
  L('Please confirm the allergy before I fire'),
  L('Short a cook tonight; ticket times will be longer'),
]
/** The same reasons servers use, so kudos read the same on the team board in every language. */
const KUDOS_IDEAS = () => [en['kudos.r1'], en['kudos.r2'], en['kudos.r3'], en['kudos.r4'], en['kudos.r5'], L('Spotted an allergy clash'), L('Great teamwork at the pass')]

const ago = (at: number, now: number) => (minutesAgo(at, now) < 1 ? L('just now') : L('{n} min ago', { n: minutesAgo(at, now) }))

/** Who someone is on the team, in one line: a server's section and load, the kitchen's queue. */
function roleLine(s: Staff, snap: Snapshot): string {
  if (s.role === 'kitchen') {
    const cooking = snap.tables.reduce((n, t) => n + t.lines.filter((l) => l.status === 'fired').length, 0)
    return L('Kitchen pass · {n} on the line', { n: cooking })
  }
  if (s.role === 'manager') return L('Floor manager')
  const section = Object.entries(snap.config.sections).find(([, id]) => id === s.id)?.[0]
  const active = snap.tables.filter((t) => t.serverId === s.id && t.visitId).length
  return `Section ${section ?? '–'} · ${active} ${active === 1 ? 'table' : 'tables'} · ${snap.openTasks?.[s.id] ?? 0} to do`
}

export function TeamCard({ snap, meId, compact }: { snap: Snapshot; meId: string; compact?: boolean }) {
  const tx = useT()
  const [compose, setCompose] = useState<{ mode: Mode; to: string[] } | null>(null)
  const me = snap.config.staff.find((s) => s.id === meId)
  const source: Source = me?.role === 'kitchen' ? 'kitchen' : 'manager'
  // Servers first, then the kitchen and the manager (everyone but me).
  const order = { server: 0, kitchen: 1, manager: 2 } as const
  const people = snap.config.staff.filter((s) => s.id !== meId).sort((a, b) => order[a.role] - order[b.role])
  const servers = people.filter((s) => s.role === 'server')
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  const all = snap.instructions ?? []
  const sent = all.filter((n) => n.from === meId)
  const kudos = snap.team.kudos.filter((k) => k.from === meId).slice(0, 3)
  const thanked = snap.team.kudos.filter((k) => k.to === meId).slice(0, 3)

  // Notes for me: team notes addressed to me, and (for the kitchen) servers' notes to the kitchen.
  type Item = { id: string; at: number; from: string; text: string; tableId?: string; seen: boolean; ack: () => Promise<unknown>; urgent?: boolean }
  const inbox: Item[] = [
    ...all.filter((n) => n.to.includes(meId)).map((n) => ({ id: n.id, at: n.at, from: n.from, text: n.text, tableId: n.tableId, seen: !!n.acks[meId], ack: () => act('instruction.acked', { instructionId: n.id, staffId: meId }, source) })),
    ...(source === 'kitchen'
      ? snap.notes.filter((n) => n.direction === 'to_kitchen').map((n) => ({ id: n.id, at: n.at, from: n.from, text: n.text, tableId: n.tableId, seen: !!n.ackAt, urgent: /^(ALLERGY|SAFETY)/.test(n.text), ack: () => act('note.acked', { noteId: n.id }, 'kitchen') }))
      : []),
  ].sort((a, b) => Number(a.seen) - Number(b.seen) || b.at - a.at)
  const unseen = inbox.filter((n) => !n.seen).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <PanelTitle>{tx('ui.teamcard.team')}</PanelTitle>
        </CardTitle>
        <CardDescription>{compact ? L('Notes and kudos with the floor and the manager.') : L('Notes and kudos with the floor and the kitchen. A note stays on their screen until they tap “Got it”.')}</CardDescription>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCompose({ mode: 'kudos', to: [] })} aria-label={tx('ui.teamcard.give_kudos')}>
            <HeartHandshake /> {!compact && <span className="hidden sm:inline">{tx('ui.teamcard.give_kudos')}</span>}
          </Button>
          <Button size="sm" onClick={() => setCompose({ mode: 'note', to: source === 'kitchen' ? [] : servers.map((s) => s.id) })} aria-label={source === 'kitchen' ? L('Send a note') : L('Message all servers')}>
            <Megaphone /> {!compact && <span className="hidden sm:inline">{source === 'kitchen' ? L('Send a note') : L('Message all servers')}</span>}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={cn('grid gap-5', !compact && 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]')}>
        <div className="space-y-4">
          <section aria-label={tx('ui.teamcard.notes_for_you')}>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Inbox className="size-3.5" /> {tx('ui.teamcard.for_you')} {unseen > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular">{unseen}</span>}
            </h3>
            {inbox.length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{tx('ui.teamcard.notes_sent_to_you')}</p>
            ) : (
              <ul className="space-y-2">
                {inbox.slice(0, compact ? 4 : 5).map((n) => (
                  <li key={n.id} className={cn('flex items-start gap-3 rounded-xl border p-3 text-sm', n.seen && 'border-dashed bg-muted/40', !n.seen && n.urgent && 'border-warn/50 bg-warn/10')}>
                    <div className="min-w-0 flex-1">
                      <p className={cn(n.urgent && 'font-medium text-warn')}>{n.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {name(n.from)}
                        {n.tableId ? ` · ${snap.tables.find((t) => t.id === n.tableId)?.name ?? n.tableId}` : ''} · {ago(n.at, snap.now)}
                      </p>
                    </div>
                    {n.seen ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-good">
                        <Check className="size-3.5" /> {tx('ui.teamcard.seen')}
                      </span>
                    ) : (
                      <Button size="sm" variant="secondary" className="h-8 shrink-0" onClick={() => void n.ack()}>
                        {tx('ui.teamcard.got_it')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ul className="divide-y rounded-xl border" aria-label={tx('ui.teamcard.people')}>
            {people.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                {s.role === 'server' ? (
                  <Avatar staff={s} className="size-8 text-sm" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">{s.role === 'kitchen' ? <ChefHat className="size-4" /> : <LayoutDashboard className="size-4" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {s.name}
                    {s.pronouns && <span className="ml-1 text-xs font-normal text-muted-foreground">({s.pronouns})</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground tabular">{roleLine(s, snap)}</div>
                </div>
                <Button size="sm" variant="ghost" className="h-9 pointer-coarse:h-11 pointer-coarse:min-w-11" onClick={() => setCompose({ mode: 'note', to: [s.id] })} aria-label={`Send ${s.name} a note`}>
                  <MessageSquarePlus /> {!compact && <span className="hidden md:inline">{tx('ui.teamcard.note')}</span>}
                </Button>
                <Button size="sm" variant="ghost" className="h-9 pointer-coarse:h-11 pointer-coarse:min-w-11 text-primary" onClick={() => setCompose({ mode: 'kudos', to: [s.id] })} aria-label={`Give ${s.name} kudos`}>
                  <HeartHandshake /> {!compact && <span className="hidden md:inline">{tx('ui.teamcard.kudos')}</span>}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">{tx('ui.teamcard.notes_you_ve_sent')}</h3>
          {sent.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{tx('ui.teamcard.notes_you_send_and')}</p>
          ) : (
            <ul className="space-y-2">
              {sent.slice(0, compact ? 3 : 5).map((n) => {
                const seen = n.to.filter((id) => n.acks[id])
                const everyone = servers.length > 1 && servers.every((s) => n.to.includes(s.id)) && n.to.length === servers.length
                return (
                  <li key={n.id} className="rounded-xl border p-3 text-sm">
                    <p>{n.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {tx('ui.teamcard.to')} {everyone ? 'all servers' : n.to.map(name).join(', ')}
                        {n.tableId ? ` · about ${snap.tables.find((t) => t.id === n.tableId)?.name ?? n.tableId}` : ''} · {ago(n.at, snap.now)}
                      </span>
                      <span className={cn('inline-flex items-center gap-1', seen.length === n.to.length && 'text-good')}>
                        <Check className="size-3.5" /> {n.to.length === 1 ? (seen.length ? L('Seen') : L('Not seen yet')) : (seen.length === n.to.length ? L('Seen by all') : L('Seen by {a} of {b}', { a: seen.length, b: n.to.length }))}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {(kudos.length > 0 || thanked.length > 0) && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-medium text-muted-foreground">{tx('ui.teamcard.kudos')}</h3>
              <ul className="space-y-1.5">
                {[...thanked.map((k) => ({ ...k, line: L('{name} thanked you', { name: name(k.from) }) })), ...kudos.map((k) => ({ ...k, line: L('You thanked {name}', { name: name(k.to) }) }))].map((k) => (
                  <li key={k.id} className="flex items-start gap-2 text-sm">
                    <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <b className="font-medium">{k.line}</b>: {k.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </CardContent>
      <Composer key={compose ? `${compose.mode}:${compose.to.join(',')}` : 'closed'} state={compose} onClose={() => setCompose(null)} people={people} snap={snap} meId={meId} source={source} />
    </Card>
  )
}

function Composer({ state, onClose, people, snap, meId, source }: { state: { mode: Mode; to: string[] } | null; onClose: () => void; people: Staff[]; snap: Snapshot; meId: string; source: Source }) {
  const tx = useT()
  const servers = people.filter((s) => s.role === 'server')
  const [mode, setMode] = useState<Mode>(state?.mode ?? 'note')
  const [to, setTo] = useState<string[]>(state?.to ?? [])
  const [text, setText] = useState('')
  const [tableId, setTableId] = useState('none')
  const [sending, setSending] = useState(false)
  const everyone = to.length === people.length
  const names = (ids: string[]) => (ids.length === people.length ? 'everyone' : ids.length === servers.length && ids.every((id) => servers.some((s) => s.id === id)) ? 'all servers' : ids.map((id) => people.find((s) => s.id === id)?.name ?? id).join(', '))
  const toggle = (id: string) => setTo((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const ready = to.length > 0 && text.trim().length > 0

  async function send() {
    if (!ready) return
    setSending(true)
    try {
      const body = text.trim().slice(0, 240)
      if (mode === 'note') {
        await act('manager.instruction', { instructionId: noteId(), from: meId, to, text: body, ...(tableId !== 'none' ? { tableId } : {}) }, source)
        toast.success(L('Note sent to {names}', { names: names(to) }))
      } else {
        for (const id of to) await act('kudos.sent', { from: meId, to: id, reason: body }, source)
        toast.success(L('Kudos sent to {names}', { names: names(to) }))
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : L('Couldn’t send. Try again.'))
    } finally {
      setSending(false)
    }
  }

  const ideas = mode === 'note' ? (source === 'kitchen' ? KITCHEN_IDEAS() : MANAGER_IDEAS()) : KUDOS_IDEAS()
  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{mode === 'note' ? L('Send a note') : L('Give kudos')}</SheetTitle>
          <SheetDescription>{mode === 'note' ? L('It stays on their screen until they tap “Got it”, and you’ll see who has seen it.') : L('It shows on the team board; servers also get XP and a celebration on their phone.')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div role="tablist" aria-label={tx('ui.teamcard.what_to_send')} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(['note', 'kudos'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setText('')
                }}
                className={cn('flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium', mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'note' ? <Megaphone className="size-4" /> : <HeartHandshake className="size-4" />}
                {m === 'note' ? 'Note' : 'Kudos'}
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
              {tx('ui.teamcard.to')}
              <button type="button" className="inline-flex items-center gap-1 text-xs font-normal text-primary underline-offset-4 hover:underline" onClick={() => setTo(everyone ? [] : people.map((s) => s.id))}>
                <Users className="size-3.5" /> {everyone ? 'Clear' : 'Everyone'}
              </button>
            </legend>
            <div className="flex flex-wrap gap-2">
              {people.map((s) => {
                const on = to.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.id)}
                    className={cn('inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors', on ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-secondary')}
                  >
                    {s.role === 'server' ? <Avatar staff={s} className="size-7 text-xs" /> : <span className="grid size-7 place-items-center rounded-full bg-secondary text-primary">{s.role === 'kitchen' ? <ChefHat className="size-3.5" /> : <LayoutDashboard className="size-3.5" />}</span>}
                    {s.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="compose-text" className="mb-2 block text-sm font-medium">
              {mode === 'note' ? 'Note' : L('What did they do?')}
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ideas.map((i) => (
                <button key={i} type="button" onClick={() => setText(i)} className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', text === i ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                  {i}
                </button>
              ))}
            </div>
            <Textarea id="compose-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} rows={3} placeholder={mode === 'note' ? L('Write a short note…') : L('Say what they did well…')} />
          </div>

          {mode === 'note' && (
            <div>
              <label className="mb-2 block text-sm font-medium" id="compose-table">
                {tx('ui.teamcard.about_a_table')} <span className="font-normal text-muted-foreground">{tx('ui.teamcard.optional')}</span>
              </label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="w-full" aria-labelledby="compose-table">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('ui.teamcard.no_particular_table')}</SelectItem>
                  {snap.tables
                    .filter((t) => !to.some((id) => servers.some((s) => s.id === id)) || to.includes(t.serverId))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.party?.guestName ? ` · ${t.party.guestName}` : t.visitId ? ` · ${L('party of {n}', { n: t.party?.size ?? '?' })}` : ` · ${L('free')}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button className="h-11 w-full" disabled={!ready || sending} onClick={() => void send()}>
            <Send /> {mode === 'note' ? L('Send note') : L('Send kudos')}
            {to.length > 0 && <span className="font-normal opacity-80"> {tx('ui.setup.to')} {names(to)}</span>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
