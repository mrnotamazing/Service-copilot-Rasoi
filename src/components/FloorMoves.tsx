// Manager only: suggestions to share the floor (hand a table to a server who speaks the guests'
// language, take load off a full section, bring a teammate over, nudge the kitchen), each with a
// one-tap button, and a picker to hand any table to another server by hand. Built from load and
// language, never from how well anyone is doing.

import { S } from '../i18n/sentences.ts'
import { useT, L } from '../i18n/index.ts'
import { ArrowRightLeft, ChefHat, CircleCheck, Languages, MessageSquare, Scale, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { FloorInsight } from '../../shared/floorInsights.ts'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { TableState } from '../../shared/types.ts'
import { SPOKEN } from '../../shared/profile.ts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { act, noteId, post } from '../lib/live.ts'
import { PanelTitle } from './kit.tsx'

const ICON: Record<FloorInsight['kind'], typeof Scale> = {
  first_visit: Sparkles,
  load_move: Scale,
  language_move: Languages,
  language_help: Languages,
  language_gap: Languages,
  question_wait: ChefHat,
}

export async function applyInsight(i: FloorInsight, managerId: string) {
  const a = i.action
  if (!a) return
  if (a.type === 'move') await post('/api/floor/move', { tableId: a.tableId, serverId: a.serverId, reason: a.reason, from: managerId })
  else if (a.type === 'note') await act('manager.instruction', { instructionId: noteId(), from: managerId, to: [a.to], text: a.text, ...(a.tableId ? { tableId: a.tableId } : {}) }, 'manager')
  else await act('note.sent', { noteId: noteId(), direction: 'to_kitchen', text: a.text, from: managerId, ...(a.tableId ? { tableId: a.tableId } : {}) }, 'manager')
}

export function FloorMoves({ snap, managerId }: { snap: Snapshot; managerId: string }) {
  const tx = useT()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const list = (snap.insights ?? []).filter((i) => !hidden.has(i.id))
  const hide = (id: string) => setHidden((h) => new Set(h).add(id))

  async function apply(i: FloorInsight) {
    setBusy(i.id)
    try {
      await applyInsight(i, managerId)
      toast.success(i.action?.type === 'move' ? L('{title}. Both servers have a note.', { title: i.title.replace(/^Hand /, L('Handed ')) }) : i.action?.type === 'kitchen' ? L('Kitchen nudged') : L('Note sent'))
      hide(i.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <PanelTitle>{tx('ui.floormoves.share_the_floor')}</PanelTitle>
        </CardTitle>
        <CardDescription>{tx('ui.floormoves.suggested_handovers_and_nudges')}</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden /> {tx('ui.floormoves.load_looks_fair_and')}
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
            {list.map((i) => {
              const Icon = ICON[i.kind]
              return (
                <motion.li key={i.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22 }} className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary">
                    <Icon className="size-4 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block text-sm font-medium">{S(i.title)}</span>
                    <span className="block text-xs text-muted-foreground text-pretty">{S(i.why)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 self-center">
                    {i.action && (
                      <Button size="sm" className="h-8 rounded-full" disabled={busy === i.id} onClick={() => void apply(i)}>
                        {i.action.type === 'move' ? <ArrowRightLeft /> : i.action.type === 'note' ? <MessageSquare /> : <ChefHat />} {S(i.cta)}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-8" aria-label={L('Not now: {title}', { title: S(i.title) })} onClick={() => hide(i.id)}>
                      <X />
                    </Button>
                  </span>
                </motion.li>
              )
            })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** "Hand to…": move one table to another server by hand. */
export function HandTo({ snap, table: t, managerId }: { snap: Snapshot; table: TableState; managerId: string }) {
  const tx = useT()
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const home = t.handover ? snap.config.staff.find((s) => s.id === t.handover!.from) : undefined
  async function move(serverId: string) {
    try {
      await post('/api/floor/move', { tableId: t.id, serverId, reason: 'manager', from: managerId })
      const to = servers.find((s) => s.id === serverId)?.name
      toast.success(t.visitId ? L('{table} handed to {to}. Both servers have a note.', { table: t.name, to: to ?? '' }) : L('{table} is now {to}’s table.', { table: t.name, to: to ?? '' }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div>
      <label htmlFor={`hand-${t.id}`} className="block text-xs text-muted-foreground">
        {tx('ui.floormoves.server')}{home ? ` (${L('handed over from {name}', { name: home.name })})` : ''}
      </label>
      <Select value={t.serverId} onValueChange={(v) => void move(v)}>
        <SelectTrigger id={`hand-${t.id}`} size="sm" className="mt-0.5 h-8 min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {servers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              {s.languages?.length ? <span className="text-muted-foreground">({s.languages.map((l) => SPOKEN.find((x) => x.id === l)?.english ?? l).join(', ')})</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
