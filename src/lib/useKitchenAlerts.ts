// The pass is told again when a dish nears, reaches and passes its standard time, and kept reminded while it stays late.
// The first time a ticket is seen it is only noted (so opening the screen doesn't ring for old tickets); after that,
// moving up a level alerts, and a ticket that stays late alerts again every few minutes. How the alert sounds and feels
// (chime, flash, buzz) is the person's own choice in Settings.

import { S } from '../i18n/sentences.ts'
import { L } from '../i18n/index.ts'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Level } from '../../shared/priority.ts'
import { alertNew, chime, haptic } from './haptics.ts'
import { getPrefs } from './prefs.ts'

const MIN = 60_000
const ORDER: Record<Level, number> = { normal: 0, soon: 1, late: 2, critical: 3 }

export interface AlertItem {
  id: string
  table: string
  dishes: string
  level: Level
  minsOver: number
  reasons: string[]
}

export function useKitchenAlerts(items: AlertItem[] | null, now: number, realertMin: number) {
  const seen = useRef<Map<string, { level: Level; at: number }>>(new Map())
  const tick = Math.floor(now / 30_000)
  const sig = items?.map((i) => `${i.id}:${i.level}`).join('|') ?? ''
  useEffect(() => {
    if (!items) return
    const map = seen.current
    const live = new Set(items.map((i) => i.id))
    for (const id of map.keys()) if (!live.has(id)) map.delete(id)
    for (const i of items) {
      const prev = map.get(i.id)
      if (!prev) {
        map.set(i.id, { level: i.level, at: now })
        continue
      }
      const up = ORDER[i.level] > ORDER[prev.level]
      const again = ORDER[i.level] >= ORDER.late && now - prev.at >= realertMin * MIN
      if (!up && !again) {
        if (ORDER[i.level] < ORDER[prev.level]) map.set(i.id, { level: i.level, at: prev.at })
        continue
      }
      map.set(i.id, { level: i.level, at: now })
      const why = i.reasons.length ? ` · ${i.reasons.map((r) => S(r)).join(' · ')}` : ''
      if (i.level === 'soon') {
        // A gentle heads-up: a soft tone and a small tap, no screen flash.
        if (getPrefs().chime) chime()
        haptic.done()
        toast.message(L('{t} is nearly due', { t: i.table }), { id: `kt:${i.id}`, description: `${i.dishes}${why}` })
      } else {
        alertNew()
        const text = i.minsOver >= 1 ? L('{n} min over standard', { n: Math.round(i.minsOver) }) : L('past its standard time')
        ;(i.level === 'critical' ? toast.error : toast.warning)(again && !up ? L('{t}: still {text}', { t: i.table, text }) : L('{t}: {text}', { t: i.table, text }), { id: `kt:${i.id}`, description: `${i.dishes}${why}`, duration: 8000 })
      }
    }
    // The sorted order and the tick are what change; the items themselves are rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tick])
}
