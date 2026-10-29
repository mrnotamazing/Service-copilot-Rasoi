// The kit behind the TableMate promo film: a clock every scene reads, a 1600×900 stage that scales
// to fit, and a few reveal helpers.
//
// Motion follows the Motion Design guidance. This is showcase content that is watched once, so
// movement can be slower and richer (700–1100 ms): things arriving use ease-out-expo, things moving
// across the stage use ease-in-out-cubic, time-like motion (counters, bars filling) is linear, and
// nothing pops in from scale(0). Only transform and opacity move; with Animations off every scene
// shows its finished frame.

import { cubicBezier } from 'motion/react'
import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export const outExpo = cubicBezier(0.19, 1, 0.22, 1)
export const inOutCubic = cubicBezier(0.645, 0.045, 0.355, 1)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export const W = 1600
export const H = 900

interface Clock {
  /** Milliseconds since the scene began. */
  t: number
  /** Animations off: show finished frames. */
  still: boolean
  /** Milliseconds since the film began, for the line along the bottom. */
  elapsed: number
}
const ClockCtx = createContext<Clock>({ t: 0, still: false, elapsed: 0 })
export const ClockProvider = ClockCtx.Provider
export const useClock = () => useContext(ClockCtx)

/** Progress 0..1 of something that starts at `start` and lasts `dur` ms. */
export function useProgress() {
  const { t, still } = useClock()
  return (start: number, dur: number) => (still ? 1 : clamp01((t - start) / dur))
}
/** True once the scene has passed `ms`. */
export function useAt() {
  const { t, still } = useClock()
  return (ms: number) => still || t >= ms
}

// ---------------------------------------------------------------------------
// The stage: always 1600×900, scaled to whatever room there is.

export function Stage({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={outer} className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reveal helpers

interface RevealProps {
  at: number
  dur?: number
  /** Distance to travel in px as it arrives (positive: rises from below). */
  dy?: number
  dx?: number
  style?: CSSProperties
  className?: string
  children: ReactNode
}

/** Fades in while sliding a short way into place. Absolutely positioned by `style`. */
export function Reveal({ at, dur = 900, dy = 28, dx = 0, style, className, children }: RevealProps) {
  const prog = useProgress()
  const p = outExpo(prog(at, dur))
  if (p <= 0) return null
  return (
    <div className={className} style={{ position: 'absolute', opacity: Math.min(1, p * 1.6), transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px)`, ...style }}>
      {children}
    </div>
  )
}

/** A headline set line by line, each line arriving after the last. */
export function Headline({ lines, x, y, size = 96, gap = 1.04, start = 0, step = 450, width = 760, accent }: { lines: string[]; x: number; y: number; size?: number; gap?: number; start?: number; step?: number; width?: number; accent?: number }) {
  return (
    <>
      {lines.map((l, i) => (
        <Reveal key={l} at={start + i * step} style={{ left: x, top: y + i * size * gap, width }}>
          <div className="font-display font-semibold tracking-[-0.035em]" style={{ fontSize: size, lineHeight: 1.04, color: i === accent ? 'var(--primary)' : 'var(--chocolate)', whiteSpace: 'nowrap' }}>
            {l}
          </div>
        </Reveal>
      ))}
    </>
  )
}

export function Sub({ at, x, y, width = 640, size = 34, children }: { at: number; x: number; y: number; width?: number; size?: number; children: ReactNode }) {
  return (
    <Reveal at={at} style={{ left: x, top: y, width }}>
      <p className="text-pretty" style={{ fontSize: size, lineHeight: 1.35, color: 'var(--muted-foreground)', margin: 0 }}>
        {children}
      </p>
    </Reveal>
  )
}

/** A raised card in the product's own look. */
export function Card({ style, className, children }: { style?: CSSProperties; className?: string; children: ReactNode }) {
  return (
    <div className={className} style={{ background: 'var(--card)', border: '2px solid var(--border)', borderRadius: 28, boxShadow: '0 18px 40px -22px color-mix(in oklab, var(--chocolate) 45%, transparent)', ...style }}>
      {children}
    </div>
  )
}

export function Pill({ children, tone = 'muted', size = 26, style }: { children: ReactNode; tone?: 'muted' | 'primary' | 'good' | 'warn' | 'kitchen'; size?: number; style?: CSSProperties }) {
  const c = { muted: 'var(--muted-foreground)', primary: 'var(--primary)', good: 'var(--good)', warn: 'var(--warn)', kitchen: 'var(--kitchen)' }[tone]
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium" style={{ fontSize: size, padding: `${size * 0.28}px ${size * 0.7}px`, borderRadius: 999, color: c, background: `color-mix(in oklab, ${c} 12%, transparent)`, ...style }}>
      {children}
    </span>
  )
}

/** A phone: the screen is 390 wide, the way servers hold it, drawn at `w` px wide. */
export function Phone({ children, w = 400, h = 800, style }: { children: ReactNode; w?: number; h?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', width: w, height: h, borderRadius: 56, background: 'var(--chocolate)', padding: 12, boxShadow: '0 40px 70px -34px color-mix(in oklab, var(--chocolate) 70%, transparent)', ...style }}>
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: 44, background: 'var(--background)' }}>
        {children}
      </div>
    </div>
  )
}
