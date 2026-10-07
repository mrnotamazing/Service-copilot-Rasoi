// Allergy and diet safety check. Deliberately rule-based, never an AI guess: a dish is
// flagged when its ingredient tags meet a guest's declared allergy or dietary need.

import type { MenuItem, Party } from './types.ts'

/** Dietary needs and the ingredient tags each one rules out. */
export const DIET_RULES: Record<string, string[]> = {
  vegan: ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey'],
  jain: ['meat', 'fish', 'shellfish', 'egg', 'root'],
  halal: ['pork', 'alcohol', 'nonhalal'],
}

export interface SafetyIssue {
  /** The ingredient tag that clashes, e.g. "dairy". */
  tag: string
  /** "allergy" for a declared allergy, otherwise the dietary need (vegan, jain, halal). */
  because: string
}

export function safetyIssues(item: Pick<MenuItem, 'contains'> | undefined, party: Party | undefined): SafetyIssue[] {
  if (!item?.contains?.length || !party) return []
  const out: SafetyIssue[] = []
  for (const a of party.allergies) if (item.contains.includes(a.toLowerCase())) out.push({ tag: a.toLowerCase(), because: 'allergy' })
  for (const need of party.needs ?? []) {
    const banned = DIET_RULES[need]
    if (!banned) continue
    for (const tag of item.contains) if (banned.includes(tag) && !out.some((o) => o.tag === tag)) out.push({ tag, because: need })
  }
  return out
}
