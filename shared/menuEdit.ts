// Checks a dish sent from the menu editor: known course, station and ingredient tags, sensible
// numbers and lengths. Returns the clean dish, or a message saying what to fix.

import type { Course, MenuItem, Station } from './types.ts'

export const COURSES: Course[] = ['starter', 'main', 'dessert', 'drink']
export const STATIONS: Station[] = ['grill', 'hot', 'cold', 'pastry', 'bar']
/** Allergens first, then diet tags; the same words the safety check uses. */
export const TAGS = ['nuts', 'dairy', 'gluten', 'egg', 'fish', 'shellfish', 'soy', 'sesame', 'meat', 'pork', 'nonhalal', 'alcohol', 'root'] as const
export const TAG_LABEL: Record<(typeof TAGS)[number], string> = {
  nuts: 'Nuts', dairy: 'Dairy', gluten: 'Gluten', egg: 'Egg', fish: 'Fish', shellfish: 'Shellfish', soy: 'Soy', sesame: 'Sesame',
  meat: 'Meat', pork: 'Pork', nonhalal: 'Non-halal meat', alcohol: 'Alcohol', root: 'Onion, garlic or root veg',
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function cleanMenuItem(raw: unknown, menu: MenuItem[]): MenuItem | string {
  if (!raw || typeof raw !== 'object') return 'Send a dish.'
  const r = raw as Record<string, unknown>
  const name = text(r.name, 80)
  if (!name) return 'Give the dish a name.'
  const course = COURSES.find((c) => c === r.course)
  const station = STATIONS.find((s) => s === r.station)
  if (!course || !station) return 'Pick a course and a kitchen station.'
  const prepMin = Number(r.prepMin)
  if (!Number.isFinite(prepMin) || prepMin < 1 || prepMin > 90) return 'Prep time should be 1 to 90 minutes.'
  const id = text(r.id, 40) || `m_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'dish'}`
  if (!text(r.id, 40) && menu.some((m) => m.id === id)) return 'A dish with that name already exists.'
  const contains = Array.isArray(r.contains) ? [...new Set(r.contains.filter((t): t is string => TAGS.includes(t as (typeof TAGS)[number])))] : []
  const spice = r.spice === null || r.spice === undefined || r.spice === '' ? undefined : Number(r.spice)
  if (spice !== undefined && ![0, 1, 2, 3].includes(spice)) return 'Spice level is 0 to 3.'
  const item: MenuItem = { id, name, course, station, prepMin: Math.round(prepMin), contains }
  if (spice !== undefined) item.spice = spice as MenuItem['spice']
  const description = text(r.description, 400)
  const adjust = text(r.adjust, 300)
  if (description) item.description = description
  if (adjust) item.adjust = adjust
  if (Array.isArray(r.facts)) item.facts = r.facts.filter((f): f is { q: string; a: string; at: number } => !!f && typeof f.q === 'string' && typeof f.a === 'string').slice(-20).map((f) => ({ q: f.q.slice(0, 300), a: f.a.slice(0, 300), at: Number(f.at) || 0 }))
  return item
}
