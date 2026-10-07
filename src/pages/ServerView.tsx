import { Bot, Flame, Loader2, Lock, MessageSquareText, NotebookPen, Send, Sparkles, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AiAnswerBox } from '../components/AiAnswer.tsx'
import { AppHeader, LiveClock, Loading, SectionTitle, Stat, TableTile } from '../components/kit.tsx'
import { TaskCard } from '../components/TaskCard.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { clock, mmss } from '../lib/format.ts'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'

const QUICK = ['Allergy', 'Hold mains', 'Rush please', 'Guest complaint', 'Birthday dessert', 'Fire mains']
const SOP_EXAMPLES = ['How fast should I greet?', 'What goes in a table reset?', 'When do I warn guests about a delay?']

export default function ServerView() {
  const { staffId = '' } = useParams()
  const { snap, connected } = useSnapshot('server', staffId)
  const [noteTable, setNoteTable] = useState('')
  const [noteText, setNoteText] = useState('')
  const [question, setQuestion] = useState('')
  const briefing = useAi()
  const sop = useAi()

  const me = snap?.config.staff.find((s) => s.id === staffId)
  const section = snap ? Object.entries(snap.config.sections).find(([, id]) => id === staffId)?.[0] : undefined
  const myTables = useMemo(() => snap?.tables.filter((t) => t.serverId === staffId) ?? [], [snap, staffId])
  const myNotes = useMemo(
    () => snap?.notes.filter((n) => !n.tableId || myTables.some((t) => t.id === n.tableId) || n.from === staffId).slice(-6).reverse() ?? [],
    [snap, myTables, staffId],
  )

  if (!snap) return <Loading />
  if (!me || !snap.me) return <div className="p-8 text-muted-foreground">We couldn’t find that staff member. Go back and pick a name.</div>

  const { top, queued, stats } = snap.me
  const autopilot = snap.sim.autopilot.includes(staffId)
  const active = myTables.filter((t) => t.visitId)

  async function sendNote() {
    const text = noteText.trim()
    if (!text) return
    await act('note.sent', { noteId: noteId(), direction: 'to_kitchen', tableId: noteTable || undefined, text, from: staffId })
    toast.success(noteTable ? `Sent to the kitchen about ${noteTable}` : 'Sent to the kitchen')
    setNoteText('')
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader
        nav={false}
        right={
          <>
            {stats && stats.streak > 0 && (
              <Badge className="gap-1" title="Tables in a row served to standard">
                <Flame className="size-3.5" /> {stats.streak}
              </Badge>
            )}
            <LiveClock now={snap.now} ok={connected} />
          </>
        }
      />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Section {section ?? '—'} · {active.length} {active.length === 1 ? 'table' : 'tables'} seated
              </p>
              <h1 className="font-display text-3xl">Hi {me.name}</h1>
            </div>
            {queued > 0 && <span className="pb-1 text-xs text-muted-foreground">+{queued} more lined up</span>}
          </div>

          {snap.sim.startedAt !== null && (
            <label
              htmlFor="autopilot"
              className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', autopilot ? 'border-dashed bg-muted/40' : 'border-primary/40 bg-accent/40')}
            >
              <span className="inline-flex items-center gap-2">
                <Bot className="size-4 text-muted-foreground" />
                {autopilot ? `Demo autopilot is serving ${me.name}’s tables. Switch off to play yourself.` : `You’re serving ${me.name}’s section.`}
              </span>
              <Switch id="autopilot" checked={autopilot} onCheckedChange={(v) => void post('/api/sim/settings', { staffId, autopilot: v })} />
            </label>
          )}

          <SectionTitle>Next up</SectionTitle>
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {top.map((t, i) => (
                <TaskCard key={t.id} task={t} now={snap.now} lead={i === 0} staffId={staffId} />
              ))}
            </AnimatePresence>
            {top.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed p-10 text-center">
                <div className="font-display text-xl">All caught up</div>
                <p className="mt-1 text-sm text-muted-foreground">Nothing needs you right now. The next thing will appear here as it happens.</p>
              </motion.div>
            )}
          </div>

          <SectionTitle>My tables</SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {myTables.map((t) => (
              <TableTile key={t.id} t={t} now={snap.now} color={me.color} active={noteTable === t.id} onClick={() => setNoteTable(noteTable === t.id ? '' : t.id)} />
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent>
              <Tabs defaultValue="briefing">
                <TabsList className="w-full">
                  <TabsTrigger value="briefing">
                    <NotebookPen /> Briefing
                  </TabsTrigger>
                  <TabsTrigger value="kitchen">
                    <Send /> Kitchen
                  </TabsTrigger>
                  <TabsTrigger value="ask">
                    <MessageSquareText /> Ask
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="briefing" className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">A quick rundown of your section: allergies, regulars, occasions and anything the kitchen is behind on.</p>
                  <Button variant="secondary" className="w-full" disabled={briefing.loading} onClick={() => briefing.ask('briefing', { staffId })}>
                    {briefing.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {briefing.answer ? 'Refresh briefing' : 'Brief me'}
                  </Button>
                  <AiAnswerBox answer={briefing.answer} error={briefing.error} />
                </TabsContent>

                <TabsContent value="kitchen" className="space-y-3 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="xs" variant={noteTable === '' ? 'default' : 'secondary'} onClick={() => setNoteTable('')}>
                      General
                    </Button>
                    {active.map((t) => (
                      <Button key={t.id} size="xs" variant={noteTable === t.id ? 'default' : 'secondary'} onClick={() => setNoteTable(t.id)}>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK.map((q) => (
                      <Button key={q} size="xs" variant="outline" className="rounded-full font-normal" onClick={() => setNoteText(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void sendNote()
                    }}
                  >
                    <Input id="note-text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={noteTable ? `Note about ${noteTable}…` : 'Note to the pass…'} />
                    <Button type="submit" size="icon" aria-label="Send to kitchen" disabled={!noteText.trim()}>
                      <Send />
                    </Button>
                  </form>
                  <ul className="space-y-2">
                    {myNotes.length === 0 && <li className="text-sm text-muted-foreground">Messages with the kitchen will show here.</li>}
                    {myNotes.map((n) => (
                      <li key={n.id} className="text-sm">
                        <span className={cn('mr-2 text-[11px] font-semibold uppercase', n.direction === 'to_floor' ? 'text-kitchen' : 'text-floor-mark')}>{n.direction === 'to_floor' ? 'Kitchen' : 'You'}</span>
                        {n.tableId && <span className="mr-1 text-muted-foreground">{n.tableId} ·</span>}
                        {n.text}
                        <span className="ml-2 text-[11px] text-muted-foreground tabular">{clock(n.at)}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="ask" className="space-y-3 pt-3">
                  <p className="text-sm text-muted-foreground">Ask about service standards. With Dify connected it answers from your SOP manual.</p>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (question.trim()) void sop.ask('ask_sop', { question, staffId })
                    }}
                  >
                    <Input id="sop-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How do I handle a complaint?" />
                    <Button type="submit" size="icon" aria-label="Ask" disabled={sop.loading || !question.trim()}>
                      {sop.loading ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-1.5">
                    {SOP_EXAMPLES.map((q) => (
                      <Button
                        key={q}
                        size="xs"
                        variant="outline"
                        className="rounded-full font-normal"
                        onClick={() => {
                          setQuestion(q)
                          void sop.ask('ask_sop', { question: q, staffId })
                        }}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                  <AiAnswerBox answer={sop.answer} error={sop.error} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                My shift
                <span className="inline-flex items-center gap-1 font-normal normal-case tracking-normal">
                  <Lock className="size-3" /> Only you see this
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Stat label="Smooth tables" value={`${stats?.smoothTables ?? 0}/${stats?.completedTables ?? 0}`} sub="every step to standard" />
              <Stat
                label="Streak"
                value={stats?.streak ?? 0}
                sub={
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="size-3" /> best {stats?.bestStreak ?? 0}
                  </span>
                }
              />
              <Stat label="Avg greeting" value={stats?.avgGreetSec != null ? mmss(stats.avgGreetSec * 1000) : '—'} sub={`standard ${snap.config.sop.greetWithinMin}:00`} />
              <Stat label="Kitchen delays" value={snap.me.myVisits.reduce((a, v) => a + v.segments.filter((s) => s.owner === 'kitchen' && s.lapse).length, 0)} sub="not counted against you" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
