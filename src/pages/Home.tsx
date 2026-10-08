import { ArrowRight, HeartHandshake, Play, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar.tsx'
import { AppShell, LiveClock, ShellSkeleton } from '../components/kit.tsx'
import { SPOKEN } from '../../shared/profile.ts'
import type { TableStatus } from '../../shared/types.ts'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useT, type Key } from '../i18n/index.ts'
import { en } from '../i18n/en.ts'
import { post, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

/** Table status as a quiet colour: free, guests in, eating, paying, needs a reset. */
const STATUS_TONE: Record<TableStatus, string> = {
  available: 'bg-muted text-muted-foreground',
  seated: 'bg-primary/12 text-primary',
  ordering: 'bg-primary/12 text-primary',
  dining: 'bg-good/12 text-good',
  bill: 'bg-warn/15 text-warn',
  paid: 'bg-warn/15 text-warn',
  needs_reset: 'bg-secondary text-secondary-foreground',
}
const GLANCE: TableStatus[] = ['available', 'seated', 'dining', 'bill', 'needs_reset']
const DOT: Partial<Record<TableStatus, string>> = { available: 'bg-muted-foreground/40', seated: 'bg-primary', dining: 'bg-good', bill: 'bg-warn', needs_reset: 'bg-secondary-foreground/50' }

/** Servers: who is on the floor, how busy each section is, and a door into each server's app. */
export default function Home() {
  useRolePage(null)
  const { snap, connected } = useSnapshot('kitchen')
  const t = useT()
  if (!snap) return <ShellSkeleton />
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const sectionOf = (id: string) => Object.entries(snap.config.sections).find(([, s]) => s === id)?.[0]
  const idle = snap.sim.startedAt === null && snap.tables.every((t) => !t.visitId)
  const seated = snap.tables.filter((t) => t.visitId).length
  const name = (id: string) => snap.config.staff.find((s) => s.id === id)?.name ?? id
  const reasonText = (r: string) => {
    const k = (Object.keys(en) as Key[]).find((key) => key.startsWith('kudos.r') && en[key] === r)
    return k ? t(k) : r
  }
  const count = (st: TableStatus) => snap.tables.filter((x) => (st === 'seated' ? x.status === 'seated' || x.status === 'ordering' : st === 'bill' ? x.status === 'bill' || x.status === 'paid' : x.status === st)).length

  return (
    <AppShell title={t('servers.title')} sub={t('home.title')} right={<LiveClock now={snap.now} ok={connected} />}>
      {/* Service status in one line, instead of a big banner. */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-hero px-5 py-4 text-hero-foreground">
        <div className="min-w-0">
          <p className="text-xs opacity-75">{idle ? t('home.closed') : t('home.seated', { n: seated, total: snap.tables.length })}</p>
          <h2 className="font-display text-xl">{idle ? t('home.ready') : t('home.running')}</h2>
        </div>
        <div className="flex min-w-56 flex-1 items-center gap-3">
          <Users className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate">{t('home.teamGoal')}</span>
              <span className="tabular opacity-75">
                {Math.min(snap.team.smooth, snap.team.goal)}/{snap.team.goal}
              </span>
            </div>
            <Progress value={Math.min(100, (snap.team.smooth / snap.team.goal) * 100)} className="mt-1.5 h-1.5 bg-white/15" aria-label={t('home.teamGoal')} />
          </div>
        </div>
        {idle ? (
          <Button className="h-10" onClick={() => void post('/api/sim/start')}>
            <Play /> {t('home.start')}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-xs opacity-80">
            <Sparkles className="size-3" /> {snap.ai.provider === 'claude' ? t('chat.byClaude') : snap.ai.provider === 'ollama' ? t('chat.byOllama') : snap.ai.provider === 'dify' ? t('assist.dify') : t('home.aiBuiltIn')}
          </span>
        )}
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="who">
          <h2 id="who" className="mb-3 text-sm font-medium text-muted-foreground">
            {t('home.who')} · {servers.length}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {servers.map((s) => {
              const section = sectionOf(s.id)
              const tables = snap.tables.filter((x) => x.serverId === s.id)
              const active = tables.filter((x) => x.visitId).length
              const open = snap.openTasks?.[s.id] ?? 0
              return (
                <li key={s.id}>
                  <Link to={`/server/${s.id}`} className="group flex h-full flex-col rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center gap-3">
                      <Avatar staff={s} className="size-11 text-lg" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {s.name}
                          {s.pronouns && <span className="ml-1 text-xs font-normal text-muted-foreground">({s.pronouns})</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{section ? t('home.section', { s: section }) : '–'}</div>
                      </div>
                    </div>
                    {s.languages?.length ? <div className="mt-2 truncate text-xs text-muted-foreground">{t('profile.speaks', { list: s.languages.map((l) => SPOKEN.find((x) => x.id === l)?.native ?? l).join(', ') })}</div> : null}
                    {/* Each of their tables with its status, so the floor reads at a glance. */}
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('home.section', { s: section ?? '' })}>
                      {tables.map((x) => (
                        <li key={x.id} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular', STATUS_TONE[x.status])} title={`${x.name}: ${t.any(`status.${x.status}`)}`}>
                          {x.name}
                          <span className="sr-only">: {t.any(`status.${x.status}`)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap tabular">{t('home.load', { tables: active, cards: open })}</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary">
                        {t('home.open')} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-medium">{t('servers.glance')}</h2>
            <ul className="mt-3 space-y-2">
              {GLANCE.map((st) => (
                <li key={st} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn('size-2.5 rounded-full', DOT[st])} aria-hidden />
                    {t.any(`status.${st}`)}
                  </span>
                  <span className="font-medium tabular">{count(st)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-medium">{t('home.kudos')}</h2>
            {snap.team.kudos.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('servers.kudosEmpty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snap.team.kudos.slice(0, 5).map((k) => (
                  <li key={k.id} className="flex items-start gap-2 text-sm">
                    <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">{t('profile.thanked', { from: name(k.from), to: name(k.to), reason: reasonText(k.reason) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
