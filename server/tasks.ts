// What kind of job is this, and how hard? Every model gets the same settings for the same job, and the
// router uses the job's weight to pick a model: quick everyday answers go to the fastest good model,
// judging a practice reply or writing a debrief goes to the most careful one.

import type { AiRequest } from './ai.ts'

export type Tier = 'quick' | 'standard' | 'deep'

export interface Profile {
  tier: Tier
  /** The same for every provider that accepts it (Claude uses its own default). */
  temperature: number
}

export function profileFor(req: AiRequest): Profile {
  if (req.kind === 'chat' && req.mode === 'practice') {
    // Scoring a reply and playing the other side in character, or the closing debrief: accuracy matters, so steady and careful.
    const judging = !!req.finish || (req.messages ?? []).some((m) => m.role === 'user')
    return judging ? { tier: 'deep', temperature: 0.3 } : { tier: 'quick', temperature: 0.6 }
  }
  if (req.kind === 'incident' || req.kind === 'shift_summary') return { tier: 'standard', temperature: 0.4 }
  if (req.kind === 'chat') {
    const manager = (req.staffId ?? '').startsWith('m_')
    return manager ? { tier: 'standard', temperature: 0.5 } : { tier: 'quick', temperature: 0.5 }
  }
  // guest lines, coach tips, briefings, complaint help, quick questions
  return { tier: 'quick', temperature: 0.5 }
}
