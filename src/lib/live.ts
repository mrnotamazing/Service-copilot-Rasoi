import { useEffect, useRef, useState } from 'react'
import type { Role, Snapshot } from '../../shared/snapshot.ts'

/** Subscribes to the live snapshot for a role; reconnects automatically. */
export function useSnapshot(role: Role, staffId?: string): { snap: Snapshot | null; connected: boolean } {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const retry = useRef(0)

  useEffect(() => {
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
      ws.onmessage = (m) => setSnap(JSON.parse(m.data as string) as Snapshot)
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
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data as T
}

export function act(type: string, payload: Record<string, unknown>, source: 'app' | 'kitchen' | 'manager' = 'app') {
  return post('/api/actions', { type, payload, source })
}

export function noteId() {
  return `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
