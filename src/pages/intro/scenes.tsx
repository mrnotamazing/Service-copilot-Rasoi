// The scenes of the TableMate promo film. Each is laid out on a 1600×900 stage and drawn from the
// scene clock, so any moment can be shown, paused or rendered. Copy follows the project's problem
// statement: servers who know the steps but lose them to a busy floor, and who are blamed for delays
// that were never theirs.

import { BellRing, Check, ChefHat, Eye, Lock, ShieldAlert, Sparkles, Type, UserRound, Volume2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Mascot } from '../../brand/marks.tsx'
import { Card, clamp01, Headline, inOutCubic, outExpo, Phone, Pill, Reveal, Sub, useAt, useClock, useProgress, W } from './kit.tsx'

const UI = 'var(--font-display)'
const lerp = (a: number, b: number, p: number) => a + (b - a) * p

/** The press of a button: a quick dip and back, at `at`. */
function usePress(at: number) {
  const { t, still } = useClock()
  if (still) return 1
  const d = t - at
  return d < 0 || d > 260 ? 1 : 1 - 0.06 * Math.sin((d / 260) * Math.PI)
}

// ---------------------------------------------------------------------------
// 1. Open

function Open() {
  const prog = useProgress()
  const at = useAt()
  const run = outExpo(prog(0, 1500))
  return (
    <>
      <div className="absolute" style={{ left: 520, top: 120, width: 560, color: 'var(--chocolate)', transform: `translateX(${(1 - run) * -1300}px)` }}>
        <Mascot running={!at(1500)} className="w-full" speed="var(--chocolate)" />
      </div>
      <Reveal at={1300} dur={1000} dy={36} style={{ left: 0, top: 470, width: W }}>
        <div className="text-center font-display font-semibold tracking-[-0.035em]" style={{ fontSize: 196, lineHeight: 1, color: 'var(--chocolate)' }} translate="no">
          Table<span style={{ color: 'var(--tomato)' }}>Mate</span>
        </div>
      </Reveal>
      <Reveal at={2400} style={{ left: 0, top: 725, width: W }}>
        <div className="text-center font-medium uppercase" style={{ fontSize: 34, letterSpacing: '0.3em', color: 'var(--chocolate)' }}>
          The right service. At the right time.
        </div>
      </Reveal>
      <Reveal at={3600} style={{ left: 0, top: 800, width: W }}>
        <div className="text-center" style={{ fontSize: 30, color: 'var(--muted-foreground)' }}>
          The AI copilot for fine-dining servers
        </div>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 2. The pressure: six tables, one head

const NEEDS: { n: number; need: string; tone: 'primary' | 'kitchen' | 'muted' }[] = [
  { n: 1, need: 'Greet', tone: 'kitchen' },
  { n: 2, need: 'Order in', tone: 'primary' },
  { n: 3, need: 'Mains up', tone: 'kitchen' },
  { n: 4, need: 'The bill!', tone: 'primary' },
  { n: 5, need: 'Check back', tone: 'muted' },
  { n: 6, need: 'Dessert?', tone: 'primary' },
]

/** Seats around each table: how many guests sit down, and when the table fills (ms into the scene). */
const SEATING = [
  { seats: 2, at: 1300 },
  { seats: 4, at: 1900 },
  { seats: 3, at: 2500 },
  { seats: 4, at: 3100 },
  { seats: 2, at: 3600 },
  { seats: 4, at: 4100 },
]

/**
 * "Imagine a Saturday night. The restaurant is full": a small floor that fills up table by table
 * while the clock runs into service, then gives way to the six tables' needs in the same places.
 */
function FullHouse() {
  const { t, still } = useClock()
  const prog = useProgress()
  if (still) return null
  const fade = 1 - clamp01((t - 6250) / 500)
  if (fade <= 0) return null
  // 7:52 pm to 8:04 pm across the opening.
  const mins = Math.min(12, Math.floor(clamp01((t - 400) / 5600) * 12))
  const clock = `${mins < 8 ? 7 : 8}:${String(mins < 8 ? 52 + mins : mins - 8).padStart(2, '0')} pm`
  const full = outExpo(prog(4500, 700))
  return (
    <div className="absolute inset-0" style={{ opacity: fade }}>
      <Reveal at={350} style={{ left: 880, top: 92, width: 660 }}>
        <div className="flex items-center justify-between">
          <Pill tone="muted" size={24}>
            <span className="tabular">Sat · {clock}</span>
          </Pill>
          <span style={{ opacity: full, transform: `scale(${0.6 + full * 0.4}) rotate(${(1 - full) * -8}deg)`, transformOrigin: 'right center' }}>
            <Pill tone="primary" size={24}>Full house</Pill>
          </span>
        </div>
      </Reveal>
      {SEATING.map((tb, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = 960 + col * 215
        const cy = 250 + row * 270 + 65
        const table = outExpo(prog(500 + i * 120, 600))
        const filled = outExpo(prog(tb.at, 500))
        return (
          <div key={i} className="absolute" style={{ left: cx - 110, top: cy - 110, width: 220, height: 220, opacity: table, transform: `scale(${0.85 + table * 0.15})` }}>
            {Array.from({ length: tb.seats }, (_, s) => {
              const angle = (s / tb.seats) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.4 : 0)
              const d = outExpo(prog(tb.at + s * 90, 450))
              const r = 82 + (1 - d) * 60
              return (
                <span
                  key={s}
                  className="absolute rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    left: 110 + Math.cos(angle) * r - 17,
                    top: 110 + Math.sin(angle) * r - 17,
                    opacity: d,
                    background: s % 2 ? 'var(--tomato)' : 'var(--chocolate)',
                    boxShadow: '0 6px 14px -8px color-mix(in oklab, var(--chocolate) 60%, transparent)',
                  }}
                />
              )
            })}
            <div
              className="absolute grid place-items-center rounded-full"
              style={{
                left: 45,
                top: 45,
                width: 130,
                height: 130,
                background: 'var(--card)',
                border: `3px solid ${filled > 0.5 ? 'var(--primary)' : 'var(--border)'}`,
                boxShadow: `0 16px 30px -20px color-mix(in oklab, var(--chocolate) 50%, transparent), 0 0 0 ${filled * (1 - filled) * 40}px color-mix(in oklab, var(--primary) 18%, transparent)`,
              }}
            >
              <span className="font-display font-semibold" style={{ fontSize: 30, color: 'var(--muted-foreground)', opacity: 1 - filled * 0.4 }}>
                T{i + 1}
              </span>
            </div>
          </div>
        )
      })}
      <Reveal at={5200} style={{ left: 880, top: 790, width: 660 }}>
        <div className="flex items-center gap-2 font-medium" style={{ fontSize: 26, color: 'var(--chocolate)' }}>
          <Sparkles size={24} style={{ color: 'var(--tomato)' }} aria-hidden /> Service has to be just right.
        </div>
      </Reveal>
    </div>
  )
}

function Pressure() {
  const { t, still } = useClock()
  return (
    <>
      {/* Each line lands on the words of the voice-over: "a Saturday night", "six tables", "one server". */}
      <Headline lines={['Saturday night.']} x={110} y={285} size={112} start={300} width={820} />
      <FullHouse />
      <Headline lines={['Six tables.']} x={110} y={285 + 117} size={112} start={6700} width={820} />
      <Headline lines={['One head.']} x={110} y={285 + 234} size={112} start={9700} accent={0} width={820} />
      {NEEDS.map((x, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = 960 + col * 215
        const cy = 250 + row * 270
        const ring = still || t < 7600 ? 0 : ((t - 7600 + i * 260) % 1500) / 1500
        return (
          <Reveal key={x.n} at={6900 + i * 330} style={{ left: cx - 100, top: cy, width: 200 }}>
            <div className="relative mx-auto grid place-items-center rounded-full" style={{ width: 130, height: 130, background: 'var(--card)', border: '3px solid var(--border)', boxShadow: '0 16px 30px -20px color-mix(in oklab, var(--chocolate) 50%, transparent)' }}>
              {x.tone === 'primary' && ring > 0 && <span className="absolute inset-0 rounded-full" style={{ border: '3px solid var(--primary)', opacity: 1 - ring, transform: `scale(${1 + ring * 0.45})` }} />}
              <span className="font-display font-semibold" style={{ fontSize: 46, color: 'var(--chocolate)' }}>
                {x.n}
              </span>
            </div>
            <div className="mt-5 text-center">
              <Pill tone={x.tone}>{x.need}</Pill>
            </div>
          </Reveal>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// 3. When service slips, the server takes the blame

function Slip() {
  const prog = useProgress()
  const a = outExpo(prog(1900, 700))
  const x = outExpo(prog(3800, 500))
  return (
    <>
      <Headline lines={['When service slips,', 'the server takes', 'the blame.']} x={110} y={265} size={86} start={300} step={550} accent={2} width={760} />
      <Sub at={2300} x={114} y={600} width={640}>
        Even when the delay was never theirs.
      </Sub>

      <Reveal at={900} style={{ left: 880, top: 120, width: 600 }}>
        <Card style={{ padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22 }}>
          <span className="grid place-items-center rounded-2xl" style={{ width: 70, height: 70, background: 'color-mix(in oklab, var(--kitchen) 14%, transparent)', color: 'var(--kitchen)' }}>
            <ChefHat size={36} aria-hidden />
          </span>
          <div className="flex-1">
            <div className="font-semibold" style={{ fontSize: 31 }}>
              Kitchen · Table 4
            </div>
            <div style={{ fontSize: 24, color: 'var(--muted-foreground)' }}>Mains held up at the grill</div>
          </div>
          <Pill tone="kitchen" size={28}>
            +14 min
          </Pill>
        </Card>
      </Reveal>

      <div className="absolute" style={{ left: 1180, top: 300, width: 4, height: 80, background: 'repeating-linear-gradient(var(--muted-foreground) 0 8px, transparent 8px 18px)', opacity: a * 0.8 }} />
      <Reveal at={1900} style={{ left: 1210, top: 318, width: 300 }}>
        <span style={{ fontSize: 24, color: 'var(--muted-foreground)' }}>and no one told them</span>
      </Reveal>

      <Reveal at={2600} style={{ left: 880, top: 390, width: 600 }}>
        <Card style={{ padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22 }}>
          <span className="grid place-items-center rounded-2xl" style={{ width: 70, height: 70, background: 'color-mix(in oklab, var(--chocolate) 8%, transparent)', color: 'var(--chocolate)' }}>
            <UserRound size={36} aria-hidden />
          </span>
          <div className="font-semibold" style={{ fontSize: 33, lineHeight: 1.2 }}>
            “Where is our food?”
          </div>
        </Card>
      </Reveal>

      <div className="absolute" style={{ left: 1180, top: 570, width: 4, height: 60, background: 'repeating-linear-gradient(var(--muted-foreground) 0 8px, transparent 8px 18px)', opacity: clamp01((prog(3400, 400))) * 0.8 }} />

      <Reveal at={3800} style={{ left: 880, top: 640, width: 600 }}>
        <Card style={{ padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22, borderColor: 'color-mix(in oklab, var(--primary) 45%, transparent)' }}>
          <span className="grid place-items-center rounded-full font-display font-semibold" style={{ width: 70, height: 70, background: 'var(--accent)', color: 'var(--accent-foreground)', fontSize: 32 }}>
            A
          </span>
          <div className="flex-1">
            <div className="font-semibold" style={{ fontSize: 31 }}>
              Aisha gets the blame
            </div>
            <div style={{ fontSize: 24, color: 'var(--muted-foreground)' }}>For a step they didn’t control</div>
          </div>
          <span className="grid place-items-center rounded-full" style={{ width: 54, height: 54, background: 'var(--primary)', color: 'var(--primary-foreground)', transform: `scale(${0.7 + x * 0.3})`, opacity: x }}>
            <X size={30} strokeWidth={3} aria-hidden />
          </span>
        </Card>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 4. The next three moves

interface Move {
  title: string
  why: string
}
const MOVES: Move[] = [
  { title: 'Greet Table 4', why: 'Seated 90 seconds ago' },
  { title: 'Check back on Table 2', why: 'Mains went out 2 min ago' },
  { title: 'Bring the bill to Table 6', why: 'Asked for it 1 min ago' },
  { title: 'Offer dessert at Table 1', why: 'Plates cleared, no order yet' },
]
const SLOT_Y = [112, 328, 494]

function MoveCard({ m, slot, opacity, x = 0, y = 0, lead, press }: { m: Move; slot: number; opacity: number; x?: number; y?: number; lead: boolean; press: number }) {
  return (
    <div className="absolute" style={{ left: 16, top: slot, width: 344, opacity, transform: `translate(${x}px, ${y}px)` }}>
      <div style={{ background: 'var(--card)', borderRadius: 24, border: lead ? '3px solid var(--primary)' : '2px solid var(--border)', padding: '18px 20px', minHeight: lead ? undefined : 150, boxShadow: lead ? '0 16px 30px -20px color-mix(in oklab, var(--primary) 60%, transparent)' : undefined }}>
        <div className="font-semibold" style={{ fontSize: 28, lineHeight: 1.15 }}>
          {m.title}
        </div>
        <div className="mt-2 flex items-start gap-2" style={{ fontSize: 21, color: 'var(--muted-foreground)', lineHeight: 1.25 }}>
          <Sparkles size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden />
          <span>{m.why}</span>
        </div>
        {lead && (
          <div className="mt-4 text-center font-medium" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 999, padding: '10px 0', fontSize: 24, transform: `scale(${press})` }}>
            Done
          </div>
        )}
      </div>
    </div>
  )
}

function NextThree() {
  const prog = useProgress()
  const press = usePress(4800)
  const out = inOutCubic(prog(5200, 600))
  const shift = inOutCubic(prog(5500, 700))
  const enter = outExpo(prog(6300, 800))
  const arrive = (i: number) => outExpo(prog(1000 + i * 320, 800))
  const y = (from: number, to: number) => lerp(SLOT_Y[from], SLOT_Y[to], shift)
  return (
    <>
      <Headline lines={['Your next', 'three moves.']} x={110} y={200} size={118} start={300} step={600} accent={1} width={760} />
      <Sub at={1700} x={114} y={490} width={660}>
        Only what matters now, in the order guests need it, each with the reason why.
      </Sub>
      <Reveal at={2700} style={{ left: 114, top: 650 }}>
        <Pill tone="primary" size={30}>
          Suggestions, never orders
        </Pill>
      </Reveal>

      <Reveal at={500} dy={60} dur={1100} style={{ left: 940, top: 30 }}>
        <Phone w={400} h={700} style={{ position: 'relative' }}>
          <div className="flex items-baseline justify-between" style={{ padding: '30px 24px 0' }}>
            <span className="font-display font-semibold" style={{ fontSize: 34 }}>
              Next up
            </span>
            <span style={{ fontSize: 22, color: 'var(--muted-foreground)' }}>{shift > 0.5 ? '1 done' : '0 done'}</span>
          </div>
          <MoveCard m={MOVES[0]} slot={SLOT_Y[0]} opacity={arrive(0) * (1 - out)} y={-out * 34} lead press={press} />
          <MoveCard m={MOVES[1]} slot={y(1, 0)} opacity={arrive(1)} lead={shift > 0.9} press={1} />
          <MoveCard m={MOVES[2]} slot={y(2, 1)} opacity={arrive(2)} lead={false} press={1} />
          <MoveCard m={MOVES[3]} slot={SLOT_Y[2]} opacity={enter} x={(1 - enter) * 60} lead={false} press={1} />
        </Phone>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 5. Safe before fast

function Safety() {
  const prog = useProgress()
  const press = usePress(3000)
  const travel = inOutCubic(prog(3000, 800))
  const answered = prog(5400, 500) > 0
  const seen = outExpo(prog(3900, 600))
  return (
    <>
      <Headline lines={['Safe before', 'fast.']} x={110} y={250} size={124} start={300} step={600} accent={1} width={760} />
      <Sub at={1500} x={114} y={540} width={640}>
        A nut allergy at the table and a dish with nuts on the order: flagged the moment it is fired. A rule, never an AI guess.
      </Sub>

      <Reveal at={900} style={{ left: 860, top: 100, width: 640 }}>
        <Card style={{ padding: 30, borderColor: answered ? 'var(--border)' : 'color-mix(in oklab, var(--destructive) 55%, transparent)', borderWidth: 3 }}>
          <div className="flex items-center gap-4">
            <span className="grid place-items-center rounded-2xl" style={{ width: 62, height: 62, background: 'color-mix(in oklab, var(--destructive) 12%, transparent)', color: 'var(--destructive)' }}>
              <ShieldAlert size={34} aria-hidden />
            </span>
            <div>
              <div className="font-semibold" style={{ fontSize: 31 }}>
                Priya has a nut allergy
              </div>
              <div style={{ fontSize: 24, color: 'var(--muted-foreground)' }}>Table 3 · Satay skewers are on the order</div>
            </div>
          </div>
          <div className="mt-6 text-center font-medium" style={{ background: answered ? 'var(--good)' : 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 999, padding: '13px 0', fontSize: 27, transform: `scale(${press})` }}>
            {answered ? 'Kitchen confirmed' : 'Tell the kitchen'}
          </div>
        </Card>
      </Reveal>

      <div className="absolute" style={{ left: 1178, top: 390, width: 4, height: 120, background: 'repeating-linear-gradient(var(--muted-foreground) 0 8px, transparent 8px 18px)', opacity: 0.7 * clamp01(prog(2800, 400)) }} />
      <div className="absolute rounded-full" style={{ left: 1170, top: 384 + travel * 118, width: 20, height: 20, background: 'var(--primary)', opacity: travel > 0 && travel < 1 ? 1 : 0 }} />

      <Reveal at={3900} style={{ left: 860, top: 520, width: 640 }}>
        <Card style={{ padding: 30, opacity: seen }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-semibold" style={{ fontSize: 29, color: 'var(--kitchen)' }}>
              <ChefHat size={32} aria-hidden /> Kitchen · Table 3
            </div>
            <Pill tone="muted">fired 0:12</Pill>
          </div>
          <div className="mt-5 flex items-center justify-between" style={{ background: 'var(--muted)', borderRadius: 18, padding: '18px 22px' }}>
            <span className="font-medium" style={{ fontSize: 29 }}>
              Satay skewers
            </span>
            <Pill tone="primary" size={24}>
              <ShieldAlert size={22} aria-hidden /> nut allergy
            </Pill>
          </div>
          <Reveal at={5400} dy={14} style={{ position: 'relative', marginTop: 18 }}>
            <div className="flex items-center gap-3" style={{ fontSize: 26, color: 'var(--good)' }}>
              <Check size={30} strokeWidth={3} aria-hidden /> Chef: swapped the sauce, no nuts
            </div>
          </Reveal>
        </Card>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 6. Fair delays

const STEPS: { step: string; time: string; who: 'Floor' | 'Kitchen'; late?: boolean }[] = [
  { step: 'Greeted', time: '0:42', who: 'Floor' },
  { step: 'Order sent to the kitchen', time: '1:05', who: 'Floor' },
  { step: 'Mains ready', time: '+14:00', who: 'Kitchen', late: true },
  { step: 'Bill brought', time: '1:50', who: 'Floor' },
]

function Fair() {
  const prog = useProgress()
  const bar = outExpo(prog(4300, 1200))
  const count = Math.round(14 * clamp01(prog(4300, 1200)))
  return (
    <>
      <Headline lines={['Delays go to whoever', 'controlled the step.']} x={110} y={80} size={88} start={300} step={550} accent={1} width={1300} />
      <Sub at={1500} x={114} y={285} width={1100} size={31}>
        Every finished table leaves a receipt: each step against its standard, credited to the kitchen or the floor.
      </Sub>

      <Reveal at={1900} style={{ left: 110, top: 398, width: 1380 }}>
        <Card style={{ height: 392, padding: '30px 44px', display: 'flex', gap: 56 }}>
          <div style={{ width: 700 }}>
            <div className="font-semibold" style={{ fontSize: 31, marginBottom: 10 }}>
              Table 4 · 1 h 42 min
            </div>
            {STEPS.map((s, i) => (
              <Reveal key={s.step} at={2400 + i * 450} dy={16} style={{ position: 'relative' }}>
                <div className="flex items-center gap-4" style={{ height: 62, borderTop: i ? '2px solid var(--border)' : undefined, fontSize: 27 }}>
                  <span className="grid place-items-center rounded-full" style={{ width: 34, height: 34, background: s.late ? 'color-mix(in oklab, var(--kitchen) 18%, transparent)' : 'color-mix(in oklab, var(--good) 16%, transparent)', color: s.late ? 'var(--kitchen)' : 'var(--good)' }}>
                    {s.late ? <span style={{ fontSize: 22, fontWeight: 700 }}>!</span> : <Check size={22} strokeWidth={3} aria-hidden />}
                  </span>
                  <span className="flex-1">{s.step}</span>
                  <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                    {s.time}
                  </span>
                  <Pill tone={s.who === 'Kitchen' ? 'kitchen' : 'muted'} size={22} style={{ width: 128, justifyContent: 'center' }}>
                    {s.who}
                  </Pill>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="flex-1" style={{ paddingTop: 6 }}>
            <div style={{ fontSize: 26, color: 'var(--muted-foreground)' }}>Where the extra time went</div>
            <div className="font-display font-semibold tabular-nums" style={{ fontSize: 96, lineHeight: 1.1, marginTop: 8, color: 'var(--kitchen)' }}>
              {count} min
            </div>
            <div style={{ fontSize: 26, color: 'var(--kitchen)' }}>in the kitchen</div>
            <div className="mt-6 flex overflow-hidden" style={{ height: 40, borderRadius: 20, background: 'var(--muted)' }}>
              <div style={{ width: `${bar * 87}%`, background: 'var(--kitchen-mark)' }} />
              <div style={{ width: `${bar * 13}%`, background: 'var(--floor-mark)' }} />
            </div>
            <div className="mt-6">
              <Reveal at={5800} dy={14} style={{ position: 'relative' }}>
                <Pill tone="good" size={26}>
                  <Check size={24} strokeWidth={3} aria-hidden /> Aisha’s steps: all within standard
                </Pill>
              </Reveal>
            </div>
          </div>
        </Card>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 7. The manager: the floor, not a leaderboard

function Table({ n, x, y, tone }: { n: string; x: number; y: number; tone?: 'move' | 'moved' }) {
  const ring = tone === 'moved' ? 'var(--good)' : tone === 'move' ? 'var(--primary)' : 'var(--border)'
  return (
    <div className="absolute grid place-items-center rounded-full font-display font-semibold" style={{ left: x, top: y, width: 86, height: 86, background: 'var(--card)', border: `4px solid ${ring}`, fontSize: 28 }}>
      {n}
    </div>
  )
}

function Manager() {
  const prog = useProgress()
  const press = usePress(3800)
  const move = inOutCubic(prog(4200, 1100))
  const moved = prog(5300, 500) > 0
  const x = lerp(215, 512, move)
  const y = lerp(270, 285, move)
  const aisha = moved ? 3 : 4
  const meera = moved ? 3 : 2
  return (
    <>
      <Headline lines={['The floor,', 'not a leaderboard.']} x={110} y={200} size={80} start={300} step={600} accent={1} width={680} />
      <Sub at={1800} x={114} y={470} width={620}>
        Managers see where help is needed. Never a ranking of people.
      </Sub>
      <Reveal at={2600} style={{ left: 114, top: 620 }}>
        <Pill tone="primary" size={30}>
          No rankings. Ever.
        </Pill>
      </Reveal>

      <Reveal at={700} style={{ left: 800, top: 60, width: 700 }}>
        <Card style={{ height: 500, position: 'relative' }}>
          {[
            { name: 'Aisha', left: 28, count: aisha },
            { name: 'Meera', left: 366, count: meera },
          ].map((r) => (
            <div key={r.name} className="absolute" style={{ left: r.left, top: 28, width: 304, height: 444, borderRadius: 22, border: '3px dashed var(--border)', background: 'var(--muted)' }}>
              <div className="flex items-center justify-between" style={{ padding: '14px 18px', fontSize: 24 }}>
                <span className="font-semibold">{r.name}’s section</span>
                <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  {r.count} tables
                </span>
              </div>
            </div>
          ))}
          <Table n="T1" x={60} y={130} />
          <Table n="T2" x={226} y={130} />
          <Table n="T3" x={60} y={290} />
          <Table n="T5" x={398} y={130} />
          <Table n="T6" x={564} y={130} />
          <div className="absolute" style={{ left: x, top: y }}>
            <Table n="T4" x={0} y={0} tone={moved ? 'moved' : 'move'} />
            <span className="absolute font-medium" style={{ left: -4, top: -40, width: 100, textAlign: 'center', fontSize: 24, color: 'var(--primary)', opacity: moved ? 0 : 1 }}>
              हिन्दी
            </span>
          </div>
        </Card>
      </Reveal>

      <Reveal at={2900} style={{ left: 800, top: 590, width: 700 }}>
        <Card style={{ padding: '24px 30px', display: 'flex', alignItems: 'center', gap: 24, height: 180 }}>
          <span className="grid shrink-0 place-items-center rounded-2xl" style={{ width: 62, height: 62, background: 'var(--accent)', color: 'var(--primary)' }}>
            <Sparkles size={34} aria-hidden />
          </span>
          <div className="flex-1">
            {moved ? (
              <div className="flex items-center gap-3 font-semibold" style={{ fontSize: 28, color: 'var(--good)' }}>
                <Check size={32} strokeWidth={3} aria-hidden /> Handed to Meera for this visit. It returns to Aisha after.
              </div>
            ) : (
              <>
                <div className="font-semibold" style={{ fontSize: 28, lineHeight: 1.2 }}>
                  Table 4 speaks Hindi. Meera does, and has the lighter section.
                </div>
                <div className="mt-4 inline-block font-medium" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 999, padding: '9px 28px', fontSize: 24, transform: `scale(${press})` }}>
                  Hand to Meera
                </div>
              </>
            )}
          </div>
        </Card>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 8. Practice, privately

const REPLY = 'Thank you for telling me. Let me check with the chef and come straight back.'

function Practice() {
  const prog = useProgress()
  const typed = REPLY.slice(0, Math.ceil(REPLY.length * prog(2200, 2000)))
  const score = Math.round(86 * outExpo(prog(4800, 1400)))
  const R = 70
  const C = 2 * Math.PI * R
  return (
    <>
      <Headline lines={['Practise the hard', 'moments. Privately.']} x={110} y={250} size={90} start={300} step={600} accent={1} width={820} />
      <Sub at={1800} x={114} y={530} width={700}>
        Real scenes from the floor, an honest score and an ideal reply to compare with.
      </Sub>

      <Reveal at={700} style={{ left: 900, top: 60, width: 610 }}>
        <Card style={{ height: 720, padding: 34, position: 'relative' }}>
          <Reveal at={1100} dy={16} style={{ position: 'relative', width: 430 }}>
            <div style={{ background: 'var(--muted)', borderRadius: '26px 26px 26px 8px', padding: '18px 24px', fontSize: 27, lineHeight: 1.3 }}>Is the satay safe for me? I’m allergic to nuts.</div>
          </Reveal>
          {prog(2100, 100) > 0 && (
            <div className="absolute" style={{ right: 34, top: 176, width: 460, background: 'var(--accent)', color: 'var(--accent-foreground)', borderRadius: '26px 26px 8px 26px', padding: '18px 24px', fontSize: 27, lineHeight: 1.3, minHeight: 74 }}>
              {typed}
            </div>
          )}
          <Reveal at={4600} style={{ left: 34, top: 400, width: 540 }}>
            <div className="flex items-center gap-8">
              <svg width="190" height="190" viewBox="0 0 190 190" aria-hidden>
                <circle cx="95" cy="95" r={R} fill="none" stroke="var(--muted)" strokeWidth="18" />
                <circle cx="95" cy="95" r={R} fill="none" stroke="var(--good)" strokeWidth="18" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 95 95)" />
                <text x="95" y="108" textAnchor="middle" fontFamily={UI} fontWeight="600" fontSize="52" fill="var(--chocolate)">
                  {score}
                </text>
              </svg>
              <div style={{ fontSize: 26, lineHeight: 1.4 }}>
                <Reveal at={5800} dy={12} style={{ position: 'relative' }}>
                  <div className="flex items-center gap-3">
                    <Check size={28} strokeWidth={3} style={{ color: 'var(--good)' }} aria-hidden /> Named the allergy
                  </div>
                </Reveal>
                <Reveal at={6200} dy={12} style={{ position: 'relative' }}>
                  <div className="flex items-center gap-3">
                    <Check size={28} strokeWidth={3} style={{ color: 'var(--good)' }} aria-hidden /> Went to the chef
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>
          <Reveal at={6600} style={{ left: 34, top: 650 }}>
            <Pill tone="muted" size={25}>
              <Lock size={24} aria-hidden /> Only the server sees this
            </Pill>
          </Reveal>
        </Card>
      </Reveal>
    </>
  )
}

// ---------------------------------------------------------------------------
// 9. For everyone

const LANGS = ['English', 'हिन्दी', 'தமிழ்', 'বাংলা', 'Español', 'नेपाली']
const ACCESS: { icon: ReactNode; label: string }[] = [
  { icon: <Volume2 size={36} aria-hidden />, label: 'Read aloud' },
  { icon: <Type size={36} aria-hidden />, label: 'Large text' },
  { icon: <Eye size={36} aria-hidden />, label: 'Colour-safe' },
  { icon: <BellRing size={36} aria-hidden />, label: 'Flash alerts' },
]

function Everyone() {
  return (
    <>
      <Headline lines={['Made for', 'every server.']} x={110} y={250} size={120} start={300} step={600} accent={1} width={760} />
      <Sub at={1500} x={114} y={560} width={640}>
        In their language, at their pace, in a way that works for them.
      </Sub>
      {LANGS.map((l, i) => (
        <Reveal key={l} at={900 + i * 230} style={{ left: 880 + (i % 2) * 330, top: 90 + Math.floor(i / 2) * 130, width: 300 }}>
          <Card style={{ height: 100, display: 'grid', placeItems: 'center', borderRadius: 24 }}>
            <span className="font-semibold" style={{ fontSize: 40 }}>
              {l}
            </span>
          </Card>
        </Reveal>
      ))}
      {ACCESS.map((a, i) => (
        <Reveal key={a.label} at={2300 + i * 260} style={{ left: 880 + (i % 2) * 330, top: 510 + Math.floor(i / 2) * 135, width: 300 }}>
          <div className="flex items-center gap-4" style={{ height: 112, padding: '0 22px', borderRadius: 24, background: 'var(--accent)', color: 'var(--accent-foreground)' }}>
            {a.icon}
            <span className="font-medium" style={{ fontSize: 26, lineHeight: 1.15 }}>
              {a.label}
            </span>
          </div>
        </Reveal>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// 10. Close

function Close() {
  const prog = useProgress()
  const at = useAt()
  const run = inOutCubic(prog(2800, 1400))
  const words = ['Quick.', 'Correct.', 'Together.']
  return (
    <>
      <div className="absolute flex justify-center" style={{ left: 0, top: 150, width: W, gap: 56 }}>
        {words.map((w, i) => {
          const p = outExpo(prog(500 + i * 650, 900))
          return (
            <span key={w} className="font-display font-semibold tracking-[-0.035em]" style={{ fontSize: 124, lineHeight: 1, color: i === 2 ? 'var(--tomato)' : 'var(--chocolate)', opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 30}px)` }}>
              {w}
            </span>
          )
        })}
      </div>
      <div className="absolute" style={{ left: 640, top: 360, width: 320, color: 'var(--chocolate)', opacity: clamp01(prog(2800, 400) * 2), transform: `translateX(${lerp(-1000, 0, run)}px)` }}>
        <Mascot running={!at(4200)} className="w-full" speed="var(--chocolate)" />
      </div>
      <Reveal at={4200} dur={1000} dy={30} style={{ left: 0, top: 610, width: W }}>
        <div className="text-center font-display font-semibold tracking-[-0.035em]" style={{ fontSize: 130, lineHeight: 1, color: 'var(--chocolate)' }} translate="no">
          Table<span style={{ color: 'var(--tomato)' }}>Mate</span>
        </div>
      </Reveal>
      <Reveal at={5000} style={{ left: 0, top: 765, width: W }}>
        <div className="text-center font-medium uppercase" style={{ fontSize: 30, letterSpacing: '0.3em' }}>
          The right service. At the right time.
        </div>
      </Reveal>
      <Reveal at={5800} style={{ left: 0, top: 835, width: W }}>
        <div className="text-center" style={{ fontSize: 26, color: 'var(--muted-foreground)' }}>
          OB Project · Working Group B3
        </div>
      </Reveal>
    </>
  )
}

export interface Scene {
  id: string
  ms: number
  /** Said by the pictures; kept as text for screen readers. */
  caption: string
  render: () => ReactNode
}

export const SCENES: Scene[] = [
  { id: 'open', ms: 5300, caption: 'TableMate: the right service, at the right time. The AI copilot for fine-dining servers.', render: () => <Open /> },
  { id: 'pressure', ms: 12900, caption: 'Saturday night. Six tables. One head.', render: () => <Pressure /> },
  { id: 'slip', ms: 6400, caption: 'When service slips, the server takes the blame, even when the delay was never theirs.', render: () => <Slip /> },
  { id: 'next3', ms: 9900, caption: 'TableMate shows each server their next three moves, in the order guests need them, each with the reason why. Suggestions, never orders.', render: () => <NextThree /> },
  { id: 'safety', ms: 7650, caption: 'Safe before fast: a nut allergy and a dish with nuts are flagged the moment the order is fired, and the kitchen is told.', render: () => <Safety /> },
  { id: 'fair', ms: 8800, caption: 'Delays go to whoever controlled the step. Every table leaves a receipt, so a kitchen delay is never a server’s.', render: () => <Fair /> },
  { id: 'manager', ms: 8650, caption: 'Managers see the floor, not a leaderboard, and can hand a table to a colleague who speaks the guests’ language.', render: () => <Manager /> },
  { id: 'practice', ms: 9200, caption: 'Servers practise hard moments privately, with an honest score and an ideal reply.', render: () => <Practice /> },
  { id: 'everyone', ms: 8000, caption: 'Made for every server: six languages, read-aloud, large text, colour-safe, and alerts that do not need sound.', render: () => <Everyone /> },
  { id: 'close', ms: 9800, caption: 'Quick. Correct. Together. TableMate.', render: () => <Close /> },
]
