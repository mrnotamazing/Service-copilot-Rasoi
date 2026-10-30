// The menu, on the server's phone: every dish with what it is, what's in it, how hot it is, what the
// kitchen can change and what the chef has already answered about it. Pick one of your tables and
// each dish says whether it suits those guests (from the allergies and diets taken when they sat down),
// so "what can I offer table 4?" is one tap. Dishes the kitchen has switched off show as off tonight.

import { Ban, BookOpen, ChefHat, CircleCheck, Flame, Loader2, MessageCircleQuestion, Search, Send, ShieldAlert, Sparkles, Trash2, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { Course, MenuItem, TableState } from '../../shared/types.ts'
import { safetyIssues, type SafetyIssue } from '../../shared/safety.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { L, useT } from '../i18n/index.ts'
import { speak } from '../lib/speech.ts'
import { act, post } from '../lib/live.ts'
import { toast } from 'sonner'
import { SPOKEN } from '../../shared/profile.ts'
import { getPrefs } from '../lib/prefs.ts'
import type { AiAnswer } from '../lib/ai.ts'

const COURSES: Course[] = ['drink', 'starter', 'main', 'dessert']

interface Msg {
  role: 'user' | 'assistant'
  text: string
  dishes?: string[]
}
/** Each table's suggestion thread, kept while the app is open so a later wish builds on the earlier ones. */
const threads = new Map<string, Msg[]>()

/** The suggestion conversation for one table: wishes in, dishes and lines to say out. */
function useSuggest(staffId: string, tableId: string | null) {
  const key = tableId ?? 'all'
  const [msgs, setMsgs] = useState<Msg[]>(() => threads.get(key) ?? [])
  const [busy, setBusy] = useState(false)
  const [shownKey, setShownKey] = useState(key)
  if (shownKey !== key) {
    setShownKey(key)
    setMsgs(threads.get(key) ?? [])
  }
  const save = (m: Msg[]) => {
    threads.set(key, m)
    setMsgs(m)
  }
  async function send(text: string, dishId?: string) {
    if (!text.trim() || busy) return
    const next = [...msgs, { role: 'user' as const, text: text.trim() }]
    save(next)
    setBusy(true)
    try {
      const a = await post<AiAnswer>('/api/ai', { kind: 'menu_suggest', staffId, tableId: tableId ?? undefined, dishId, lang: getPrefs().lang, messages: next.map(({ role, text: x }) => ({ role, text: x })) })
      save([...next, { role: 'assistant', text: a.text, dishes: a.dishes }])
    } catch (e) {
      save([...next, { role: 'assistant', text: e instanceof Error ? e.message : String(e) }])
    } finally {
      setBusy(false)
    }
  }
  const latest = [...msgs].reverse().find((m) => m.role === 'assistant')?.dishes ?? []
  return { msgs, busy, send, clear: () => save([]), suggested: new Set(latest) }
}

/** Opens the menu sheet (optionally for one table) through the page address, so any card can open it. */
export function useMenuSheet() {
  const [params, setParams] = useSearchParams()
  const value = params.get('menu')
  const set = (v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === null) next.delete('menu')
        else next.set('menu', v)
        return next
      },
      { replace: true },
    )
  return { open: value !== null, tableId: value && value !== 'all' ? value : null, show: (tableId?: string) => set(tableId ?? 'all'), close: () => set(null) }
}

export function MenuButton({ className, label = true }: { className?: string; label?: boolean }) {
  const menu = useMenuSheet()
  return (
    <Button size={label ? 'sm' : 'icon'} variant="ghost" className={className} aria-label={L('Menu')} onClick={() => menu.show()}>
      <BookOpen />
      {label && <span>{L('Menu')}</span>}
    </Button>
  )
}

export function MenuSheet({ snap, staffId }: { snap: Snapshot; staffId: string }) {
  const t = useT()
  const menu = useMenuSheet()
  const [q, setQ] = useState('')
  const [course, setCourse] = useState<Course | 'all'>('all')
  const myTables = snap.tables.filter((x) => x.serverId === staffId && x.visitId)
  const table = myTables.find((x) => x.id === menu.tableId) ?? null
  const off = new Set(snap.unavailable)
  const chat = useSuggest(staffId, table?.id ?? null)

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return snap.config.menu
      .filter((m) => course === 'all' || m.course === course)
      .filter((m) => !needle || `${m.name} ${m.description ?? ''} ${(m.contains ?? []).join(' ')}`.toLowerCase().includes(needle))
      .map((m) => ({ m, off: off.has(m.id), issues: table ? safetyIssues(m, table.party) : [] }))
      // Available first, then (for a table) what suits them, then by course order.
      .sort((a, b) => Number(chat.suggested.has(b.m.id)) - Number(chat.suggested.has(a.m.id)) || Number(a.off) - Number(b.off) || Number(a.issues.length > 0) - Number(b.issues.length > 0) || COURSES.indexOf(a.m.course) - COURSES.indexOf(b.m.course))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.config.menu, snap.unavailable, q, course, table?.id, table?.party, chat.suggested.size, [...chat.suggested].join()])

  const suits = table ? items.filter((i) => !i.off && i.issues.length === 0).length : 0

  return (
    <Drawer open={menu.open} onOpenChange={(o) => !o && menu.close()}>
      <DrawerContent className="mx-auto flex max-h-[92dvh] max-w-xl flex-col">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="font-display text-2xl">{L('Menu')}</DrawerTitle>
          <DrawerDescription>{table ? L('What suits {table}: {n} dishes', { table: table.name, n: suits }) : L('Tap a table to see what suits those guests.')}</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-2.5 px-4 pb-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search dishes or ingredients')} aria-label={L('Search dishes or ingredients')} className="h-11 pl-9" />
          </label>

          {/* For which guests */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label={L('For which table')}>
            <Chip on={!table} onClick={() => menu.show()}>
              {L('Everyone')}
            </Chip>
            {myTables.map((x) => (
              <Chip key={x.id} on={table?.id === x.id} onClick={() => menu.show(x.id)}>
                {x.name}
                {needsOf(x).length > 0 && <ShieldAlert className="size-3.5" aria-label={L('Has an allergy or diet')} />}
              </Chip>
            ))}
          </div>

          {/* Course */}
          <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label={L('Course')}>
            <Chip on={course === 'all'} onClick={() => setCourse('all')}>
              {L('All')}
            </Chip>
            {COURSES.filter((c) => snap.config.menu.some((m) => m.course === c)).map((c) => (
              <Chip key={c} on={course === c} onClick={() => setCourse(c)}>
                <span className="capitalize">{t.any(`course.${c}`)}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* The guest panel scrolls with the dishes: open for editing, it would otherwise squeeze the list to nothing. */}
        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {table && (
            <li className="list-none">
              <GuestPanel table={table} staffId={staffId} />
            </li>
          )}
          <li className="list-none">
            <SuggestChat chat={chat} table={table} />
          </li>
          {items.length === 0 && <li className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{L('No dishes match.')}</li>}
          {items.map(({ m, off: isOff, issues }) => (
            <Dish key={m.id} m={m} off={isOff} issues={issues} table={table} suggested={chat.suggested.has(m.id)} onSuggest={() => void chat.send(L('Suggest the {dish}', { dish: m.name }), m.id)} busy={chat.busy} />
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  )
}

function Dish({ m, off, issues, table, suggested, onSuggest, busy }: { m: MenuItem; off: boolean; issues: SafetyIssue[]; table: TableState | null; suggested: boolean; onSuggest: () => void; busy: boolean }) {
  const t = useT()
  const word = useWord()
  const [open, setOpen] = useState(false)
  const clash = issues.length > 0
  return (
    <li className={cn('rounded-2xl border bg-card p-3.5', off && 'opacity-60', clash && !off && 'border-destructive/40', suggested && !off && !clash && 'border-primary/50 ring-1 ring-primary/20')}>
      <div className="flex items-start gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={cn('block font-medium leading-snug', off && 'line-through')} translate="no">
            {m.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="capitalize">{t.any(`course.${m.course}`)}</span>
            {m.spice ? (
              <span className="inline-flex items-center text-kitchen" aria-label={L('Spice {n} of 3', { n: m.spice })}>
                {Array.from({ length: m.spice }, (_, i) => (
                  <Flame key={i} className="size-3.5" aria-hidden />
                ))}
              </span>
            ) : null}
            {suggested && !off && !clash && (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden /> {L('Suggested')}
              </span>
            )}
            {off && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Ban className="size-3.5" aria-hidden /> {L('Off tonight')}
              </span>
            )}
          </span>
        </button>
        <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label={L('Say “{name}” aloud', { name: m.name })} onClick={() => speak(m.name)}>
          <Volume2 />
        </Button>
        {!off && !clash && (
          <Button size="sm" variant="outline" className="h-9 shrink-0 rounded-full text-primary" disabled={busy} onClick={onSuggest} aria-label={L('Suggest the {dish}', { dish: m.name })}>
            <Sparkles /> {L('Suggest')}
          </Button>
        )}
      </div>

      {table && !off && (
        <p className={cn('mt-2 flex items-start gap-1.5 text-sm', clash ? 'text-destructive' : 'text-good')}>
          {clash ? <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {clash
              ? L('Not for {table}: {why}', { table: table.name, why: issues.map((i) => `${word(`tag.${i.tag}`, i.tag)} (${i.because === 'allergy' ? L('allergy') : need(i.because)})`).join(', ') })
              : L('Suits {table}', { table: table.name })}
          </span>
        </p>
      )}

      {m.description && <p className="mt-2 text-sm leading-relaxed text-pretty">{m.description}</p>}

      {(m.contains?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.contains!.map((c) => (
            <span key={c} className={cn('rounded-full px-2 py-0.5 text-[11px]', issues.some((i) => i.tag === c) ? 'bg-destructive/12 font-medium text-destructive' : 'bg-muted text-muted-foreground')}>
              {word(`tag.${c}`, c)}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          {m.adjust && (
            <p className="flex items-start gap-1.5">
              <ChefHat className="mt-0.5 size-4 shrink-0 text-kitchen" aria-hidden />
              <span>
                <span className="font-medium">{L('The kitchen can')}: </span>
                {m.adjust}
              </span>
            </p>
          )}
          {(m.facts ?? []).slice(-3).map((f) => (
            <p key={f.at} className="flex items-start gap-1.5 text-muted-foreground">
              <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="text-foreground">{f.q}</span> {f.a}
              </span>
            </p>
          ))}
          {!m.adjust && !(m.facts ?? []).length && <p className="text-muted-foreground">{L('Nothing more noted yet. Ask the kitchen from the Kitchen tab.')}</p>}
        </div>
      )}
    </li>
  )
}

function SuggestChat({ chat, table }: { chat: ReturnType<typeof useSuggest>; table: TableState | null }) {
  const [text, setText] = useState('')
  const quick = [L('Something spicy'), L('Something light'), L('Vegetarian'), L('A dessert')]
  // Keep the newest answer in view.
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [chat.msgs.length, chat.busy])
  return (
    <section className="rounded-2xl border border-primary/25 bg-accent/40 p-3" aria-label={L('Ideas for this table')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> {table ? L('Ideas for {table}', { table: table.name }) : L('Ideas for the guests')}
        </h3>
        {chat.msgs.length > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={chat.clear}>
            <Trash2 /> {L('Start over')}
          </Button>
        )}
      </div>
      {chat.msgs.length > 0 && (
        <ol ref={list} className="mt-2 max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
          {chat.msgs.map((m, i) => (
            <li key={i} className={cn('max-w-[92%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'ml-auto rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-background')}>
              {m.text}
            </li>
          ))}
          {chat.busy && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> {L('Thinking…')}
            </li>
          )}
        </ol>
      )}
      {chat.msgs.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quick.map((x) => (
            <button key={x} type="button" className="min-h-9 rounded-full border bg-background px-3 text-sm pointer-coarse:min-h-11" onClick={() => void chat.send(x)} disabled={chat.busy}>
              {x}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void chat.send(text)
          setText('')
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={chat.msgs.length ? L('Anything else they mentioned?') : L('What do they feel like? e.g. something spicy')} aria-label={L('What the guests would like')} className="h-10 bg-background" />
        <Button type="submit" size="icon" className="size-10 shrink-0" disabled={!text.trim() || chat.busy} aria-label={L('Send')}>
          <Send />
        </Button>
      </form>
    </section>
  )
}

const ALLERGENS = ['nuts', 'dairy', 'gluten', 'egg', 'shellfish', 'fish', 'soy', 'sesame']
const DIETS = ['vegetarian', 'vegan', 'jain', 'halal', 'no_beef', 'no_pork']

/**
 * Everything known about the table, in one place: who they are, the occasion, the language, access
 * needs, and their allergies and diet. The server can add what the guests mention at the table; the
 * safety check and the suggestions use it at once, and a new allergy goes to the kitchen card again.
 */
function GuestPanel({ table, staffId }: { table: TableState; staffId: string }) {
  const t = useT()
  const word = useWord()
  const p = table.party
  const [editing, setEditing] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])
  const [diets, setDiets] = useState<string[]>([])
  if (!p) return null
  const lang = p.language && p.language !== 'en' ? SPOKEN.find((x) => x.id === p.language)?.native ?? p.language : null
  const access = (p.needs ?? []).filter((n) => !DIETS.includes(n) && n !== 'fasting')
  const facts = [
    L('party of {n}', { n: p.size }),
    p.guestName,
    p.vip ? L('regular') : '',
    p.occasion ? L(p.occasion) : '',
    lang ? t('party.speaks', { lang }) : '',
    ...access.map((n) => word(`need.${n}`, n.replace(/_/g, ' '))),
  ].filter(Boolean)
  const open = () => {
    setAllergies(p.allergies)
    setDiets((p.needs ?? []).filter((n) => DIETS.includes(n)))
    setEditing(true)
  }
  const toggle = (list: string[], set: (x: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  async function save() {
    try {
      await act('party.updated', { tableId: table.id, allergies, needs: [...(p!.needs ?? []).filter((n) => !DIETS.includes(n)), ...diets], from: staffId })
      toast.success(L('Updated. The safety check and suggestions use it now.'))
      setEditing(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }
  const noted = needsOf(table)
  return (
    <section className="rounded-2xl border bg-card p-3 text-sm" aria-label={L('Guests at {table}', { table: table.name })}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{L('Guests at {table}', { table: table.name })}</div>
          <div className="text-xs text-muted-foreground">{facts.join(' · ')}</div>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full" onClick={open}>
            {L('Update')}
          </Button>
        )}
      </div>
      {!editing && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <ShieldAlert className={cn('size-3.5', noted.length ? 'text-destructive' : 'text-muted-foreground')} aria-hidden />
          {noted.length ? (
            noted.map((n) => (
              <span key={n.k} className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                {n.k.startsWith('need.') ? need(n.raw) : word(n.k, n.raw)}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">{L('No allergies or diet noted. Ask before you suggest.')}</span>
          )}
        </p>
      )}
      {editing && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{L('Allergies')}</div>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <Chip key={a} on={allergies.includes(a)} onClick={() => toggle(allergies, setAllergies, a)}>
                  {word(`tag.${a}`, a)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{L('Diet')}</div>
            <div className="flex flex-wrap gap-1.5">
              {DIETS.map((d) => (
                <Chip key={d} on={diets.includes(d)} onClick={() => toggle(diets, setDiets, d)}>
                  {need(d)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="rounded-full" onClick={() => void save()}>
              {L('Save')}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>
              {L('Cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn('inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm transition-colors pointer-coarse:min-h-11', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}

/** A dictionary word in the current language, or the raw word when there is none. */
function useWord() {
  const t = useT()
  return (key: string, raw: string) => {
    const v = t.any(key)
    return v && v !== key ? v : raw
  }
}

/** A diet in a word or two, for chips and reasons. */
function need(n: string): string {
  const words: Record<string, string> = { vegetarian: L('vegetarian'), jain: L('Jain'), halal: L('halal'), vegan: L('vegan'), no_beef: L('no beef'), no_pork: L('no pork'), fasting: L('fasting') }
  return words[n] ?? n.replace(/_/g, ' ')
}

/** A table's allergies and diet needs, as translation keys with the raw word as the fallback. */
function needsOf(x: TableState): { k: string; raw: string }[] {
  const p = x.party
  if (!p) return []
  return [...p.allergies.map((a) => ({ k: `tag.${a}`, raw: a })), ...(p.needs ?? []).filter((n) => ['vegetarian', 'jain', 'halal', 'vegan', 'no_beef', 'no_pork', 'fasting'].includes(n)).map((n) => ({ k: `need.${n}`, raw: n }))]
}

