import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Role, Snapshot } from '../../shared/snapshot.ts'
import type { Staff } from '../../shared/types.ts'

// The staff list from the latest snapshot, shared with the "signed in as" switcher on every screen.
let staffList: Staff[] = []
const staffListeners = new Set<() => void>()
function rememberStaff(snap: Snapshot) {
  if (JSON.stringify(snap.config.staff) === JSON.stringify(staffList)) return
  staffList = snap.config.staff
  for (const l of staffListeners) l()
}
export function useStaffList(): Staff[] {
  return useSyncExternalStore(
    (l) => {
      staffListeners.add(l)
      return () => staffListeners.delete(l)
    },
    () => staffList,
  )
}

/** Built as a self-contained demo (no server): everything runs in the page. */
export const STANDALONE = import.meta.env.VITE_STANDALONE === '1'
const local = STANDALONE ? await import('./standalone.ts') : null

/** Subscribes to the live snapshot for a role; reconnects automatically. */
export function useSnapshot(role: Role, staffId?: string): { snap: Snapshot | null; connected: boolean } {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const retry = useRef(0)

  useEffect(() => {
    if (local) {
      const push = () => {
        const next = structuredClone(local.localApi.snapshot(role, staffId))
        rememberStaff(next)
        setSnap(next)
      }
      push()
      setConnected(true)
      let queued = false
      const off = local.onLocalChange(() => {
        if (queued) return
        queued = true
        setTimeout(() => {
          queued = false
          push()
        }, 100)
      })
      const timer = setInterval(push, 1000)
      return () => {
        off()
        clearInterval(timer)
      }
    }
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let closed = false
    const open = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const qs = new URLSearchParams({ role, ...(staffId ? { staffId } : {}) })
      ws = new WebSocket(`${proto}://${location.host}/ws?${qs}`)
      ws.onopen = () => {
        retry.current = 0
        setConnected(true)
      }
      ws.onmessage = (m) => {
        const next = JSON.parse(m.data as string) as Snapshot
        rememberStaff(next)
        setSnap(next)
      }
      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        timer = setTimeout(open, Math.min(5000, 500 * 2 ** retry.current++))
      }
    }
    open()
    return () => {
      closed = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [role, staffId])

  return { snap, connected }
}

export async function post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  if (local) return (await local.localPost(path, body as Record<string, unknown>)) as T
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data as T
}

/**
 * Like `post` for the assistant, but shows the answer while it's written: `onText` gets the whole
 * answer so far. Falls back to a normal request if streaming isn't available.
 */
export async function postStream<T = unknown>(path: string, body: unknown, onText: (text: string) => void): Promise<T> {
  if (local) return (await local.localPost(path, body as Record<string, unknown>, onText)) as T
  const res = await fetch(`${path}/stream`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok || !res.body) return post<T>(path, body)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let result: T | undefined
  const read = (line: string) => {
    if (!line.trim()) return
    const msg = JSON.parse(line) as { text?: string; answer?: T; error?: string }
    if (msg.error) throw new Error(msg.error)
    if (msg.answer) result = msg.answer
    else if (msg.text !== undefined) onText(msg.text)
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    lines.forEach(read)
  }
  read(buf)
  if (!result) throw new Error('The answer was cut off. Try again.')
  return result
}

export function act(type: string, payload: Record<string, unknown>, source: 'app' | 'kitchen' | 'manager' = 'app') {
  return post('/api/actions', { type, payload, source })
}

export function noteId() {
  return `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
