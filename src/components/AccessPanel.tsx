import { Accessibility, Check, Languages, UtensilsCrossed, Volume2, X } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { DEFAULT_PREFS, setPrefs, usePrefs, type Prefs } from '../lib/prefs.ts'
import { canSpeak, cuisineVoices, hasVoice, speak, speakTask, voicesFor } from '../lib/speech.ts'
import { MENU_FOR_TEST } from '../lib/pronounce.ts'

/**
 * Opens language & accessibility settings. Shown in every staff header as a pill with the
 * current language ("EN", "हि") so it is easy to spot, and as a labelled row where there is room.
 */
export function AccessButton({ className, variant = 'pill' }: { className?: string; variant?: 'pill' | 'row' | 'icon' }) {
  const [open, setOpen] = useState(false)
  const t = useT()
  const { lang } = usePrefs()
  const short = LANGUAGES.find((l) => l.id === lang)?.short ?? 'EN'
  return (
    <>
      {variant === 'row' ? (
        <button type="button" onClick={() => setOpen(true)} className={cn('flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent', className)}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Languages className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t('acc.open')}</span>
            <span className="block truncate text-xs text-muted-foreground">{t('acc.openSub')}</span>
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{short}</span>
        </button>
      ) : variant === 'icon' ? (
        <Button size="icon" variant="ghost" className={className} aria-label={t('acc.open')} title={t('acc.open')} onClick={() => setOpen(true)}>
          <Languages className="size-5" />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('acc.open')}
          title={t('acc.open')}
          className={cn('inline-flex h-9 shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent', className)}
        >
          <Languages className="size-4 text-primary" />
          {short}
        </button>
      )}
      <AccessPanel open={open} onOpenChange={setOpen} />
    </>
  )
}

export function AccessPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const p = usePrefs()
  const voices = canSpeak() ? voicesFor(p.lang) : []
  // Voices load asynchronously in Chrome; re-check once they arrive.
  const [, bump] = useState(0)
  useEffect(() => {
    if (!canSpeak()) return
    const on = () => bump((n) => n + 1)
    speechSynthesis.addEventListener('voiceschanged', on)
    return () => speechSynthesis.removeEventListener('voiceschanged', on)
  }, [])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[90dvh] max-w-xl">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 font-display text-2xl">
            <Accessibility className="size-6 text-primary" /> {t('acc.title')}
          </DrawerTitle>
          <DrawerDescription>{t('acc.sub')}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-8">
          <Group title={t('acc.language')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('acc.language')}>
              {LANGUAGES.map((l) => {
                const on = p.lang === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    lang={l.id}
                    onClick={() => setPrefs({ lang: l.id })}
                    className={cn('flex min-h-14 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors', on ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent')}
                  >
                    <span>
                      <span className="block font-medium">{l.native}</span>
                      {l.native !== l.english && <span className="block text-xs text-muted-foreground">{l.english}</span>}
                    </span>
                    {on && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t('acc.screensNote')}</p>
          </Group>

          <Group title={t('acc.reading')}>
            <div>
              <div className="mb-2 text-sm font-medium">{t('acc.textSize')}</div>
              <Segmented<Prefs['textSize']>
                label={t('acc.textSize')}
                value={p.textSize}
                onChange={(textSize) => setPrefs({ textSize })}
                options={[
                  { value: 'standard', label: t('acc.size.standard'), sample: 'text-sm' },
                  { value: 'large', label: t('acc.size.large'), sample: 'text-base' },
                  { value: 'xlarge', label: t('acc.size.xlarge'), sample: 'text-lg' },
                ]}
              />
            </div>
            <Toggle k="readableFont" label="acc.readable" hint="acc.readableHint" />
            <Toggle k="highContrast" label="acc.contrast" />
          </Group>

          <Group title={t('acc.listen')}>
            <Toggle k="readAloud" label="acc.readAloud" hint="acc.readAloudHint" />
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">{t('acc.rate')}</span>
              <Slider value={[p.speechRate]} min={0.6} max={1.4} step={0.1} onValueChange={([v]) => setPrefs({ speechRate: Math.round(v * 10) / 10 })} aria-label={t('acc.rate')} className="flex-1" />
              <span className="w-10 text-right text-sm tabular text-muted-foreground">{p.speechRate.toFixed(1)}×</span>
            </div>
            {voices.length > 1 && (
              <label className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm">{t('acc.voice')}</span>
                <select
                  className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm"
                  value={p.voices?.[p.lang] ?? ''}
                  onChange={(e) => setPrefs({ voices: { ...p.voices, [p.lang]: e.target.value || undefined } })}
                >
                  <option value="">{t('acc.voiceAuto')}</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              disabled={!canSpeak()}
              onClick={() => {
                // A real card, so people hear table numbers and dish names the way service will sound.
                const title = t('t.pickup', { table: 'T3', course: '@course.starter' })
                speakTask(`${t('acc.testPhrase')} ${title}`, '2× Galouti kebab, 1× Burrata & heirloom tomato', {
                  title: `Hello, I’m TableMate. Your next task will be read like this. Pick up T3 starters from the pass`,
                  hint: '2× Galouti kebab, 1× Burrata & heirloom tomato',
                })
              }}
            >
              <Volume2 /> {t('acc.test')}
            </Button>
            {canSpeak() && p.lang !== 'en' && !hasVoice(p.lang) && <p className="text-xs text-warn">{t('acc.noVoice')}</p>}
            {canSpeak() && (
              <div className="rounded-xl border bg-card p-3">
                <Button variant="secondary" className="h-10 w-full rounded-lg" onClick={() => speak(`${t('acc.dishIntro')} ${MENU_FOR_TEST.join(', ')}.`)}>
                  <UtensilsCrossed /> {t('acc.testDishes')}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">{t('acc.dishNote')}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {(Object.entries(cuisineVoices()) as [string, boolean][]).map(([code, ok]) => (
                    <span key={code} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', ok ? 'bg-good/12 text-good' : 'bg-warn/12 text-warn')}>
                      {ok ? <Check className="size-3" /> : <X className="size-3" />} {CUISINE_NAME[code]}
                    </span>
                  ))}
                </div>
                {Object.values(cuisineVoices()).some((ok) => !ok) && <p className="mt-1.5 text-xs text-muted-foreground">{t('acc.dishMissing')}</p>}
              </div>
            )}
          </Group>

          <Group title={t('acc.alerts')}>
            <Toggle k="flash" label="acc.flash" hint="acc.flashHint" />
            <Toggle k="chime" label="acc.chime" />
            <Toggle k="haptics" label="acc.haptics" />
          </Group>

          <Group title={t('acc.calm')}>
            <Toggle k="focusMode" label="acc.focus" hint="acc.focusHint" />
            <Toggle k="quietCelebrations" label="acc.quiet" hint="acc.quietHint" />
            <Toggle k="reduceMotion" label="acc.reduceMotion" />
            <Toggle k="leftHanded" label="acc.leftHanded" hint="acc.leftHint" />
          </Group>

          <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={() => setPrefs({ ...DEFAULT_PREFS, lang: p.lang })}>
            {t('acc.reset')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Cuisine voices, named in their own language. */
const CUISINE_NAME: Record<string, string> = { hi: 'हिन्दी', it: 'Italiano', fr: 'Français' }

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

type BoolKey = { [K in keyof Prefs]-?: Prefs[K] extends boolean ? K : never }[keyof Prefs]

function Toggle({ k, label, hint }: { k: BoolKey; label: Key; hint?: Key }) {
  const t = useT()
  const p = usePrefs()
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
      <span>
        <span className="block text-sm font-medium">{t(label)}</span>
        {hint && <span className="block text-xs text-muted-foreground">{t(hint)}</span>}
      </span>
      <Switch id={id} checked={p[k]} onCheckedChange={(v) => setPrefs({ [k]: v } as Partial<Prefs>)} />
    </label>
  )
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; sample?: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('min-h-11 rounded-lg px-2 font-medium transition-colors', o.sample, value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
