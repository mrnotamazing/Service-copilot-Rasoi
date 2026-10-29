// Alerts for the screens: something new arrives → chime, flash, buzz (each as chosen in Settings).
import { useEffect, useRef, useState } from 'react'
import { alertNew } from './haptics.ts'

/**
 * Alert when a key appears that wasn't there before (a new ticket, question, request). Keys already
 * on screen when the page opens never alert. `null` while the data is still loading.
 */
export function useAlertOnNew(keys: string[] | null) {
  const seen = useRef<Set<string> | null>(null)
  const sig = keys?.join('|') ?? null
  useEffect(() => {
    if (!keys) return
    const prev = seen.current
    seen.current = new Set(keys)
    if (prev && keys.some((k) => !prev.has(k))) alertNew()
    // The joined keys are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
}

/** The screen-edge flash, shown app-wide for a moment whenever an alert asks for it. */
export function useEdgeFlash(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = () => {
      setN((x) => x + 1)
      clearTimeout(timer)
      timer = setTimeout(() => setN(0), 1800)
    }
    window.addEventListener('tablemate-flash', on)
    return () => {
      window.removeEventListener('tablemate-flash', on)
      clearTimeout(timer)
    }
  }, [])
  return n
}
