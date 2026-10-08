// The manager's line to the team: send a note to one server, a few, or everyone (it shows as a
// card on their phone until they tap "Got it"), and thank people with kudos (XP for them, and a
// line on the team board). Load is shown so notes go to people with room, never as a ranking.

import { Check, HeartHandshake, Megaphone, MessageSquarePlus, Send, Users } from 'lucide-react'
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

const NOTE_IDEAS = [
  'Push the dessert specials tonight',
  'Please help run food from the pass',
  'Take your break now; I’ll cover your section',
  'Regulars arriving soon; give them a warm welcome',
  'Double-check allergies before firing mains',
  'Pre-bus and reset as soon as tables pay',
]
/** The same reasons servers use, so kudos read the same on the team board in every language. */
const KUDOS_IDEAS = [en['kudos.r1'], en['kudos.r2'], en['kudos.r3'], en['kudos.r4'], en['kudos.r5'], 'Brilliant with a guest’s access needs', 'Spotted an allergy clash']

export function TeamCard({ snap, managerId }: { snap: Snapshot; managerId: string }) {
  const [compose, setCompose] = useState<{ mode: Mode; to: string[] } | null>(null)
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const sectionOf = (id: string) => Object.entries(snap.config.sections).find(([, s]) => s === id)?.[0]
  const notes = snap.instructions ?? []
  const all = servers.map((s) => s.id)
  const kudos = snap.team.kudos.filter((k) => k.from === managerId).slice(0, 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <PanelTitle>Your team</PanelTitle>
        </CardTitle>
        <CardDescription>Send a note or say thanks. A note shows as a card on the server’s phone until they tap “Got it”.</CardDescription>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCompose({ mode: 'kudos', to: [] })}>
            <HeartHandshake /> <span className="hidden sm:inline">Give kudos</span>
          </Button>
          <Button size="sm" onClick={() => setCompose({ mode: 'note', to: all })}>
            <Megaphone /> <span className="hidden sm:inline">Message everyone</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ul className="divide-y rounded-xl border">
          {servers.map((s) => {
            const active = snap.tables.filter((t) => t.serverId === s.id && t.visitId).length
            const open = snap.openTasks?.[s.id] ?? 0
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar staff={s} className="size-8 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {s.name}
                    {s.pronouns && <span className="ml-1 text-xs font-normal text-muted-foreground">({s.pronouns})</span>}
                  </div>
                  <div className="text-xs text-muted-foreground tabular">
                    Section {sectionOf(s.id) ?? '–'} · {active} {active === 1 ? 'table' : 'tables'} · {open} to do
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-9" onClick={() => setCompose({ mode: 'note', to: [s.id] })} aria-label={`Send ${s.name} a note`}>
                  <MessageSquarePlus /> <span className="hidden md:inline">Note</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-primary" onClick={() => setCompose({ mode: 'kudos', to: [s.id] })} aria-label={`Give ${s.name} kudos`}>
                  <HeartHandshake /> <span className="hidden md:inline">Kudos</span>
                </Button>
              </li>
            )
          })}
        </ul>
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Notes you’ve sent</h3>
          {notes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No notes yet. Notes and who has seen them appear here.</p>
          ) : (
            <ul className="space-y-2">
              {notes.slice(0, 5).map((n) => {
                const seen = n.to.filter((id) => n.acks[id])
                const everyone = n.to.length === servers.length
                return (
                  <li key={n.id} className="rounded-xl border p-3 text-sm">
                    <p>{n.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        To {everyone ? 'everyone' : n.to.map((id) => servers.find((s) => s.id === id)?.name ?? id).join(', ')}
                        {n.tableId ? ` · about ${snap.tables.find((t) => t.id === n.tableId)?.name ?? n.tableId}` : ''} · {minutesAgo(n.at, snap.now) < 1 ? 'just now' : `${minutesAgo(n.at, snap.now)} min ago`}
                      </span>
                      <span className={cn('inline-flex items-center gap-1', seen.length === n.to.length && 'text-good')}>
                        <Check className="size-3.5" /> Seen by {seen.length === n.to.length ? 'all' : `${seen.length} of ${n.to.length}`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {kudos.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Kudos you’ve given</h3>
              <ul className="space-y-1.5">
                {kudos.map((k) => (
                  <li key={k.id} className="flex items-start gap-2 text-sm">
                    <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <b className="font-medium">{servers.find((s) => s.id === k.to)?.name ?? k.to}</b>: {k.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </CardContent>
      <Composer key={compose ? `${compose.mode}:${compose.to.join(',')}` : 'closed'} state={compose} onClose={() => setCompose(null)} servers={servers} snap={snap} managerId={managerId} />
    </Card>
  )
}

function Composer({ state, onClose, servers, snap, managerId }: { state: { mode: Mode; to: string[] } | null; onClose: () => void; servers: Staff[]; snap: Snapshot; managerId: string }) {
  const [mode, setMode] = useState<Mode>(state?.mode ?? 'note')
  const [to, setTo] = useState<string[]>(state?.to ?? [])
  const [text, setText] = useState('')
  const [tableId, setTableId] = useState('none')
  const [sending, setSending] = useState(false)
  const everyone = to.length === servers.length
  const names = (ids: string[]) => (ids.length === servers.length ? 'everyone' : ids.map((id) => servers.find((s) => s.id === id)?.name ?? id).join(', '))
  const toggle = (id: string) => setTo((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const ready = to.length > 0 && text.trim().length > 0

  async function send() {
    if (!ready) return
    setSending(true)
    try {
      const body = text.trim().slice(0, 240)
      if (mode === 'note') {
        await act('manager.instruction', { instructionId: noteId(), from: managerId, to, text: body, ...(tableId !== 'none' ? { tableId } : {}) }, 'manager')
        toast.success(`Note sent to ${names(to)}`)
      } else {
        for (const id of to) await act('kudos.sent', { from: managerId, to: id, reason: body }, 'manager')
        toast.success(`Kudos sent to ${names(to)}`)
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t send. Try again.')
    } finally {
      setSending(false)
    }
  }

  const ideas = mode === 'note' ? NOTE_IDEAS : KUDOS_IDEAS
  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{mode === 'note' ? 'Send a note' : 'Give kudos'}</SheetTitle>
          <SheetDescription>{mode === 'note' ? 'It appears as a card on their phone until they tap “Got it”. You’ll see who has seen it.' : 'They get XP and a celebration on their phone, and it shows on the team board.'}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div role="tablist" aria-label="What to send" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
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
              To
              <button type="button" className="inline-flex items-center gap-1 text-xs font-normal text-primary underline-offset-4 hover:underline" onClick={() => setTo(everyone ? [] : servers.map((s) => s.id))}>
                <Users className="size-3.5" /> {everyone ? 'Clear' : 'Everyone'}
              </button>
            </legend>
            <div className="flex flex-wrap gap-2">
              {servers.map((s) => {
                const on = to.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.id)}
                    className={cn('inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors', on ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-secondary')}
                  >
                    <Avatar staff={s} className="size-7 text-xs" />
                    {s.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="compose-text" className="mb-2 block text-sm font-medium">
              {mode === 'note' ? 'Note' : 'What did they do?'}
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ideas.map((i) => (
                <button key={i} type="button" onClick={() => setText(i)} className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', text === i ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                  {i}
                </button>
              ))}
            </div>
            <Textarea id="compose-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} rows={3} placeholder={mode === 'note' ? 'Write a short note…' : 'Say what they did well…'} />
          </div>

          {mode === 'note' && (
            <div>
              <label className="mb-2 block text-sm font-medium" id="compose-table">
                About a table <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="w-full" aria-labelledby="compose-table">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No particular table</SelectItem>
                  {snap.tables
                    .filter((t) => to.length === 0 || to.includes(t.serverId))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.party?.guestName ? ` · ${t.party.guestName}` : t.visitId ? ` · party of ${t.party?.size ?? '?'}` : ' · free'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button className="h-11 w-full" disabled={!ready || sending} onClick={() => void send()}>
            <Send /> {mode === 'note' ? 'Send note' : 'Send kudos'}
            {to.length > 0 && <span className="font-normal opacity-80"> to {names(to)}</span>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
