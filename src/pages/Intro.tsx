// The introduction to TableMate as a short animated film, made with Motion. It tells the problem
// first (a server, six tables, a rush, the blame, the retraining that doesn't help) and then what
// TableMate does about it, in the same order as the project's problem statement.
//
// Every scene is drawn from a clock (`t`, in milliseconds since the scene began), so Pause freezes the
// story, any scene can be jumped to, and the same code is what gets recorded as the video.

import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChefHat,
  Eye,
  HandHelping,
  Languages,
  Maximize2,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Star,
  Volume2,
  Vibrate,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mascot, Wordmark } from '../brand/marks.tsx'
import { TopNav } from '../components/kit.tsx'
import { useRolePage } from '../lib/role.ts'

type Beat = (ms: number) => boolean

interface Scene {
  id: string
  /** How long it plays, in ms. */
  ms: number
  /** The line read as a caption under the picture. */
  caption: string
  render: (t: number, at: Beat) => ReactNode
}

// ---------------------------------------------------------------------------
// Small pieces

const ease = [0.22, 0.8, 0.2, 1] as const

/** A line of text that rises into place when its moment comes. */
function Rise({ show, children, className, delay = 0 }: { show: boolean; children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={false} animate={{ opacity: show ? 1 : 0, y: show ? 0 : 18 }} transition={{ duration: 0.6, ease, delay }} className={className}>
      {children}
    </motion.div>
  )
}

/** Big words that arrive one after another. */
function Words({ text, from = 0, step = 160, t, className }: { text: string; from?: number; step?: number; t: number; className?: string }) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i) => (
        <motion.span key={i} initial={false} animate={{ opacity: t >= from + i * step ? 1 : 0, y: t >= from + i * step ? 0 : 14 }} transition={{ duration: 0.5, ease }} className="mr-[0.28em] inline-block">
          {w}
        </motion.span>
      ))}
    </span>
  )
}

/** A number that counts up to `to` between two moments. */
function useCount(t: number, from: number, to: number, ms: number) {
  const p = Math.min(1, Math.max(0, (t - from) / ms))
  return Math.round((1 - Math.pow(1 - p, 3)) * to)
}


// ---------------------------------------------------------------------------
// The scenes

/** 1. Hello: the chef runs in. */
function Hello({ t, at }: { t: number; at: Beat }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center">
        <motion.div initial={{ x: '-70cqw' }} animate={{ x: 0 }} transition={{ duration: 1.6, ease }}>
          <Mascot running={t < 1700} className="w-[22cqw]" speed="var(--hero-foreground)" />
        </motion.div>
        <Rise show={at(1500)} className="mt-[1cqw]">
          <Wordmark className="text-[8.5cqw] leading-none" />
        </Rise>
        <Rise show={at(2400)} className="mt-[1.6cqw] text-[2.2cqw] opacity-80">
          The right service. At the right time.
        </Rise>
        <Rise show={at(3600)} className="mt-[2.4cqw] rounded-full border border-hero-foreground/25 px-[1.6cqw] py-[0.5cqw] text-[1.5cqw] opacity-80">
          An AI service copilot for fine-dining servers
        </Rise>
      </div>
    </div>
  )
}

const TABLES = [
  { n: 'T1', w: 'Needs a greeting', x: 50, y: 14, c: 'warn' },
  { n: 'T2', w: 'Waiting to order', x: 79, y: 31, c: 'primary' },
  { n: 'T3', w: 'Mains are cooking', x: 79, y: 69, c: 'kitchen' },
  { n: 'T4', w: 'Wants the bill', x: 50, y: 86, c: 'warn' },
  { n: 'T5', w: 'Check-back due', x: 21, y: 69, c: 'primary' },
  { n: 'T6', w: 'Dessert, maybe?', x: 21, y: 31, c: 'kitchen' },
]

/** 2. One server, six tables. */
function SixTables({ t, at }: { t: number; at: Beat }) {
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1.1fr] items-center gap-[3cqw] px-[5cqw]">
      <div>
        <Rise show={at(200)} className="text-[1.8cqw] opacity-70">
          Saturday, 9 pm
        </Rise>
        <h2 className="mt-[0.8cqw] font-display text-[5.6cqw] leading-[1.02]">
          <Words t={t} from={500} text="Six tables." />
          <br />
          <Words t={t} from={1100} text="One server." className="text-primary-2" />
        </h2>
        <Rise show={at(2600)} className="mt-[1.6cqw] max-w-[34cqw] text-[1.9cqw] leading-snug opacity-80">
          Each table is at a different step, and every step has a standard to meet.
        </Rise>
      </div>
      <div className="relative mx-auto aspect-square h-[38cqw]">
        <motion.div initial={false} animate={{ scale: at(300) ? 1 : 0.6, opacity: at(300) ? 1 : 0 }} transition={{ duration: 0.6, ease }} className="absolute left-1/2 top-1/2 grid size-[9cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <span className="text-center font-display text-[1.7cqw] leading-tight">One
            <br />server</span>
        </motion.div>
        {TABLES.map((tb, i) => {
          const on = t >= 900 + i * 380
          return (
            <motion.div
              key={tb.n}
              initial={false}
              animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
              transition={{ duration: 0.5, ease }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${tb.x}%`, top: `${tb.y}%` }}
            >
              <div className="mx-auto grid size-[6.4cqw] place-items-center rounded-full border-[0.35cqw] bg-card font-display text-[2cqw] text-foreground" style={{ borderColor: `var(--${tb.c === 'warn' ? 'warn' : tb.c === 'kitchen' ? 'kitchen' : 'primary'})` }}>
                {tb.n}
              </div>
              <div className="mt-[0.6cqw] whitespace-nowrap text-[1.3cqw] opacity-85">{tb.w}</div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

const STANDARDS = [
  { s: 'Greet within 2 minutes', ok: true },
  { s: 'Check back after the food lands', ok: true },
  { s: 'Warn the table about a delay', ok: false },
  { s: 'Clear plates promptly', ok: false },
  { s: 'Bring the bill when asked', ok: false },
]

/** 3. They know the standards, and still slip. */
function Slip({ t, at }: { t: number; at: Beat }) {
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1fr] items-center gap-[4cqw] px-[6cqw]">
      <div>
        <h2 className="font-display text-[4.6cqw] leading-[1.06]">
          <Words t={t} from={200} text="They learnt the standards on day one." />
        </h2>
        <Rise show={at(5200)} className="mt-[2cqw] text-[2.3cqw] leading-snug text-primary-2">
          Knowing was never the problem. Holding six tables in one head is.
        </Rise>
      </div>
      <ul className="space-y-[1.1cqw]">
        {STANDARDS.map((x, i) => {
          const shown = t >= 800 + i * 350
          const slipped = !x.ok && t >= 3000 + (i - 2) * 700
          return (
            <motion.li key={x.s} initial={false} animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : 30 }} transition={{ duration: 0.5, ease }} className={cn('flex items-center gap-[1.4cqw] rounded-[1.2cqw] border px-[1.8cqw] py-[1.3cqw] text-[1.9cqw] transition-colors duration-500', slipped ? 'border-warn bg-warn/15' : 'border-hero-foreground/20 bg-hero-foreground/5')}>
              <span className={cn('grid size-[3cqw] shrink-0 place-items-center rounded-full transition-colors duration-500', slipped ? 'bg-warn text-background' : 'bg-good text-background')}>
                {slipped ? <X className="size-[1.9cqw]" /> : <Check className="size-[1.9cqw]" />}
              </span>
              <span className="flex-1">{x.s}</span>
              {slipped && <span className="text-[1.3cqw] text-warn">missed</span>}
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

/** 4. The blame lands on the server. */
function Blame({ t, at }: { t: number; at: Beat }) {
  const stage = t < 2200 ? 0 : t < 4200 ? 1 : 2
  return (
    <div className="absolute inset-0 px-[6cqw] pt-[5cqw]">
      <h2 className="font-display text-[4.4cqw] leading-[1.06]">
        <Words t={t} from={200} text="Then the food runs late." />
      </h2>
      <div className="relative mt-[5cqw] grid grid-cols-3 items-start gap-[2cqw]">
        {[
          { icon: <ChefHat className="size-[4cqw]" />, n: 'The pass', sub: stage >= 1 ? 'Grill is backed up: +8 min' : 'Mains are cooking', bad: stage >= 1, owner: 'The delay begins here' },
          { icon: <HandHelping className="size-[4cqw]" />, n: 'The server', sub: stage >= 1 ? 'Doesn’t know yet' : 'Busy at T2', bad: false, owner: stage >= 2 ? 'Takes the blame' : '' },
          { icon: <Eye className="size-[4cqw]" />, n: 'The guest', sub: stage >= 2 ? '“Where is our food?”' : 'Chatting, happily', bad: stage >= 2, owner: '' },
        ].map((c, i) => (
          <motion.div key={c.n} initial={false} animate={{ opacity: at(700 + i * 400) ? 1 : 0, y: at(700 + i * 400) ? 0 : 24 }} transition={{ duration: 0.6, ease }} className={cn('rounded-[1.6cqw] border p-[2cqw] text-center transition-colors duration-500', c.bad ? 'border-warn bg-warn/12' : 'border-hero-foreground/20 bg-hero-foreground/5')}>
            <div className={cn('mx-auto grid size-[7cqw] place-items-center rounded-full transition-colors duration-500', c.bad ? 'bg-warn text-background' : 'bg-hero-foreground/15')}>{c.icon}</div>
            <div className="mt-[1.2cqw] font-display text-[2.4cqw]">{c.n}</div>
            <div className="mt-[0.4cqw] min-h-[2.4cqw] text-[1.7cqw] opacity-85">{c.sub}</div>
            <div className="mt-[1cqw] min-h-[2cqw] text-[1.4cqw] font-medium text-warn">{c.owner}</div>
          </motion.div>
        ))}
      </div>
      <Rise show={at(6000)} className="mt-[3.2cqw] text-center text-[2.3cqw] leading-snug">
        The server hears about it from the guest, and is judged for it.
      </Rise>
    </div>
  )
}

/** 5. The retraining loop. */
function Loop({ t, at }: { t: number; at: Beat }) {
  const steps = ['A step slips', 'The server is blamed', 'They’re sent to retrain', 'Same rush, same slip']
  const active = Math.min(3, Math.floor(Math.max(0, t - 900) / 1100))
  return (
    <div className="absolute inset-0 grid place-items-center px-[6cqw]">
      <div className="w-full">
        <h2 className="text-center font-display text-[4.2cqw] leading-[1.08]">
          <Words t={t} from={150} text="So restaurants retrain them." />
        </h2>
        <div className="mt-[4.5cqw] flex items-center justify-center gap-[1.2cqw]">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-[1.2cqw]">
              <motion.div initial={false} animate={{ opacity: t >= 900 + i * 1100 ? 1 : 0.15, scale: i === active && t >= 900 ? 1.06 : 1 }} transition={{ duration: 0.45, ease }} className={cn('w-[17cqw] rounded-[1.4cqw] border px-[1.4cqw] py-[2cqw] text-center text-[1.9cqw] leading-tight', i === active ? 'border-primary-2 bg-primary/25' : 'border-hero-foreground/25 bg-hero-foreground/5')}>
                <div className="font-display text-[3cqw] text-primary-2">{i + 1}</div>
                {s}
              </motion.div>
              {i < 3 && <ArrowRight className="size-[2.4cqw] opacity-60" />}
            </div>
          ))}
        </div>
        <motion.div initial={false} animate={{ opacity: at(5400) ? 1 : 0 }} transition={{ duration: 0.7 }} className="mx-auto mt-[3.5cqw] flex w-fit items-center gap-[1cqw] text-[1.6cqw] opacity-70">
          <RotateCcw className="size-[2cqw]" /> and round again, next weekend
        </motion.div>
        <Rise show={at(6400)} className="mt-[2cqw] text-center text-[2.4cqw] leading-snug text-primary-2">
          Retraining fixes what they know. Nothing about the night has changed.
        </Rise>
      </div>
    </div>
  )
}

const HMW = 'How might we help fine-dining servers keep every table on track in the middle of a rush, so the standards they already know don’t slip, they aren’t left to find out about kitchen delays from their guests, and they aren’t blamed or retrained for lapses that weren’t theirs?'

/** 6. The question. */
function Question({ t, at }: { t: number; at: Beat }) {
  const n = Math.min(HMW.length, Math.max(0, Math.floor((t - 500) / 28)))
  return (
    <div className="absolute inset-0 grid place-items-center px-[8cqw]">
      <div>
        <Rise show={at(150)} className="text-[1.6cqw] font-medium text-primary-2">
          The problem we set out to solve
        </Rise>
        <p className="mt-[1.6cqw] font-display text-[3.1cqw] leading-[1.25]">
          {HMW.slice(0, n)}
          <span className={cn('ml-[0.3cqw] inline-block h-[3cqw] w-[0.3cqw] translate-y-[0.5cqw] bg-primary-2', n >= HMW.length && 'animate-pulse')} aria-hidden />
        </p>
      </div>
    </div>
  )
}

/** Phone-shaped frame for the product scenes. */
function Phone({ children, on }: { children: ReactNode; on: boolean }) {
  return (
    <motion.div initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 40 }} transition={{ duration: 0.8, ease }} className="relative h-[40cqw] w-[19.4cqw] overflow-hidden rounded-[2.8cqw] border-[0.6cqw] border-hero-foreground/80 bg-background text-foreground shadow-2xl">
      {children}
    </motion.div>
  )
}

function Card({ icon, title, hint, why, on, tone }: { icon: ReactNode; title: string; hint: string; why: string; on: boolean; tone?: 'warn' }) {
  return (
    <motion.div initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 36, scale: on ? 1 : 0.96 }} transition={{ duration: 0.6, ease }} className={cn('mb-[0.9cqw] rounded-[1.2cqw] border bg-card p-[1cqw]', tone === 'warn' && 'border-warn')}>
      <div className="flex items-start gap-[0.8cqw]">
        <span className={cn('grid size-[2.6cqw] shrink-0 place-items-center rounded-full', tone === 'warn' ? 'bg-warn/20 text-warn' : 'bg-secondary text-primary')}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[1.15cqw] font-semibold leading-tight">{title}</div>
          <div className="mt-[0.25cqw] text-[0.95cqw] leading-tight text-muted-foreground">{hint}</div>
        </div>
      </div>
      <div className="mt-[0.7cqw] w-fit rounded-full bg-secondary px-[0.8cqw] py-[0.2cqw] text-[0.85cqw] text-muted-foreground">{why}</div>
    </motion.div>
  )
}

/** 7. Meet TableMate: the next three. */
function NextThree({ t, at }: { t: number; at: Beat }) {
  return (
    <div className="absolute inset-0 grid grid-cols-[1.1fr_auto] items-center gap-[6cqw] px-[7cqw]">
      <div>
        <Rise show={at(150)} className="flex items-center gap-[1cqw]">
          <Mascot className="w-[6cqw]" speed="var(--hero-foreground)" />
          <Wordmark className="text-[3.4cqw]" />
        </Rise>
        <h2 className="mt-[1.6cqw] font-display text-[4.6cqw] leading-[1.05]">
          <Words t={t} from={600} text="Only the next three." />
        </h2>
        <Rise show={at(1800)} className="mt-[1.6cqw] max-w-[38cqw] text-[2cqw] leading-snug opacity-85">
          It watches the whole floor and shows each server the three things that matter right now, in order, with a reason for each.
        </Rise>
        <Rise show={at(4200)} className="mt-[1.4cqw] text-[1.9cqw] text-primary-2">
          A nudge they can ignore. Never an order.
        </Rise>
      </div>
      <Phone on={at(500)}>
        <div className="border-b px-[1.2cqw] py-[1cqw]">
          <div className="text-[1.3cqw] font-semibold">Aisha</div>
          <div className="text-[0.9cqw] text-muted-foreground">Next up</div>
        </div>
        <div className="p-[1cqw]">
          <Card on={at(1500)} tone="warn" icon={<ShieldAlert className="size-[1.5cqw]" />} title="Check T2’s order before it’s cooked" hint="Galouti kebab has nuts (allergy)" why="Why first: allergy comes first" />
          <Card on={at(2500)} icon={<Bell className="size-[1.5cqw]" />} title="Kitchen: grill is backed up, about 7 minutes" hint="For the whole floor" why="Due in the next 2 minutes" />
          <Card on={at(3500)} icon={<HandHelping className="size-[1.5cqw]" />} title="Welcome T4" hint="Party of 4 · birthday" why="No one has been to this table for 3 min" />
        </div>
      </Phone>
    </div>
  )
}

/** 8. The loop between kitchen, servers and manager. */
function Loopback({ t, at }: { t: number; at: Beat }) {
  const nodes = [
    { n: 'Kitchen', x: 18, y: 62, icon: <ChefHat className="size-[3.2cqw]" /> },
    { n: 'Server', x: 50, y: 28, icon: <HandHelping className="size-[3.2cqw]" /> },
    { n: 'Manager', x: 82, y: 62, icon: <BookOpen className="size-[3.2cqw]" /> },
  ]
  const msgs = [
    { s: 'Mains for T3 in 2 min', from: 0, to: 1, at: 1500 },
    { s: 'Is the burrata made in-house?', from: 1, to: 0, at: 3000 },
    { s: 'Yes, every morning. Saved for next time.', from: 0, to: 1, at: 4500 },
    { s: 'T6 asks to see the manager', from: 1, to: 2, at: 6000 },
  ]
  return (
    <div className="absolute inset-0 px-[6cqw] pt-[5cqw]">
      <h2 className="font-display text-[4.2cqw] leading-[1.06]">
        <Words t={t} from={200} text="Everyone in the same loop." />
      </h2>
      <Rise show={at(900)} className="mt-[1cqw] max-w-[44cqw] text-[1.9cqw] opacity-80">
        Delays, sold-out dishes and guests’ questions reach the right person in one tap.
      </Rise>
      <div className="relative mt-[2cqw] h-[26cqw]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {[[0, 1], [1, 2], [0, 2]].map(([a, b], k) => (
            <motion.line key={k} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="var(--hero-foreground)" strokeOpacity="0.25" strokeWidth="0.35" strokeDasharray="1.2 1.6" vectorEffect="non-scaling-stroke" initial={false} animate={{ pathLength: t >= 700 + k * 250 ? 1 : 0 }} transition={{ duration: 0.8, ease }} />
          ))}
        </svg>
        {nodes.map((nd, i) => (
          <motion.div key={nd.n} initial={false} animate={{ opacity: at(500 + i * 250) ? 1 : 0, scale: at(500 + i * 250) ? 1 : 0.6 }} transition={{ duration: 0.5, ease }} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${nd.x}%`, top: `${nd.y}%` }}>
            <div className="mx-auto grid size-[8cqw] place-items-center rounded-full bg-primary text-primary-foreground">{nd.icon}</div>
            <div className="mt-[0.6cqw] font-display text-[2cqw]">{nd.n}</div>
          </motion.div>
        ))}
        {msgs.map((m) => {
          const a = nodes[m.from]
          const b = nodes[m.to]
          const p = Math.min(1, Math.max(0, (t - m.at) / 1100))
          const visible = t >= m.at && t < m.at + 1500
          return (
            <div key={m.s} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${a.x + (b.x - a.x) * p}%`, top: `${a.y + (b.y - a.y) * p - 9}%`, opacity: visible ? (p < 0.9 ? 1 : 1 - (p - 0.9) * 10) : 0 }}>
              <div className="flex items-center gap-[0.6cqw] whitespace-nowrap rounded-full bg-background px-[1.4cqw] py-[0.8cqw] text-[1.45cqw] text-foreground shadow-lg">
                <MessageSquareText className="size-[1.6cqw] text-primary" /> {m.s}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 9. Whose delay was it? */
function Fair({ t, at }: { t: number; at: Beat }) {
  const rows = [
    { s: 'Greeting', who: 'floor', w: 22, v: '1.8 min', late: false },
    { s: 'Kitchen prep', who: 'kitchen', w: 62, v: '+8 min late', late: true },
    { s: 'Pass to table', who: 'floor', w: 20, v: '1.2 min', late: false },
    { s: 'Bill', who: 'floor', w: 24, v: '2 min', late: false },
  ]
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1.25fr] items-center gap-[4cqw] px-[6cqw]">
      <div>
        <h2 className="font-display text-[4.6cqw] leading-[1.05]">
          <Words t={t} from={200} text="Whose delay was it?" />
        </h2>
        <Rise show={at(1400)} className="mt-[1.6cqw] max-w-[34cqw] text-[2cqw] leading-snug opacity-85">
          Every visit is broken into steps, and each delay is credited to whoever controlled that step.
        </Rise>
        <Rise show={at(5200)} className="mt-[1.6cqw] text-[2.2cqw] leading-snug text-primary-2">
          Kitchen delays are never counted against a server.
        </Rise>
      </div>
      <div className="rounded-[1.8cqw] border border-hero-foreground/20 bg-hero-foreground/5 p-[2.4cqw]">
        <div className="mb-[1.4cqw] flex items-center justify-between text-[1.4cqw] opacity-80">
          <span>Table T3, step by step</span>
          <span className="flex gap-[1.2cqw]">
            <span className="flex items-center gap-[0.4cqw]"><i className="size-[1cqw] rounded-full" style={{ background: 'var(--floor-mark)' }} /> floor</span>
            <span className="flex items-center gap-[0.4cqw]"><i className="size-[1cqw] rounded-full" style={{ background: 'var(--kitchen-mark)' }} /> kitchen</span>
          </span>
        </div>
        {rows.map((r, i) => (
          <div key={r.s} className="mb-[1.5cqw] last:mb-0">
            <div className="mb-[0.4cqw] flex justify-between text-[1.5cqw]">
              <span>{r.s}</span>
              <span className={cn(r.late && 'font-semibold text-warn')}>{r.v}</span>
            </div>
            <div className="h-[1.5cqw] overflow-hidden rounded-full bg-hero-foreground/10">
              <motion.div initial={false} animate={{ width: t >= 900 + i * 600 ? `${r.w}%` : '0%' }} transition={{ duration: 1, ease }} className="h-full rounded-full" style={{ background: r.who === 'kitchen' ? 'var(--kitchen-mark)' : 'var(--floor-mark)' }} />
            </div>
          </div>
        ))}
        <motion.div initial={false} animate={{ opacity: at(4200) ? 1 : 0, scale: at(4200) ? 1 : 0.9 }} transition={{ duration: 0.5, ease }} className="mt-[1.8cqw] rounded-[1cqw] border border-primary-2 bg-primary/20 px-[1.6cqw] py-[1.1cqw] text-[1.7cqw]">
          Kitchen delay: <b>not Aisha’s.</b>
        </motion.div>
      </div>
    </div>
  )
}

/** 10. Floor balance: a table handed to a colleague who speaks the guests' language. */
function Handover({ t, at }: { t: number; at: Beat }) {
  const moved = t >= 3600
  return (
    <div className="absolute inset-0 px-[6cqw] pt-[5cqw]">
      <h2 className="font-display text-[4.2cqw] leading-[1.06]">
        <Words t={t} from={200} text="Sharing the floor." />
      </h2>
      <Rise show={at(900)} className="mt-[1cqw] max-w-[46cqw] text-[1.9cqw] opacity-80">
        The manager sees who is stretched, and can hand a table to a colleague, for the load or for the guests’ language.
      </Rise>
      <div className="relative mt-[3cqw] grid grid-cols-2 gap-[8cqw]">
        {[
          { n: 'Aisha', note: moved ? '4 tables' : '5 tables: over the limit', bad: !moved, tables: moved ? ['T1', 'T2', 'T3', 'T4'] : ['T1', 'T2', 'T3', 'T4'] },
          { n: 'Priya', note: moved ? '3 tables · speaks Bengali' : '2 tables · speaks Bengali', bad: false, tables: moved ? ['T6', 'T7', 'T5'] : ['T6', 'T7'] },
        ].map((c, i) => (
          <motion.div key={c.n} initial={false} animate={{ opacity: at(800 + i * 300) ? 1 : 0, y: at(800 + i * 300) ? 0 : 24 }} transition={{ duration: 0.6, ease }} className={cn('rounded-[1.6cqw] border p-[2cqw] transition-colors duration-500', c.bad ? 'border-warn bg-warn/10' : 'border-hero-foreground/20 bg-hero-foreground/5')}>
            <div className="font-display text-[2.4cqw]">{c.n}</div>
            <div className={cn('text-[1.5cqw]', c.bad ? 'text-warn' : 'opacity-75')}>{c.note}</div>
            <div className="mt-[1.4cqw] flex min-h-[5.4cqw] flex-wrap gap-[0.8cqw]">
              {c.tables.map((tb) => (
                <motion.span key={tb} layout transition={{ duration: 0.8, ease }} className={cn('grid size-[5cqw] place-items-center rounded-full bg-card font-display text-[1.7cqw] text-foreground', tb === 'T5' && 'ring-[0.3cqw] ring-primary-2')}>
                  {tb}
                </motion.span>
              ))}
              {i === 0 && !moved && (
                <motion.span layout className="grid size-[5cqw] place-items-center rounded-full bg-card font-display text-[1.7cqw] text-foreground ring-[0.3cqw] ring-primary-2">T5</motion.span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div initial={false} animate={{ opacity: at(2200) && !moved ? 1 : 0 }} className="absolute right-[6cqw] top-[22cqw] flex items-center gap-[0.8cqw] rounded-full bg-primary px-[1.6cqw] py-[0.7cqw] text-[1.5cqw] text-primary-foreground">
        <Languages className="size-[1.8cqw]" /> T5’s guests prefer বাংলা
      </motion.div>
      <motion.div initial={false} animate={{ opacity: at(4600) ? 1 : 0, y: at(4600) ? 0 : 16 }} transition={{ duration: 0.5, ease }} className="mt-[3cqw] flex items-center justify-center gap-[1cqw] text-[1.9cqw]">
        <Check className="size-[2.2cqw] text-good" /> Both servers get a note, and T5 goes back to Aisha after the visit.
      </motion.div>
    </div>
  )
}

/** 11. Practising privately. */
function Rehearsal({ t, at }: { t: number; at: Beat }) {
  const poor = useCount(t, 2400, 12, 700)
  const good = useCount(t, 5600, 92, 1100)
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1.15fr] items-center gap-[4cqw] px-[6cqw]">
      <div>
        <h2 className="font-display text-[4.6cqw] leading-[1.05]">
          <Words t={t} from={200} text="Practise the hard moments, privately." />
        </h2>
        <Rise show={at(1400)} className="mt-[1.6cqw] max-w-[34cqw] text-[2cqw] leading-snug opacity-85">
          Honest scores on what a reply actually says, and an ideal reply to compare with.
        </Rise>
        <Rise show={at(7000)} className="mt-[1.4cqw] flex items-center gap-[0.8cqw] text-[1.9cqw] text-primary-2">
          <Eye className="size-[2.2cqw]" /> Only the server sees it.
        </Rise>
      </div>
      <div className="space-y-[1.2cqw] text-[1.6cqw]">
        <Rise show={at(500)} className="max-w-[78%] rounded-[1.4cqw] rounded-bl-none bg-hero-foreground/12 px-[1.6cqw] py-[1.1cqw]">
          “My lamb is lukewarm, and we waited forty minutes for it.”
          <div className="mt-[0.3cqw] text-[1.2cqw] opacity-60">A guest</div>
        </Rise>
        <Rise show={at(1800)} className="ml-auto max-w-[78%] rounded-[1.4cqw] rounded-br-none bg-primary px-[1.6cqw] py-[1.1cqw] text-primary-foreground">
          “The chef died, sorry.”
          <div className="mt-[0.5cqw] flex items-center gap-[0.8cqw] text-[1.3cqw]">
            <span className="rounded-full bg-background/90 px-[0.9cqw] py-[0.2cqw] font-semibold text-warn">{at(2400) ? poor : 0}/100</span>
            <span className="opacity-90">An excuse, and it ignores the complaint</span>
          </div>
        </Rise>
        <Rise show={at(4400)} className="ml-auto max-w-[84%] rounded-[1.4cqw] rounded-br-none bg-primary px-[1.6cqw] py-[1.1cqw] text-primary-foreground">
          “I’m so sorry. Let me replace it right away; it’ll be with you in about 10 minutes.”
          <div className="mt-[0.5cqw] flex items-center gap-[0.8cqw] text-[1.3cqw]">
            <span className="rounded-full bg-background/90 px-[0.9cqw] py-[0.2cqw] font-semibold text-good">{at(5600) ? good : 0}/100</span>
            <span className="flex gap-[0.2cqw]">
              {[0, 1, 2].map((s) => (
                <Star key={s} className={cn('size-[1.6cqw] transition-opacity duration-500', at(6400 + s * 250) ? 'opacity-100' : 'opacity-20')} fill="currentColor" />
              ))}
            </span>
          </div>
        </Rise>
      </div>
    </div>
  )
}

const HELLOS = [
  { t: 'Welcome', l: 'English' },
  { t: 'स्वागत है', l: 'हिन्दी' },
  { t: 'स्वागत छ', l: 'नेपाली' },
  { t: 'স্বাগতম', l: 'বাংলা' },
  { t: 'வரவேற்கிறோம்', l: 'தமிழ்' },
  { t: 'Bienvenidos', l: 'Español' },
]

/** 12. Everyone is welcome. */
function Welcome({ t, at }: { t: number; at: Beat }) {
  const i = Math.min(HELLOS.length - 1, Math.floor(Math.max(0, t - 700) / 800))
  return (
    <div className="absolute inset-0 grid place-items-center px-[6cqw]">
      <div className="text-center">
        <h2 className="font-display text-[4cqw] leading-[1.06]">
          <Words t={t} from={150} text="Built for the people who actually work here." />
        </h2>
        <div className="mt-[3cqw] h-[9cqw]">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.4, ease }}>
              <div className="font-display text-[6.4cqw] leading-none text-primary-2">{HELLOS[i].t}</div>
              <div className="mt-[0.8cqw] text-[1.6cqw] opacity-70">{HELLOS[i].l}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-[3cqw] flex flex-wrap justify-center gap-[1.2cqw]">
          {[
            { i: <Volume2 className="size-[2cqw]" />, s: 'Read aloud' },
            { i: <Eye className="size-[2cqw]" />, s: 'Large text' },
            { i: <Bell className="size-[2cqw]" />, s: 'Flash alerts' },
            { i: <Vibrate className="size-[2cqw]" />, s: 'Vibration' },
            { i: <MessageSquareText className="size-[2cqw]" />, s: 'Simple words' },
          ].map((c, k) => (
            <Rise key={c.s} show={at(5000 + k * 250)} className="flex items-center gap-[0.8cqw] rounded-full border border-hero-foreground/25 px-[1.6cqw] py-[0.8cqw] text-[1.6cqw]">
              {c.i} {c.s}
            </Rise>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 13. Close. */
function Close({ t, at }: { t: number; at: Beat }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ x: '60cqw' }} animate={{ x: 0 }} transition={{ duration: 1.4, ease }}>
          <Mascot running={t < 1500} className="w-[16cqw]" speed="var(--hero-foreground)" />
        </motion.div>
        <h2 className="mt-[2cqw] font-display text-[6.2cqw] leading-none">
          <Words t={t} from={1200} step={500} text="Quick. Correct. Together." />
        </h2>
        <Rise show={at(3400)} className="mt-[2.4cqw] text-[2.1cqw] opacity-85">
          <Wordmark className="text-[2.4cqw]" /> · an AI service copilot for fine-dining servers
        </Rise>
        <Rise show={at(4400)} className="mt-[1cqw] text-[1.5cqw] opacity-60">
          OB Project · Working Group B3
        </Rise>
      </div>
    </div>
  )
}

const SCENES: Scene[] = [
  { id: 'hello', ms: 6000, caption: 'TableMate: the right service, at the right time.', render: (t, at) => <Hello t={t} at={at} /> },
  { id: 'tables', ms: 8200, caption: 'A fine-dining server looks after six tables at once, each at a different step.', render: (t, at) => <SixTables t={t} at={at} /> },
  { id: 'slip', ms: 8000, caption: 'They know the standards. In a rush, some still slip.', render: (t, at) => <Slip t={t} at={at} /> },
  { id: 'blame', ms: 8000, caption: 'When the food runs late, the server hears it from the guest and takes the blame, even if the delay began at the pass.', render: (t, at) => <Blame t={t} at={at} /> },
  { id: 'loop', ms: 8200, caption: 'The usual answer is retraining, which fixes what they know, not what the night asks of them.', render: (t, at) => <Loop t={t} at={at} /> },
  { id: 'question', ms: 10500, caption: 'How might we help servers keep every table on track, without blame for what wasn’t theirs?', render: (t, at) => <Question t={t} at={at} /> },
  { id: 'next3', ms: 8000, caption: 'TableMate shows each server only the next three things that matter, in order, with a reason.', render: (t, at) => <NextThree t={t} at={at} /> },
  { id: 'loopback', ms: 8200, caption: 'Kitchen, servers and manager work from the same picture.', render: (t, at) => <Loopback t={t} at={at} /> },
  { id: 'fair', ms: 8000, caption: 'Every delay is credited to whoever controlled that step, so a kitchen delay is never a server’s.', render: (t, at) => <Fair t={t} at={at} /> },
  { id: 'share', ms: 8000, caption: 'The manager can hand a table to a colleague who speaks the guests’ language, or has more room.', render: (t, at) => <Handover t={t} at={at} /> },
  { id: 'practice', ms: 9000, caption: 'Servers practise the hard moments privately, with honest scores and an ideal reply.', render: (t, at) => <Rehearsal t={t} at={at} /> },
  { id: 'welcome', ms: 7500, caption: 'Six languages, read-aloud, large text and alerts that don’t depend on sound.', render: (t, at) => <Welcome t={t} at={at} /> },
  { id: 'close', ms: 7500, caption: 'Quick. Correct. Together.', render: (t, at) => <Close t={t} at={at} /> },
]

const TOTAL = SCENES.reduce((n, s) => n + s.ms, 0)

// ---------------------------------------------------------------------------
// The player

export default function Intro() {
  useRolePage(null)
  const [params] = useSearchParams()
  const first = Math.max(0, Math.min(SCENES.length - 1, Number(params.get('scene') ?? 0) || 0))
  const bare = params.get('bare') === '1'
  const [i, setI] = useState(first)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(params.get('play') !== '0')
  const stage = useRef<HTMLDivElement>(null)
  const scene = SCENES[i]

  // The clock: while playing, time moves on; at a scene's end, the next one begins.
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      setT((x) => x + dt)
    }, 60)
    return () => clearInterval(id)
  }, [playing])
  useEffect(() => {
    if (t < scene.ms) return
    if (i < SCENES.length - 1) {
      setI(i + 1)
      setT(0)
    } else {
      setPlaying(false)
      setT(scene.ms)
    }
  }, [t, i, scene.ms])

  const go = useCallback((n: number) => {
    setI(Math.max(0, Math.min(SCENES.length - 1, n)))
    setT(0)
  }, [])
  const ended = !playing && i === SCENES.length - 1 && t >= scene.ms
  const toggle = useCallback(() => {
    if (ended) {
      go(0)
      setPlaying(true)
    } else setPlaying((p) => !p)
  }, [ended, go])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'ArrowRight') go(i + 1)
      else if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'f') void stage.current?.requestFullscreen?.()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [go, i, toggle])

  const at: Beat = (ms) => t >= ms
  const elapsed = SCENES.slice(0, i).reduce((n, s) => n + s.ms, 0) + Math.min(t, scene.ms)

  return (
    <div className={cn('min-h-dvh bg-background', bare && 'bg-black')}>
      {!bare && <TopNav />}
      <main id="main" className={cn('mx-auto w-full max-w-6xl px-4', bare ? 'max-w-none p-0' : 'py-6')}>
        {!bare && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl md:text-3xl">Meet TableMate</h1>
              <p className="text-sm text-muted-foreground">A {Math.round(TOTAL / 1000 / 6) / 10}-minute film about the problem and what TableMate does about it.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/about">
                <BookOpen /> Read how it works
              </Link>
            </Button>
          </div>
        )}
        <div ref={stage} className="@container relative aspect-video w-full overflow-hidden bg-hero font-sans text-hero-foreground sm:rounded-3xl" role="region" aria-label="TableMate introduction">
          {/* Soft light behind the picture */}
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 70% at 50% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%)' }} aria-hidden />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
              {scene.render(t, at)}
            </motion.div>
          </AnimatePresence>
          {/* Caption */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-[5cqw] pb-[1.6cqw] pt-[5cqw]">
            <p key={scene.id} className="mx-auto max-w-[78cqw] text-center text-[1.55cqw] leading-snug text-hero-foreground/95" aria-live="polite">
              {scene.caption}
            </p>
          </div>
          {ended && !bare && (
            <button type="button" onClick={toggle} className="absolute right-[2cqw] top-[2cqw] flex items-center gap-[0.8cqw] rounded-full bg-primary px-[1.8cqw] py-[0.9cqw] text-[1.5cqw] font-medium text-primary-foreground">
              <RotateCcw className="size-[1.8cqw]" /> Watch again
            </button>
          )}
        </div>

        {/* Controls */}
        <div className={cn('mt-3 flex items-center gap-2', bare && 'hidden')}>
          <Button size="icon" variant="ghost" aria-label="Previous scene" onClick={() => go(i - 1)} disabled={i === 0}>
            <SkipBack />
          </Button>
          <Button size="icon" className="rounded-full" aria-label={playing ? 'Pause' : ended ? 'Watch again' : 'Play'} onClick={toggle}>
            {ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Next scene" onClick={() => go(i + 1)} disabled={i === SCENES.length - 1}>
            <SkipForward />
          </Button>
          <div className="flex min-w-0 flex-1 gap-1" role="group" aria-label="Scenes">
            {SCENES.map((s, k) => (
              <button key={s.id} type="button" onClick={() => go(k)} aria-label={`Scene ${k + 1}: ${s.id}`} aria-current={k === i ? 'true' : undefined} className="group relative h-6 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted transition-[height] group-hover:h-2">
                  <span className="block h-full rounded-full bg-primary" style={{ width: k < i ? '100%' : k === i ? `${Math.min(100, (t / s.ms) * 100)}%` : '0%' }} />
                </span>
              </button>
            ))}
          </div>
          <span className="hidden w-24 text-right text-xs tabular text-muted-foreground sm:block">
            {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')} / {Math.floor(TOTAL / 60000)}:{String(Math.floor((TOTAL % 60000) / 1000)).padStart(2, '0')}
          </span>
          <Button size="icon" variant="ghost" aria-label="Full screen" onClick={() => void stage.current?.requestFullscreen?.()}>
            <Maximize2 />
          </Button>
        </div>
        {!bare && <p className="mt-2 text-xs text-muted-foreground">Space to pause, arrow keys to change scene, F for full screen. Turn Animations off in Settings and the scenes still play, with less movement.</p>}
      </main>
    </div>
  )
}
