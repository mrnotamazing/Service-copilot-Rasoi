// Everything a practice role-play says, per language: what the guest or team member says as the
// conversation turns better or worse, an ideal reply to learn from, and the coaching.

export type PracticeLang = 'en' | 'hi' | 'ne' | 'bn' | 'ta' | 'es'

export interface ScenarioText {
  /** The first line. */
  opening: string
  /** After a good reply: calmer, but with a real follow-up concern. */
  calm: string
  /** After a poor reply: more upset. */
  upset: string
  /** When it's been handled well: they're won over. */
  resolved: string
  /** When it's gone badly: they ask for the manager or leave. */
  walkout: string
  /** An ideal reply to the opening, and to the follow-up. */
  ideal: [string, string]
}

export interface PracticeText {
  scenarios: Record<string, ScenarioText>
  /** What they say after a vague reply: push for specifics. */
  push: { guest: string; staff: string }
  /** When time runs out without winning them over. */
  grudging: { guest: string; staff: string }
  /** Coaching for each check: what the reply did well, and the tip when it's missing. */
  checks: Record<string, { good: string; tip: string }>
  debrief: {
    worked: string
    practise: string
    keep: string
    won: string
    lost: string
    ok: string
    noReplies: string
  }
}
