// Haptics for meaningful moments only (a task done, a badge earned), never on every tap.
// Silently does nothing where vibration isn't supported (iOS Safari, desktop).

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const haptic = {
  done: () => vibrate(12),
  celebrate: () => vibrate([18, 60, 28]),
}

function vibrate(pattern: number | number[]) {
  if (reduced()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not available in this context
  }
}
