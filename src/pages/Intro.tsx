// The introduction to TableMate as a short promo film: the running chef, the problem in one beat,
// then the product (next three moves, the safety check, fair delays, the manager's floor, private
// practice, access for everyone) and the promise.
//
// Every scene is drawn from a clock (`t`, in milliseconds since the scene began), so Pause freezes
// the picture, any scene can be jumped to, and the same page is what gets recorded as the video.
// With Animations off in Settings, scenes show their finished frames instead of animating.

import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'motion/react'
import { BookOpen, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mascot } from '../brand/marks.tsx'
import { TopNav } from '../components/kit.tsx'
import { usePrefs } from '../lib/prefs.ts'
import { useRolePage } from '../lib/role.ts'
import { clamp01, ClockProvider, Stage } from './intro/kit.tsx'
import { SCENES } from './intro/scenes.tsx'

const TOTAL = SCENES.reduce((n, s) => n + s.ms, 0)
// The voice-over and music, one track timed to the whole film. The single-file demo embeds it as window.__TM_VOICE.
const VOICE = (typeof window !== 'undefined' && (window as unknown as { __TM_VOICE?: string }).__TM_VOICE) || `${import.meta.env.BASE_URL}TableMate-voiceover.mp3`

/** A thin service line along the foot of the middle scenes, with the chef running along it as the film plays. */
function ServiceLine({ elapsed, scene }: { elapsed: number; scene: number }) {
  const show = scene > 0 && scene < SCENES.length - 1
  const p = clamp01(elapsed / TOTAL)
  const x0 = 110
  const x1 = 1490
  return (
    <div className="absolute" style={{ left: 0, top: 0, width: 1600, height: 900, opacity: show ? 1 : 0, transition: 'opacity 0.4s', pointerEvents: 'none' }} aria-hidden>
      <div className="absolute" style={{ left: x0, top: 868, width: x1 - x0, height: 6, borderRadius: 3, background: 'var(--border)' }} />
      <div className="absolute" style={{ left: x0, top: 868, width: (x1 - x0) * p, height: 6, borderRadius: 3, background: 'var(--tomato)' }} />
      <div className="absolute" style={{ left: x0 + (x1 - x0) * p - 54, top: 806, width: 84, color: 'var(--chocolate)' }}>
        <Mascot className="w-full" speed="var(--chocolate)" />
      </div>
    </div>
  )
}

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
  const audio = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  // Browsers only let sound start after a tap; until then the player says so instead of staying silent.
  const [blocked, setBlocked] = useState(false)
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

  const elapsed = SCENES.slice(0, i).reduce((n, s) => n + s.ms, 0) + Math.min(t, scene.ms)

  // Sound follows the clock: it plays and pauses with the film, and jumps when a scene is skipped.
  useEffect(() => {
    const a = audio.current
    if (!a || bare) return
    if (!playing || muted) {
      a.pause()
      return
    }
    const want = elapsed / 1000
    if (Math.abs(a.currentTime - want) > 0.45) a.currentTime = Math.min(want, Math.max(0, (a.duration || want) - 0.05))
    if (a.paused) {
      a.play().then(() => setBlocked(false), () => setBlocked(true))
    }
  }, [playing, muted, bare, Math.floor(elapsed / 250)]) // eslint-disable-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => ({ t, still, elapsed }), [t, still, elapsed])

  return (
    <div className={cn('min-h-dvh bg-background', bare && 'bg-black')}>
      {!bare && <TopNav />}
      <main id="main" className={cn('mx-auto w-full max-w-6xl px-4', bare ? 'max-w-none p-0' : 'py-6')}>
        {!bare && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl md:text-3xl">Meet TableMate</h1>
              <p className="text-sm text-muted-foreground">A {Math.round(TOTAL / 1000)}-second film about the problem and what TableMate does about it.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/about">
                <BookOpen /> Read how it works
              </Link>
            </Button>
          </div>
        )}
        {/* The film is always light and on brand, whichever theme the app is in. */}
        <div ref={stage} className={cn('film @container relative aspect-video w-full overflow-hidden', !bare && 'sm:rounded-3xl')} role="region" aria-label="TableMate introduction" style={{ background: 'var(--cream)', color: 'var(--chocolate)' }}>
          {!bare && <audio ref={audio} src={VOICE} preload="auto" />}
          <ClockProvider value={ctx}>
            <Stage>
              <ServiceLine elapsed={elapsed} scene={i} />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}>
                  {scene.render()}
                </motion.div>
              </AnimatePresence>
            </Stage>
          </ClockProvider>
          <p className="sr-only" aria-live="polite" key={scene.id}>
            {scene.caption}
          </p>
          {blocked && playing && !muted && !bare && (
            <button type="button" onClick={() => void audio.current?.play().then(() => setBlocked(false), () => undefined)} className="absolute bottom-[2cqw] left-[2cqw] flex items-center gap-[0.8cqw] rounded-full bg-primary px-[1.8cqw] py-[0.9cqw] text-[1.5cqw] font-medium text-primary-foreground">
              <Volume2 className="size-[1.8cqw]" /> Tap for sound
            </button>
          )}
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
          <Button size="icon" variant="ghost" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Full screen" onClick={() => void stage.current?.requestFullscreen?.()}>
            <Maximize2 />
          </Button>
        </div>
        {!bare && <p className="mt-2 text-xs text-muted-foreground">Space to pause, arrow keys to change scene, F for full screen. With Animations off in Settings, each scene shows its finished frame.</p>}
      </main>
    </div>
  )
}
