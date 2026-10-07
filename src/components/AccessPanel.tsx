import { Accessibility, Check, Volume2 } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT, type Key } from '../i18n/index.ts'
import { DEFAULT_PREFS, setPrefs, usePrefs, type Prefs } from '../lib/prefs.ts'
import { canSpeak, hasVoice, speak } from '../lib/speech.ts'

/** Opens the comfort & access settings. Lives in every staff header so it is never more than a tap away. */
export function AccessButton({ className, label }: { className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false)
  const t = useT()
  return (
    <>
      <Button size={label ? 'default' : 'icon'} variant="ghost" className={className} aria-label={t('hdr.access')} title={t('hdr.access')} onClick={() => setOpen(true)}>
        <Accessibility className="size-5" />
        {label && <span>{t('hdr.access')}</span>}
      </Button>
      <AccessPanel open={open} onOpenChange={setOpen} />
    </>
  )
}

export function AccessPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const p = usePrefs()
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
            <Button variant="outline" className="h-11 w-full rounded-xl" disabled={!canSpeak()} onClick={() => speak(t('acc.testPhrase'))}>
              <Volume2 /> {t('acc.test')}
            </Button>
            {canSpeak() && p.lang !== 'en' && !hasVoice(p.lang) && <p className="text-xs text-warn">{t('acc.noVoice')}</p>}
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

type BoolKey = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs]

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
