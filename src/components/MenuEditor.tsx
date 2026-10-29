// The menu, as the restaurant describes it: what each dish contains (for the safety check), how
// spicy it is, what it is and what the kitchen can change. Servers' questions are answered from
// this; the kitchen's answers to new questions are kept here too, so each is only asked once.

import { useT, L } from '../i18n/index.ts'
import { ChefHat, Flame, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { MenuItem } from '../../shared/types.ts'
import { COURSES, STATIONS, TAG_LABEL, TAGS } from '../../shared/menuEdit.ts'
import { SPICE_WORDS } from '../../shared/menuAnswer.ts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { post } from '../lib/live.ts'
import { PanelTitle } from './kit.tsx'

const BLANK: MenuItem = { id: '', name: '', course: 'main', station: 'hot', prepMin: 12, contains: [] }
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function Spice({ level }: { level?: MenuItem['spice'] }) {
  const tx = useT()
  if (level === undefined) return <span className="text-xs text-warn">{tx('ui.menueditor.spice_not_recorded')}</span>
  return (
    <span className="inline-flex items-center gap-0.5" title={SPICE_WORDS[level]} role="img" aria-label={`Spice: ${SPICE_WORDS[level]}`}>
      {[1, 2, 3].map((i) => (
        <Flame key={i} className={cn('size-3.5', i <= level ? 'text-primary' : 'text-muted-foreground/30')} aria-hidden />
      ))}
    </span>
  )
}

export function MenuEditor({ snap }: { snap: Snapshot }) {
  const tx = useT()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const menu = snap.config.menu
  const missing = menu.filter((m) => m.spice === undefined || !m.description).length
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>
          <PanelTitle>{tx('ui.menueditor.menu')}</PanelTitle>
        </CardTitle>
        <CardDescription>
          {tx('ui.menueditor.what_each_dish_contains')}
          {missing > 0 && ' ' + (missing === 1 ? L('{n} dish needs details.', { n: missing }) : L('{n} dishes need details.', { n: missing }))}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing({ ...BLANK })}>
            <Plus /> {tx('ui.menueditor.add_a_dish')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {COURSES.filter((c) => menu.some((m) => m.course === c)).map((c) => (
          <section key={c}>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{cap(c)}s</h3>
            <ul className="divide-y rounded-xl border">
              {menu
                .filter((m) => m.course === c)
                .map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setEditing(m)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <Spice level={m.spice} />
                          {!m.description && (
                            <span className="inline-flex items-center gap-1 text-warn">
                              <TriangleAlert className="size-3" /> {tx('ui.menueditor.no_description')}
                            </span>
                          )}
                          {m.facts?.length ? (
                            <span className="inline-flex items-center gap-1">
                              <ChefHat className="size-3" /> {m.facts.length} {tx('ui.menueditor.kitchen')} {m.facts.length === 1 ? 'answer' : 'answers'}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </CardContent>
      <DishSheet key={editing?.id || 'new'} dish={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function DishSheet({ dish, onClose }: { dish: MenuItem | null; onClose: () => void }) {
  const tx = useT()
  const [d, setD] = useState<MenuItem>(dish ?? BLANK)
  const [busy, setBusy] = useState(false)
  const isNew = !dish?.id
  const set = (patch: Partial<MenuItem>) => setD((x) => ({ ...x, ...patch }))
  async function save() {
    setBusy(true)
    try {
      await post('/api/menu', { item: d })
      toast.success(isNew ? L('{name} added to the menu', { name: d.name }) : L('{name} saved', { name: d.name }))
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!confirm(L('Remove {name} from the menu?', { name: d.name }))) return
    await post('/api/menu', { deleteId: d.id })
    toast.success(`${d.name} removed`)
    onClose()
  }
  return (
    <Sheet open={!!dish} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{isNew ? L('Add a dish') : d.name}</SheetTitle>
          <SheetDescription>{tx('ui.menueditor.servers_answer_guests_from')}</SheetDescription>
        </SheetHeader>
        <form
          className="space-y-4 px-4 pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label={tx('ui.menueditor.name')} id="dish-name">
            <Input id="dish-name" value={d.name} onChange={(e) => set({ name: e.target.value })} required maxLength={80} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={tx('ui.menueditor.course')} id="dish-course">
              <Select value={d.course} onValueChange={(v) => set({ course: v as MenuItem['course'] })}>
                <SelectTrigger id="dish-course" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {cap(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tx('ui.manager.station')} id="dish-station">
              <Select value={d.station} onValueChange={(v) => set({ station: v as MenuItem['station'] })}>
                <SelectTrigger id="dish-station" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {cap(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tx('ui.menueditor.prep_min')} id="dish-prep">
              <Input id="dish-prep" type="number" min={1} max={90} value={d.prepMin} onChange={(e) => set({ prepMin: Number(e.target.value) })} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{tx('ui.menueditor.how_spicy')}</legend>
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1">
              {([undefined, 0, 1, 2, 3] as const).map((lvl) => (
                <button
                  key={String(lvl)}
                  type="button"
                  aria-pressed={d.spice === lvl}
                  onClick={() => set({ spice: lvl })}
                  className={cn('min-h-9 rounded-lg px-1 text-xs font-medium', d.spice === lvl ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {lvl === undefined ? L('Not set') : ['None', 'Mild', 'Medium', 'Hot'][lvl]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{tx('ui.menueditor.contains_for_the_allergy')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((tag) => {
                const on = d.contains?.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ contains: on ? d.contains!.filter((x) => x !== tag) : [...(d.contains ?? []), tag] })}
                    className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-warn bg-warn/15 font-medium text-warn' : 'text-muted-foreground hover:bg-secondary')}
                  >
                    {TAG_LABEL[tag]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Field label={tx('ui.menueditor.what_it_is')} id="dish-desc" hint={tx('ui.menueditor.a_sentence_or_two')}>
            <Textarea id="dish-desc" rows={3} maxLength={400} value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label={tx('ui.menueditor.what_the_kitchen_can')} id="dish-adjust" hint={tx('ui.menueditor.e_g_can_be')}>
            <Textarea id="dish-adjust" rows={2} maxLength={300} value={d.adjust ?? ''} onChange={(e) => set({ adjust: e.target.value })} />
          </Field>

          {d.facts?.length ? (
            <div>
              <div className="mb-1.5 text-sm font-medium">{tx('ui.menueditor.the_kitchen_s_answers')}</div>
              <ul className="space-y-1.5">
                {d.facts.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/60 p-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{f.q}</span>
                      {f.a}
                    </span>
                    <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={tx('ui.menueditor.remove_this_answer')} onClick={() => set({ facts: d.facts!.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy || !d.name.trim()}>
              {isNew ? L('Add to the menu') : L('Save dish')}
            </Button>
            {!isNew && (
              <Button type="button" variant="outline" onClick={() => void remove()}>
                <Trash2 /> {tx('ui.menueditor.remove')}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
