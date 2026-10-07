import { ChevronLeft, Drama, Loader2, Mic, RotateCcw, Send, Star, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { AiAnswer, PracticeTurn } from '../../server/ai.ts'
import { SCENARIOS } from '../../shared/practice.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { post } from '../lib/live.ts'
import { getPrefs, usePrefs } from '../lib/prefs.ts'
import { speak } from '../lib/speech.ts'

/** Entry card on the Profile tab (and a button in Ask TableMate) that opens the practice room. */
export function PracticeCard() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Drama className="size-5 text-primary" /> {t('practice.title')}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t('practice.sub')}</p>
      <Button variant="secondary" className="mt-3 h-11 w-full rounded-xl" onClick={() => setOpen(true)}>
        <Drama /> {t('practice.start')}
      </Button>
      <PracticeDrawer open={open} onOpenChange={setOpen} />
    </section>
  )
}

interface Turn extends PracticeTurn {
  feedback?: string
  stars?: number
}

/**
 * A safe place to rehearse tough moments: TableMate plays the guest, the server replies by
 * typing or speaking, and gets coaching on each reply. Nothing is saved or shared.
 */
export function PracticeDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const { readAloud } = usePrefs()
  const [scenario, setScenario] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [source, setSource] = useState<AiAnswer['source']>('built-in')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [turns, busy])

  async function next(history: Turn[], id = scenario) {
    if (!id) return
    setBusy(true)
    try {
      const a = await post<AiAnswer>('/api/ai', { kind: 'practice', scenario: id, history: history.map(({ role, text }) => ({ role, text })), lang: getPrefs().lang })
      setSource(a.source)
      // Coaching belongs to the reply it's about; the guest's answer follows it.
      const withFeedback = history.map((h, i) => (i === history.length - 1 && h.role === 'server' ? { ...h, feedback: a.feedback, stars: a.stars } : h))
      setTurns([...withFeedback, { role: 'guest', text: a.text }])
      setDone(!!a.done)
      if (readAloud) speak(a.text)
    } finally {
      setBusy(false)
    }
  }

  function start(id: string) {
    setScenario(id)
    setTurns([])
    setDone(false)
    void next([], id)
  }

  function send(text = reply) {
    const msg = text.trim()
    if (!msg || busy) return
    setReply('')
    const history: Turn[] = [...turns, { role: 'server', text: msg }]
    setTurns(history)
    void next(history)
  }

  const reset = () => {
    setScenario(null)
    setTurns([])
    setDone(false)
  }

  return (
    <Drawer open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DrawerContent className="mx-auto max-h-[90dvh] max-w-xl">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 font-display text-2xl">
            {scenario && (
              <Button size="icon" variant="ghost" className="-ml-2 size-9" aria-label={t('practice.back')} onClick={reset}>
                <ChevronLeft />
              </Button>
            )}
            <Drama className="size-5 text-primary" /> {scenario ? t(`sc.${scenario}` as Key) : t('practice.title')}
          </DrawerTitle>
          <DrawerDescription>{scenario ? t('practice.how') : t('practice.pick')}</DrawerDescription>
        </DrawerHeader>

        {!scenario ? (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto px-4 pb-8">
            {SCENARIOS.map((s) => (
              <button key={s.id} type="button" onClick={() => start(s.id)} className="min-h-20 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent">
                <span className="block font-medium">{t(`sc.${s.id}` as Key)}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{t(`sc.${s.id}.d` as Key)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-col px-4 pb-6">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
              {turns.map((turn, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex flex-col', turn.role === 'server' ? 'items-end' : 'items-start')}>
                  <span className="mb-0.5 text-[11px] text-muted-foreground">{turn.role === 'guest' ? t('practice.guest') : t('practice.you')}</span>
                  <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', turn.role === 'server' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary')}>
                    <span lang={turn.role === 'guest' && source === 'built-in' ? 'en' : undefined}>{turn.text}</span>
                    {turn.role === 'guest' && (
                      <button type="button" onClick={() => speak(turn.text, { lang: source === 'built-in' ? 'en' : undefined })} className="ml-1.5 inline-grid size-6 place-items-center rounded-full align-middle text-muted-foreground hover:bg-background" aria-label={t('card.read')}>
                        <Volume2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {turn.feedback && (
                    <div className="mt-1.5 max-w-[90%] rounded-xl border border-primary/30 bg-accent/60 px-3 py-2 text-sm">
                      {turn.stars ? (
                        <div className="mb-1 flex gap-0.5" aria-label={t('practice.stars', { n: turn.stars })}>
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={cn('size-4', n <= turn.stars! ? 'fill-primary text-primary' : 'text-border')} />
                          ))}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-line leading-relaxed" lang={source === 'built-in' ? 'en' : undefined}>
                        {turn.feedback}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <div ref={end} />
            </div>
            {source === 'built-in' && t.lang !== 'en' && <p className="pb-2 text-[11px] text-muted-foreground">{t('assist.englishNote')}</p>}
            {done ? (
              <div className="space-y-2 border-t pt-3 text-center">
                <p className="text-sm text-muted-foreground">{t('practice.done')}</p>
                <Button className="h-11 w-full rounded-xl" onClick={reset}>
                  <RotateCcw /> {t('practice.again')}
                </Button>
              </div>
            ) : (
              <form
                className="flex gap-2 border-t pt-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <Dictate onText={(x) => setReply((r) => (r ? `${r} ${x}` : x))} />
                <Input name="practice-reply" aria-label={t('practice.reply')} autoComplete="off" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('practice.reply')} className="h-11 rounded-full" />
                <Button type="submit" size="icon" className="size-11 rounded-full" aria-label={t('practice.send')} disabled={busy || !reply.trim()}>
                  <Send />
                </Button>
              </form>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

type Recognition = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void }

/** Speak instead of type, where the browser supports speech recognition. */
function Dictate({ onText }: { onText: (text: string) => void }) {
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
