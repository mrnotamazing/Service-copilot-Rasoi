import { Bot, Flame, Lock, Send, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TaskCard } from '../components/TaskCard.tsx'
import { Dot, Panel, Stat, TableTile, TopBar } from '../components/ui.tsx'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'
import { clock, mmss } from '../lib/format.ts'

const QUICK = ['Allergy', 'Hold mains', 'Rush please', 'Guest complaint', 'Birthday dessert', 'Fire mains']

export default function ServerView() {
  const { staffId = '' } = useParams()
  const { snap, connected } = useSnapshot('server', staffId)
  const [noteTable, setNoteTable] = useState<string>('')
  const [noteText, setNoteText] = useState('')

  const me = snap?.config.staff.find((s) => s.id === staffId)
  const section = snap ? Object.entries(snap.config.sections).find(([, id]) => id === staffId)?.[0] : undefined
  const myTables = useMemo(() => snap?.tables.filter((t) => t.serverId === staffId) ?? [], [snap, staffId])
  const myNotes = useMemo(
    () => snap?.notes.filter((n) => !n.tableId || myTables.some((t) => t.id === n.tableId) || n.from === staffId).slice(-6).reverse() ?? [],
    [snap, myTables, staffId],
  )

  if (!snap) return <Loading />
  if (!me || !snap.me) return <div className="p-8 text-muted">Unknown staff member.</div>

  const { top, queued, stats } = snap.me
  const autopilot = snap.sim.autopilot.includes(staffId)

  async function sendNote() {
    const text = noteText.trim()
    if (!text) return
    await act('note.sent', { noteId: noteId(), direction: 'to_kitchen', tableId: noteTable || undefined, text, from: staffId })
    setNoteText('')
  }

  return (
    <div className="min-h-screen pb-16">
      <TopBar
        title={me.name}
        sub={`Section ${section ?? '—'} · ${myTables.filter((t) => t.visitId).length} active tables`}
        right={
          <>
            {stats && stats.streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-semibold text-saffron" title="Tables in a row served to standard">
                <Flame className="size-3.5" /> {stats.streak}
              </span>
            )}
            <span className="font-mono text-sm text-muted">{clock(snap.now)}</span>
            <Dot ok={connected} />
          </>
        }
      />

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
            {snap.sim.startedAt !== null && (
              <label className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Bot className="size-4 text-muted" /> {autopilot ? `Autopilot is serving ${me.name}’s tables. Untick to play yourself` : `You’re playing ${me.name}`}
                </span>
                <input type="checkbox" className="size-5 accent-[var(--color-saffron)]" checked={autopilot} onChange={(e) => void post('/api/sim/settings', { staffId, autopilot: e.target.checked })} />
              </label>
            )}
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl">Next up</h1>
            {queued > 0 && <span className="text-xs text-muted">+{queued} more lined up</span>}
          </div>
          {top.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center">
              <div className="font-display text-xl">All caught up</div>
              <p className="mt-1 text-sm text-muted">Nothing needs you right now. We’ll bring the next thing up as it happens.</p>
            </div>
          ) : (
            top.map((t, i) => <TaskCard key={t.id} task={t} now={snap.now} lead={i === 0} staffId={staffId} />)
          )}

          <Panel title="My tables">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {myTables.map((t) => (
                <TableTile key={t.id} t={t} now={snap.now} color={me.color} active={noteTable === t.id} onClick={() => setNoteTable(noteTable === t.id ? '' : t.id)} />
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Talk to the kitchen">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setNoteTable('')} className={`rounded-lg px-2 py-1 text-xs ${noteTable === '' ? 'bg-saffron text-bg' : 'bg-raised text-muted'}`}>
                General
              </button>
              {myTables.filter((t) => t.visitId).map((t) => (
                <button key={t.id} type="button" onClick={() => setNoteTable(t.id)} className={`rounded-lg px-2 py-1 text-xs ${noteTable === t.id ? 'bg-saffron text-bg' : 'bg-raised text-muted'}`}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setNoteText(q)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendNote()
              }}
            >
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={noteTable ? `Note about ${noteTable}…` : 'Note to the pass…'}
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-saffron"
              />
              <button type="submit" className="rounded-xl bg-raised px-3 text-saffron hover:bg-line" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {myNotes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className={`mr-2 text-[11px] font-semibold uppercase ${n.direction === 'to_floor' ? 'text-kitchen' : 'text-info'}`}>{n.direction === 'to_floor' ? 'Kitchen' : 'You'}</span>
                  {n.tableId && <span className="mr-1 text-muted">{n.tableId} ·</span>}
                  {n.text}
                  <span className="ml-2 text-[11px] text-faint">{clock(n.at)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="My shift"
            right={
              <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                <Lock className="size-3" /> Only you see this
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Smooth tables" value={`${stats?.smoothTables ?? 0}/${stats?.completedTables ?? 0}`} sub="every step to standard" />
              <Stat label="Streak" value={stats?.streak ?? 0} sub={<span className="inline-flex items-center gap-1"><Trophy className="size-3" /> best {stats?.bestStreak ?? 0}</span>} />
              <Stat label="Avg greeting" value={stats?.avgGreetSec != null ? mmss(stats.avgGreetSec * 1000) : '—'} sub={`standard ${snap.config.sop.greetWithinMin}:00`} />
              <Stat label="Kitchen delays" value={snap.me.myVisits.reduce((a, v) => a + v.segments.filter((s) => s.owner === 'kitchen' && s.lapse).length, 0)} sub="not counted against you" />
            </div>
          </Panel>

        </div>
      </main>
    </div>
  )
}

export function Loading() {
  return <div className="grid min-h-screen place-items-center text-muted">Connecting to service…</div>
}
