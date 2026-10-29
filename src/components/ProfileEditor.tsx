import { Camera, Check, Loader2, Pencil, Type } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AVATAR_COLORS, AVATAR_ICONS, MAX_PHOTO_CHARS, SPOKEN } from '../../shared/profile.ts'
import type { Staff } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { post } from '../lib/live.ts'
import { AVATAR_ICON, Avatar } from './Avatar.tsx'

const PRONOUNS: { key: Key; value: string }[] = [
  { key: 'pronoun.none', value: '' },
  { key: 'pronoun.they', value: 'they/them' },
  { key: 'pronoun.she', value: 'she/her' },
  { key: 'pronoun.he', value: 'he/him' },
]

/** "About me" on the Profile tab: how teammates see you, with an Edit button. */
export function ProfileCard({ me }: { me: Staff }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const spoken = (me.languages ?? []).map((l) => SPOKEN.find((x) => x.id === l)?.native ?? l)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar staff={me} className="size-14 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl">
            {me.name} {me.pronouns && <span className="font-sans text-sm font-normal text-muted-foreground">({me.pronouns})</span>}
          </div>
          <div className="truncate text-sm text-muted-foreground">{spoken.length ? t('profile.speaks', { list: spoken.join(', ') }) : t('profile.aboutMe')}</div>
        </div>
        <Button variant="outline" className="h-10 rounded-full" onClick={() => setOpen(true)}>
          <Pencil /> {t('profile.edit')}
        </Button>
      </div>
      <ProfileEditor me={me} open={open} onOpenChange={setOpen} />
    </section>
  )
}

/** Shrink a photo to a small square (centre crop) so it loads instantly on every screen. */
async function toAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 160
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 160, 160)
    for (const q of [0.82, 0.7, 0.55]) {
      const data = canvas.toDataURL('image/jpeg', q)
      if (data.length <= MAX_PHOTO_CHARS) return data
    }
    throw new Error('too big')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ProfileEditor({ me, open, onOpenChange }: { me: Staff; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const [name, setName] = useState(me.name)
  const [color, setColor] = useState(me.color)
  const [avatar, setAvatar] = useState(me.avatar ?? '')
  const [pronouns, setPronouns] = useState(me.pronouns ?? '')
  const [otherPronouns, setOtherPronouns] = useState(!PRONOUNS.some((p) => p.value === (me.pronouns ?? '')))
  const [languages, setLanguages] = useState<string[]>(me.languages ?? [])
  const [saving, setSaving] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  // Start from what's saved each time the editor opens.
  function reset(o: boolean) {
    if (o) {
      setName(me.name)
      setColor(me.color)
      setAvatar(me.avatar ?? '')
      setPronouns(me.pronouns ?? '')
      setOtherPronouns(!PRONOUNS.some((p) => p.value === (me.pronouns ?? '')))
      setLanguages(me.languages ?? [])
    }
    onOpenChange(o)
  }

  async function save() {
    setSaving(true)
    try {
      await post('/api/staff/profile', { staffId: me.id, name, color: AVATAR_COLORS.includes(color) ? color : undefined, avatar, pronouns, languages })
      toast.success(t('profile.saved'))
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  const preview = { name: name || me.name, color, avatar }
  return (
    <Drawer open={open} onOpenChange={reset}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-xl">
        <DrawerHeader>
          <DrawerTitle className="font-display text-2xl">{t('profile.edit')}</DrawerTitle>
          <DrawerDescription>{t('profile.visible')}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-4">
          {/* Picture */}
          <section className="flex flex-col items-center gap-3">
            <Avatar staff={preview} className="size-24 text-4xl shadow-lg ring-4 ring-background" />
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" className="h-10 rounded-full" onClick={() => file.current?.click()}>
                <Camera /> {t('profile.photo')}
              </Button>
              <Button variant="ghost" className="h-10 rounded-full" onClick={() => setAvatar('')} disabled={!avatar}>
                <Type /> {t('profile.initial')}
              </Button>
              <input
                ref={file}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    setAvatar(await toAvatar(f))
                  } catch {
                    toast.error(t('profile.photoBad'))
                  }
                }}
              />
            </div>
          </section>

          <Field label={t('profile.illustrated')}>
            <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label={t('profile.illustrated')}>
              {AVATAR_ICONS.map((id) => {
                const Icon = AVATAR_ICON[id]
                const on = avatar === `icon:${id}`
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={id}
                    onClick={() => setAvatar(`icon:${id}`)}
                    className={cn('grid aspect-square place-items-center rounded-full text-white transition-transform hover:scale-105', on && 'ring-2 ring-foreground ring-offset-2 ring-offset-background')}
                    style={{ background: color }}
                  >
                    <Icon className="size-[55%]" strokeWidth={1.8} />
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label={t('profile.colour')}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('profile.colour')}>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn('grid size-9 place-items-center rounded-full text-white', color === c && 'ring-2 ring-foreground ring-offset-2 ring-offset-background')}
                  style={{ background: c }}
                >
                  {color === c && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('profile.name')}>
            <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" autoComplete="nickname" name="display-name" />
          </Field>

          <Field label={t('profile.pronouns')} hint={t('profile.pronounsHint')}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('profile.pronouns')}>
              {PRONOUNS.map((p) => (
                <Pill key={p.key} on={!otherPronouns && pronouns === p.value} onClick={() => (setOtherPronouns(false), setPronouns(p.value))}>
                  {t(p.key)}
                </Pill>
              ))}
              <Pill on={otherPronouns} onClick={() => setOtherPronouns(true)}>
                {t('pronoun.other')}
              </Pill>
            </div>
            {otherPronouns && <Input value={pronouns} maxLength={24} onChange={(e) => setPronouns(e.target.value)} placeholder={t('pronoun.placeholder')} className="mt-2 h-10 rounded-xl" />}
          </Field>

          <Field label={t('profile.languages')} hint={t('profile.languagesHint')}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('profile.languages')}>
              {SPOKEN.map((l) => {
                const on = languages.includes(l.id)
                return (
                  <Pill key={l.id} multi on={on} onClick={() => setLanguages(on ? languages.filter((x) => x !== l.id) : [...languages, l.id])} lang={l.id}>
                    {on && <Check className="size-3.5" />} {l.native}
                  </Pill>
                )
              })}
            </div>
          </Field>
        </div>
        <DrawerFooter className="flex-row border-t">
          <Button variant="ghost" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
            {t('profile.cancel')}
          </Button>
          <Button className="h-11 flex-1" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} {t('profile.save')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-medium">{label}</h3>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

function Pill({ on, onClick, children, lang, multi }: { on: boolean; onClick: () => void; children: React.ReactNode; lang?: string; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      lang={lang}
      onClick={onClick}
      className={cn('inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}
