// The introduction to TableMate as a hand-drawn explainer film: wobbly pen lines that draw
// themselves, doodle people, and handwriting. It tells the problem first (a server, six tables, a
// rush, the blame, the retraining that doesn't help) and then what TableMate does about it, in the
// same order as the project's problem statement.
//
// Every scene is drawn from a clock (`t`, in milliseconds since the scene began), so Pause freezes
// the picture, any scene can be jumped to, and the same page is what gets recorded as the video.
// With Animations off in Settings, scenes show their finished drawings instead of drawing them.

import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'motion/react'
import { BookOpen, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mascot } from '../brand/marks.tsx'
import { TopNav } from '../components/kit.tsx'
import { usePrefs } from '../lib/prefs.ts'
import { useRolePage } from '../lib/role.ts'
import {
  arrow,
  bubble,
  Canvas,
  clamp01,
  GREEN,
  INK,
  Ink,
  inOutCubic,
  OCHRE,
  outExpo,
  PAPER,
  person,
  plate,
  RED,
  sh,
  Sketch,
  star,
  star5,
  StageProvider,
  sweat,
  table,
  underline,
  useAt,
  useProgress,
  useStage,
  type Shape,
} from './intro/sketch.tsx'

interface Scene {
  id: string
  ms: number
  /** Said aloud by the pictures; kept as text for screen readers. */
  caption: string
  render: () => ReactNode
}

// ---------------------------------------------------------------------------
// Pieces shared by scenes

const AISHA = person({ kind: 'server', mood: 'smile', seed: 3 })
const AISHA_WORRY = person({ kind: 'server', mood: 'worry', seed: 3 })
const AISHA_HAPPY = person({ kind: 'server', mood: 'happy', seed: 3, arms: 'wave' })
const AISHA_JUGGLE = person({ kind: 'server', mood: 'worry', seed: 4, arms: 'up' })
const GUEST_ANGRY = person({ kind: 'guest', mood: 'angry', arms: 'point', seed: 9 })
const CHEF = person({ kind: 'chef', mood: 'flat', seed: 21 })
const MANAGER = person({ kind: 'manager', mood: 'smile', seed: 33 })
const PRIYA = person({ kind: 'server', mood: 'smile', seed: 41 })

const tick = (x: number, y: number, color = GREEN): Shape[] => [sh.path(`M ${x - 22} ${y} L ${x - 6} ${y + 20} L ${x + 26} ${y - 26}`, { stroke: color, strokeWidth: 8, seed: x + y })]
const cross = (x: number, y: number, color = RED): Shape[] => [sh.line(x - 22, y - 22, x + 22, y + 22, { stroke: color, strokeWidth: 8 }), sh.line(x + 22, y - 22, x - 22, y + 22, { stroke: color, strokeWidth: 8 })]

/** A gentle bob, so drawn people feel alive without moving much. */
function useBob(amount = 5, speed = 0.004, phase = 0) {
  const { t } = useStageTime()
  return Math.sin(t * speed + phase) * amount
}
function useStageTime() {
  const s = useStage()
  return s.still ? { ...s, t: 0 } : s
}

/** Text that types itself word by word (for the long question). */
function Typed({ text, x, y, size, start, dur, maxWidth, color = INK }: { text: string; x: number; y: number; size: number; start: number; dur: number; maxWidth: number; color?: string }) {
  const prog = useProgress()
  const p = prog(start, dur)
  if (p <= 0) return null
  const n = Math.ceil(p * text.length)
  return (
    <div className="pointer-events-none absolute whitespace-pre-wrap" style={{ left: `${(x / 1600) * 100}%`, top: `${(y / 900) * 100}%`, width: `${(maxWidth / 1600) * 100}%`, fontSize: `${size / 16}cqw`, color, fontFamily: '"Patrick Hand", cursive', lineHeight: 1.22, transform: 'translateY(-50%)' }}>
      {text.slice(0, n)}
      {p < 1 && <span style={{ color: RED }}>|</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Title

const SPARKS = [star(20, 1), star(14, 2), star(24, 3), star(12, 4)]

function Title() {
  const prog = useProgress()
  const at = useAt()
  const run = outExpo(prog(0, 1500))
  return (
    <>
      <div className="absolute" style={{ left: '50%', top: '6%', width: '22cqw', transform: `translateX(calc(-50% + ${(1 - run) * -62}cqw))` }}>
        <Mascot running={!at(1500)} className="w-full" speed={INK} />
      </div>
      <Canvas>
        <Sketch shapes={SPARKS[0]} x={470} y={250} start={2400} dur={500} />
        <Sketch shapes={SPARKS[1]} x={1180} y={210} start={2600} dur={500} />
        <Sketch shapes={SPARKS[2]} x={1290} y={420} start={2800} dur={500} />
        <Sketch shapes={SPARKS[3]} x={330} y={470} start={3000} dur={500} />
        <Sketch shapes={underline(470, 668, 660, RED, 4)} start={2300} dur={900} />
      </Canvas>
      <Ink x={800} y={560} size={200} font="brush" align="center" start={900} dur={1300}>
        Table<span style={{ color: RED }}>Mate</span>
      </Ink>
      <Ink x={800} y={730} size={54} align="center" start={3200} dur={1400}>
        the right service. at the right time.
      </Ink>
      <Ink x={800} y={810} size={36} align="center" start={4400} dur={1200} color={OCHRE}>
        an AI service copilot for fine-dining servers
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 2. Meet Aisha: six tables

const TABLES: { x: number; y: number; n: string; note: string; fill: string }[] = [
  { x: 290, y: 480, n: 'T1', note: 'needs a greeting', fill: OCHRE },
  { x: 640, y: 350, n: 'T2', note: 'ready to order?', fill: RED },
  { x: 1000, y: 350, n: 'T3', note: 'mains are cooking', fill: OCHRE },
  { x: 1320, y: 480, n: 'T4', note: 'wants the bill!', fill: RED },
  { x: 1400, y: 730, n: 'T5', note: 'check-back due', fill: OCHRE },
  { x: 200, y: 730, n: 'T6', note: 'dessert, maybe?', fill: RED },
]
const TABLE_SHAPES = TABLES.map((tb, i) => table(i + 1, tb.fill))
const WEB = TABLES.map((tb, i) => [sh.line(800, 640, tb.x, tb.y + 40, { strokeLineDash: [4, 16], strokeWidth: 3, seed: i + 50 })])

function MeetAisha() {
  const { t, still } = useStageTime()
  const at = useAt()
  const bob = useBob(4, 0.005)
  const worried = at(4300)
  return (
    <>
      <Canvas>
        {TABLES.map((tb, i) => (
          <g key={tb.n}>
            <Sketch shapes={WEB[i]} start={3400 + i * 160} dur={600} opacity={0.5} />
            <Sketch shapes={TABLE_SHAPES[i]} x={tb.x} y={tb.y} start={1000 + i * 420} dur={700} />
          </g>
        ))}
        <Sketch shapes={worried ? AISHA_WORRY : AISHA} x={800} y={870 + bob} start={300} dur={1500} />
        {worried &&
          [0, 1, 2].map((k) => {
            const cyc = still ? 0.3 : ((t - 4300 + k * 450) % 1350) / 1350
            return <Sketch key={k} shapes={sweat(k + 1)} x={720 - k * 8 + (k % 2) * 160} y={610 + cyc * 50} scale={0.55} opacity={still ? 1 : 1 - cyc} />
          })}
      </Canvas>
      {TABLES.map((tb, i) => (
        <Fragment key={tb.n}>
          <Ink x={tb.x} y={tb.y} size={50} font="brush" align="center" start={1400 + i * 420} dur={400}>
            {tb.n}
          </Ink>
          <Ink x={tb.x} y={tb.y + 104} size={34} align="center" start={1700 + i * 420} dur={700} color={tb.fill === RED ? RED : OCHRE}>
            {tb.note}
          </Ink>
        </Fragment>
      ))}
      <Ink x={140} y={110} size={120} font="brush" start={200} dur={1000}>
        Meet Aisha.
      </Ink>
      <Ink x={150} y={205} size={42} start={1300} dur={1300} color={OCHRE}>
        a fine-dining server. saturday, 9 pm.
      </Ink>
      <Ink x={1500} y={125} size={84} font="brush" align="right" start={5600} dur={1200} color={RED} rotate={-3}>
        6 tables. 1 server.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 3. They know the SOPs, and still slip

const SOPS = ['greet within 2 minutes', 'check back after the food lands', 'warn about a delay', 'clear plates promptly', 'bring the bill when asked']
const PLATES = [0, 1, 2, 3, 4].map((i) => plate(i + 7))
const NOTEBOOK = [
  sh.rect(110, 150, 640, 570, { fill: PAPER, fillStyle: 'solid', seed: 61 }),
  ...[0, 1, 2, 3, 4, 5].map((i) => sh.circle(110, 200 + i * 90, 26, { fill: PAPER, fillStyle: 'solid', seed: 70 + i })),
]
const CRACK = [sh.line(0, 0, 18, 26, { stroke: RED, seed: 81 }), sh.line(18, 26, 6, 48, { stroke: RED, seed: 82 }), sh.line(18, 26, 44, 34, { stroke: RED, seed: 83 }), sh.line(-6, 12, -34, 18, { stroke: RED, seed: 84 })]

function Slip() {
  const { t, still } = useStageTime()
  const at = useAt()
  const cx = 1180
  const cy = 380
  const fall = 5200
  const lost = 2 // which plate drops
  const plates = PLATES.map((s, i) => {
    const a = still ? (i / 5) * Math.PI * 2 : t * 0.0032 + (i / 5) * Math.PI * 2
    let x = cx + Math.cos(a) * 210
    let y = cy + Math.sin(a) * 88 - Math.abs(Math.sin(a)) * 30
    let gone = false
    if (i === lost && (still || t > fall)) {
      const dt = still ? 99999 : t - fall
      const ground = 770
      const g = 0.0016
      const fy = y + 0.5 * g * dt * dt
      if (fy < ground) y = fy
      else {
        const bt = dt - Math.sqrt((2 * (ground - y)) / g) // time since first touch
        const bounce = Math.max(0, 70 * Math.sin(Math.min(bt, 520) * 0.006)) * (bt < 520 ? 1 : 0) // one small playful bounce
        y = ground - bounce
        gone = bt > 520
      }
    }
    return { s, x, y, gone, i }
  })
  return (
    <>
      <Canvas>
        <Sketch shapes={NOTEBOOK} start={200} dur={1200} />
        {SOPS.map((_, i) => (i < 2 ? <Sketch key={i} shapes={tick(190, 345 + i * 84)} start={1700 + i * 450} dur={400} /> : <Sketch key={i} shapes={cross(190, 345 + i * 84)} start={3300 + (i - 2) * 700} dur={450} />))}
        <Sketch shapes={AISHA_JUGGLE} x={cx} y={880} start={900} dur={1400} />
        {plates.map((p) => (
          <Sketch key={p.i} shapes={p.s} x={p.x} y={p.y} start={1600 + p.i * 250} dur={500} rotate={p.i === lost && p.y > 600 ? 12 : Math.sin((t + p.i * 300) * 0.004) * 6} opacity={p.gone ? 0 : 1} />
        ))}
        {at(fall + 1200) && <Sketch shapes={CRACK} x={cx - 90} y={750} start={fall + 1200} dur={500} />}
      </Canvas>
      <Ink x={140} y={105} size={90} font="brush" start={200} dur={1200}>
        She knows the SOPs.
      </Ink>
      <Ink x={190} y={235} size={40} start={800} dur={800} color={OCHRE}>
        learnt on day one
      </Ink>
      {SOPS.map((s, i) => (
        <Ink key={s} x={250} y={345 + i * 84} size={42} start={1500 + i * 450} dur={800}>
          {s}
        </Ink>
      ))}
      {at(5600) && (
        <Ink x={1060} y={850} size={74} font="brush" start={fall + 1000} dur={500} color={RED} rotate={-6}>
          crash!
        </Ink>
      )}
      <Ink x={130} y={790} size={62} font="brush" start={5800} dur={1500} color={RED}>
        knowing was never the problem.
      </Ink>
      <Ink x={130} y={850} size={46} start={7000} dur={1400}>
        holding six tables in one head is.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 4. The food runs late, and the blame lands on her

const FLAME = [sh.path('M 0 0 L 14 -46 L 28 -12 L 44 -62 L 58 -10 L 74 -44 L 88 0 Z', { fill: RED, fillStyle: 'solid', seed: 91 })]
const POT = [sh.rect(0, 0, 120, 70, { fill: OCHRE, fillStyle: 'hachure', hachureGap: 10, seed: 92 }), sh.line(-14, 8, 0, 8, { seed: 93 }), sh.line(120, 8, 134, 8, { seed: 94 })]
const CLOCK = [sh.circle(0, 0, 110, { fill: PAPER, fillStyle: 'solid', seed: 95 }), sh.line(0, 0, 0, -38, { seed: 96 }), sh.line(0, 0, 28, 14, { seed: 97 })]
const PASS = [sh.rect(0, 0, 250, 40, { fill: PAPER, fillStyle: 'solid', seed: 98 }), sh.line(20, 40, 20, 150, { seed: 99 }), sh.line(230, 40, 230, 150, { seed: 100 })]
const STAMP = [sh.rect(0, 0, 330, 120, { stroke: RED, strokeWidth: 8, seed: 101 }), sh.rect(10, 10, 310, 100, { stroke: RED, strokeWidth: 3, seed: 102 })]

function Blame() {
  const at = useAt()
  const bob = useBob(3, 0.006)
  return (
    <>
      <Canvas>
        {/* The kitchen */}
        <Sketch shapes={CHEF} x={210} y={870} scale={0.82} start={600} dur={1100} />
        <Sketch shapes={POT} x={330} y={800} start={1200} dur={600} />
        <Sketch shapes={FLAME} x={348} y={800} start={1700} dur={500} />
        <Sketch shapes={CLOCK} x={300} y={430} scale={0.9} start={2200} dur={800} />
        <Sketch shapes={PASS} x={470} y={650} scale={0.9} start={1400} dur={700} />
        {/* Aisha, none the wiser */}
        <Sketch shapes={at(4800) ? AISHA_WORRY : AISHA} x={810} y={870 + bob} start={900} dur={1200} />
        {at(3600) && <Sketch shapes={bubble(610, 270, 380, 100, 790, 590)} start={3600} dur={900} />}
        {/* The guest, not happy */}
        <Sketch shapes={GUEST_ANGRY} x={1330} y={870} flip start={1100} dur={1200} />
        {at(4200) && <Sketch shapes={bubble(1020, 150, 520, 130, 1260, 560)} start={4200} dur={1000} />}
        {at(5200) && <Sketch shapes={arrow(1150, 700, 930, 700, { stroke: RED, strokeWidth: 7 })} start={5200} dur={700} />}
        {at(5700) && <Sketch shapes={STAMP} x={1010} y={470} scale={0.85} rotate={-8} start={5700} dur={700} />}
        {at(6800) && <Sketch shapes={arrow(400, 250, 330, 360, { stroke: OCHRE, strokeWidth: 5 }, -20)} start={6800} dur={500} />}
      </Canvas>
      <Ink x={130} y={105} size={96} font="brush" start={200} dur={1200}>
        Then the food runs late.
      </Ink>
      <Ink x={300} y={432} size={36} font="brush" align="center" start={2900} dur={500} color={RED}>
        +8 min
      </Ink>
      <Ink x={470} y={625} size={34} start={2100} dur={500} color={OCHRE}>
        the pass
      </Ink>
      <Ink x={130} y={500} size={34} start={2600} dur={900} color={OCHRE}>
        grill is backed up
      </Ink>
      <Ink x={800} y={320} size={36} align="center" start={3800} dur={900} maxWidth={340}>
        huh? nobody told me…
      </Ink>
      <Ink x={1280} y={215} size={44} font="brush" align="center" start={4400} dur={1100} color={RED} maxWidth={480}>
        WHERE IS OUR FOOD?!
      </Ink>
      <Ink x={1150} y={522} size={62} font="brush" align="center" start={5800} dur={500} color={RED} rotate={-8}>
        BLAME
      </Ink>
      <Ink x={130} y={225} size={40} start={6800} dur={1300} color={OCHRE} maxWidth={330}>
        the delay started way over here
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 5. The retraining loop

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return { d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, end: [x1, y1, a1] as const }
}
const LOOP = [0, 1, 2, 3].map((i) => {
  const a0 = -Math.PI / 2 + i * (Math.PI / 2) + 0.28
  const a1 = a0 + Math.PI / 2 - 0.5
  const { d, end } = arcPath(800, 500, 230, a0, a1)
  const [ex, ey, ea] = end
  const hx = ea + Math.PI / 2
  return [sh.path(d, { strokeWidth: 6, seed: 110 + i }), sh.line(ex, ey, ex - 34 * Math.cos(hx - 0.55), ey - 34 * Math.sin(hx - 0.55), { strokeWidth: 6, seed: 120 + i }), sh.line(ex, ey, ex - 34 * Math.cos(hx + 0.55), ey - 34 * Math.sin(hx + 0.55), { strokeWidth: 6, seed: 130 + i })]
})
const LOOP_LABELS = [
  { x: 800, y: 215, t: 'a step slips', c: INK },
  { x: 1180, y: 500, t: 'she gets blamed', c: RED },
  { x: 800, y: 790, t: 'sent to retrain', c: INK },
  { x: 410, y: 500, t: 'same rush. same slip.', c: RED },
]

function Retrain() {
  return (
    <>
      <Canvas>
        {LOOP.map((s, i) => (
          <Sketch key={i} shapes={s} start={900 + i * 1000} dur={900} />
        ))}
      </Canvas>
      <Ink x={130} y={105} size={96} font="brush" start={200} dur={1200}>
        So restaurants retrain her.
      </Ink>
      {LOOP_LABELS.map((l, i) => (
        <Ink key={l.t} x={l.x} y={l.y} size={46} align="center" start={800 + i * 1000} dur={900} color={l.c}>
          {l.t}
        </Ink>
      ))}
      <Ink x={800} y={505} size={64} font="brush" align="center" start={4600} dur={900} color={OCHRE} rotate={-5}>
        again &amp; again
      </Ink>
      <Ink x={800} y={862} size={42} align="center" start={5200} dur={1100} color={RED}>
        retraining fixes what she knows. the night hasn't changed.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 6. The question

const HMW =
  'How might we help fine-dining servers keep every table on track in the middle of a rush, so the standards they already know don’t slip, they aren’t left to find out about kitchen delays from their guests, and they aren’t blamed or retrained for lapses that weren’t theirs?'
const NOTE = [sh.rect(190, 160, 1140, 640, { fill: PAPER, fillStyle: 'solid', seed: 140 }), sh.rect(205, 175, 1110, 610, { strokeWidth: 2, seed: 141 })]
const TAPE = [sh.rect(0, 0, 150, 46, { fill: RED, fillStyle: 'hachure', hachureGap: 8, seed: 142 })]

function Question() {
  const bob = useBob(5, 0.005)
  return (
    <>
      <Canvas>
        <Sketch shapes={NOTE} start={200} dur={1000} rotate={-0.8} x={0} y={0} />
        <Sketch shapes={TAPE} x={600} y={140} rotate={-4} start={1100} dur={500} />
        <Sketch shapes={AISHA_WORRY} x={1430} y={870 + bob} scale={0.78} start={1500} dur={1100} />
        <Sketch shapes={arrow(1250, 560, 1330, 640, { stroke: RED, strokeWidth: 6 }, 20)} start={4500} dur={600} />
      </Canvas>
      <Ink x={260} y={240} size={44} start={900} dur={1100} color={OCHRE}>
        the problem we set out to solve
      </Ink>
      <Typed text={HMW} x={265} y={520} size={54} start={1700} dur={7000} maxWidth={1020} />
      <Ink x={1420} y={330} size={330} font="brush" align="center" start={600} dur={900} color={RED} rotate={12} opacity={0.9}>
        ?
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 7. Meet TableMate: the next three

const PHONE = [
  sh.path('M 930 90 L 1220 90 Q 1260 90 1260 130 L 1260 830 Q 1260 870 1220 870 L 930 870 Q 890 870 890 830 L 890 130 Q 890 90 930 90 Z', { fill: PAPER, fillStyle: 'solid', strokeWidth: 6, seed: 150 }),
  sh.line(1010, 118, 1140, 118, { strokeWidth: 5, seed: 151 }),
]
const CARDS = [
  { y: 190, fill: RED, title: 'Check T2’s order before it’s cooked', sub: 'Galouti kebab has nuts (allergy)', note: 'allergy comes first', icon: '!' },
  { y: 410, fill: OCHRE, title: 'Kitchen: grill is 7 min behind', sub: 'for the whole floor', note: 'heads-up, before they ask', icon: '~' },
  { y: 630, fill: INK, title: 'Welcome T4', sub: 'party of 4 · birthday', note: 'nobody’s been over yet', icon: '+' },
]
const CARD_SHAPES = CARDS.map((c, i) => [sh.rect(920, c.y, 310, 190, { fill: PAPER, fillStyle: 'solid', seed: 160 + i }), sh.circle(970, c.y + 52, 58, { fill: c.fill, fillStyle: 'hachure', hachureGap: 7, seed: 170 + i })])

function NextThree() {
  const prog = useProgress()
  const run = outExpo(prog(0, 1200))
  return (
    <>
      <div className="absolute" style={{ left: '8.5%', top: '9%', width: '8cqw', transform: `translateX(${(1 - run) * -20}cqw)` }}>
        <Mascot running={!useAt()(1300)} className="w-full" speed={INK} />
      </div>
      <Canvas>
        <Sketch shapes={PHONE} start={500} dur={1200} />
        {CARD_SHAPES.map((s, i) => (
          <Sketch key={i} shapes={s} start={1900 + i * 1000} dur={800} />
        ))}
        {CARDS.map((c, i) => (
          <Sketch key={c.note} shapes={arrow(1340, c.y + 95, 1275, c.y + 95, { stroke: RED, strokeWidth: 5 })} start={2800 + i * 1000} dur={500} />
        ))}
        <Sketch shapes={underline(135, 445, 560, RED, 7)} start={3400} dur={900} />
      </Canvas>
      <Ink x={285} y={185} size={92} font="brush" start={300} dur={900}>
        TableMate
      </Ink>
      <Ink x={130} y={385} size={84} font="brush" start={1000} dur={1200}>
        Only the next three.
      </Ink>
      <Ink x={135} y={530} size={44} start={2200} dur={2400} maxWidth={620}>
        it watches the whole floor and shows her just what matters right now, with a reason for each.
      </Ink>
      <Ink x={135} y={720} size={52} font="brush" start={5000} dur={1300} color={RED} maxWidth={620}>
        a nudge she can ignore. never an order.
      </Ink>
      {CARDS.map((c, i) => (
        <div key={c.title}>
          <Ink x={970} y={c.y + 52} size={52} font="brush" align="center" start={2200 + i * 1000} dur={300} color={PAPER}>
            {c.icon}
          </Ink>
          <Ink x={1030} y={c.y + 45} size={28} start={2300 + i * 1000} dur={900} maxWidth={190}>
            {c.title}
          </Ink>
          <Ink x={940} y={c.y + 150} size={26} start={2800 + i * 1000} dur={700} color={OCHRE} maxWidth={280}>
            {c.sub}
          </Ink>
          <Ink x={1350} y={c.y + 95} size={30} start={3000 + i * 1000} dur={900} color={RED} maxWidth={230}>
            {c.note}
          </Ink>
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// 8. Everyone in the same loop

const PEOPLE = [
  { shapes: CHEF, x: 300, y: 790, name: 'kitchen', head: [300, 580] as [number, number] },
  { shapes: AISHA, x: 800, y: 590, name: 'server', head: [800, 380] as [number, number] },
  { shapes: MANAGER, x: 1300, y: 790, name: 'manager', head: [1300, 580] as [number, number] },
]
const LINKS = [
  [PEOPLE[0], PEOPLE[1]],
  [PEOPLE[1], PEOPLE[2]],
  [PEOPLE[0], PEOPLE[2]],
].map(([a, b], i) => [sh.line(a.head[0], a.head[1], b.head[0], b.head[1], { strokeLineDash: [4, 16], strokeWidth: 3, seed: 180 + i })])
const MSGS = [
  { text: 'mains for T3 in 2 min', from: 0, to: 1, at: 2300 },
  { text: 'is the burrata made in-house?', from: 1, to: 0, at: 3900 },
  { text: 'yes! every morning (saved)', from: 0, to: 1, at: 5500 },
  { text: 'T6 asks for the manager', from: 1, to: 2, at: 6900 },
]
const MSG_BUBBLE = (w: number) => bubble(0, 0, w, 70, 20, 90)

function TeamLoop() {
  const { t, still } = useStageTime()
  const bob = useBob(4, 0.005)
  return (
    <>
      <Canvas>
        {LINKS.map((s, i) => (
          <Sketch key={i} shapes={s} start={1800 + i * 300} dur={700} opacity={0.6} />
        ))}
        {PEOPLE.map((p, i) => (
          <Sketch key={p.name} shapes={p.shapes} x={p.x} y={p.y + (i === 1 ? bob : 0)} scale={0.8} start={500 + i * 400} dur={1000} />
        ))}
        {MSGS.map((m) => {
          const p = still ? 1 : clamp01((t - m.at) / 1500)
          if (!still && (t < m.at || t > m.at + 2300)) return null
          const a = PEOPLE[m.from].head
          const b = PEOPLE[m.to].head
          const e = inOutCubic(p)
          const w = m.text.length * 17 + 50
          const x = a[0] + (b[0] - a[0]) * e - w / 2
          const y = a[1] + (b[1] - a[1]) * e - 150
          return <Sketch key={m.text} shapes={MSG_BUBBLE(w)} x={x} y={y} start={still ? 0 : m.at} dur={still ? 1 : 300} />
        })}
      </Canvas>
      <Ink x={130} y={105} size={96} font="brush" start={200} dur={1200}>
        Everyone in the same loop.
      </Ink>
      <Ink x={135} y={200} size={40} start={1100} dur={1900} color={OCHRE} maxWidth={820}>
        delays, sold-out dishes and guests’ questions reach the right person in one tap.
      </Ink>
      {PEOPLE.map((p, i) => (
        <Ink key={p.name} x={p.x + (i === 1 ? -190 : 0)} y={p.y + (i === 1 ? -150 : 58)} size={48} font="brush" align="center" start={1200 + i * 400} dur={500}>
          {p.name}
        </Ink>
      ))}
      {MSGS.map((m) => {
        if (!still && (t < m.at || t > m.at + 2300)) return null
        const p = still ? 1 : clamp01((t - m.at) / 1500)
        const a = PEOPLE[m.from].head
        const b = PEOPLE[m.to].head
        const e = inOutCubic(p)
        return (
          <Ink key={m.text} x={a[0] + (b[0] - a[0]) * e} y={a[1] + (b[1] - a[1]) * e - 115} size={30} align="center" start={still ? 0 : m.at + 150} dur={400}>
            {m.text}
          </Ink>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// 9. Whose delay was it?

const ROWS = [
  { label: 'greeting', w: 130, who: 'floor', v: '1.8 min' },
  { label: 'kitchen prep', w: 400, who: 'kitchen', v: '+8 min late' },
  { label: 'pass to table', w: 120, who: 'floor', v: '1.2 min' },
  { label: 'the bill', w: 170, who: 'floor', v: '2 min' },
]
const BARS = ROWS.map((r, i) => [sh.rect(470, 330 + i * 100, r.w, 54, { fill: r.who === 'kitchen' ? OCHRE : RED, fillStyle: 'hachure', hachureGap: 9, fillWeight: 3, seed: 200 + i }), sh.rect(470, 330 + i * 100, r.w, 54, { seed: 210 + i })])
const AXIS = [sh.line(470, 300, 470, 740, { seed: 220 })]
const STAMP2 = [sh.rect(0, 0, 440, 200, { stroke: RED, strokeWidth: 9, seed: 221 }), sh.rect(12, 12, 416, 176, { stroke: RED, strokeWidth: 3, seed: 222 })]

function Fair() {
  return (
    <>
      <Canvas>
        <Sketch shapes={AXIS} start={600} dur={600} />
        {BARS.map((s, i) => (
          <Sketch key={i} shapes={s} start={1300 + i * 700} dur={800} />
        ))}
        <Sketch shapes={STAMP2} x={1140} y={400} rotate={-6} start={4700} dur={800} />
        <Sketch shapes={AISHA_HAPPY} x={1430} y={880} scale={0.8} start={5800} dur={1100} />
      </Canvas>
      <Ink x={130} y={105} size={104} font="brush" start={200} dur={1200}>
        Whose delay was it?
      </Ink>
      <Ink x={135} y={205} size={42} start={900} dur={1800} color={OCHRE} maxWidth={900}>
        table T3, step by step. each step credited to whoever controlled it.
      </Ink>
      {ROWS.map((r, i) => (
        <div key={r.label}>
          <Ink x={440} y={357 + i * 100} size={42} align="right" start={1200 + i * 700} dur={600}>
            {r.label}
          </Ink>
          <Ink x={490 + r.w} y={357 + i * 100} size={38} start={1900 + i * 700} dur={600} color={r.who === 'kitchen' ? RED : INK}>
            {r.v}
          </Ink>
        </div>
      ))}
      <Ink x={1360} y={462} size={58} font="brush" align="center" start={5000} dur={900} color={RED} rotate={-6}>
        kitchen’s delay.
      </Ink>
      <Ink x={1360} y={535} size={58} font="brush" align="center" start={5600} dur={700} color={RED} rotate={-6}>
        not Aisha’s.
      </Ink>
      <Ink x={135} y={810} size={44} start={7000} dur={1100} color={RED}>
        kitchen delays are never counted against a server.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 10. Sharing the floor

const A_TABLES = [
  { x: 150, y: 400 },
  { x: 330, y: 330 },
  { x: 510, y: 400 },
  { x: 130, y: 590 },
  { x: 500, y: 600 },
]
const A_SHAPES = A_TABLES.map((_, i) => table(230 + i, i === 4 ? RED : OCHRE))
const P_TABLES = [
  { x: 1090, y: 420 },
  { x: 1290, y: 420 },
]
const P_SHAPES = P_TABLES.map((_, i) => table(250 + i, OCHRE))

function Share() {
  const prog = useProgress()
  const at = useAt()
  const bob = useBob(4, 0.005)
  const mv = inOutCubic(prog(3800, 2200))
  // T5 leaves Aisha (500, 600) and lands beside Priya (1110, 700)
  const x5 = 500 + (1110 - 500) * mv
  const y5 = 600 + (700 - 600) * mv - Math.sin(mv * Math.PI) * 160
  return (
    <>
      <Canvas>
        {A_TABLES.slice(0, 4).map((tb, i) => (
          <Sketch key={i} shapes={A_SHAPES[i]} x={tb.x} y={tb.y} scale={0.62} start={1000 + i * 250} dur={600} />
        ))}
        <Sketch shapes={at(3800) ? AISHA : AISHA_WORRY} x={330} y={880 + bob} scale={0.9} start={500} dur={1100} />
        {P_TABLES.map((tb, i) => (
          <Sketch key={i} shapes={P_SHAPES[i]} x={tb.x} y={tb.y} scale={0.62} start={1400 + i * 250} dur={600} />
        ))}
        <Sketch shapes={PRIYA} x={1290} y={880} scale={0.9} start={900} dur={1100} />
        <Sketch shapes={A_SHAPES[4]} x={x5} y={y5} scale={0.62} start={1900} dur={600} />
        {at(2700) && !at(3800) && <Sketch shapes={bubble(540, 440, 300, 90, 510, 570)} start={2700} dur={700} />}
        {at(4500) && <Sketch shapes={bubble(800, 480, 330, 90, 1110, 640)} start={4800} dur={700} />}
        {at(6200) && <Sketch shapes={arrow(560, 760, 1000, 760, { stroke: OCHRE, strokeWidth: 5 }, 30)} start={6200} dur={700} />}
      </Canvas>
      <Ink x={130} y={105} size={104} font="brush" start={200} dur={1100}>
        Sharing the floor.
      </Ink>
      <Ink x={135} y={205} size={42} start={900} dur={1500} color={OCHRE} maxWidth={900}>
        for the load, or for the guests’ language.
      </Ink>
      {A_TABLES.slice(0, 4).map((tb, i) => (
        <Ink key={i} x={tb.x} y={tb.y} size={34} font="brush" align="center" start={1300 + i * 250} dur={300}>
          {`T${i + 1}`}
        </Ink>
      ))}
      <Ink x={x5} y={y5} size={34} font="brush" align="center" start={2100} dur={300}>
        T5
      </Ink>
      {P_TABLES.map((tb, i) => (
        <Ink key={i} x={tb.x} y={tb.y} size={34} font="brush" align="center" start={1700 + i * 250} dur={300}>
          {`T${i + 6}`}
        </Ink>
      ))}
      {!at(3800) && (
        <Ink x={330} y={730} size={38} font="brush" align="center" start={1700} dur={500} color={RED}>
          5 tables!
        </Ink>
      )}
      <Ink x={1290} y={560} size={36} font="brush" align="center" start={2100} dur={600} color={OCHRE}>
        speaks Bengali
      </Ink>
      {at(2700) && !at(3800) && (
        <Ink x={690} y={485} size={36} align="center" start={2900} dur={500} maxWidth={280}>
          guests prefer বাংলা
        </Ink>
      )}
      <Ink x={1005} y={545} size={34} align="center" start={5000} dur={900} maxWidth={300}>
        T5 is yours for this visit
      </Ink>
      <Ink x={800} y={790} size={42} align="center" start={6400} dur={1400} color={RED}>
        both get a note. T5 goes back afterwards.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 11. Practice, privately

const EYE = [sh.curve([[-48, 0], [0, -30], [48, 0], [0, 30], [-48, 0]], { seed: 240 }), sh.circle(0, 0, 22, { fill: INK, fillStyle: 'solid', seed: 241 }), sh.line(-58, 34, 58, -34, { stroke: RED, strokeWidth: 7, seed: 242 })]
const SCORE_BAD = [sh.circle(0, 0, 130, { stroke: RED, strokeWidth: 7, seed: 243 })]
const SCORE_GOOD = [sh.circle(0, 0, 130, { stroke: GREEN, strokeWidth: 7, seed: 244 })]
const STARS = [0, 1, 2].map((i) => star5(32, 250 + i))

function Practice() {
  const prog = useProgress()
  const bad = Math.round(inOutCubic(prog(3500, 600)) * 12)
  const good = Math.round(inOutCubic(prog(6500, 900)) * 92)
  return (
    <>
      <Canvas>
        <Sketch shapes={bubble(140, 170, 640, 140, 220, 340)} start={500} dur={900} />
        <Sketch shapes={bubble(640, 380, 520, 90, 1120, 480)} start={2400} dur={800} />
        <Sketch shapes={SCORE_BAD} x={1330} y={430} scale={0.8} start={3300} dur={600} />
        <Sketch shapes={bubble(330, 570, 700, 150, 1020, 720)} start={5000} dur={900} />
        <Sketch shapes={SCORE_GOOD} x={1330} y={690} scale={0.8} start={6300} dur={600} />
        {STARS.map((s, i) => (
          <Sketch key={i} shapes={s} x={1250 + i * 80} y={830} start={7400 + i * 300} dur={400} />
        ))}
        <Sketch shapes={EYE} x={170} y={820} scale={0.9} start={7700} dur={700} />
      </Canvas>
      <Ink x={130} y={95} size={84} font="brush" start={200} dur={1100}>
        Practise the hard moments.
      </Ink>
      <Ink x={170} y={235} size={42} start={700} dur={1500} maxWidth={580}>
        “my lamb is lukewarm and we waited forty minutes!”
      </Ink>
      <Ink x={690} y={425} size={46} start={2600} dur={1000} color={INK}>
        “the chef died, sorry.”
      </Ink>
      <Ink x={1330} y={430} size={92} font="brush" align="center" start={3500} dur={600} color={RED}>
        {String(bad)}
      </Ink>
      <Ink x={1330} y={540} size={34} align="center" start={4000} dur={900} color={RED} maxWidth={300}>
        an excuse, and it ignores the complaint
      </Ink>
      <Ink x={365} y={645} size={40} start={5200} dur={1500} maxWidth={640}>
        “I’m so sorry. Let me replace it right away; about 10 minutes.”
      </Ink>
      <Ink x={1330} y={690} size={92} font="brush" align="center" start={6400} dur={900} color={GREEN}>
        {String(good)}
      </Ink>
      <Ink x={250} y={822} size={42} start={7900} dur={1100} color={OCHRE}>
        private. only she sees it.
      </Ink>
    </>
  )
}

// ---------------------------------------------------------------------------
// 12. Everyone is welcome

const HELLOS = [
  { t: 'Welcome', l: 'English', x: 300, y: 330 },
  { t: 'स्वागत है', l: 'हिन्दी', x: 800, y: 260 },
  { t: 'স্বাগতম', l: 'বাংলা', x: 1290, y: 330 },
  { t: 'வரவேற்கிறோம்', l: 'தமிழ்', x: 300, y: 560 },
  { t: 'स्वागत छ', l: 'नेपाली', x: 800, y: 520 },
  { t: 'Bienvenidos', l: 'Español', x: 1290, y: 560 },
]
const HELLO_BUBBLES = HELLOS.map((h) => bubble(h.x - 190, h.y - 62, 380, 124, h.x - 120, h.y + 112))
const ICONS = [
  { x: 280, label: 'read aloud', shapes: [sh.path('M -26 -14 L -6 -14 L 22 -36 L 22 36 L -6 14 L -26 14 Z', { seed: 260 }), sh.curve([[36, -18], [48, 0], [36, 18]], { seed: 261 }), sh.curve([[48, -34], [68, 0], [48, 34]], { seed: 262 })] },
  { x: 620, label: 'big text', shapes: [sh.line(-30, 30, 0, -34, { seed: 263 }), sh.line(0, -34, 30, 30, { seed: 264 }), sh.line(-16, 8, 16, 8, { seed: 265 })] },
  { x: 960, label: 'flash alerts', shapes: [sh.path('M -8 -36 L -26 4 L -4 4 L -14 36 L 28 -8 L 4 -8 L 14 -36 Z', { fill: RED, fillStyle: 'solid', seed: 266 })] },
  { x: 1300, label: 'vibration', shapes: [sh.rect(-18, -34, 36, 68, { seed: 267 }), sh.curve([[-34, -20], [-42, 0], [-34, 20]], { seed: 268 }), sh.curve([[34, -20], [42, 0], [34, 20]], { seed: 269 })] },
]

function Welcome() {
  const { t, still } = useStageTime()
  return (
    <>
      <Canvas>
        {HELLO_BUBBLES.map((s, i) => (
          <Sketch key={i} shapes={s} y={still ? 0 : Math.sin(t * 0.003 + i) * 5} start={800 + i * 450} dur={700} />
        ))}
        {ICONS.map((ic, i) => (
          <Sketch key={ic.label} shapes={ic.shapes} x={ic.x} y={745} start={4200 + i * 500} dur={600} />
        ))}
      </Canvas>
      <Ink x={800} y={105} size={86} font="brush" align="center" start={200} dur={1500} maxWidth={1400}>
        built for the people who actually work here.
      </Ink>
      {HELLOS.map((h, i) => (
        <div key={h.l}>
          <Ink x={h.x} y={h.y - 8} size={h.t.length > 11 ? 44 : 56} font="brush" align="center" start={1100 + i * 450} dur={600} color={i % 2 ? RED : INK}>
            {h.t}
          </Ink>
          <Ink x={h.x} y={h.y + 40} size={30} align="center" start={1500 + i * 450} dur={400} color={OCHRE}>
            {h.l}
          </Ink>
        </div>
      ))}
      {ICONS.map((ic, i) => (
        <Ink key={ic.label} x={ic.x} y={822} size={36} align="center" start={4500 + i * 500} dur={600}>
          {ic.label}
        </Ink>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// 13. Close

function Close() {
  const prog = useProgress()
  const at = useAt()
  const run = outExpo(prog(0, 1500))
  const words = [
    { w: 'Quick.', x: 330, c: INK },
    { w: 'Correct.', x: 800, c: RED },
    { w: 'Together.', x: 1280, c: INK },
  ]
  return (
    <>
      <div className="absolute" style={{ left: '50%', top: '4%', width: '21cqw', transform: `translateX(calc(-50% + ${(1 - run) * 60}cqw))` }}>
        <Mascot running={!at(1500)} className="w-full" speed={INK} />
      </div>
      <Canvas>
        {words.map((w, i) => (
          <Sketch key={w.w} shapes={underline(w.x - 190, 640, 380, w.c === RED ? RED : OCHRE, 300 + i)} start={2200 + i * 700} dur={700} />
        ))}
      </Canvas>
      {words.map((w, i) => (
        <Ink key={w.w} x={w.x} y={560} size={140} font="brush" align="center" start={1400 + i * 700} dur={800} color={w.c}>
          {w.w}
        </Ink>
      ))}
      <Ink x={800} y={770} size={48} align="center" start={4300} dur={1500}>
        TableMate · an AI service copilot for fine-dining servers
      </Ink>
      <Ink x={800} y={840} size={36} align="center" start={5400} dur={900} color={OCHRE}>
        OB Project · Working Group B3
      </Ink>
    </>
  )
}

const SCENES: Scene[] = [
  { id: 'title', ms: 6500, caption: 'TableMate: the right service, at the right time.', render: () => <Title /> },
  { id: 'aisha', ms: 8500, caption: 'Meet Aisha, a fine-dining server, on a Saturday night with six tables, each at a different step.', render: () => <MeetAisha /> },
  { id: 'sops', ms: 9500, caption: 'She knows the standards she learnt on day one, but holding six tables in one head, some still slip.', render: () => <Slip /> },
  { id: 'blame', ms: 9000, caption: 'When the food runs late, the guest blames her, even though the delay started in the kitchen and nobody told her.', render: () => <Blame /> },
  { id: 'retrain', ms: 7500, caption: 'The usual answer is retraining, which fixes what she knows but not what the night asks of her.', render: () => <Retrain /> },
  { id: 'question', ms: 10500, caption: 'How might we help servers keep every table on track, without blame for what was never theirs?', render: () => <Question /> },
  { id: 'next3', ms: 8500, caption: 'TableMate shows each server only the next three things that matter, with a reason for each.', render: () => <NextThree /> },
  { id: 'loop', ms: 9000, caption: 'Kitchen, server and manager work from the same picture.', render: () => <TeamLoop /> },
  { id: 'fair', ms: 9000, caption: 'Every delay is credited to whoever controlled that step, so a kitchen delay is never a server’s.', render: () => <Fair /> },
  { id: 'share', ms: 8500, caption: 'The manager can hand a table to a colleague who speaks the guests’ language, or has more room.', render: () => <Share /> },
  { id: 'practice', ms: 9500, caption: 'Servers practise the hard moments privately, with an honest score and an ideal reply.', render: () => <Practice /> },
  { id: 'welcome', ms: 7500, caption: 'Six languages, read-aloud, large text and alerts that do not depend on sound.', render: () => <Welcome /> },
  { id: 'close', ms: 7500, caption: 'Quick. Correct. Together.', render: () => <Close /> },
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
  const [t, setT] = useState(() => Math.max(0, Number(params.get('t') ?? 0) || 0))
  const [playing, setPlaying] = useState(params.get('play') !== '0')
  const stage = useRef<HTMLDivElement>(null)
  const scene = SCENES[i]
  const device = useReducedMotion()
  const still = usePrefs().reduceMotion || !!device

  // The clock: while playing, time moves on every frame; at a scene's end the next one begins.
  useAnimationFrame((_, delta) => {
    if (playing) setT((x) => x + Math.min(delta, 100))
  })
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

  // For rendering the film frame by frame: jump to any scene and moment, paused.
  useEffect(() => {
    if (!bare) return
    const w = window as unknown as { __tm?: { seek: (scene: number, ms: number) => void; scenes: number[] } }
    w.__tm = {
      seek: (n, ms) => {
        setPlaying(false)
        setI(n)
        setT(Math.min(ms, SCENES[n].ms - 1))
      },
      scenes: SCENES.map((x) => x.ms),
    }
    return () => {
      delete w.__tm
    }
  }, [bare])

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

  const ctx = useMemo(() => ({ t, still }), [t, still])
  const elapsed = SCENES.slice(0, i).reduce((n, s) => n + s.ms, 0) + Math.min(t, scene.ms)

  return (
    <div className={cn('min-h-dvh bg-background', bare && 'bg-black')}>
      {!bare && <TopNav />}
      <main id="main" className={cn('mx-auto w-full max-w-6xl px-4', bare ? 'max-w-none p-0' : 'py-6')}>
        {!bare && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl md:text-3xl">Meet TableMate</h1>
              <p className="text-sm text-muted-foreground">A {Math.round(TOTAL / 1000 / 6) / 10}-minute hand-drawn film about the problem and what TableMate does about it.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/about">
                <BookOpen /> Read how it works
              </Link>
            </Button>
          </div>
        )}
        {/* The paper: a fixed look that follows the brand, whichever theme the app is in. */}
        <div
          ref={stage}
          className={cn('@container relative aspect-video w-full overflow-hidden', !bare && 'sm:rounded-3xl')}
          role="region"
          aria-label="TableMate introduction"
          style={{
            background: PAPER,
            color: INK,
            backgroundImage: 'radial-gradient(color-mix(in oklab, var(--chocolate) 14%, transparent) 1.2px, transparent 1.6px)',
            backgroundSize: '2.2cqw 2.2cqw',
          }}
        >
          <StageProvider value={ctx}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}>
                {scene.render()}
              </motion.div>
            </AnimatePresence>
          </StageProvider>
          <p className="sr-only" aria-live="polite" key={scene.id}>
            {scene.caption}
          </p>
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
        {!bare && <p className="mt-2 text-xs text-muted-foreground">Space to pause, arrow keys to change scene, F for full screen. With Animations off in Settings, each scene shows its finished drawing.</p>}
      </main>
    </div>
  )
}
