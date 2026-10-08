import { Accessibility, Armchair, Gauge, Bot, CakeSlice, Clock3, HandPlatter, Hourglass, ReceiptText, ShieldAlert, Flame, HeartHandshake, HeartPulse, Lock, MessageSquareText, Send, Shield, Sparkles, Star, Target, Trophy, UserRound, Users, UtensilsCrossed } from 'lucide-react'
import { Mark, Mascot, TAGLINE } from '../brand/marks.tsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import { AccessButton } from '../components/AccessPanel.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { ProfileCard } from '../components/ProfileEditor.tsx'
import { ShiftRecap } from '../components/ShiftRecap.tsx'
import { useRolePage } from '../lib/role.ts'
import { MOOD_TONE, Reaction } from '../components/Reaction.tsx'
import { CoachCard } from '../components/Coach.tsx'
import { AssistantDrawer, PracticeCard } from '../components/Practice.tsx'
import { ComplaintHelp, LearningJourney, WhyFirst } from '../components/Intel.tsx'
import { safetyIssues } from '../../shared/safety.ts'
import { tableTimeline } from '../../shared/timeline.ts'
import { FloorPlan } from '../components/FloorPlan.tsx'
import { BadgeTile, Celebrations, LevelRing, StreakChip, useAwardText } from '../components/game.tsx'
import { TopNav } from '../components/kit.tsx'
import { TaskCard, useTaskWords } from '../components/TaskCard.tsx'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { en } from '../i18n/en.ts'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { chime, haptic } from '../lib/haptics.ts'
import { setPrefs, usePrefs } from '../lib/prefs.ts'
import { speakTask } from '../lib/speech.ts'
import { clock, minutesAgo, useWallClock } from '../lib/format.ts'
import { act, noteId, post, useSnapshot } from '../lib/live.ts'
import type { Task, Upcoming } from '../../shared/types.ts'

// Tabs follow the brand's usage example: Home (the chef-hat mark), Tables, Kitchen, Profile.
type Tab = 'home' | 'tables' | 'kitchen' | 'profile'
const TABS: { id: Tab; label: Key; Icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'home', label: 'nav.home', Icon: ({ className }) => <Mark className={cn('h-5 w-auto', className)} /> },
  { id: 'tables', label: 'nav.tables', Icon: Armchair },
  { id: 'kitchen', label: 'nav.kitchen', Icon: UtensilsCrossed },
  { id: 'profile', label: 'nav.profile', Icon: UserRound },
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
  const t = useT()
  const awardText = useAwardText()
  const wallNow = useWallClock()
  useRolePage({ kind: 'server', staffId })

  const me = snap?.config.staff.find((s) => s.id === staffId)
  const myTables = useMemo(() => snap?.tables.filter((t) => t.serverId === staffId) ?? [], [snap, staffId])
  // The table open on the Tables tab: the one asked for, else the first seated one.
  const picked = myTables.find((t) => t.id === params.get('table')) ?? myTables.find((t) => t.visitId) ?? myTables[0]
  const unread = useUnreadKitchen(snap, staffId, tab === 'kitchen' || (tablet && tab === 'home'))

  if (!snap) return <PhoneSkeleton />
  if (!me || !snap.me) return <div className="p-8 text-muted-foreground">{t('srv.notFound')}</div>
  const game = snap.me.game
  const rank = awardText.rank(game?.level.index)
  const nextRank = game?.level.next ? awardText.rank(game.level.index + 1) : null

  const overlays = (
    <>
      {game && <Celebrations awards={game.awards} muted={snap.sim.autopilot.includes(staffId)} />}
      <AssistantDrawer open={assist} onOpenChange={setAssist} staffId={staffId} provider={snap.ai.provider} wide={tablet} />
      <Onboarding staffId={staffId} name={me.name} />
      <NewTaskAlerts top={snap.me.top} />
    </>
  )

  const liveDot = <span className={cn('absolute right-1 top-1 size-1.5 rounded-full', connected ? 'bg-good' : 'bg-warn pulse-soft')} aria-label={connected ? t('hdr.live') : t('hdr.reconnecting')} />

  if (tablet)
    return (
      <div className="flex h-dvh flex-col bg-background">
      <TopNav />
      <div className="relative grid min-h-0 flex-1 grid-cols-[88px_1fr] grid-rows-[minmax(0,1fr)] overflow-hidden">
        {/* Side rail: the tablet's tab bar */}
        <nav aria-label={t('srv.sections')} className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto border-r bg-sidebar py-4">
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
                <span className="relative">{t(label)}</span>
                {dot && <span className="absolute right-2 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white tabular">{unread}</span>}
              </button>
            )
          })}
          <div className="mt-auto flex flex-col items-center gap-1">
            <Button size="icon" variant="ghost" className="relative size-11 text-primary" aria-label={t('hdr.ask')} onClick={() => setAssist(true)}>
              <Sparkles className="size-5" />
              {liveDot}
            </Button>
          </div>
        </nav>

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Top bar: me, my rank and progress, my streak, the team goal */}
          <header className="flex items-center gap-4 border-b bg-background/90 px-6 py-3 backdrop-blur">
            {game && <LevelRing name={me.name} color={me.color} avatar={me.avatar} progress={game.level.progress} level={game.level.level} size={48} />}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-lg font-semibold leading-tight">
                <ServerSwitch snap={snap} staffId={staffId} /> <Pronouns value={me.pronouns} />
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {rank}, <span className="tabular">{game?.player.xp} XP</span>
                {game?.level.next ? <span className="tabular">, {t('hdr.xpTo', { xp: game.level.next - game.player.xp, rank: nextRank ?? '' })}</span> : null}
              </div>
            </div>
            {game && <StreakChip streak={game.player.streak} shields={game.player.shields} />}
            <div className="ml-auto hidden min-w-0 items-center gap-3 lg:flex">
              <Users className="size-4 shrink-0 text-primary" />
              <div className="w-48">
                <div className="flex justify-between text-xs">
                  <span>{t('hdr.teamGoal')}</span>
                  <span className="text-muted-foreground tabular">
                    {Math.min(snap.team.smooth, snap.team.goal)}/{snap.team.goal}
                  </span>
                </div>
                <Progress value={Math.min(100, (snap.team.smooth / snap.team.goal) * 100)} className="mt-1 h-1.5" aria-label={t('hdr.teamGoal')} />
              </div>
            </div>
            <span className="ml-auto rounded-full border px-2.5 py-1 text-xs text-muted-foreground tabular lg:ml-0">{clock(wallNow)} IST</span>
            <Link to="?device=phone" className="hidden text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline xl:inline">
              {t('hdr.phoneView')}
            </Link>
          </header>

          <main id="main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full p-6">
                {tab === 'home' && (
                  <div className="mx-auto grid max-w-[1600px] items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(300px,0.8fr)]">
                    <div className="min-w-0 space-y-4">
                      <AutopilotToggle snap={snap} staffId={staffId} />
                      <NextUp snap={snap} staffId={staffId} />
                      {/* On iPads the kitchen chat sits under the cards, where there is room. */}
                      <div className="xl:hidden">
                        <KitchenPanel snap={snap} staffId={staffId} myTables={myTables} className="h-[480px]" />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-6">
                      <SectionMap snap={snap} color={me.color} myTables={myTables} onPick={(id) => setParams({ tab: 'tables', table: id }, { replace: true })} />
                      <GuestList snap={snap} myTables={myTables} />
                    </div>
                    <div className="sticky top-0 hidden min-w-0 xl:block">
                      <KitchenPanel snap={snap} staffId={staffId} myTables={myTables} className="h-[calc(100dvh-8.5rem)] max-h-[720px]" />
                    </div>
                  </div>
                )}
                {tab === 'tables' && (
                  <div className="mx-auto grid max-w-[1400px] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
                    <div className="min-w-0 space-y-6">
                      <SectionMap snap={snap} color={me.color} myTables={myTables} large picked={picked?.id} onPick={(id) => setParam('table', id)} />
                      <GuestList snap={snap} myTables={myTables} picked={picked?.id} onPick={(id) => setParam('table', id)} />
                    </div>
                    <div className="sticky top-0 min-w-0">
                      <TableDetail snap={snap} table={picked} />
                    </div>
                  </div>
                )}
                {tab === 'kitchen' && (
                  <div className="mx-auto flex h-full max-w-3xl flex-col">
                    <h2 className="font-display text-2xl">{t('nav.kitchen')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kitchen.sub')}</p>
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
      </div>
    )

  return (
    <div className="flex h-dvh flex-col md:h-auto md:min-h-dvh">
    <TopNav />
    <div className="min-h-0 flex-1 md:flex md:flex-col md:items-center md:justify-center md:bg-[radial-gradient(ellipse_at_top,var(--accent),var(--background)_60%)] md:py-6">
      <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-background md:h-[min(860px,calc(100dvh-9rem))] md:rounded-[2.75rem] md:border-[10px] md:border-foreground/85 md:shadow-2xl">
        {/* Top bar: who I am, my rank, my streak */}
        <header className="z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
          {game && <LevelRing name={me.name} color={me.color} avatar={me.avatar} progress={game.level.progress} level={game.level.level} />}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1 font-semibold leading-tight">
              <ServerSwitch snap={snap} staffId={staffId} /> <Pronouns value={me.pronouns} />
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {rank} <span className="tabular">{game?.player.xp} XP</span>
            </div>
          </div>
          {game && <StreakChip streak={game.player.streak} shields={game.player.shields} />}
          <Button size="icon" variant="ghost" className="relative text-primary" aria-label={t('hdr.ask')} onClick={() => setAssist(true)}>
            <Sparkles />
            {liveDot}
          </Button>
        </header>

        <main id="main" className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="px-4 pb-6 pt-4">
              {tab === 'home' && <FloorTab snap={snap} staffId={staffId} onKudos={() => setTab('profile')} />}
              {tab === 'tables' && <TablesTab snap={snap} color={me.color} myTables={myTables} picked={params.get('table') ? picked : undefined} onPick={(id) => setParam('table', id)} />}
              {tab === 'kitchen' && <KitchenTab snap={snap} staffId={staffId} myTables={myTables} />}
              {tab === 'profile' && <ProgressTab snap={snap} staffId={staffId} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom tab bar */}
        <nav aria-label={t('srv.sections')} className="z-10 grid grid-cols-4 border-t bg-background/95 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1.5 backdrop-blur">
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
                <span className="relative font-medium">{t(label)}</span>
                {dot && <span className="absolute right-[calc(50%-18px)] top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white tabular">{unread}</span>}
              </button>
            )
          })}
        </nav>
        {overlays}
      </div>

      <aside className="mx-auto mt-3 hidden w-full max-w-[440px] items-center justify-between gap-4 text-sm text-muted-foreground md:flex">
        <span>{t('srv.phoneOf', { name: me.name })}</span>
        <span className="flex items-center gap-3">
          {forcePhone && (
            <button type="button" onClick={() => setParam('device', null)} className="underline-offset-4 hover:text-foreground hover:underline">
              {t('hdr.tabletView')}
            </button>
          )}
        </span>
      </aside>
    </div>
    </div>
  )
}

/** Switch between the servers on tonight's floor without leaving the server app (keeps the tab). */
function ServerSwitch({ snap, staffId }: { snap: Snapshot; staffId: string }) {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  return (
    <Select
      value={staffId}
      onValueChange={(id) => {
        const next = new URLSearchParams(params)
        next.delete('table')
        const q = next.toString()
        navigate(`/server/${id}${q ? `?${q}` : ''}`)
      }}
    >
      <SelectTrigger aria-label={t('srv.switch')} className="h-8 min-w-0 gap-1 border-transparent bg-transparent px-1.5 text-[length:inherit] font-semibold shadow-none hover:bg-secondary">
        <SelectValue>{servers.find((s) => s.id === staffId)?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {servers.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <Avatar staff={s} className="size-6 text-xs" /> {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const t = useT()
  return (
    <label htmlFor="autopilot" className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Bot className="size-4" /> {autopilot ? t('floor.autopilotOn') : t('floor.autopilotOff')}
      </span>
      <Switch id="autopilot" checked={autopilot} onCheckedChange={(v) => void post('/api/sim/settings', { staffId, autopilot: v })} />
    </label>
  )
}

function NextUp({ snap, staffId }: { snap: Snapshot; staffId: string }) {
  const { top: all, queued: more } = snap.me!
  const combo = snap.me!.game?.player.combo ?? 0
  const t = useT()
  // One-card focus: the most important task only; the rest wait quietly in the count.
  const { focusMode } = usePrefs()
  const top = focusMode ? all.slice(0, 1) : all
  const queued = more + (all.length - top.length)
  const lead = useTaskWords(all[0] ?? EMPTY_TASK)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl">{t('floor.nextUp')}</h2>
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
                <Flame className="size-3" /> {t('floor.combo', { n: combo })}
              </motion.span>
            )}
          </AnimatePresence>
          {queued > 0 && <span className="text-xs text-muted-foreground tabular">{t('floor.waiting', { n: queued })}</span>}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {all[0] ? t('floor.next', { title: lead.title }) : t('floor.caughtUp')}
      </p>
      {top.length > 0 && <WhyFirst why={snap.me!.why} />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {top.map((t, i) => (
            <TaskCard key={t.id} task={t} now={snap.now} lead={i === 0} staffId={staffId} />
          ))}
        </AnimatePresence>
        {top.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center">
            <Mascot className="w-40" speed="var(--muted-foreground)" />
            <div className="mt-3 font-display text-xl">{t('floor.caughtUp')}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t('floor.caughtUpBody')}</p>
          </motion.div>
        )}
      </div>
      {top.length > 0 && <p className="mt-2 text-center text-[11px] text-muted-foreground">{t('floor.swipeHint')}</p>}
      <ComingUp items={snap.me!.upcoming ?? []} />
    </section>
  )
}

function TablesTab({ snap, color, myTables, picked, onPick }: { snap: Snapshot; color: string; myTables: Snapshot['tables']; picked?: Snapshot['tables'][number]; onPick: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <SectionMap snap={snap} color={color} myTables={myTables} picked={picked?.id} onPick={onPick} />
      {picked && <TableDetail snap={snap} table={picked} />}
      <GuestList snap={snap} myTables={myTables} picked={picked?.id} onPick={onPick} />
    </div>
  )
}

const LINE_TONE: Record<string, string> = {
  fired: 'bg-kitchen/12 text-kitchen',
  ready: 'bg-primary/12 text-primary',
  served: 'bg-good/12 text-good',
  unavailable: 'bg-muted text-muted-foreground line-through',
}

/** Everything about one table on one card: who is there, what they need, and where each dish is. */
function TableDetail({ snap, table: t }: { snap: Snapshot; table?: Snapshot['tables'][number] }) {
  const tr = useT()
  if (!t) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{tr('tables.pick')}</p>
  const seatedMin = t.seatedAt ? Math.max(1, Math.round((snap.now - t.seatedAt) / 60_000)) : null
  const courses = ['drink', 'starter', 'main', 'dessert'] as const
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label={tr('tables.details')}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg">{t.name}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {t.visitId ? (t.party?.guestName ?? tr('party.of', { n: t.party?.size ?? '?' })) : tr('status.available')}
            {t.party?.vip && <Star className="size-3.5 text-primary" aria-label={tr('tables.regular')} />}
            {t.party?.occasion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                <CakeSlice className="size-3" /> {tr.any(`occ.${t.party.occasion}`)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.mood && (
              <span className={cn('mr-1 inline-flex items-center gap-0.5 align-middle', MOOD_TONE[t.mood.value])} title={tr.any(`mood.${t.mood.value}`)}>
                <Reaction mood={t.mood.value} filled className="size-4" />
                <span className="sr-only">{tr.any(`mood.${t.mood.value}`)}</span>
              </span>
            )}
            {tr.any(`status.${t.status}`)} · {t.visitId && seatedMin ? tr('tables.detail', { n: t.party?.size ?? '?', min: seatedMin }) : tr('tile.seats', { n: t.seats })}
          </div>
        </div>
      </div>

      {(t.party?.allergies.length || t.party?.needs?.length) ? (
        <div className="mt-3 space-y-1.5">
          {t.party?.allergies.length ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-warn/12 px-2 py-1.5 text-sm font-medium text-warn">
              <HeartPulse className="size-4 shrink-0" /> {tr('party.allergy', { list: t.party.allergies.join(', ') })}
            </div>
          ) : null}
          {t.party?.needs?.map((n) => (
            <div key={n} className="flex items-start gap-1.5 rounded-lg bg-primary/8 px-2 py-1.5 text-sm">
              <Accessibility className="mt-0.5 size-4 shrink-0 text-primary" /> {tr.any(`need.${n}`)}
            </div>
          ))}
        </div>
      ) : null}

      {t.visitId && <TableNow snap={snap} table={t} />}
      {t.visitId && snap.me && <ComplaintHelp key={t.id} tableId={t.id} staffId={snap.me.staffId} />}

      {t.visitId && (
        <>
          <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('tables.order')}</h3>
          {t.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr('tables.noOrder')}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {courses
                .flatMap((c) => t.lines.filter((l) => l.course === c))
                .map((l) => {
                  const late = l.status === 'fired' && snap.now > l.expectedReadyAt ? Math.round((snap.now - l.expectedReadyAt) / 60_000) : 0
                  const eta = l.status === 'fired' && l.etaAt ? Math.max(1, Math.round((l.etaAt - snap.now) / 60_000)) : null
                  const issues = l.safetyResolution === 'guest_ok' ? [] : safetyIssues(snap.config.menu.find((m) => m.id === l.menuItemId), t.party)
                  return (
                    <li key={l.id} className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground tabular">{l.qty}×</span> {l.name}
                          <span className="ml-1.5 text-xs text-muted-foreground">{tr.any(`course.${l.course}`)}</span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', LINE_TONE[l.status])}>
                          {late > 0 ? tr('line.late', { n: late }) : tr.any(`line.${l.status}`)}
                        </span>
                      </div>
                      {(eta || issues.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          {eta && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock3 className="size-3" /> {tr('line.eta', { n: eta })}
                            </span>
                          )}
                          {issues.map((i) => (
                            <span key={i.tag} className="inline-flex items-center gap-1 rounded-md bg-warn/12 px-1.5 py-0.5 font-medium text-warn">
                              <ShieldAlert className="size-3" /> {tr.any(`tag.${i.tag}`)} · {tr.any(`diet.${i.because}`)}
                              {l.safetyResolution === 'kitchen' && <span className="font-normal"> · {tr('line.kitchenTold')}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
            </ul>
          )}
        </>
      )}
      {t.visitId && <TableDone table={t} now={snap.now} />}
    </section>
  )
}

function SectionMap({ snap, myTables, large, picked, onPick }: { snap: Snapshot; color?: string; myTables: Snapshot['tables']; large?: boolean; picked?: string; onPick?: (id: string) => void }) {
  const t = useT()
  return (
    <section>
      <h2 className="mb-2 font-display text-xl">{t('tables.mySection')}</h2>
      <FloorPlan snap={snap} tables={myTables} tasks={snap.me?.tasks ?? []} picked={picked} onPick={(id) => onPick?.(id)} compact={!large} />
    </section>
  )
}

function GuestList({ snap, myTables, picked, onPick }: { snap: Snapshot; myTables: Snapshot['tables']; picked?: string; onPick?: (id: string) => void }) {
  const seated = myTables.filter((t) => t.visitId)
  const tr = useT()
  return (
    <section>
      <h2 className="mb-2 font-display text-xl">{tr('tables.guestsNow')}</h2>
      {seated.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{tr('tables.none')}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {seated.map((t) => {
            const pending = t.lines.filter((l) => l.status === 'fired').length
            const ready = t.lines.filter((l) => l.status === 'ready').length
            return (
              <li
                key={t.id}
                className={cn('flex items-start gap-3 p-3', onPick && 'cursor-pointer transition-colors hover:bg-accent/60', picked === t.id && 'bg-accent/70')}
                onClick={onPick ? () => onPick(t.id) : undefined}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-semibold">{t.name}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {t.party?.guestName ?? tr('party.of', { n: t.party?.size ?? '?' })}
                    {t.party?.vip && <Star className="size-3.5 text-primary" aria-label={tr('tables.regular')} />}
                    {t.party?.occasion && <CakeSlice className="size-3.5 text-primary" aria-label={tr.any(`occ.${t.party.occasion}`)} />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tr('tables.detail', { n: t.party?.size ?? '?', min: Math.max(1, Math.round((snap.now - (t.seatedAt ?? snap.now)) / 60_000)) })}
                    {pending ? `, ${tr('tables.inKitchen', { n: pending })}` : ''}
                    {ready ? `, ${tr('tables.ready', { n: ready })}` : ''}
                  </div>
                  {t.party?.allergies.length ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-warn/12 px-1.5 py-0.5 text-xs font-medium text-warn">
                      <HeartPulse className="size-3" /> {tr('party.allergy', { list: t.party.allergies.join(', ') })}
                    </div>
                  ) : null}
                  {/* Access and dietary needs from the booking: what to do, so nobody has to ask twice. */}
                  {t.party?.needs?.map((n) => (
                    <div key={n} className="mt-1 flex w-fit items-start gap-1 rounded-md bg-primary/8 px-1.5 py-0.5 text-xs text-foreground">
                      <Accessibility className="mt-0.5 size-3 shrink-0 text-primary" /> {tr.any(`need.${n}`)}
                    </div>
                  ))}
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
  const t = useT()
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary">
        <Users className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{t('team.goalTonight')}</span>
          <span className="text-xs text-muted-foreground tabular">
            {Math.min(smooth, goal)}/{goal}
          </span>
        </div>
        <Progress value={pct} className="mt-1.5 h-1.5" aria-label={t('team.goalTonight')} />
        <div className="mt-1 text-[11px] text-muted-foreground">{t('team.goalSub')}</div>
      </div>
      <Button size="icon" variant="ghost" aria-label={t('team.sendKudos')} onClick={onKudos}>
        <HeartHandshake />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------

// Quick notes go to the kitchen in English (the pass's working language); the chip shows each person's language.
const QUICK: Key[] = ['quick.allergy', 'quick.hold', 'quick.rush', 'quick.complaint', 'quick.birthday', 'quick.fire']

function KitchenTab({ snap, staffId, myTables }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables'] }) {
  const t = useT()
  return (
    <div className="flex h-[calc(100dvh-170px)] flex-col md:h-[640px]">
      <h2 className="font-display text-xl">{t('nav.kitchen')}</h2>
      <p className="text-sm text-muted-foreground">{t('kitchen.sub')}</p>
      <KitchenThread snap={snap} staffId={staffId} myTables={myTables} className="mt-3 min-h-0 flex-1" />
    </div>
  )
}

/** Compact kitchen thread for the tablet's home screen. */
function KitchenPanel({ snap, staffId, myTables, className }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables']; className?: string }) {
  return (
    <section className={cn('flex flex-col rounded-2xl border bg-card p-4', className)}>
      <h2 className="flex items-center gap-2 font-display text-xl">
        <UtensilsCrossed className="size-5 text-primary" /> {useT()('nav.kitchen')}
      </h2>
      <KitchenThread snap={snap} staffId={staffId} myTables={myTables} className="mt-3 min-h-0 flex-1" />
    </section>
  )
}

function KitchenThread({ snap, staffId, myTables, className }: { snap: Snapshot; staffId: string; myTables: Snapshot['tables']; className?: string }) {
  const [table, setTable] = useState('')
  const [text, setText] = useState('')
  const tr = useT()
  const ago = useAgo()
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
        {thread.length === 0 && (
          <li className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
            <MessageSquareText className="size-8 text-primary/40" />
            {tr('kitchen.empty')}
          </li>
        )}
        {thread.map((n) => {
          const mine = n.direction === 'to_kitchen'
          return (
            <li key={n.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary', n.text.startsWith('ALLERGY') && 'ring-2 ring-warn')}>
                {n.tableId && <span className={cn('mr-1 text-xs font-semibold', mine ? 'opacity-80' : 'text-muted-foreground')}>{n.tableId}</span>}
                {n.text}
                <div className={cn('mt-0.5 text-right text-[10px] tabular', mine ? 'opacity-70' : 'text-muted-foreground')}>
                  {ago(snap.now, n.at)}
                  {mine && n.ackAt ? ` · ${tr('kitchen.seen')}` : ''}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tr('kitchen.to')}>
          <span className="mr-0.5 text-xs text-muted-foreground">{tr('kitchen.to')}</span>
          <Chip active={table === ''} onClick={() => setTable('')}>
            {tr('kitchen.general')}
          </Chip>
          {active.map((t) => (
            <Chip key={t.id} active={table === t.id} onClick={() => setTable(t.id)}>
              {t.name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('kitchen.quick')}>
          {QUICK.map((q) => (
            <Chip key={q} onClick={() => void send(en[q])}>
              {tr(q)}
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
          <Input name="note-text" aria-label={tr('kitchen.label')} autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={table ? tr('kitchen.placeholderTable', { table }) : tr('kitchen.placeholder')} className="h-10 rounded-full" />
          <Button type="submit" size="icon" className="size-10 rounded-full" aria-label={tr('kitchen.send')} disabled={!text.trim()}>
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

const KUDOS_REASONS: Key[] = ['kudos.r1', 'kudos.r2', 'kudos.r3', 'kudos.r4', 'kudos.r5', 'kudos.r6']
/** Kudos are stored in English so everyone can read them; shown back in each person's language. */
const REASON_KEY = new Map<string, Key>(KUDOS_REASONS.map((k) => [en[k], k]))

function ProgressTab({ snap, staffId, wide }: { snap: Snapshot; staffId: string; wide?: boolean }) {
  const game = snap.me!.game
  const [kudosTo, setKudosTo] = useState<string | null>(null)
  const [recap, setRecap] = useState(false)
  const t = useT()
  const words = useAwardText()
  if (!game) return null
  const { level, player, quests, badges } = game
  // Everyone can be thanked: fellow servers, the kitchen and the manager.
  const teammates = snap.config.staff.filter((s) => s.id !== staffId)
  const earned = badges.filter((b) => b.earnedAt !== null).length

  return (
    <div className={cn(wide ? 'columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid' : 'space-y-6')}>
      <ProfileCard me={snap.config.staff.find((s) => s.id === staffId)!} />
      <AccessButton variant="row" />
      {/* Rank */}
      <section className="relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/25 blur-2xl" aria-hidden />
        <div className="text-sm opacity-75">{t('profile.level', { n: level.level })}</div>
        <div className="font-display text-3xl">{words.rank(level.index)}</div>
        <div className="mt-4 flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular">{player.xp} XP</span>
          <span className="opacity-75">{level.next ? t('hdr.xpTo', { xp: level.next - player.xp, rank: words.rank(level.index + 1) }) : t('profile.topRank')}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
          <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini icon={<Flame className="size-4" />} value={player.streak} label={t('profile.streak')} />
          <Mini icon={<Shield className="size-4" />} value={player.shields} label={t('profile.shields')} />
          <Mini icon={<Sparkles className="size-4" />} value={player.bestCombo} label={t('profile.bestCombo')} />
        </div>
      </section>

      <CoachCard staffId={staffId} />
      <PracticeCard staffId={staffId} provider={snap.ai.provider} />
      <LearningJourney plan={snap.me!.learning} staffId={staffId} provider={snap.ai.provider} />

      {/* Quests */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
          <Target className="size-5 text-primary" /> {t('profile.quests')}
        </h2>
        <ul className="space-y-2">
          {quests.map((q) => (
            <li key={q.id} className={cn('rounded-2xl border p-3', q.done && 'border-good/40 bg-good/8')}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn('font-medium', q.done && 'text-good')}>{words.quest(q)}</span>
                <span className="shrink-0 text-xs font-semibold text-primary tabular">+{q.xp} XP</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={(q.progress / q.target) * 100} className="h-1.5" aria-label={words.quest(q)} />
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
          {t('profile.badges')} <span className="font-sans text-sm text-muted-foreground tabular">{earned}/{badges.length}</span>
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <BadgeTile key={b.id} b={b} />
          ))}
        </div>
      </section>

      {/* Kudos */}
      <section>
        <h2 className="mb-1 font-display text-xl">{t('profile.thank')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('profile.thankSub')}</p>
        <div className="flex flex-wrap gap-2">
          {teammates.map((t) => (
            <Button key={t.id} variant="outline" className="h-11 flex-1 justify-start gap-2 rounded-xl" onClick={() => setKudosTo(t.id)}>
              <Avatar staff={t} className="size-6 text-xs" />
              {t.name}
              <Pronouns value={t.pronouns} />
            </Button>
          ))}
        </div>
        {snap.team.kudos.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {snap.team.kudos.slice(0, 4).map((k) => (
              <li key={k.id} className="flex items-center gap-2 text-sm">
                <HeartHandshake className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  {t('profile.thanked', { from: name(snap, k.from), to: name(snap, k.to), reason: REASON_KEY.has(k.reason) ? t(REASON_KEY.get(k.reason)!) : k.reason })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent XP */}
      <section>
        <h2 className="mb-2 font-display text-xl">{t('profile.recent')}</h2>
        <ul className="divide-y rounded-2xl border">
          {game.awards.length === 0 && <li className="p-4 text-sm text-muted-foreground">{t('profile.recentEmpty')}</li>}
          {[...game.awards]
            .reverse()
            .slice(0, 8)
            .map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{words.title(a)}</span>
                  {a.detail && <span className="block truncate text-xs text-muted-foreground">{words.detail(a)}</span>}
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary tabular">{a.xp > 0 ? `+${a.xp}` : a.kind === 'shield' ? <Shield className="size-4 text-good" /> : ''}</span>
              </li>
            ))}
        </ul>
      </section>

      <Button size="lg" variant="secondary" className="h-12 w-full rounded-2xl" onClick={() => setRecap(true)}>
        <Trophy /> {t('profile.wrap')}
      </Button>
      <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <Lock className="size-3" /> {t('profile.private')}
      </p>



      <KudosDrawer to={kudosTo} snap={snap} staffId={staffId} onClose={() => setKudosTo(null)} />
      <ShiftRecap snap={snap} staffId={staffId} open={recap} onOpenChange={setRecap} />
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

function KudosDrawer({ to, snap, staffId, onClose }: { to: string | null; snap: Snapshot; staffId: string; onClose: () => void }) {
  const who = to ? name(snap, to) : ''
  const t = useT()
  return (
    <Drawer open={!!to} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-w-[440px]">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="font-display text-2xl">{t('kudos.title', { name: who })}</DrawerTitle>
            <DrawerDescription>{t('kudos.what')}</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-2 px-4 pb-6">
            {KUDOS_REASONS.map((r) => (
              <Button
                key={r}
                variant="outline"
                className="h-11 justify-start rounded-xl"
                onClick={async () => {
                  await act('kudos.sent', { from: staffId, to, reason: en[r] })
                  toast.success(t('kudos.sent', { name: who }))
                  onClose()
                }}
              >
                <HeartHandshake className="text-primary" /> {t(r)}
              </Button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function useUnreadKitchen(snap: Snapshot | null, staffId: string, viewing: boolean) {
  const [seen, setSeen] = useState(0)
  const count = snap?.notes.filter((n) => n.direction === 'to_floor' && (!n.tableId || snap.tables.find((t) => t.id === n.tableId)?.serverId === staffId)).length ?? 0
  useEffect(() => {
    if (viewing) setSeen(count)
  }, [viewing, count])
  return Math.max(0, count - seen)
}

const ONBOARD: { Icon: typeof Sparkles; title: Key; body: Key }[] = [
  { Icon: Sparkles, title: 'ob.s1t', body: 'ob.s1b' },
  { Icon: Send, title: 'ob.s2t', body: 'ob.s2b' },
  { Icon: Trophy, title: 'ob.s3t', body: 'ob.s3b' },
  { Icon: Accessibility, title: 'ob.s4t', body: 'ob.s4b' },
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
  const t = useT()
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
                <p className="text-sm text-muted-foreground">{t('ob.welcome', { name: who })}</p>
              </>
            ) : (
              <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary">
                <s.Icon className="size-8" />
              </span>
            )}
            <DrawerTitle className="font-display text-2xl">{t(s.title)}</DrawerTitle>
            <DrawerDescription className="text-balance">{t(s.body)}</DrawerDescription>
          </DrawerHeader>
          {/* Language first, so the rest of the tour is readable. */}
          {step === 0 && <LanguageRow />}
          {step === ONBOARD.length - 1 && (
            <div className="flex justify-center pb-2">
              <AccessButton variant="row" className="mx-4 w-auto" />
            </div>
          )}
          <div className="flex justify-center gap-1.5 pb-2" aria-hidden>
            {ONBOARD.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border')} />
            ))}
          </div>
          <DrawerFooter className="flex-row">
            <Button variant="ghost" className="h-11 flex-1" onClick={close}>
              {t('ob.skip')}
            </Button>
            <Button className="h-11 flex-1" onClick={() => (step < ONBOARD.length - 1 ? setStep(step + 1) : close())}>
              {step < ONBOARD.length - 1 ? t('ob.next') : t('ob.start')}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function PhoneSkeleton() {
  return (
    <div className="mx-auto flex h-dvh max-w-[440px] flex-col gap-4 p-4" aria-busy="true" aria-label={useT()('srv.loading')}>
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

// ---------------------------------------------------------------------------
// Inclusion helpers

const EMPTY_TASK = { title: '', hint: '' } as Task

/** Pronouns someone chose for themselves, shown quietly after their name. */
function Pronouns({ value }: { value?: string }) {
  if (!value) return null
  return <span className="ml-1 text-xs font-normal text-muted-foreground">({value})</span>
}

/** Language chips on the first onboarding step, in each language's own name. */
function LanguageRow() {
  const { lang } = usePrefs()
  return (
    <div role="radiogroup" aria-label={useT()('acc.language')} className="flex flex-wrap justify-center gap-1.5 px-4 pb-3">
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          lang={l.id}
          onClick={() => setPrefs({ lang: l.id })}
          className={cn('min-h-9 rounded-full border px-3 text-sm transition-colors', lang === l.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground')}
        >
          {l.native}
        </button>
      ))}
    </div>
  )
}

/**
 * When a new task reaches the top: read it aloud, chime, flash the screen edge and/or buzz,
 * each only if the person turned it on. Nothing fires for the cards already there on load.
 */
function NewTaskAlerts({ top }: { top: Task[] }) {
  const prefs = usePrefs()
  const lead = top[0]
  const words = useTaskWords(lead ?? EMPTY_TASK)
  const seen = useRef<string | null | undefined>(undefined)
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    const id = lead?.id ?? null
    if (seen.current === undefined || id === null || id === seen.current) {
      seen.current = id
      return
    }
    seen.current = id
    if (prefs.readAloud) speakTask(words.title, words.hint, { title: lead.title, hint: lead.hint })
    if (prefs.chime) chime()
    if (prefs.flash) setFlash((n) => n + 1)
    if (prefs.flash || prefs.chime) haptic.alert()
    // Only the lead card's identity should trigger an alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])
  if (!flash) return null
  return <div key={flash} className="edge-flash pointer-events-none fixed inset-0 z-50" aria-hidden />
}

const UP_ICON: Record<Upcoming['kind'], typeof Clock3> = { food_ready: HandPlatter, course_end: Hourglass, bill_soon: ReceiptText, crunch: Gauge }

/**
 * What's likely to need the server in the next few minutes, from tonight's real timings.
 * Quiet on purpose: a heads-up to get ahead, not another task.
 */
function ComingUp({ items: all }: { items: Upcoming[] }) {
  const t = useT()
  const items = all.slice(0, 3)
  if (!items.length) return null
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock3 className="size-3.5" /> {t('up.title')}
      </h3>
      <ul className="divide-y rounded-2xl border border-dashed">
        {items.map((u) => (
          <li key={u.id} className={cn('flex items-center gap-2.5 px-3 py-2 text-sm', u.kind === 'crunch' && 'bg-warn/10 font-medium')}>
            {(() => {
              const Icon = UP_ICON[u.kind]
              return <Icon className={cn('size-4 shrink-0', u.kind === 'crunch' ? 'text-warn' : 'text-primary')} aria-hidden />
            })()}
            <span className="min-w-0 flex-1">{t.text(u.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** What this table needs now (every open card, not just the top three) and what is coming. */
function TableNow({ snap, table }: { snap: Snapshot; table: Snapshot['tables'][number] }) {
  const tr = useT()
  const tasks = (snap.me?.tasks ?? []).filter((k) => k.tableId === table.id)
  const ups = (snap.me?.upcoming ?? []).filter((u) => u.tableId === table.id)
  return (
    <>
      <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('table.now')}</h3>
      {tasks.length === 0 ? (
        <p className="rounded-xl bg-good/8 px-3 py-2 text-sm text-good">{tr('table.nothingNow')}</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((k) => (
            <TableTaskRow key={k.id} task={k} staffId={snap.me!.staffId} />
          ))}
        </ul>
      )}
      {ups.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('up.title')}</h3>
          <ul className="space-y-1.5">
            {ups.map((u) => (
              <li key={u.id} className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
                <Clock3 className="size-4 shrink-0 text-primary" /> {tr.text(u.text)}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function TableTaskRow({ task, staffId }: { task: Task; staffId: string }) {
  const words = useTaskWords(task)
  const [busy, setBusy] = useState(false)
  const tr = useT()
  return (
    <li className="rounded-xl bg-secondary/70 px-3 py-2">
      <div className="text-sm font-medium">{words.title}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {task.actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant={a.primary ? 'default' : 'outline'}
            className="h-8 rounded-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await act(a.event, a.event === 'task.snoozed' ? { ...a.payload, taskId: task.id, staffId } : a.payload)
              } catch {
                toast.error(tr('toast.error'))
              } finally {
                setBusy(false)
              }
            }}
          >
            {words.action(a)}
          </Button>
        ))}
      </div>
    </li>
  )
}

/** Everything already done for these guests, with times: the table's story so far. */
function TableDone({ table, now }: { table: Snapshot['tables'][number]; now: number }) {
  const tr = useT()
  const ago = useAgo()
  const items = tableTimeline(table).reverse()
  if (!items.length) return null
  return (
    <>
      <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('table.done')}</h3>
      <ol className="relative space-y-2 border-l pl-4">
        {items.map((i, n) => (
          <li key={n} className="relative text-sm">
            <span className={cn('absolute -left-[1.3rem] top-1 grid size-3 place-items-center rounded-full border-2 border-card', i.kitchen ? 'bg-kitchen' : 'bg-good')} aria-hidden />
            <span className="mr-2 text-xs text-muted-foreground tabular">{ago(now, i.at)}</span>
            <span className="inline-block first-letter:uppercase">{tr.text(i.text)}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

/** "just now" / "12 min ago", measured in service time so it always agrees with the cards. */
function useAgo() {
  const tr = useT()
  return (now: number, at: number) => {
    const n = minutesAgo(at, now)
    return n < 1 ? tr('time.justNow') : tr('time.ago', { n })
  }
}
