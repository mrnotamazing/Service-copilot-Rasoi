// The front door at "/": what TableMate is, the problem it answers, what it does, who it is for, and
// the ways in (the live demo, the film, the real screens). It stands apart from the app's own menu.

import { Accessibility, ArrowRight, BellRing, Check, ChefHat, Clapperboard, Eye, HeartHandshake, Languages, Lock, Play, Receipt, ShieldCheck, Sparkles, Timer, Type, Users, Volume2 } from 'lucide-react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mascot, Mark, TAGLINE, Wordmark } from '../brand/marks.tsx'
import { AccessButton } from '../components/AccessPanel.tsx'
import { RunningChef } from '../components/RunningChef.tsx'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { usePrefs } from '../lib/prefs.ts'
import { scrollToId, skipToMain } from '../lib/scroll.ts'
import { useRolePage } from '../lib/role.ts'

// ---------------------------------------------------------------------------
// Header

const LINKS = [
  { href: '#problem', label: 'The problem' },
  { href: '#product', label: 'What it does' },
  { href: '#teams', label: 'Who it is for' },
  { href: '#everyone', label: 'For everyone' },
]

/**
 * The header's lower edge is the service line: it fills as the page is read, with the chef running
 * along it while the page moves. Position follows the scroll; the running legs stop for reduced motion.
 */
function ScrollChef() {
  const device = useReducedMotion()
  const still = usePrefs().reduceMotion || !!device
  const { scrollYProgress } = useScroll()
  const left = useTransform(scrollYProgress, (v) => `${v * 100}%`)
  const width = useTransform(scrollYProgress, (v) => `${v * 100}%`)
  const [running, setRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useMotionValueEvent(scrollYProgress, 'change', () => {
    if (still) return
    setRunning(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRunning(false), 160)
  })
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" aria-hidden>
      <motion.div className="h-full bg-primary" style={{ width }} />
      <motion.div className="absolute bottom-[3px] w-9 -translate-x-full" style={{ left }}>
        <Mascot running={running} className="w-full" speed="var(--muted-foreground)" />
      </motion.div>
    </div>
  )
}

/** The section in view, so the header can show where the visitor is. */
function useSection(ids: string[]) {
  const [active, setActive] = useState('')
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (hit) setActive(hit.target.id)
        else if (window.scrollY < 300) setActive('')
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.5] },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [ids])
  return active
}
const SECTION_IDS = LINKS.map((l) => l.href.slice(1))

function Header() {
  const active = useSection(SECTION_IDS)
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <a href="#main" onClick={skipToMain} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground">
        Skip to main content
      </a>
      <ScrollChef />
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:gap-6 md:px-6">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2" aria-label="TableMate home">
          <Mark className="h-6 w-auto text-tomato" />
          <Wordmark className="text-xl leading-none" />
        </Link>
        <nav aria-label="On this page" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={(e) => scrollToId(e, l.href.slice(1))}
              aria-current={active === l.href.slice(1) ? 'location' : undefined}
              className={cn('inline-flex h-9 items-center rounded-lg px-3 text-sm transition-colors hover:bg-secondary/60 hover:text-foreground', active === l.href.slice(1) ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground')}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <AccessButton />
          <Button asChild size="sm" className="h-9 rounded-full px-4 pointer-coarse:h-11">
            <Link to="/demo">Try the demo</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Hero: a phone you can use. Tap Done and the next move slides up; left alone, it keeps going.

interface Move {
  id: string
  title: string
  why: string
  action: string
  safety?: boolean
}
const MOVES: Move[] = [
  { id: 'greet', title: 'Greet Table 4', why: 'Seated 90 seconds ago. Anniversary dinner, one nut allergy.', action: 'Greeted' },
  { id: 'late', title: 'Tell Table 2 the mains are late', why: 'The grill is 6 minutes behind. A heads-up now beats an apology later.', action: 'Told them' },
  { id: 'bill', title: 'Bring the bill to Table 6', why: 'Asked for it a minute ago.', action: 'Brought' },
  { id: 'allergy', title: 'Priya has a nut allergy', why: 'The satay on Table 3 has peanut sauce. Tell the kitchen before it is plated.', action: 'Tell the kitchen', safety: true },
  { id: 'check', title: 'Check back on Table 1', why: 'Mains arrived 2 minutes ago.', action: 'Checked' },
  { id: 'dessert', title: 'Offer dessert at Table 5', why: 'Plates cleared, no order yet.', action: 'Offered' },
]

function MoveCard({ m, lead, onDone }: { m: Move; lead: boolean; onDone: () => void }) {
  return (
    <div
      className={cn('rounded-2xl border bg-card p-4 text-left shadow-sm', lead && !m.safety && 'border-primary/60', m.safety && 'border-destructive/50 bg-destructive/[0.04]', lead && 'shadow-md')}
    >
      <div className="flex items-start gap-2.5">
        {m.safety && <ShieldCheck className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
        <div className="min-w-0">
          <div className="font-display text-base leading-snug">{m.title}</div>
          <div className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>{m.why}</span>
          </div>
        </div>
      </div>
      {lead && (
        <button
          type="button"
          onClick={onDone}
          className={cn(
            'mt-3 h-10 w-full rounded-full text-sm font-medium transition-[background-color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
            m.safety ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {m.action}
        </button>
      )}
    </div>
  )
}

function HeroPhone() {
  const device = useReducedMotion()
  const still = usePrefs().reduceMotion || !!device
  const [n, setN] = useState(0)
  const [touched, setTouched] = useState(false)
  const visible = [0, 1, 2].map((i) => ({ m: MOVES[(n + i) % MOVES.length], key: n + i }))

  // Left alone it plays on its own; the first tap hands it over to the visitor.
  useEffect(() => {
    if (still || touched) return
    const id = window.setInterval(() => setN((x) => x + 1), 3800)
    return () => window.clearInterval(id)
  }, [still, touched])

  return (
    <div className="relative mx-auto w-[min(100%,340px)]">
      <div className="rounded-[2.6rem] bg-chocolate p-2.5 ring-1 ring-border shadow-[0_40px_70px_-34px_color-mix(in_oklab,var(--chocolate)_70%,transparent)]">
        <div className="overflow-hidden rounded-[2.1rem] bg-background">
          <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
            <span className="font-display text-lg">Next up</span>
            <span className="text-xs tabular text-muted-foreground" aria-live="polite">
              {n} done
            </span>
          </div>
          <div className="grid h-[440px] content-start gap-3 overflow-hidden px-3 pb-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map(({ m, key }, i) => (
                <motion.div
                  key={key}
                  layout={!still}
                  initial={still ? false : { opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={still ? undefined : { opacity: 0, y: -24, transition: { duration: 0.28 } }}
                  transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
                >
                  <MoveCard
                    m={m}
                    lead={i === 0}
                    onDone={() => {
                      setTouched(true)
                      setN((x) => x + 1)
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{touched ? 'Suggestions, never orders. Nothing here is forced on the server.' : 'Try it: tap the button on the top card.'}</p>
    </div>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-14 pt-10 md:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-20 lg:pt-16">
      <div className="min-w-0">
        <Mascot className="-ml-1 w-[min(150px,40vw)]" speed="var(--foreground)" title="TableMate's running chef" />
        <p className="tagline mt-3 text-muted-foreground">{TAGLINE}</p>
        <h1 className="mt-5 text-balance font-display text-[clamp(2.3rem,4.8vw,3.7rem)] leading-[1.05] tracking-[-0.035em]">
          Every table on time. <span className="text-primary">No one blamed for what was never theirs.</span>
        </h1>
        <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-muted-foreground">
          TableMate is an AI copilot for fine-dining servers. It shows each server the next three things that matter, keeps the kitchen and the floor on the same page, and records whose step every
          delay really was.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
            <Link to="/demo">
              Try the live demo <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-base">
            <Link to="/intro">
              <Play /> Watch the film
            </Link>
          </Button>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          <Link to="/about" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            Read how it works
          </Link>{' '}
          · Reads your POS, no new hardware · Six languages
        </p>
      </div>
      <HeroPhone />
    </section>
  )
}

// ---------------------------------------------------------------------------
// The service line: the chef runs along it, then the problem begins.

function ServiceLine() {
  const runner = useRef<() => void>(null)
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6" onPointerEnter={() => runner.current?.()}>
      <div className="relative overflow-x-clip border-t pt-1">
        <RunningChef trigger={runner} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The problem

function Problem() {
  const items: { icon: ReactNode; title: string; body: string }[] = [
    { icon: <Users />, title: 'Six tables, one head', body: 'Greetings, courses, check-backs, bills, resets. Each step is simple. Holding all of them at once, at pace, is where servers slip.' },
    { icon: <ChefHat />, title: 'News stops at the pass', body: 'The POS knows a dish is late or gone. The server learns when the guest asks. Kitchen and floor still talk by shouting.' },
    { icon: <Receipt />, title: 'Blame lands on the floor', body: 'Guests and managers see the server, so a slow grill reads as slow service. And retraining fixes what people know, not what a rush asks of them.' },
  ]
  return (
    <section id="problem" className="scroll-mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <h2 className="max-w-[22ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">Restaurants digitised the order. Not the server’s job.</h2>
        <p className="mt-4 max-w-[56ch] text-pretty text-lg text-muted-foreground">Servers know the standards. A busy night is what makes them slip, and then the wrong person carries the blame.</p>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {items.map((x) => (
            <div key={x.title} className="border-l-2 border-primary pl-5">
              <span className="text-primary [&_svg]:size-6">{x.icon}</span>
              <h3 className="mt-3 font-display text-xl">{x.title}</h3>
              <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{x.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// What it does: four groups, each with a picture of the real thing.

function Bullets({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-5">
      {items.map(([t, d]) => (
        <li key={t} className="flex gap-3">
          <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          <div>
            <div className="font-medium">{t}</div>
            <p className="mt-0.5 text-pretty text-[15px] leading-relaxed text-muted-foreground">{d}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Pane({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border bg-secondary/40 p-5 md:p-7">{children}</div>
}

function OnTrackPicture() {
  return (
    <Pane>
      <div className="grid gap-3">
        <div className="rounded-2xl border border-destructive/50 bg-card p-4">
          <div className="flex items-center gap-2.5 font-display text-lg">
            <ShieldCheck className="size-5 text-destructive" aria-hidden /> Priya has a nut allergy
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Table 3 · Satay skewers are on the order</p>
          <div className="mt-3 rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-foreground">Tell the kitchen</div>
        </div>
        <div className="mx-auto h-6 w-px border-l-2 border-dashed border-muted-foreground/50" aria-hidden />
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-kitchen">
              <ChefHat className="size-5" aria-hidden /> Kitchen · Table 3
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">fired 0:12</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-sm">
            <span className="font-medium">Satay skewers</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> nut allergy
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-good">
            <Check className="size-4" strokeWidth={3} aria-hidden /> Chef: swapped the sauce, no nuts
          </p>
        </div>
      </div>
    </Pane>
  )
}

function FairPicture() {
  return (
    <Pane>
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg">Table 4 · 1 h 42 min</span>
          <span className="text-xs text-muted-foreground">Example receipt</span>
        </div>
        <ul className="mt-3 divide-y text-sm">
          {[
            ['Greeted', '0:42', 'Floor', false],
            ['Order sent to the kitchen', '1:05', 'Floor', false],
            ['Mains ready', '+14:00', 'Kitchen', true],
            ['Bill brought', '1:50', 'Floor', false],
          ].map(([step, time, who, late]) => (
            <li key={String(step)} className="flex items-center gap-3 py-2.5">
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold', late ? 'bg-kitchen/15 text-kitchen' : 'bg-good/15 text-good')}>{late ? '!' : <Check className="size-3.5" strokeWidth={3} aria-hidden />}</span>
              <span className="min-w-0 flex-1">{step}</span>
              <span className="tabular text-muted-foreground">{time}</span>
              <span className={cn('w-[4.5rem] rounded-full py-0.5 text-center text-xs', late ? 'bg-kitchen/12 text-kitchen' : 'bg-muted text-muted-foreground')}>{who}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="The extra time: 87 percent kitchen, 13 percent floor">
          <div className="h-full" style={{ width: '87%', background: 'var(--kitchen-mark)' }} />
          <div className="h-full" style={{ width: '13%', background: 'var(--floor-mark)' }} />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-good/12 px-3 py-1 text-sm text-good">
          <Check className="size-4" strokeWidth={3} aria-hidden /> Aisha’s steps: all within standard
        </p>
      </div>
    </Pane>
  )
}

function FloorPicture() {
  const tbl = (n: string, extra?: ReactNode, tone?: 'move') => (
    <span key={n} className={cn('relative grid size-12 place-items-center rounded-full border-[3px] bg-card font-display text-sm', tone === 'move' ? 'border-primary' : 'border-border')}>
      {n}
      {extra}
    </span>
  )
  return (
    <Pane>
      <div className="grid grid-cols-2 gap-3">
        {[
          { who: 'Aisha’s section', count: '4 tables', tables: [tbl('T1'), tbl('T2'), tbl('T3'), tbl('T4', <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-primary">हिन्दी</span>, 'move')] },
          { who: 'Meera’s section', count: '2 tables', tables: [tbl('T5'), tbl('T6')] },
        ].map((r) => (
          <div key={r.who} className="rounded-2xl border-2 border-dashed bg-card/60 p-3">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">{r.who}</span>
              <span className="text-muted-foreground">{r.count}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 justify-items-center gap-x-4 gap-y-9 pb-2 pt-7">{r.tables}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-2xl border bg-card p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-medium">Table 4 speaks Hindi. Meera does, and has the lighter section.</p>
          <div className="mt-2 inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">Hand to Meera</div>
        </div>
      </div>
    </Pane>
  )
}

function GrowPicture() {
  const R = 38
  const C = 2 * Math.PI * R
  return (
    <Pane>
      <div className="grid gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm">Is the satay safe for me? I’m allergic to nuts.</div>
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-accent-foreground">Thank you for telling me. Let me check with the chef and come straight back.</div>
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
            <circle cx="44" cy="44" r={R} fill="none" stroke="var(--muted)" strokeWidth="9" />
            <circle cx="44" cy="44" r={R} fill="none" stroke="var(--good)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * 0.14} transform="rotate(-90 44 44)" />
            <text x="44" y="51" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" fontSize="22" fill="var(--foreground)">
              86
            </text>
          </svg>
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-2">
              <Check className="size-4 text-good" strokeWidth={3} aria-hidden /> Named the allergy
            </p>
            <p className="mt-1 flex items-center gap-2">
              <Check className="size-4 text-good" strokeWidth={3} aria-hidden /> Went to the chef
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden /> Only the server sees this
            </p>
          </div>
        </div>
      </div>
    </Pane>
  )
}

const GROUPS: { id: string; tab: string; title: string; lead: string; items: [string, string][]; picture: ReactNode }[] = [
  {
    id: 'track',
    tab: 'On track',
    title: 'Every table stays on track',
    lead: 'Quick and correct, in the order the guests need it.',
    items: [
      ['The next three moves', 'Each server sees only what matters now, ranked by guest impact and urgency, with the reason for each. They are suggestions, never orders.'],
      ['Allergies caught before the plate is made', 'A nut allergy at the table and a dish with nuts on the order become the top card, and the kitchen ticket carries the same flag. It is a rule, never an AI guess.'],
      ['One answer for every guest question', 'Guests ask “is it vegetarian?”. The kitchen answers once, and the answer is saved for the next server.'],
    ],
    picture: <OnTrackPicture />,
  },
  {
    id: 'fair',
    tab: 'Fair',
    title: 'Delays go to whoever controlled them',
    lead: 'So a slow grill is never marked against a server.',
    items: [
      ['A receipt for every table', 'Each step is timed against the restaurant’s own standard and coloured by who controlled it: the floor or the kitchen.'],
      ['The kitchen and floor share one picture', 'Late tickets, dishes that are off, notes both ways. News no longer travels by shouting.'],
      ['Process, never people', 'Managers see where time goes, not a ranking of staff. Personal stats stay on the server’s own screen.'],
    ],
    picture: <FairPicture />,
  },
  {
    id: 'floor',
    tab: 'Balanced floor',
    title: 'The floor stays balanced',
    lead: 'The manager sees where help is needed and can act in one tap.',
    items: [
      ['The live floor', 'Every table’s stage and mood, with the ones that need a manager flagged first.'],
      ['Share the floor', 'Hand a table to a colleague who speaks the guests’ language or has more room. It returns to its section after the visit.'],
      ['Suggestions and what-ifs', 'AI-suggested moves for the next fifteen minutes, and “what if we add a grill cook?” answered before it is tried.'],
    ],
    picture: <FloorPicture />,
  },
  {
    id: 'grow',
    tab: 'Growing',
    title: 'People get better at the hard moments',
    lead: 'Practice that fits between rushes, in private.',
    items: [
      ['Practise tough conversations', 'Realistic guests, an honest score, and an ideal reply to compare with. Scores and progress belong to the server.'],
      ['A coach, not a scoreboard', 'Short lessons and tips that follow what that server actually met on the floor.'],
      ['Built for every server', 'Six languages, read-aloud, large text, colour-safe cues, and alerts that flash and buzz as well as chime.'],
    ],
    picture: <GrowPicture />,
  },
]

function Product() {
  return (
    <section id="product" className="scroll-mt-16 border-t bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <h2 className="max-w-[24ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">One copilot for the server, the kitchen and the manager.</h2>
        <p className="mt-4 max-w-[56ch] text-pretty text-lg text-muted-foreground">It listens to events your POS already produces. No new hardware, and no one types an order twice.</p>
        <Tabs defaultValue="track" className="mt-10 gap-6">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <TabsList className="h-auto w-max gap-1 rounded-full bg-background p-1.5 ring-1 ring-border">
              {GROUPS.map((g) => (
                <TabsTrigger key={g.id} value={g.id} className="h-9 flex-none rounded-full px-5 text-sm text-muted-foreground pointer-coarse:h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                  {g.tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {GROUPS.map((g) => (
            <TabsContent key={g.id} value={g.id} className="rise-in grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className="min-w-0">
                <h3 className="text-balance font-display text-2xl leading-tight tracking-[-0.02em] md:text-4xl">{g.title}</h3>
                <p className="mt-2 text-lg text-muted-foreground">{g.lead}</p>
                <div className="mt-6">
                  <Bullets items={g.items} />
                </div>
              </div>
              <div className="min-w-0">{g.picture}</div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Who it is for: one moment, seen from each screen.

function Screen({ role, to, cta, children, className }: { role: string; to: string; cta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <h3 className="font-display text-2xl">{role}</h3>
      <div className="mt-3 flex-1 rounded-3xl border bg-card p-4 shadow-sm md:p-5">{children}</div>
      <Link to={to} className="group mt-1 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  )
}

function Teams() {
  return (
    <section id="teams" className="scroll-mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <h2 className="max-w-[22ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">One moment, three screens.</h2>
        <p className="mt-4 max-w-[58ch] text-pretty text-lg text-muted-foreground">
          It is 8:42 on a busy Saturday and the grill falls behind. Here is what each person sees, and what they do next. Open any of them to try it for real.
        </p>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr_1fr] lg:gap-6">
          <Screen role="The server" to="/servers" cta="Open a server’s phone">
            <div className="rounded-2xl border border-primary/60 bg-background p-4 shadow-md">
              <div className="font-display text-base leading-snug">Tell Table 2 the mains are late</div>
              <div className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span>The grill is 6 minutes behind. A heads-up now beats an apology later.</span>
              </div>
              <div className="mt-3 rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-foreground">Told them</div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">She tells the table before they ask. The guest hears it from her, calmly.</p>
          </Screen>
          <Screen role="The kitchen" to="/kitchen" cta="Open the kitchen pass" className="lg:mt-10">
            <ul className="divide-y text-sm">
              {[
                ['T2 · Mains', '+6:10', true],
                ['T6 · Mains', '+3:40', true],
                ['T9 · Starters', '1:20', false],
              ].map(([t, time, late]) => (
                <li key={String(t)} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 font-medium">{t}</span>
                  <span className={cn('tabular', late ? 'font-medium text-kitchen' : 'text-muted-foreground')}>{time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
              <ChefHat className="size-4 shrink-0 text-kitchen" aria-hidden />
              <span className="min-w-0 flex-1">Grill backed up, about 5 min</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-good">Sent to the floor</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">One note reaches every server at once. No one walks the pass to ask.</p>
          </Screen>
          <Screen role="The manager" to="/manager" cta="Open the manager view" className="lg:mt-4">
            <div className="flex items-start gap-3 rounded-2xl bg-accent/60 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium leading-snug">The grill is behind on 3 tables. This is a kitchen pattern, not a server one.</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="size-4 text-good" strokeWidth={3} aria-hidden /> Aisha’s steps: all within standard
              </li>
              <li className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" aria-hidden /> No ranking of people, only where time goes
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">She sees the cause, not a slow server, and can step in at the grill.</p>
          </Screen>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Principles and access

const PRINCIPLES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Timer />, title: 'Suggestions, never orders', body: 'The server stays in charge. Every card can wait, and the reason is always shown.' },
  { icon: <ShieldCheck />, title: 'Safety is a rule, not a guess', body: 'Allergy checks and menu answers come from your kitchen’s own data. AI only helps with wording.' },
  { icon: <Lock />, title: 'Never a ranking of people', body: 'Managers see the process. Personal scores, streaks and practice stay on the server’s own screen.' },
  { icon: <HeartHandshake />, title: 'Works without the AI', body: 'If no AI service is connected, a built-in writer takes over. Nothing on the floor depends on it.' },
]
const LANGS = ['English', 'हिन्दी', 'தமிழ்', 'বাংলা', 'Español', 'नेपाली']
const ACCESS: { icon: ReactNode; label: string }[] = [
  { icon: <Volume2 />, label: 'Read aloud' },
  { icon: <Type />, label: 'Large text' },
  { icon: <Eye />, label: 'Colour-safe cues' },
  { icon: <BellRing />, label: 'Flash and buzz alerts' },
]

function Trust() {
  return (
    <section id="everyone" className="scroll-mt-16 border-t bg-secondary/30">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <h2 className="max-w-[18ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">Built to be trusted on the floor.</h2>
          <ul className="mt-8 space-y-6">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary [&_svg]:size-5">{p.icon}</span>
                <div>
                  <h3 className="font-medium">{p.title}</h3>
                  <p className="mt-0.5 text-pretty text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="max-w-[18ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">Made for every server.</h2>
          <p className="mt-4 text-lg text-muted-foreground">In their own language, and in whatever way works best for them.</p>
          <div className="mt-8 flex items-center gap-2 text-sm font-medium">
            <Languages className="size-4 text-primary" aria-hidden /> Six languages across the app
          </div>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {LANGS.map((l) => (
              <li key={l} className="rounded-xl border bg-card px-4 py-2.5 font-display text-lg">
                {l}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center gap-2 text-sm font-medium">
            <Accessibility className="size-4 text-primary" aria-hidden /> Comfort and access, in Settings
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2.5">
            {ACCESS.map((a) => (
              <li key={a.label} className="flex items-center gap-3 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground [&_svg]:size-5">
                {a.icon}
                {a.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// The way in

function Finale() {
  return (
    <section className="px-4 py-14 md:px-6 md:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-hero p-8 text-hero-foreground md:p-14">
        <Mascot className="pointer-events-none absolute bottom-5 right-8 w-48 max-md:hidden" speed="var(--hero-foreground)" />
        <h2 className="max-w-[18ch] text-balance font-display text-3xl leading-tight tracking-[-0.025em] md:text-5xl">See it run before you decide.</h2>
        <p className="mt-4 max-w-[48ch] text-pretty text-lg opacity-85">
          Start a simulated Saturday service, play a server, and watch the kitchen and the manager react. Presenting? One tap sets up a service already 100 minutes in, with something to show on
          every screen.
        </p>
        <ol className="mt-6 grid max-w-[44rem] gap-3 text-[15px] sm:grid-cols-3">
          {[
            ['Open the demo', 'and press Start service.'],
            ['Tap Set up a presentation', 'and pick the server you play.'],
            ['Follow the seven stops', 'each one has something to show.'],
          ].map(([a, b], i) => (
            <li key={a} className="flex gap-3 border-t border-hero-foreground/25 pt-3">
              <span className="font-display text-lg tabular-nums text-primary-2" aria-hidden>
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{a}</span> <span className="opacity-80">{b}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm opacity-75">About two minutes, and no account needed.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
            <Link to="/demo">
              Open the demo <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-hero-foreground/30 bg-transparent px-6 text-base text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground">
            <Link to="/intro">
              <Clapperboard /> Watch the film
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground">
            <Link to="/about">Read how it works</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:px-6">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-auto text-tomato" />
          <Wordmark className="text-base leading-none text-foreground" />
          <span className="ml-2">{TAGLINE}</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/demo" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground">
            Demo
          </Link>
          <Link to="/about" className="inline-flex min-h-11 items-center hover:text-foreground">
            How it works
          </Link>
          <Link to="/intro" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground">
            Film
          </Link>
          <span>OB Project · Working Group B3</span>
        </nav>
      </div>
    </footer>
  )
}

export default function Landing() {
  useRolePage(null)
  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main id="main">
        <Hero />
        <ServiceLine />
        <Problem />
        <Product />
        <Teams />
        <Trust />
        <Finale />
      </main>
      <Footer />
    </div>
  )
}
