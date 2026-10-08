import { BookOpenText, ChevronLeft, CircleCheck, Drama, Flag, Lightbulb, Loader2, Mic, Minus, RotateCcw, Send, Sparkles, Star, TrendingDown, TrendingUp, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { AiAnswer, ChatTurn } from '../../server/ai.ts'
import { SCENARIOS, scenariosFor } from '../../shared/practice.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { en } from '../i18n/en.ts'
import { post, postStream } from '../lib/live.ts'
import { getPrefs, setPrefs, usePrefs, type Lang } from '../lib/prefs.ts'
import { speak } from '../lib/speech.ts'

type Mode = 'ask' | 'practice'
export type AssistantRole = 'server' | 'manager'

interface Message extends ChatTurn {
  source?: AiAnswer['source']
  notice?: string
  feedback?: string
  stars?: number
  suggestions?: string[]
  /** Practice debrief shown as a summary card. */
  debrief?: boolean
  /** Practice, on your replies: what this one did and missed, an ideal version and the XP it earned. */
  criteria?: AiAnswer['criteria']
  ideal?: string
  xp?: number
  /** Practice, on their lines: how they took your last reply. */
  mood?: AiAnswer['mood']
  patience?: number
  /** Language of the text, when it differs from the app's (for the right voice and font). */
  lang?: Lang
}

const STARTERS: Record<AssistantRole, Key[]> = {
  server: ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4', 'chat.s5'],
  manager: ['chat.m1', 'chat.m2', 'chat.m3', 'chat.m4', 'chat.m5'],
}

/**
 * TableMate's assistant: a chat that knows the restaurant's standards, tonight's menu and the
 * asker's tables or floor (Ask), and a practice room where it plays a guest or a team member and
 * coaches each reply (Practice). Servers and managers each get their own training and situations.
 * Answers come in the person's language when an AI model is connected.
 */
export function Assistant({ staffId, provider, initialMode = 'ask', role = 'server' }: { staffId: string; provider: AiAnswer['source']; initialMode?: Mode; role?: AssistantRole }) {
  const t = useT()
  const [mode, setMode] = useState<Mode>(initialMode)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pb-3">
        <div role="tablist" aria-label={t('hdr.ask')} className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['ask', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn('flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {m === 'ask' ? <Sparkles className="size-4" /> : <Drama className="size-4" />}
              {t(m === 'ask' ? 'chat.ask' : 'chat.practice')}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-normal text-muted-foreground">
          <Sparkles className="size-3" /> {provider === 'claude' ? t('chat.byClaude') : provider === 'ollama' ? t('chat.byOllama') : provider === 'dify' ? t('assist.dify') : t('assist.builtIn')}
        </Badge>
      </div>
      {/* Each mode keeps its own conversation while you switch back and forth. */}
      <div className={cn('min-h-0 flex-1', mode !== 'ask' && 'hidden')}>
        <Chat staffId={staffId} provider={provider} mode="ask" role={role} />
      </div>
      <div className={cn('min-h-0 flex-1', mode !== 'practice' && 'hidden')}>
        <PracticeRoom staffId={staffId} provider={provider} role={role} />
      </div>
    </div>
  )
}

/** Practice: pick a situation, then role-play it in the chat. */
function PracticeRoom({ staffId, provider, role }: { staffId: string; provider: AiAnswer['source']; role: AssistantRole }) {
  const t = useT()
  const [scenario, setScenario] = useState<string | null>(null)
  if (!scenario)
    return (
      <div className="h-full overflow-y-auto px-4 pb-6">
        <p className="mb-3 text-sm text-muted-foreground">{t(role === 'manager' ? 'practice.pickMgr' : 'practice.pick')}</p>
        <div className="grid grid-cols-2 gap-2">
          {scenariosFor(role).map((s) => (
            <button key={s.id} type="button" onClick={() => setScenario(s.id)} className="min-h-20 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent">
              <span className="block font-medium">{t(`sc.${s.id}` as Key)}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{t(`sc.${s.id}.d` as Key)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2">
        <Button size="sm" variant="ghost" className="-ml-2 h-8" onClick={() => setScenario(null)}>
          <ChevronLeft /> {t('practice.back')}
        </Button>
        <span className="truncate text-sm font-medium">{t(`sc.${scenario}` as Key)}</span>
      </div>
      <Chat key={scenario} staffId={staffId} provider={provider} mode="practice" scenario={scenario} role={role} onExit={() => setScenario(null)} />
    </div>
  )
}

function Chat({ staffId, provider, mode, scenario, role, onExit }: { staffId: string; provider: AiAnswer['source']; mode: Mode; scenario?: string; role: AssistantRole; onExit?: () => void }) {
  const t = useT()
  const { readAloud, simpleWords } = usePrefs()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The answer so far while it's being written (questions only; role-play turns arrive whole). */
  const [streaming, setStreaming] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const practice = mode === 'practice'
  // Who the other side of a role-play is: a guest, or (for some manager situations) a team member.
  const other: Key = SCENARIOS.find((x) => x.id === scenario)?.plays === 'staff' ? 'practice.staff' : 'practice.guest'

  useEffect(() => end.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth', block: 'end' }), [messages, busy, streaming])

  async function call(history: Message[], finish = false) {
    setBusy(true)
    setError(null)
    try {
      const ask = practice ? (path: string, body: unknown) => post<AiAnswer>(path, body) : (path: string, body: unknown) => postStream<AiAnswer>(path, body, setStreaming)
      const a = await ask('/api/ai', {
        kind: 'chat',
        mode,
        scenario,
        staffId,
        lang: getPrefs().lang,
        finish,
        simple: getPrefs().simpleWords,
        // Each reply carries the score it got, so the other side's patience carries over between turns.
        messages: history.filter((m) => !m.debrief).map(({ role, text: x, score }) => ({ role, text: x, score })),
      })
      // The built-in trainer answers questions in English; role-plays come in the app's language.
      const lang = (a.lang as Lang | undefined) ?? (a.source === 'built-in' && !practice ? 'en' : undefined)
      // In practice, the score, coaching, ideal reply and XP belong under the reply they are about.
      const scored = practice && !finish && a.score !== undefined
      const withCoach = scored
        ? history.map((m, i) => (i === history.length - 1 && m.role === 'user' ? { ...m, feedback: a.feedback, stars: a.stars, score: a.score, criteria: a.criteria, ideal: a.ideal, xp: a.xp } : m))
        : history
      const reply: Message = finish
        ? { role: 'assistant', text: a.text, source: a.source, debrief: true, stars: a.stars, score: a.score, xp: a.xp, lang }
        : { role: 'assistant', text: a.text, source: a.source, notice: a.notice, suggestions: a.suggestions, mood: a.mood, patience: a.patience, lang }
      const next = [...withCoach, reply]
      setMessages(next)
      if (finish) setDone(true)
      if (readAloud) speak(a.text, { lang })
      // When they've been won over (or lost), the summary follows on its own.
      if (practice && !finish && a.done) void call(next, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setStreaming(null)
      setBusy(false)
    }
  }

  // A practice opens with the guest's first line.
  useEffect(() => {
    if (practice && messages.length === 0) void call([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function send(raw = text) {
    const msg = raw.trim()
    if (!msg || busy) return
    setText('')
    const next: Message[] = [...messages, { role: 'user', text: msg }]
    setMessages(next)
    void call(next)
  }

  // The built-in trainer understands English; with an AI model, starters go in the server's language.
  const starter = (k: Key) => (provider === 'built-in' ? en[k] : t(k))
  const last = messages.at(-1)
  const showSuggestions = !practice && !busy && last?.role === 'assistant' && last.suggestions?.length && (t.lang === 'en' || provider === 'built-in')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {practice && <PatienceMeter messages={messages} other={other} />}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-live="polite">
        {!practice && messages.length === 0 && (
          <div className="rounded-2xl bg-secondary/60 p-4">
            <p className="text-sm">{t(role === 'manager' ? 'chat.helloMgr' : 'chat.hello')}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STARTERS[role].map((k) => (
                <Suggestion key={k} onClick={() => send(starter(k))}>
                  {t(k)}
                </Suggestion>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} m={m} practice={practice} other={other} all={messages} />
        ))}
        {busy && streaming ? (
          <div className="flex flex-col items-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-sm">
              <Lines text={streaming} />
              <span className="mt-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary/60 align-middle" aria-hidden />
            </div>
          </div>
        ) : busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {practice && messages.length === 0 ? t('chat.guestArriving') : t('chat.thinking')}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {showSuggestions ? (
          <div className="flex flex-wrap gap-1.5">
            {last!.suggestions!.map((s) => (
              <Suggestion key={s} onClick={() => send(s)}>
                {s}
              </Suggestion>
            ))}
          </div>
        ) : null}
        {/* Only questions fall back to English; role-plays are written in every app language. */}
        {practice || provider !== 'built-in' || t.lang === 'en' ? null : messages.length > 0 && <p className="text-[11px] text-muted-foreground">{t('assist.englishNote')}</p>}
        <div ref={end} />
      </div>

      <div className="border-t px-4 pb-4 pt-3">
        {practice && done ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => (setMessages([]), setDone(false), void call([]))}>
              <RotateCcw /> {t('practice.retry')}
            </Button>
            <Button className="h-11 rounded-xl" onClick={onExit}>
              <Drama /> {t('practice.again')}
            </Button>
          </div>
        ) : (
          <>
            {practice && messages.some((m) => m.role === 'user') && (
              <Button variant="outline" size="sm" className="mb-2 h-8 rounded-full" disabled={busy} onClick={() => void call(messages, true)}>
                <Flag /> {t('chat.finish')}
              </Button>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <Dictate onText={(x) => setText((r) => (r ? `${r} ${x}` : x))} />
              <Input
                name={practice ? 'practice-reply' : 'assistant-question'}
                aria-label={practice ? t('practice.reply') : t('chat.placeholder')}
                autoComplete="off"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={practice ? t('practice.reply') : t('chat.placeholder')}
                className="h-11 rounded-full"
              />
              <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" aria-label={t('practice.send')} disabled={busy || !text.trim()}>
                <Send />
              </Button>
            </form>
            <div className="mt-2 flex items-center gap-3">
              {!practice && messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} className="inline-flex min-h-6 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="size-3" /> {t('chat.new')}
                </button>
              )}
              {/* Plain language on request: for anyone still learning the language, tired, or who just prefers it. */}
              <button
                type="button"
                aria-pressed={simpleWords}
                onClick={() => setPrefs({ simpleWords: !simpleWords })}
                className={cn('ml-auto inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-xs transition-colors', simpleWords ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <BookOpenText className="size-3.5" /> {t('acc.simple')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Bubble({ m, practice, other, all }: { m: Message; practice: boolean; other: Key; all: Message[] }) {
  const t = useT()
  const mine = m.role === 'user'
  if (m.debrief) return <Debrief m={m} all={all} />
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {practice && (
        <span className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {mine ? t('practice.you') : t(other)}
          {!mine && m.mood && <MoodChip mood={m.mood} />}
        </span>
      )}
      <div className={cn('max-w-[88%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary')}>
        <Lines text={m.text} lang={!mine ? m.lang : undefined} />
        {!mine && (
          <button type="button" onClick={() => speak(m.text, { lang: m.lang })} className="mt-1 inline-flex items-center gap-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground" aria-label={t('card.read')}>
            <Volume2 className="size-3.5" /> {t('card.read')}
          </button>
        )}
      </div>
      {m.notice && <span className="mt-1 text-[11px] text-warn">{m.notice}</span>}
      {(m.feedback || m.score !== undefined) && <ScoreCard m={m} />}
    </motion.div>
  )
}

/** Under each practice reply: stars, the score, XP earned, what it did and missed, and an ideal reply. */
function ScoreCard({ m }: { m: Message }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5 w-full max-w-[92%] rounded-xl border border-primary/30 bg-accent/60 px-3 py-2 text-sm">
      {m.score !== undefined && (
        <div className="mb-1.5 flex items-center gap-2">
          {m.stars ? <Stars n={m.stars} /> : null}
          <span className="font-display text-base tabular">{t('practice.score', { n: m.score })}</span>
          <ScoreBar score={m.score} />
          {m.xp ? (
            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular">{t('practice.xp', { n: m.xp })}</span>
          ) : m.xp === 0 ? (
            <span className="sr-only">{t('practice.capped')}</span>
          ) : null}
        </div>
      )}
      {m.criteria?.length ? (
        <ul className="space-y-1" aria-label={t('practice.checks')}>
          {m.criteria.map((c) => (
            <li key={c.id} className="flex items-start gap-1.5">
              {c.met ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden /> : <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      ) : m.feedback ? (
        <ul className="space-y-1">
          {m.feedback
            .split('\n')
            .filter(Boolean)
            .map((line, j) => {
              const good = line.startsWith('✓')
              const tip = line.startsWith('→')
              const Icon = good ? CircleCheck : tip ? Lightbulb : null
              return (
                <li key={j} className="flex items-start gap-1.5">
                  {Icon && <Icon className={cn('mt-0.5 size-4 shrink-0', good ? 'text-good' : 'text-primary')} aria-hidden />}
                  <span>{good || tip ? line.slice(1).trim() : line}</span>
                </li>
              )
            })}
        </ul>
      ) : null}
      {m.xp === 0 && m.score !== undefined && <p className="mt-1.5 text-[11px] text-muted-foreground">{t('practice.capped')}</p>}
      {m.ideal && (
        <div className="mt-2 border-t border-primary/20 pt-2">
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex min-h-6 items-center gap-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> {t('practice.showIdeal')}
          </button>
          {open && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 rounded-lg bg-background/80 p-2">
              <div className="mb-0.5 text-[11px] text-muted-foreground">{t('practice.ideal')}</div>
              <p className="leading-relaxed">{m.ideal}</p>
              <button type="button" onClick={() => speak(m.ideal!)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" aria-label={t('card.read')}>
                <Volume2 className="size-3.5" /> {t('card.read')}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

/** The end of a practice: how it went, the average score, total XP, and the ideal replies to learn from. */
function Debrief({ m, all }: { m: Message; all: Message[] }) {
  const t = useT()
  const replies = all.filter((x) => x.role === 'user' && x.score !== undefined)
  const xp = replies.reduce((n, x) => n + (x.xp ?? 0), 0) + (m.xp ?? 0)
  const ideals = [...new Set(replies.map((x) => x.ideal).filter((x): x is string => !!x))]
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-accent/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{t('chat.debrief')}</span>
        {m.stars ? <Stars n={m.stars} /> : null}
        {m.score !== undefined && <span className="text-sm tabular text-muted-foreground">{t('practice.avg', { n: m.score })}</span>}
        {xp > 0 && <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground tabular">{t('practice.xpTotal', { n: xp })}</span>}
      </div>
      <Lines text={m.text} lang={m.lang} />
      {ideals.length > 0 && (
        <div className="mt-3 border-t border-primary/20 pt-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">{t('practice.idealsTitle')}</div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {ideals.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </div>
      )}
    </motion.div>
  )
}

/** How the other side feels right now: patience from 0 (leaving) to 4 (won over). */
function PatienceMeter({ messages, other }: { messages: Message[]; other: Key }) {
  const t = useT()
  const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.patience !== undefined)
  const p = last?.patience ?? 2
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">
        {t('practice.feel')} <span className="sr-only">({t(other)})</span>
      </span>
      <div className="flex flex-1 gap-1" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={p} aria-label={t('practice.feel')}>
        {[1, 2, 3, 4].map((k) => (
          <span key={k} className={cn('h-1.5 flex-1 rounded-full transition-colors', k <= p ? (p >= 3 ? 'bg-good' : p <= 1 ? 'bg-destructive' : 'bg-warn') : 'bg-border')} />
        ))}
      </div>
      {last?.mood && <MoodChip mood={last.mood} />}
    </div>
  )
}

function MoodChip({ mood }: { mood: NonNullable<Message['mood']> }) {
  const t = useT()
  const Icon = mood === 'better' ? TrendingUp : mood === 'worse' ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium', mood === 'better' ? 'bg-good/15 text-good' : mood === 'worse' ? 'bg-destructive/10 text-destructive' : 'bg-warn/15 text-warn')}>
      <Icon className="size-3" aria-hidden /> {t(`practice.mood.${mood}` as Key)}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
      <span className={cn('block h-full rounded-full', score >= 80 ? 'bg-good' : score >= 50 ? 'bg-warn' : 'bg-destructive')} style={{ width: `${score}%` }} />
    </span>
  )
}

/** Plain text with line breaks and simple "•" / "-" bullets. */
function Lines({ text, lang }: { text: string; lang?: string }) {
  return (
    <div className="space-y-1 leading-relaxed" lang={lang}>
      {text.split('\n').map((line, i) =>
        /^\s*[•\-*]\s+/.test(line) ? (
          <div key={i} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>{line.replace(/^\s*[•\-*]\s+/, '').replace(/\*\*/g, '')}</span>
          </div>
        ) : line.trim() ? (
          <p key={i}>{line.replace(/\*\*/g, '')}</p>
        ) : null,
      )}
    </div>
  )
}

function Stars({ n, className }: { n: number; className?: string }) {
  const t = useT()
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={t('practice.stars', { n })}>
      {[1, 2, 3].map((k) => (
        <Star key={k} className={cn('size-4', k <= n ? 'fill-primary text-primary' : 'text-border')} />
      ))}
    </div>
  )
}

function Suggestion({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent">
      {children}
    </button>
  )
}

type Recognition = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void }

/** Speak instead of type, in the app's language, where the browser supports speech recognition. */
export function Dictate({ onText }: { onText: (text: string) => void }) {
  const t = useT()
  const [on, setOn] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const Ctor = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) : undefined
  if (!Ctor) return null
  return (
    <Button
      type="button"
      size="icon"
      variant={on ? 'default' : 'outline'}
      className={cn('size-11 shrink-0 rounded-full', on && 'pulse-soft')}
      aria-label={t('practice.mic')}
      aria-pressed={on}
      onClick={() => {
        if (on) return rec.current?.stop()
        const r = new (Ctor as new () => Recognition)()
        r.lang = LANGUAGES.find((l) => l.id === getPrefs().lang)?.speech ?? 'en-IN'
        r.interimResults = false
        r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
        r.onend = () => setOn(false)
        rec.current = r
        setOn(true)
        r.start()
      }}
    >
      <Mic />
    </Button>
  )
}
