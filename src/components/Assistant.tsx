import { ChevronLeft, CircleCheck, Drama, Flag, Lightbulb, Loader2, Mic, RotateCcw, Send, Sparkles, Star, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { AiAnswer, ChatTurn } from '../../server/ai.ts'
import { SCENARIOS } from '../../shared/practice.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { en } from '../i18n/en.ts'
import { post } from '../lib/live.ts'
import { getPrefs, usePrefs } from '../lib/prefs.ts'
import { speak } from '../lib/speech.ts'

type Mode = 'ask' | 'practice'

interface Message extends ChatTurn {
  source?: AiAnswer['source']
  notice?: string
  feedback?: string
  stars?: number
  suggestions?: string[]
  /** Practice debrief shown as a summary card. */
  debrief?: boolean
}

const STARTERS: Key[] = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4', 'chat.s5']

/**
 * TableMate's assistant: a chat that knows the restaurant's standards, tonight's menu and the
 * server's own tables (Ask), and a practice room where it plays a guest and coaches each reply
 * (Practice). Answers come in the server's language when an AI model is connected.
 */
export function Assistant({ staffId, provider, initialMode = 'ask' }: { staffId: string; provider: AiAnswer['source']; initialMode?: Mode }) {
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
        <Chat staffId={staffId} provider={provider} mode="ask" />
      </div>
      <div className={cn('min-h-0 flex-1', mode !== 'practice' && 'hidden')}>
        <PracticeRoom staffId={staffId} provider={provider} />
      </div>
    </div>
  )
}

/** Practice: pick a situation, then role-play it in the chat. */
function PracticeRoom({ staffId, provider }: { staffId: string; provider: AiAnswer['source'] }) {
  const t = useT()
  const [scenario, setScenario] = useState<string | null>(null)
  if (!scenario)
    return (
      <div className="h-full overflow-y-auto px-4 pb-6">
        <p className="mb-3 text-sm text-muted-foreground">{t('practice.pick')}</p>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
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
      <Chat key={scenario} staffId={staffId} provider={provider} mode="practice" scenario={scenario} />
    </div>
  )
}

function Chat({ staffId, provider, mode, scenario }: { staffId: string; provider: AiAnswer['source']; mode: Mode; scenario?: string }) {
  const t = useT()
  const { readAloud } = usePrefs()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const practice = mode === 'practice'

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, busy])

  async function call(history: Message[], finish = false) {
    setBusy(true)
    setError(null)
    try {
      const a = await post<AiAnswer>('/api/ai', {
        kind: 'chat',
        mode,
        scenario,
        staffId,
        lang: getPrefs().lang,
        finish,
        messages: history.filter((m) => !m.debrief).map(({ role, text: x }) => ({ role, text: x })),
      })
      // In practice, coaching belongs under the reply it is about.
      const withCoach = practice && !finish ? history.map((m, i) => (i === history.length - 1 && m.role === 'user' ? { ...m, feedback: a.feedback, stars: a.stars } : m)) : history
      setMessages([...withCoach, { role: 'assistant', text: a.text, source: a.source, notice: a.notice, suggestions: a.suggestions, debrief: finish, stars: finish ? a.stars : undefined }])
      if (finish || a.done) setDone(true)
      if (readAloud) speak(a.text, { lang: a.source === 'built-in' ? 'en' : undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('toast.error'))
    } finally {
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-live="polite">
        {!practice && messages.length === 0 && (
          <div className="rounded-2xl bg-secondary/60 p-4">
            <p className="text-sm">{t('chat.hello')}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STARTERS.map((k) => (
                <Suggestion key={k} onClick={() => send(starter(k))}>
                  {t(k)}
                </Suggestion>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} m={m} practice={practice} />
        ))}
        {busy && (
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
        {provider !== 'built-in' || t.lang === 'en' ? null : messages.length > 0 && <p className="text-[11px] text-muted-foreground">{t('assist.englishNote')}</p>}
        <div ref={end} />
      </div>

      <div className="border-t px-4 pb-4 pt-3">
        {practice && done ? (
          <Button className="h-11 w-full rounded-xl" onClick={() => (setMessages([]), setDone(false), void call([]))}>
            <RotateCcw /> {t('practice.again')}
          </Button>
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
            {!practice && messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3" /> {t('chat.new')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Bubble({ m, practice }: { m: Message; practice: boolean }) {
  const t = useT()
  const mine = m.role === 'user'
  const builtIn = m.source === 'built-in'
  if (m.debrief)
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-accent/60 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold">{t('chat.debrief')}</span>
          {m.stars ? <Stars n={m.stars} /> : null}
        </div>
        <Lines text={m.text} lang={builtIn ? 'en' : undefined} />
      </motion.div>
    )
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {practice && <span className="mb-0.5 text-[11px] text-muted-foreground">{mine ? t('practice.you') : t('practice.guest')}</span>}
      <div className={cn('max-w-[88%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary')}>
        <Lines text={m.text} lang={!mine && builtIn ? 'en' : undefined} />
        {!mine && (
          <button type="button" onClick={() => speak(m.text, { lang: builtIn ? 'en' : undefined })} className="mt-1 inline-flex items-center gap-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground" aria-label={t('card.read')}>
            <Volume2 className="size-3.5" /> {t('card.read')}
          </button>
        )}
      </div>
      {m.notice && <span className="mt-1 text-[11px] text-warn">{m.notice}</span>}
      {m.feedback && (
        <div className="mt-1.5 max-w-[92%] rounded-xl border border-primary/30 bg-accent/60 px-3 py-2 text-sm">
          {m.stars ? <Stars n={m.stars} className="mb-1" /> : null}
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
        </div>
      )}
    </motion.div>
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
