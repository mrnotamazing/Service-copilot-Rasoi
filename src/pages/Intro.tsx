// The introduction to TableMate as a short promo film: the running chef, the problem in one beat,
// then the product (next three moves, the safety check, fair delays, the manager's floor, private
// practice, access for everyone) and the promise.
//
// Every scene is drawn from a clock (`t`, in milliseconds since the scene began), so Pause freezes
// the picture, any scene can be jumped to, and the same page is what gets recorded as the video.
// With Animations off in Settings, scenes show their finished frames instead of animating.

import { useT, L } from '../i18n/index.ts'
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'motion/react'
import { BookOpen, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
/** When each scene starts, in ms from the start of the film. */
const STARTS = SCENES.map((_, k) => SCENES.slice(0, k).reduce((n, s) => n + s.ms, 0))
/** Which scene is showing at a moment of the film. */
const sceneAt = (pos: number) => {
  let k = 0
  while (k + 1 < SCENES.length && pos >= STARTS[k + 1]) k++
  return k
}
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
  const tx = useT()
  useRolePage(null)
  const [params] = useSearchParams()
  const first = Math.max(0, Math.min(SCENES.length - 1, Number(params.get('scene') ?? 0) || 0))
  const bare = params.get('bare') === '1'
  // One clock for the whole film (ms from the start); the scene and its own time are worked out from it.
  const [pos, setPos] = useState(() => STARTS[first] + Math.max(0, Number(params.get('t') ?? 0) || 0))
  const i = Math.min(sceneAt(pos), SCENES.length - 1)
  const t = pos - STARTS[i]
  const [playing, setPlaying] = useState(params.get('play') !== '0')
  /** Where the film was, and when, the last time the clock was set: without sound, time runs on from there. */
  const anchor = useRef({ pos: 0, wall: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  // Browsers only let sound start after a tap; until then the player says so instead of staying silent.
  const [blocked, setBlocked] = useState(false)
  const scene = SCENES[i]
  const device = useReducedMotion()
  const still = usePrefs().reduceMotion || !!device

  // The clock. With sound on, the voice-over is the clock and the picture follows it, so the two can
  // never drift apart (a slow frame no longer pulls the sound back). Without sound, real time moves it.
  const restart = useCallback((at: number) => {
    anchor.current = { pos: at, wall: performance.now() }
  }, [])
  useAnimationFrame(() => {
    if (!playing) return
    const a = audio.current
    const fromSound = a && !muted && !blocked && !a.paused && !a.ended && a.readyState >= 2
    const next = fromSound ? a.currentTime * 1000 : anchor.current.pos + (performance.now() - anchor.current.wall)
    if (fromSound) anchor.current = { pos: next, wall: performance.now() }
    if (next >= TOTAL) {
      setPlaying(false)
      setPos(TOTAL)
      return
    }
    setPos(next)
  })

  // For rendering the film frame by frame: jump to any scene and moment, paused.
  useEffect(() => {
    if (!bare) return
    const w = window as unknown as { __tm?: { seek: (scene: number, ms: number) => void; scenes: number[] } }
    w.__tm = {
      seek: (n, ms) => {
        setPlaying(false)
        setPos(STARTS[n] + Math.min(ms, SCENES[n].ms - 1))
      },
      scenes: SCENES.map((x) => x.ms),
    }
    return () => {
      delete w.__tm
    }
  }, [bare])

  const go = useCallback(
    (n: number) => {
      const at = STARTS[Math.max(0, Math.min(SCENES.length - 1, n))]
      setPos(at)
      restart(at)
      // Jumping is the one time the sound is moved.
      const a = audio.current
      if (a) a.currentTime = at / 1000
    },
    [restart],
  )
  const ended = !playing && pos >= TOTAL
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

  const elapsed = Math.min(pos, TOTAL)
  const posRef = useRef(pos)
  posRef.current = pos

  // Play, pause or mute: the sound starts from where the picture is, and the clock carries on from there.
  useEffect(() => {
    restart(posRef.current)
    const a = audio.current
    if (!a || bare) return
    if (!playing || muted) {
      a.pause()
      return
    }
    a.currentTime = posRef.current / 1000
    a.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    )
  }, [playing, muted, bare, restart])


  return (
    <div className={cn('min-h-dvh bg-background', bare && 'bg-black')}>
      {!bare && <TopNav />}
      <main id="main" className={cn('mx-auto w-full max-w-6xl px-4', bare ? 'max-w-none p-0' : 'py-6')}>
        {!bare && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl md:text-3xl">{tx('ui.intro.meet_tablemate')}</h1>
              <p className="text-sm text-muted-foreground">A {Math.round(TOTAL / 1000)}{tx('ui.intro.second_film_about_the')}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/about">
                <BookOpen /> {tx('ui.landing.read_how_it_works')}
              </Link>
            </Button>
          </div>
        )}
        {/* The film is always light and on brand, whichever theme the app is in. */}
        <div ref={stage} className={cn('film @container relative aspect-video w-full overflow-hidden', !bare && 'sm:rounded-3xl')} role="region" aria-label={tx('ui.intro.tablemate_introduction')} style={{ background: 'var(--cream)', color: 'var(--chocolate)' }}>
          {!bare && <audio ref={audio} src={VOICE} preload="auto" />}
          <Stage>
            <ServiceLine elapsed={elapsed} scene={i} />
            {/* Each scene carries its own clock: while one fades out it holds its last frame, and the next one starts at its own beginning. */}
            <AnimatePresence initial={false}>
              <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.215, 0.61, 0.355, 1] }}>
                <ClockProvider value={{ t: Math.min(t, scene.ms), still, elapsed }}>{scene.render()}</ClockProvider>
              </motion.div>
            </AnimatePresence>
          </Stage>
          <p className="sr-only" aria-live="polite" key={scene.id}>
            {scene.caption}
          </p>
          {blocked && playing && !muted && !bare && (
            <button type="button" onClick={() => void audio.current?.play().then(() => setBlocked(false), () => undefined)} className="absolute bottom-[2cqw] left-[2cqw] flex items-center gap-[0.8cqw] rounded-full bg-primary px-[1.8cqw] py-[0.9cqw] text-[1.5cqw] font-medium text-primary-foreground">
              <Volume2 className="size-[1.8cqw]" /> {tx('ui.intro.tap_for_sound')}
            </button>
          )}
          {ended && !bare && (
            <button type="button" onClick={toggle} className="absolute right-[2cqw] top-[2cqw] flex items-center gap-[0.8cqw] rounded-full bg-primary px-[1.8cqw] py-[0.9cqw] text-[1.5cqw] font-medium text-primary-foreground">
              <RotateCcw className="size-[1.8cqw]" /> {tx('ui.intro.watch_again')}
            </button>
          )}
        </div>

        {/* Controls */}
        <div className={cn('mt-3 flex items-center gap-2', bare && 'hidden')}>
          <Button size="icon" variant="ghost" aria-label={tx('ui.intro.previous_scene')} onClick={() => go(i - 1)} disabled={i === 0}>
            <SkipBack />
          </Button>
          <Button size="icon" className="rounded-full" aria-label={playing ? 'Pause' : ended ? L('Watch again') : 'Play'} onClick={toggle}>
            {ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="ghost" aria-label={tx('ui.intro.next_scene')} onClick={() => go(i + 1)} disabled={i === SCENES.length - 1}>
            <SkipForward />
          </Button>
          <div className="flex min-w-0 flex-1 gap-1" role="group" aria-label={tx('ui.intro.scenes')}>
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
          <Button size="icon" variant="ghost" aria-label={muted ? L('Turn sound on') : L('Turn sound off')} aria-pressed={!muted} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button size="icon" variant="ghost" aria-label={tx('ui.intro.full_screen')} onClick={() => void stage.current?.requestFullscreen?.()}>
            <Maximize2 />
          </Button>
        </div>
        {!bare && <p className="mt-2 text-xs text-muted-foreground">{tx('ui.intro.space_to_pause_arrow')}</p>}
      </main>
    </div>
  )
}
