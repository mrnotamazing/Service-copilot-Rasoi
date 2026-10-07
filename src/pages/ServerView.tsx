import { Armchair, Bot, CakeSlice, ChevronLeft, Flame, HeartHandshake, HeartPulse, Loader2, Lock, MessageSquareText, Send, Shield, Sparkles, Star, Target, Trophy, UserRound, Users, UtensilsCrossed } from 'lucide-react'
import { Mark, Mascot, TAGLINE, Wordmark } from '../brand/marks.tsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import { AiAnswerBox } from '../components/AiAnswer.tsx'
import { BadgeTile, Celebrations, LevelRing, StreakChip } from '../components/game.tsx'
import { TableTile, ThemeToggle } from '../components/kit.tsx'
import { TaskCard } from '../components/TaskCard.tsx'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAi } from '../lib/ai.ts'
import { clock, mmss } from '../lib/format.ts'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'

// Tabs follow the brand's usage example: Home (the chef-hat mark), Tables, Kitchen, Profile.
type Tab = 'home' | 'tables' | 'kitchen' | 'profile'
const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'home', label: 'Home', Icon: ({ className }) => <Mark className={cn('h-5 w-auto', className)} /> },
  { id: 'tables', label: 'Tables', Icon: Armchair },
  { id: 'kitchen', label: 'Kitchen', Icon: UtensilsCrossed },
  { id: 'profile', label: 'Profile', Icon: UserRound },
]

export default function ServerView() {
  const { staffId = '' } = useParams()
  const { snap, connected } = useSnapshot('server', staffId)
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'home') as Tab
  // iPads and laptops get the tablet layout; ?device=phone shows the phone version for demos.
  const wide = useMediaQuery('(min-width: 768px)')
  const forcePhone = params.get('device') === 'phone'
  const tablet = wide && !forcePhone
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const setTab = (t: Tab) => setParam('tab', t === 'home' ? null : t)
  const [assist, setAssist] = useState(false)

  const me = snap?.config.staff.find((s) => s.id === staffId)
  const myTables = useMemo(() => snap?.tables.filter((t) => t.serverId === staffId) ?? [], [snap, staffId])
  const unread = useUnreadKitchen(snap, staffId, tab === 'kitchen' || (tablet && tab === 'home'))

  if (!snap) return <PhoneSkeleton />
  if (!me || !snap.me) return <div className="p-8 text-muted-foreground">We couldn’t find that staff member. Go back and pick a name.</div>
  const game = snap.me.game

  const overlays = (
    <>
      {game && <Celebrations awards={game.awards} muted={snap.sim.autopilot.includes(staffId)} />}
      <Drawer open={assist} onOpenChange={setAssist}>
        <DrawerContent className={cn('mx-auto max-h-[85dvh]', tablet ? 'max-w-xl' : 'max-w-[440px]')}>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 font-display text-2xl">
              <Sparkles className="size-5 text-primary" /> Ask TableMate
            </DrawerTitle>
            <DrawerDescription>Your section briefing and answers about service standards.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <AssistTab staffId={staffId} />
          </div>
        </DrawerContent>
      </Drawer>
      <Onboarding staffId={staffId} name={me.name} />
    </>
  )

  const liveDot = <span className={cn('absolute right-1 top-1 size-1.5 rounded-full', connected ? 'bg-good' : 'bg-warn pulse-soft')} aria-label={connected ? 'Live' : 'Reconnecting'} />

  if (tablet)
    return (
      <div className="relative grid h-dvh grid-cols-[88px_1fr] grid-rows-[minmax(0,1fr)] overflow-hidden bg-background">
        {/* Side rail: the tablet's tab bar */}
        <nav aria-label="Sections" className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto border-r bg-sidebar py-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
          <Link to="/" aria-label="Back to all screens" className="mb-4 rounded-xl p-2 text-tomato hover:bg-sidebar-accent">
            <Mark className="h-7 w-auto" />
          </Link>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            const dot = id === 'kitchen' && unread > 0
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex w-16 flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground')}
              >
                {active && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-primary/12" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon className="relative size-6" />
                <span className="relative">{label}</span>
                {dot && <span className="absolute right-2 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white tabular">{unread}</span>}
              </button>
            )
          })}
          <div className="mt-auto flex flex-col items-center gap-1">
            <Button size="icon" variant="ghost" className="relative size-11 text-primary" aria-label="Ask TableMate" onClick={() => setAssist(true)}>
              <Sparkles className="size-5" />
              {liveDot}
            </Button>
            <ThemeToggle />
          </div>
        </nav>

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Top bar: me, my rank and progress, my streak, the team goal */}
          <header className="flex items-center gap-4 border-b bg-background/90 px-6 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur">
            {game && <LevelRing name={me.name} color={me.color} progress={game.level.progress} level={game.level.level} size={48} />}
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold leading-tight">{me.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {game?.level.title}, <span className="tabular">{game?.player.xp} XP</span>
                {game?.level.next ? <span className="tabular">, {game.level.next - game.player.xp} to {game.level.nextTitle}</span> : null}
              </div>
            </div>
            {game && <StreakChip streak={game.player.streak} shields={game.player.shields} />}
            <div className="ml-auto hidden min-w-0 items-center gap-3 lg:flex">
              <Users className="size-4 shrink-0 text-primary" />
              <div className="w-48">
                <div className="flex justify-between text-xs">
                  <span>Team goal</span>
                  <span className="text-muted-foreground tabular">
                    {Math.min(snap.team.smooth, snap.team.goal)}/{snap.team.goal}
                  </span>
                </div>
                <Progress value={Math.min(100, (snap.team.smooth / snap.team.goal) * 100)} className="mt-1 h-1.5" aria-label="Team goal progress" />
              </div>
            </div>
            <span className="ml-auto rounded-full border px-2.5 py-1 text-xs text-muted-foreground tabular lg:ml-0">{clock(snap.now)}</span>
            <Link to="?device=phone" className="hidden text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline xl:inline">
              Phone view
            </Link>
          </header>

          <main id="main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full p-6">
                {tab === 'home' && (
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_340px]">
                    <div className="min-w-0 space-y-4">
                      <AutopilotToggle snap={snap} staffId={staffId} />
                      <NextUp snap={snap} staffId={staffId} />
                    </div>
                    <div className="min-w-0 space-y-6">
                      <SectionMap snap={snap} color={me.color} myTables={myTables} />
                      <GuestList snap={snap} myTables={myTables} />
                      <div className="lg:hidden">
                        <KitchenPanel snap={snap} staffId={staffId} myTables={myTables} />
                      </div>
                    </div>
                    <div className="hidden min-w-0 lg:block">
                      <div className="sticky top-0">
                        <KitchenPanel snap={snap} staffId={staffId} myTables={myTables} />
                      </div>
                    </div>
                  </div>
                )}
                {tab === 'tables' && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <SectionMap snap={snap} color={me.color} myTables={myTables} large />
                    <GuestList snap={snap} myTables={myTables} />
                  </div>
                )}
                {tab === 'kitchen' && (
                  <div className="mx-auto flex h-full max-w-3xl flex-col">
                    <h2 className="font-display text-2xl">Kitchen</h2>
                    <p className="text-sm text-muted-foreground">Messages with the pass about your tables.</p>
                    <KitchenThread snap={snap} staffId={staffId} myTables={myTables} className="mt-4 min-h-0 flex-1" />
                  </div>
                )}
                {tab === 'profile' && (
                  <div className="mx-auto max-w-5xl">
                    <ProgressTab snap={snap} staffId={staffId} wide />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        {overlays}
      </div>
    )

  return (
    <div className="min-h-dvh md:flex md:flex-col md:items-center md:justify-center md:bg-[radial-gradient(ellipse_at_top,var(--accent),var(--background)_60%)] md:py-6">
      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-background md:h-[min(880px,calc(100dvh-5rem))] md:rounded-[2.75rem] md:border-[10px] md:border-foreground/85 md:shadow-2xl">
        {/* Top bar: who I am, my rank, my streak */}
        <header className="z-10 flex items-center gap-3 border-b bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur">
          <Link to="/" aria-label="Back to all screens" className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ChevronLeft className="size-5" />
          </Link>
          {game && <LevelRing name={me.name} color={me.color} progress={game.level.progress} level={game.level.level} />}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold leading-tight">{me.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {game?.level.title} <span className="tabular">{game?.player.xp} XP</span>
            </div>
          </div>
          {game && <StreakChip streak={game.player.streak} shields={game.player.shields} />}
          <Button size="icon" variant="ghost" className="relative text-primary" aria-label="Ask TableMate" onClick={() => setAssist(true)}>
            <Sparkles />
            {liveDot}
          </Button>
        </header>

        <main id="main" className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="px-4 pb-6 pt-4">
              {tab === 'home' && <FloorTab snap={snap} staffId={staffId} onKudos={() => setTab('profile')} />}
              {tab === 'tables' && <TablesTab snap={snap} color={me.color} myTables={myTables} />}
              {tab === 'kitchen' && <KitchenTab snap={snap} staffId={staffId} myTables={myTables} />}
              {tab === 'profile' && <ProgressTab snap={snap} staffId={staffId} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom tab bar */}
        <nav aria-label="Sections" className="z-10 grid grid-cols-4 border-t bg-background/95 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1.5 backdrop-blur">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            const dot = id === 'kitchen' && unread > 0
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] transition-colors', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {active && <motion.span layoutId="tab-pill" className="absolute top-0 h-8 w-14 rounded-full bg-primary/12" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon className="relative size-5" />
                <span className="relative font-medium">{label}</span>
                {dot && <span className="absolute right-[calc(50%-18px)] top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white tabular">{unread}</span>}
              </button>
            )
          })}
        </nav>
        {overlays}
      </div>

      <aside className="mx-auto mt-3 hidden w-full max-w-[440px] items-center justify-between gap-4 text-sm text-muted-foreground md:flex">
        <span>This is {me.name}’s phone during service.</span>
        <span className="flex items-center gap-3">
          {forcePhone && (
            <button type="button" onClick={() => setParam('device', null)} className="underline-offset-4 hover:text-foreground hover:underline">
              Tablet view
            </button>
          )}
          <Link to="/manager" className="underline-offset-4 hover:text-foreground hover:underline">
            Manager view
          </Link>
          <ThemeToggle />
        </span>
      </aside>
    </div>
  )
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

// ---------------------------------------------------------------------------

function FloorTab({ snap, staffId, onKudos }: { snap: Snapshot; staffId: string; onKudos: () => void }) {
  return (
    <div className="space-y-5">
      <AutopilotToggle snap={snap} staffId={staffId} />
      <TeamGoal smooth={snap.team.smooth} goal={snap.team.goal} onKudos={onKudos} />
      <NextUp snap={snap} staffId={staffId} />
    </div>
  )
}

function AutopilotToggle({ snap, staffId }: { snap: Snapshot; staffId: string }) {
  if (snap.sim.startedAt === null) return null
  const autopilot = snap.sim.autopilot.includes(staffId)
  return (
    <label htmlFor="autopilot" className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Bot className="size-4" /> {autopilot ? 'Autopilot is playing this shift. Switch off to play.' : 'You’re playing this shift.'}
      </span>
      <Switch id="autopilot" checked={autopilot} onCheckedChange={(v) => void post('/api/sim/settings', { staffId, autopilot: v })} />
    </label>
  )
}

function NextUp({ snap, staffId }: { snap: Snapshot; staffId: string }) {
  const { top, queued } = snap.me!
  const combo = snap.me!.game?.player.combo ?? 0
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl">Next up</h2>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {combo >= 3 && (
              <motion.span
                key={combo}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary-2 px-2 py-0.5 text-xs font-bold text-primary-foreground tabular"
              >
                <Flame className="size-3" /> Combo ×{combo}
              </motion.span>
            )}
          </AnimatePresence>
          {queued > 0 && <span className="text-xs text-muted-foreground tabular">+{queued} waiting</span>}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {top[0] ? `Next: ${top[0].title}` : 'All caught up'}
      </p>
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {top.map((t, i) => (
            <TaskCard key={t.id} task={t} now={snap.now} lead={i === 0} staffId={staffId} />
          ))}
        </AnimatePresence>
        {top.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center">
            <Mascot className="w-40" speed="var(--muted-foreground)" />
            <div className="mt-3 font-display text-xl">All caught up</div>
            <p className="mt-1 text-sm text-muted-foreground">Your section is running smoothly. New tasks appear here the moment they’re needed.</p>
          </motion.div>
        )}
      </div>
      {top.length > 0 && <p className="mt-2 text-center text-[11px] text-muted-foreground">Swipe right when done, left for later</p>}
    </section>
  )
}

function TablesTab({ snap, color, myTables }: { snap: Snapshot; color: string; myTables: Snapshot['tables'] }) {
  return (
    <div className="space-y-5">
      <SectionMap snap={snap} color={color} myTables={myTables} />
      <GuestList snap={snap} myTables={myTables} />
    </div>
  )
}

function SectionMap({ snap, color, myTables, large }: { snap: Snapshot; color: string; myTables: Snapshot['tables']; large?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-xl">My section</h2>
      <div className={cn('grid gap-2', large ? 'grid-cols-3 lg:grid-cols-4' : 'grid-cols-3')}>
        {myTables.map((t) => (
          <TableTile key={t.id} t={t} now={snap.now} color={color} />
        ))}
      </div>
    </section>
  )
}

function GuestList({ snap, myTables }: { snap: Snapshot; myTables: Snapshot['tables'] }) {
  const seated = myTables.filter((t) => t.visitId)
  return (
    <section>
      <h2 className="mb-2 font-display text-xl">Guests right now</h2>
      {seated.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No guests seated in your section yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {seated.map((t) => {
            const pending = t.lines.filter((l) => l.status === 'fired').length
            const ready = t.lines.filter((l) => l.status === 'ready').length
            return (
              <li key={t.id} className="flex items-start gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-semibold">{t.name}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {t.party?.guestName ?? `Party of ${t.party?.size ?? '?'}`}
                    {t.party?.vip && <Star className="size-3.5 text-primary" aria-label="Regular guest" />}
                    {t.party?.occasion && <CakeSlice className="size-3.5 text-primary" aria-label={t.party.occasion} />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.party?.size} guests, seated {Math.round((snap.now - (t.seatedAt ?? snap.now)) / 60_000)} min
                    {pending ? `, ${pending} in the kitchen` : ''}
                    {ready ? `, ${ready} ready at the pass` : ''}
                  </div>
                  {t.party?.allergies.length ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-warn/12 px-1.5 py-0.5 text-xs font-medium text-warn">
                      <HeartPulse className="size-3" /> {t.party.allergies.join(', ')}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function TeamGoal({ smooth, goal, onKudos }: { smooth: number; goal: number; onKudos: () => void }) {
  const pct = Math.min(100, (smooth / goal) * 100)
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary">
        <Users className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Team goal tonight</span>
          <span className="text-xs text-muted-foreground tabular">
            {Math.min(smooth, goal)}/{goal}
          </span>
        </div>
        <Progress value={pct} className="mt-1.5 h-1.5" aria-label="Team goal progress" />
        <div className="mt-1 text-[11px] text-muted-foreground">Tables served fully to standard, by everyone</div>
      </div>
      <Button size="icon" variant="ghost" aria-label="Send kudos to a teammate" onClick={onKudos}>
        <HeartHandshake />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------

const QUICK = ['Allergy', 'Hold mains', 'Rush please', 'Guest complaint', 'Birthday dessert', 'Fire mains']

function KitchenTab({ snap, staffId, myTables }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables'] }) {
  return (
    <div className="flex h-[calc(100dvh-170px)] flex-col md:h-[640px]">
      <h2 className="font-display text-xl">Kitchen</h2>
      <p className="text-sm text-muted-foreground">Messages with the pass about your tables.</p>
      <KitchenThread snap={snap} staffId={staffId} myTables={myTables} className="mt-3 min-h-0 flex-1" />
    </div>
  )
}

/** Compact kitchen thread for the tablet's home screen. */
function KitchenPanel({ snap, staffId, myTables }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables'] }) {
  return (
    <section className="flex h-[min(560px,calc(100dvh-140px))] flex-col rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <UtensilsCrossed className="size-5 text-primary" /> Kitchen
      </h2>
      <KitchenThread snap={snap} staffId={staffId} myTables={myTables} className="mt-3 min-h-0 flex-1" />
    </section>
  )
}

function KitchenThread({ snap, staffId, myTables, className }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables']; className?: string }) {
  const [table, setTable] = useState('')
  const [text, setText] = useState('')
  const active = myTables.filter((t) => t.visitId)
  const thread = snap.notes.filter((n) => !n.tableId || myTables.some((t) => t.id === n.tableId) || n.from === staffId).slice(-30)

  async function send(body = text) {
    const msg = body.trim()
    if (!msg) return
    await act('note.sent', { noteId: noteId(), direction: 'to_kitchen', tableId: table || undefined, text: msg, from: staffId })
    setText('')
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {thread.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">No messages yet. Send the kitchen a note below.</li>}
        {thread.map((n) => {
          const mine = n.direction === 'to_kitchen'
          return (
            <li key={n.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary', n.text.startsWith('ALLERGY') && 'ring-2 ring-warn')}>
                {n.tableId && <span className={cn('mr-1 text-xs font-semibold', mine ? 'opacity-80' : 'text-muted-foreground')}>{n.tableId}</span>}
                {n.text}
                <div className={cn('mt-0.5 text-right text-[10px] tabular', mine ? 'opacity-70' : 'text-muted-foreground')}>{clock(n.at)}</div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 space-y-2 border-t pt-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={table === ''} onClick={() => setTable('')}>
            General
          </Chip>
          {active.map((t) => (
            <Chip key={t.id} active={table === t.id} onClick={() => setTable(t.id)}>
              {t.name}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-border" />
          {QUICK.map((q) => (
            <Chip key={q} onClick={() => void send(q)}>
              {q}
            </Chip>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Input name="note-text" aria-label="Message to the kitchen" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={table ? `Message about ${table}…` : 'Message the pass…'} className="h-10 rounded-full" />
          <Button type="submit" size="icon" className="size-10 rounded-full" aria-label="Send to kitchen" disabled={!text.trim()}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  )
}

function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('shrink-0 rounded-full border px-3 py-1 text-xs transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------

const KUDOS_REASONS = ['Covered my table', 'Ran my food', 'Great save with a guest', 'Kept us calm', 'Helped with a reset']

function ProgressTab({ snap, staffId, wide }: { snap: Snapshot; staffId: string; wide?: boolean }) {
  const game = snap.me!.game
  const stats = snap.me!.stats
  const [kudosTo, setKudosTo] = useState<string | null>(null)
  const [recap, setRecap] = useState(false)
  if (!game) return null
  const { level, player, quests, badges } = game
  const teammates = snap.config.staff.filter((s) => s.role === 'server' && s.id !== staffId)
  const earned = badges.filter((b) => b.earnedAt !== null).length

  return (
    <div className={cn(wide ? 'columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid' : 'space-y-6')}>
      {/* Rank */}
      <section className="relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/25 blur-2xl" aria-hidden />
        <div className="text-sm opacity-75">Level {level.level}</div>
        <div className="font-display text-3xl">{level.title}</div>
        <div className="mt-4 flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular">{player.xp} XP</span>
          <span className="opacity-75">{level.next ? `${level.next - player.xp} XP to ${level.nextTitle}` : 'Top rank reached'}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
          <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini icon={<Flame className="size-4" />} value={player.streak} label="streak" />
          <Mini icon={<Shield className="size-4" />} value={player.shields} label="shields" />
          <Mini icon={<Sparkles className="size-4" />} value={player.bestCombo} label="best combo" />
        </div>
      </section>

      {/* Quests */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
          <Target className="size-5 text-primary" /> Tonight’s quests
        </h2>
        <ul className="space-y-2">
          {quests.map((q) => (
            <li key={q.id} className={cn('rounded-2xl border p-3', q.done && 'border-good/40 bg-good/8')}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn('font-medium', q.done && 'text-good')}>{q.title}</span>
                <span className="shrink-0 text-xs font-semibold text-primary tabular">+{q.xp} XP</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={(q.progress / q.target) * 100} className="h-1.5" aria-label={`${q.title} progress`} />
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular">
                  {q.progress}/{q.target}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Badges */}
      <section>
        <h2 className="mb-2 flex items-center justify-between font-display text-xl">
          Badges <span className="font-sans text-sm text-muted-foreground tabular">{earned}/{badges.length}</span>
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <BadgeTile key={b.id} b={b} />
          ))}
        </div>
      </section>

      {/* Kudos */}
      <section>
        <h2 className="mb-1 font-display text-xl">Thank a teammate</h2>
        <p className="mb-3 text-sm text-muted-foreground">Kudos give you both XP and show on the team board.</p>
        <div className="flex gap-2">
          {teammates.map((t) => (
            <Button key={t.id} variant="outline" className="h-11 flex-1 justify-start gap-2 rounded-xl" onClick={() => setKudosTo(t.id)}>
              <span className="grid size-6 place-items-center rounded-full text-xs text-white" style={{ background: t.color }} aria-hidden>
                {t.name[0]}
              </span>
              {t.name}
            </Button>
          ))}
        </div>
        {snap.team.kudos.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {snap.team.kudos.slice(0, 4).map((k) => (
              <li key={k.id} className="flex items-center gap-2 text-sm">
                <HeartHandshake className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  <b className="font-medium">{name(snap, k.from)}</b> thanked <b className="font-medium">{name(snap, k.to)}</b>: {k.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent XP */}
      <section>
        <h2 className="mb-2 font-display text-xl">Recent</h2>
        <ul className="divide-y rounded-2xl border">
          {game.awards.length === 0 && <li className="p-4 text-sm text-muted-foreground">Complete a card on the Floor tab to earn your first XP.</li>}
          {[...game.awards]
            .reverse()
            .slice(0, 8)
            .map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{a.title}</span>
                  {a.detail && <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>}
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary tabular">{a.xp > 0 ? `+${a.xp}` : a.kind === 'shield' ? <Shield className="size-4 text-good" /> : ''}</span>
              </li>
            ))}
        </ul>
      </section>

      <Button size="lg" variant="secondary" className="h-12 w-full rounded-2xl" onClick={() => setRecap(true)}>
        <Trophy /> Wrap up my shift
      </Button>
      <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <Lock className="size-3" /> Your XP, badges and stats are visible only to you.
      </p>

      <KudosDrawer to={kudosTo} snap={snap} staffId={staffId} onClose={() => setKudosTo(null)} />
      <Drawer open={recap} onOpenChange={setRecap}>
        <DrawerContent className="mx-auto max-w-[440px]">
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader className="text-center">
              <DrawerDescription>Your shift, wrapped</DrawerDescription>
              <DrawerTitle className="font-display text-3xl">{level.title}</DrawerTitle>
            </DrawerHeader>
            <div className="grid grid-cols-2 gap-2 px-4">
              <RecapStat value={player.xp} label="XP earned" />
              <RecapStat value={`${stats?.smoothTables ?? 0}/${stats?.completedTables ?? 0}`} label="tables to standard" />
              <RecapStat value={player.bestStreak} label="best streak" />
              <RecapStat value={stats?.avgGreetSec != null ? mmss(stats.avgGreetSec * 1000) : '—'} label="avg greeting" />
              <RecapStat value={earned} label="badges" />
              <RecapStat value={snap.team.kudos.filter((k) => k.to === staffId).length} label="kudos received" />
            </div>
            <p className="px-4 pt-4 text-center text-sm text-muted-foreground">Kitchen delays on your tables were recorded as kitchen delays, not yours.</p>
            <DrawerFooter>
              <Button size="lg" className="h-11" onClick={() => setRecap(false)}>
                Done
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

const name = (snap: Snapshot, id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id

function Mini({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/8 py-2">
      <div className="flex items-center justify-center gap-1 text-lg font-semibold tabular">
        <span className="text-primary">{icon}</span>
        {value}
      </div>
      <div className="text-[11px] opacity-70">{label}</div>
    </div>
  )
}

function RecapStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3 text-center">
      <div className="font-display text-2xl tabular">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function KudosDrawer({ to, snap, staffId, onClose }: { to: string | null; snap: Snapshot; staffId: string; onClose: () => void }) {
  const who = to ? name(snap, to) : ''
  return (
    <Drawer open={!!to} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-w-[440px]">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="font-display text-2xl">Thank {who}</DrawerTitle>
            <DrawerDescription>What did they do?</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-2 px-4 pb-6">
            {KUDOS_REASONS.map((r) => (
              <Button
                key={r}
                variant="outline"
                className="h-11 justify-start rounded-xl"
                onClick={async () => {
                  await act('kudos.sent', { from: staffId, to, reason: r })
                  toast.success(`Kudos sent to ${who}`)
                  onClose()
                }}
              >
                <HeartHandshake className="text-primary" /> {r}
              </Button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------

const SOP_EXAMPLES = ['How fast should I greet?', 'What goes in a table reset?', 'When do I warn guests about a delay?']

function AssistTab({ staffId }: { staffId: string }) {
  const briefing = useAi()
  const sop = useAi()
  const [question, setQuestion] = useState('')
  const ask = (q: string) => {
    setQuestion(q)
    void sop.ask('ask_sop', { question: q, staffId })
  }
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl">Briefing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your section at a glance: allergies, regulars, occasions and anything the kitchen is behind on.</p>
        <Button className="mt-3 h-11 w-full rounded-xl" disabled={briefing.loading} onClick={() => briefing.ask('briefing', { staffId })}>
          {briefing.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {briefing.answer ? 'Refresh briefing' : 'Brief me'}
        </Button>
        <AiAnswerBox answer={briefing.answer} error={briefing.error} className="mt-3" />
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <MessageSquareText className="size-5 text-primary" /> Ask about standards
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SOP_EXAMPLES.map((q) => (
            <Chip key={q} onClick={() => ask(q)}>
              {q}
            </Chip>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim()) ask(question)
          }}
        >
          <Input id="sop-question" name="sop-question" autoComplete="off" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question…" className="h-10 rounded-full" />
          <Button type="submit" size="icon" className="size-10 rounded-full" aria-label="Ask" disabled={sop.loading || !question.trim()}>
            {sop.loading ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
        <AiAnswerBox answer={sop.answer} error={sop.error} className="mt-3" />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function useUnreadKitchen(snap: Snapshot | null, staffId: string, viewing: boolean) {
  const [seen, setSeen] = useState(0)
  const count = snap?.notes.filter((n) => n.direction === 'to_floor' && (!n.tableId || snap.tables.find((t) => t.id === n.tableId)?.serverId === staffId)).length ?? 0
  useEffect(() => {
    if (viewing) setSeen(count)
  }, [viewing, count])
  return Math.max(0, count - seen)
}

const ONBOARD = [
  { Icon: Sparkles, title: 'Your next three moves', body: 'The copilot watches the POS and shows the three things that matter most right now, in the order guests would want them.' },
  { Icon: Send, title: 'Swipe right when it’s done', body: 'Or tap the button. Swipe left to push a card to later. Most cards close by themselves when the POS sees the step happen.' },
  { Icon: Trophy, title: 'Your progress is yours', body: 'Earn XP, keep your streak and unlock badges. Only you see them. Kitchen delays are never counted against you.' },
]

function Onboarding({ staffId, name: who }: { staffId: string; name: string }) {
  const key = `tablemate-onboarded-${staffId}`
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(key)
    } catch {
      return false
    }
  })
  const [step, setStep] = useState(0)
  const close = () => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      // storage blocked: show again next time
    }
    setOpen(false)
  }
  const s = ONBOARD[step]
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()}>
      <DrawerContent className="mx-auto max-w-[440px]">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="items-center text-center">
            {step === 0 ? (
              <>
                <Mascot className="mb-1 w-48" speed="var(--muted-foreground)" />
                <p className="text-sm text-muted-foreground">
                  Welcome to <Wordmark className="text-base" />, {who}
                </p>
              </>
            ) : (
              <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary">
                <s.Icon className="size-8" />
              </span>
            )}
            <DrawerTitle className="font-display text-2xl">{s.title}</DrawerTitle>
            <DrawerDescription className="text-balance">{s.body}</DrawerDescription>
          </DrawerHeader>
          <div className="flex justify-center gap-1.5 pb-2" aria-hidden>
            {ONBOARD.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border')} />
            ))}
          </div>
          <DrawerFooter className="flex-row">
            <Button variant="ghost" className="h-11 flex-1" onClick={close}>
              Skip
            </Button>
            <Button className="h-11 flex-1" onClick={() => (step < ONBOARD.length - 1 ? setStep(step + 1) : close())}>
              {step < ONBOARD.length - 1 ? 'Next' : 'Start service'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function PhoneSkeleton() {
  return (
    <div className="mx-auto flex h-dvh max-w-[440px] flex-col gap-4 p-4" aria-busy="true" aria-label="Loading your shift">
      <div className="flex items-center gap-2 text-primary">
        <Mark className="h-6 w-auto pulse-soft" />
        <span className="tagline text-muted-foreground">{TAGLINE}</span>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  )
}
