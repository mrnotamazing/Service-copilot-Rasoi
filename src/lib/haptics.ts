// Alerts and haptics. A new task (or a new ticket, question or request on the kitchen and manager
// screens) can chime, flash the screen edge and buzz, each only if the person turned it on in
// Settings. Haptics also mark meaningful moments (a task done, a badge earned), never every tap.
//
// Browsers only allow sound and vibration after the person has touched the page, so the first tap
// anywhere unlocks them; turning an alert on in Settings plays it once as a preview.

import { getPrefs } from './prefs.ts'

export const haptic = {
  done: () => vibrate(12, true),
  celebrate: () => vibrate([18, 60, 28], true),
  alert: () => vibrate([40, 90, 40]),
}

/** Wins are quieted by "quiet celebrations"; alerts never are (they carry information). */
function vibrate(pattern: number | number[], win = false) {
  const p = getPrefs()
  if (!p.haptics || (win && p.quietCelebrations)) return
  // Browsers refuse to buzz before the person has touched the page; skip quietly instead of logging an error.
  if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not available in this context
  }
}

/** Phones and browsers that can vibrate from a web page (Android Chrome yes; iPhone Safari no). */
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// The first touch, click or key press unlocks sound for the rest of the visit.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = audio()
    if (a && a.state !== 'suspended') for (const e of ['pointerdown', 'keydown'] as const) window.removeEventListener(e, unlock)
  }
  for (const e of ['pointerdown', 'keydown'] as const) window.addEventListener(e, unlock)
}

/** A soft two-note chime made with WebAudio, so no sound file ships with the app. */
export function chime() {
  const a = audio()
  if (!a) return
  const now = a.currentTime + 0.02
  for (const [i, freq] of [660, 880].entries()) {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + i * 0.14
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    osc.connect(gain).connect(a.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  }
}

/** Ask the app-wide edge flash (see EdgeFlash) to show once. */
export function flashEdge() {
  window.dispatchEvent(new Event('tablemate-flash'))
}

/** Something new needs this person: chime, flash and buzz, each as they chose in Settings. */
export function alertNew() {
  const p = getPrefs()
  if (p.chime) chime()
  if (p.flash) flashEdge()
  haptic.alert()
}
