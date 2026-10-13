// The hand-drawn kit for the introduction film: wobbly pen lines made with rough.js that draw
// themselves, handwriting that writes itself in, and a few doodle characters.
//
// Motion choices follow the Motion Design guidance: this is illustrative, rarely-seen content, so
// movement can be slower and richer (700–1200 ms); things arriving use ease-out-expo, things moving
// across the page use ease-in-out-cubic, time-like motion (writing, clocks) is linear, and nothing
// pops in from scale(0): everything is drawn with a stroke instead. Bounce appears once, on the
// dropped plate, because this is an intentionally playful piece.

import { cubicBezier } from 'motion/react'
import rough from 'roughjs'
import type { Drawable, Options } from 'roughjs/bin/core'
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'

import '@fontsource/caveat-brush/latin-400.css'
import '@fontsource/patrick-hand/latin-400.css'

// Brand tokens, so the film follows the brand and not a one-off palette.
export const INK = 'var(--chocolate)'
export const RED = 'var(--tomato)'
export const OCHRE = 'var(--kitchen-mark)'
export const GREEN = 'var(--good)'
export const PAPER = 'var(--cream)'

export const outExpo = cubicBezier(0.19, 1, 0.22, 1)
export const inOutCubic = cubicBezier(0.645, 0.045, 0.355, 1)
export const inOutQuad = cubicBezier(0.455, 0.03, 0.515, 0.955)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// ---------------------------------------------------------------------------
// The clock every scene reads

interface Stage {
  /** Milliseconds since the scene began. */
  t: number
  /** Show finished drawings instead of drawing them (Animations off). */
  still: boolean
}
const StageCtx = createContext<Stage>({ t: 0, still: false })
export const StageProvider = StageCtx.Provider
export const useStage = () => useContext(StageCtx)

/** 0 → 1 between `start` and `start + dur` (1 straight away when motion is off). */
export function useProgress() {
  const { t, still } = useStage()
  return (start: number, dur: number) => (still ? 1 : clamp01((t - start) / dur))
}
export function useAt() {
  const { t, still } = useStage()
  return (ms: number) => still || t >= ms
}

// ---------------------------------------------------------------------------
// Shapes

const gen = rough.generator({ options: { roughness: 1.25, bowing: 1.3, strokeWidth: 4.5, stroke: INK, disableMultiStroke: false } })

export interface Shape {
  d: Drawable
}

const seedOf = (...n: number[]) => Math.abs(Math.round(n.reduce((a, v, i) => a + v * (13 + i * 7), 17))) % 99991 || 1
const o = (opts: Options, ...n: number[]): Options => ({ seed: seedOf(...n), ...opts })

export const sh = {
  line: (x1: number, y1: number, x2: number, y2: number, opts: Options = {}): Shape => ({ d: gen.line(x1, y1, x2, y2, o(opts, x1, y1, x2, y2)) }),
  ellipse: (cx: number, cy: number, w: number, h: number, opts: Options = {}): Shape => ({ d: gen.ellipse(cx, cy, w, h, o(opts, cx, cy, w, h)) }),
  circle: (cx: number, cy: number, dia: number, opts: Options = {}): Shape => ({ d: gen.circle(cx, cy, dia, o(opts, cx, cy, dia)) }),
  rect: (x: number, y: number, w: number, h: number, opts: Options = {}): Shape => ({ d: gen.rectangle(x, y, w, h, o(opts, x, y, w, h)) }),
  curve: (pts: [number, number][], opts: Options = {}): Shape => ({ d: gen.curve(pts, o(opts, ...pts.flat())) }),
  poly: (pts: [number, number][], opts: Options = {}): Shape => ({ d: gen.polygon(pts, o(opts, ...pts.flat())) }),
  path: (d: string, opts: Options = {}): Shape => ({ d: gen.path(d, o(opts, d.length, d.charCodeAt(2) || 1, d.charCodeAt(d.length - 2) || 1)) }),
}

/** A rounded speech-bubble outline with a tail pointing at (tx, ty). */
export function bubble(x: number, y: number, w: number, h: number, tx: number, ty: number, opts: Options = {}): Shape[] {
  const r = 22
  const bx = Math.min(Math.max(tx, x + r + 10), x + w - r - 40)
  const below = ty > y + h / 2
  const edge = below ? y + h : y
  return [
    sh.path(
      `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${bx + 34} ${y + h} ${below ? `L ${tx} ${ty}` : ''} L ${bx} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`.replace(/\s+/g, ' '),
      opts,
    ),
    ...(below ? [] : [sh.line(bx, edge, tx, ty, opts), sh.line(bx + 30, edge, tx, ty, opts)]),
  ]
}

const pathCache = new WeakMap<Drawable, { d: string; stroke?: string; fill?: string; w: number }[]>()
function pathsOf(shape: Shape) {
  let p = pathCache.get(shape.d)
  if (!p) {
    p = gen.toPaths(shape.d).map((x) => ({ d: x.d, stroke: x.stroke, fill: x.fill, w: x.strokeWidth }))
    pathCache.set(shape.d, p)
  }
  return p
}

/**
 * Draws shapes one after another, like a pen, between `start` and `start + dur`. Position, size and
 * mirroring are for the whole drawing. `fade` fades the finished drawing out between two moments.
 */
export function Sketch({
  shapes,
  start = 0,
  dur = 1000,
  x = 0,
  y = 0,
  scale = 1,
  rotate = 0,
  flip,
  opacity = 1,
  width,
}: {
  shapes: Shape[]
  start?: number
  dur?: number
  x?: number
  y?: number
  scale?: number
  rotate?: number
  flip?: boolean
  opacity?: number
  width?: number
}) {
  const prog = useProgress()
  const n = shapes.length
  const each = Math.min(dur, (dur / Math.max(1, n)) * 2.4)
  const items = shapes.map((s, i) => {
    const from = start + (n === 1 ? 0 : (dur - each) * (i / (n - 1)))
    return { paths: pathsOf(s), p: inOutQuad(prog(from, each)) }
  })
  if (items.every((i) => i.p <= 0)) return null
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${flip ? -scale : scale} ${scale})`} opacity={opacity}>
      {items.map((it, i) =>
        it.p <= 0
          ? null
          : it.paths.map((p, k) => (
              <path
                key={`${i}-${k}`}
                d={p.d}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - it.p}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={width ?? p.w}
                style={{ stroke: p.stroke ?? INK, fill: p.fill ?? 'none', fillOpacity: clamp01((it.p - 0.7) / 0.3) }}
              />
            )),
      )}
    </g>
  )
}

/** The canvas the drawings sit on (1600 × 900 units). */
export function Canvas({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 1600 900" className="absolute inset-0 size-full" aria-hidden>
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Handwriting

/** Text that writes itself in from the left (a linear reveal, because writing is time), at a spot on the 1600 × 900 canvas. */
export function Ink({
  children,
  x,
  y,
  size = 48,
  start = 0,
  dur,
  font = 'hand',
  color = INK,
  align = 'left',
  rotate = 0,
  maxWidth,
  weight,
  opacity = 1,
}: {
  children: ReactNode
  x: number
  y: number
  size?: number
  start?: number
  /** How long the writing takes; by default it follows how much there is to write. */
  dur?: number
  font?: 'hand' | 'brush'
  color?: string
  align?: 'left' | 'center' | 'right'
  rotate?: number
  maxWidth?: number
  weight?: number
  opacity?: number
}) {
  const prog = useProgress()
  const len = typeof children === 'string' ? children.length : 12
  const p = prog(start, dur ?? Math.max(500, len * 45))
  if (p <= 0) return null
  const style: CSSProperties = {
    left: `${(x / 1600) * 100}%`,
    top: `${(y / 900) * 100}%`,
    fontSize: `${size / 16}cqw`,
    color,
    opacity,
    fontFamily: font === 'brush' ? '"Caveat Brush", "Patrick Hand", cursive' : '"Patrick Hand", "Caveat Brush", cursive',
    fontWeight: weight,
    width: maxWidth ? `${(maxWidth / 1600) * 100}%` : undefined,
    transform: `translate(${align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0'}, -50%) rotate(${rotate}deg)`,
    textAlign: align,
    whiteSpace: maxWidth ? 'pre-wrap' : 'nowrap',
    clipPath: `inset(-20% ${100 - p * 100}% -20% -4%)`,
    lineHeight: 1.12,
  }
  return (
    <div className="pointer-events-none absolute" style={style}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// People and things

export type Mood = 'smile' | 'happy' | 'worry' | 'angry' | 'flat'

function face(mood: Mood, hx: number, hy: number, s: number): Shape[] {
  const eyes = [sh.circle(hx - 15, hy - 6, 8, { fill: INK, fillStyle: 'solid', seed: s + 3 }), sh.circle(hx + 15, hy - 6, 8, { fill: INK, fillStyle: 'solid', seed: s + 4 })]
  switch (mood) {
    case 'happy':
      return [...eyes, sh.path(`M ${hx - 20} ${hy + 10} Q ${hx} ${hy + 38} ${hx + 20} ${hy + 10} Z`, { fill: RED, fillStyle: 'solid', seed: s + 5 })]
    case 'worry':
      return [...eyes, sh.line(hx - 26, hy - 24, hx - 8, hy - 18, { seed: s + 6 }), sh.line(hx + 26, hy - 24, hx + 8, hy - 18, { seed: s + 7 }), sh.curve([[hx - 16, hy + 26], [hx - 6, hy + 16], [hx + 6, hy + 26], [hx + 16, hy + 16]], { seed: s + 8 })]
    case 'angry':
      return [...eyes, sh.line(hx - 26, hy - 20, hx - 6, hy - 12, { seed: s + 6 }), sh.line(hx + 26, hy - 20, hx + 6, hy - 12, { seed: s + 7 }), sh.curve([[hx - 18, hy + 26], [hx, hy + 14], [hx + 18, hy + 26]], { seed: s + 8 })]
    case 'flat':
      return [...eyes, sh.line(hx - 14, hy + 18, hx + 14, hy + 18, { seed: s + 5 })]
    default:
      return [...eyes, sh.curve([[hx - 18, hy + 14], [hx, hy + 28], [hx + 18, hy + 14]], { seed: s + 5 })]
  }
}

/**
 * A standing doodle person, feet at (0, 0), about 330 tall.
 * `kind` gives the outfit: a server with a bow tie and apron, a guest, a chef in a tall hat, a manager with a tie.
 */
export function person(opts: { kind?: 'server' | 'guest' | 'chef' | 'manager'; mood?: Mood; arms?: 'down' | 'up' | 'point' | 'wave'; seed?: number } = {}): Shape[] {
  const { kind = 'server', mood = 'smile', arms = 'down', seed: s = 1 } = opts
  const out: Shape[] = []
  const head = { x: 0, y: -262 }
  // Legs and feet
  out.push(sh.line(-14, -96, -38, 0, { seed: s + 1 }), sh.line(14, -96, 38, 0, { seed: s + 2 }), sh.line(-38, 0, -64, 0, { seed: s + 9 }), sh.line(38, 0, 64, 0, { seed: s + 10 }))
  // Torso
  const shirt = kind === 'chef' ? PAPER : kind === 'guest' ? OCHRE : kind === 'manager' ? INK : PAPER
  out.push(sh.poly([[-40, -200], [40, -200], [48, -96], [-48, -96]], { fill: shirt, fillStyle: kind === 'chef' ? 'solid' : 'hachure', hachureGap: 9, fillWeight: 2, seed: s + 11 }))
  // Arms
  const arm = {
    down: [[-40, -190, -78, -118], [40, -190, 78, -118]],
    up: [[-40, -190, -92, -272], [40, -190, 92, -272]],
    point: [[-40, -190, -80, -120], [40, -190, 170, -214]],
    wave: [[-40, -190, -78, -118], [40, -190, 96, -276]],
  }[arms]
  for (const [x1, y1, x2, y2] of arm) out.push(sh.line(x1, y1, x2, y2, { seed: s + x2 }))
  // Head
  out.push(sh.ellipse(head.x, head.y, 84, 90, { fill: PAPER, fillStyle: 'solid', seed: s + 12 }), ...face(mood, head.x, head.y, s))
  // Outfit details
  if (kind === 'server') {
    out.push(sh.circle(0, -318, 34, { fill: INK, fillStyle: 'hachure', hachureGap: 6, seed: s + 13 }), sh.poly([[0, -196], [-22, -210], [-22, -182]], { fill: RED, fillStyle: 'solid', seed: s + 14 }), sh.poly([[0, -196], [22, -210], [22, -182]], { fill: RED, fillStyle: 'solid', seed: s + 15 }), sh.rect(-30, -160, 60, 62, { fill: RED, fillStyle: 'hachure', hachureGap: 9, seed: s + 16 }))
  } else if (kind === 'chef') {
    out.push(sh.path('M -34 -296 C -68 -306 -60 -352 -26 -350 C -20 -384 24 -384 30 -350 C 64 -354 68 -304 36 -296 Z', { fill: PAPER, fillStyle: 'solid', seed: s + 13 }), sh.line(-34, -296, 36, -296, { seed: s + 14 }), sh.poly([[0, -196], [-14, -170], [14, -170]], { fill: RED, fillStyle: 'solid', seed: s + 15 }))
  } else if (kind === 'manager') {
    out.push(sh.poly([[0, -198], [-14, -170], [0, -110], [14, -170]], { fill: RED, fillStyle: 'solid', seed: s + 13 }), sh.curve([[-40, -292], [-14, -310], [20, -304], [40, -286]], { seed: s + 14 }))
  } else {
    out.push(sh.curve([[-38, -296], [-8, -318], [28, -306], [40, -284]], { seed: s + 13 }), sh.curve([[-42, -280], [-48, -262], [-44, -248]], { seed: s + 14 }))
  }
  return out
}

/** A plate seen from the side, centred on (0, 0). */
export const plate = (s = 1): Shape[] => [sh.ellipse(0, 0, 112, 30, { fill: PAPER, fillStyle: 'solid', seed: s }), sh.ellipse(0, -2, 70, 15, { seed: s + 1 })]

/** A round table from above, centred on (0, 0). */
export const table = (s = 1, fill: string = OCHRE): Shape[] => [sh.circle(0, 0, 132, { fill, fillStyle: 'hachure', hachureGap: 11, fillWeight: 2, seed: s }), sh.circle(0, 0, 132, { seed: s + 5 })]

export const sweat = (s = 1): Shape[] => [sh.path('M 0 0 C 14 22, 22 36, 0 46 C -22 36, -14 22, 0 0 Z', { fill: PAPER, fillStyle: 'solid', seed: s })]

/** A sparkle: four crossing lines. */
export const star = (r = 18, s = 1): Shape[] => [sh.line(-r, 0, r, 0, { seed: s }), sh.line(0, -r, 0, r, { seed: s + 1 }), sh.line(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6, { seed: s + 2 }), sh.line(r * 0.6, -r * 0.6, -r * 0.6, r * 0.6, { seed: s + 3 })]

/** A five-point star, filled. */
export const star5 = (r = 30, s = 1, fill: string = OCHRE): Shape[] => [
  sh.poly(
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? r * 0.45 : r
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number]
    }),
    { fill, fillStyle: 'solid', seed: s },
  ),
]

/** A wobbly arrow from (x1, y1) to (x2, y2), with an arrowhead. */
export function arrow(x1: number, y1: number, x2: number, y2: number, opts: Options = {}, bend = 0): Shape[] {
  const mx = (x1 + x2) / 2 + bend
  const my = (y1 + y2) / 2 - bend
  const a = Math.atan2(y2 - my, x2 - mx)
  const h = 30
  return [
    sh.curve([[x1, y1], [mx, my], [x2, y2]], opts),
    sh.line(x2, y2, x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5), opts),
    sh.line(x2, y2, x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5), opts),
  ]
}

/** A scribbled underline. */
export const underline = (x: number, y: number, w: number, color: string = RED, s = 1): Shape[] => [
  sh.curve([[x, y], [x + w * 0.3, y + 8], [x + w * 0.6, y - 6], [x + w, y + 4]], { stroke: color, strokeWidth: 6, seed: s }),
  sh.curve([[x + w * 0.1, y + 18], [x + w * 0.5, y + 10], [x + w * 0.9, y + 20]], { stroke: color, strokeWidth: 5, seed: s + 3 }),
]

export function useMemoShapes<T>(make: () => T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(make, [])
}
