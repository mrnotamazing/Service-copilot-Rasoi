// Haptics for meaningful moments only (a task done, a badge earned), never on every tap.
// Respects the person's comfort settings and silently does nothing where vibration isn't
// supported (iOS Safari, desktop).

import { getPrefs } from './prefs.ts'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const haptic = {
  done: () => vibrate(12),
  celebrate: () => vibrate([18, 60, 28]),
  alert: () => vibrate([30, 80, 30]),
}

function vibrate(pattern: number | number[]) {
  const p = getPrefs()
  if (!p.haptics || p.quietCelebrations || reduced()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not available in this context
  }
}

/** A soft two-note chime made with WebAudio, so no sound file ships with the app. */
let ctx: AudioContext | null = null
export function chime() {
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.14
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    }
  } catch {
    // audio blocked until the first tap, or unsupported
  }
}
