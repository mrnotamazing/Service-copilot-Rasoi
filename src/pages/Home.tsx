import { ArrowRight, BookOpen, ChefHat, HeartHandshake, LayoutDashboard, Play, Sparkles, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Mascot } from '../brand/marks.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { AppShell, LiveClock, SectionTitle, ShellSkeleton } from '../components/kit.tsx'
import { SPOKEN } from '../../shared/profile.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useT, type Key } from '../i18n/index.ts'
import { en } from '../i18n/en.ts'
import { post, useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

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

  return (
    <AppShell title={t('home.title')} sub={snap.config.name} right={<LiveClock now={snap.now} ok={connected} />} wide={false}>
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground">
        <Mascot className="pointer-events-none absolute right-5 top-1/2 w-44 -translate-y-1/2 max-sm:hidden" speed="var(--hero-foreground)" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 sm:pr-48">
          <div>
            <p className="text-sm opacity-75">{idle ? t('home.closed') : t('home.seated', { n: seated, total: snap.tables.length })}</p>
            <h2 className="font-display text-2xl">{idle ? t('home.ready') : t('home.running')}</h2>
          </div>
          {idle ? (
            <Button size="lg" className="h-11" onClick={() => void post('/api/sim/start')}>
              <Play /> {t('home.start')}
            </Button>
          ) : (
            <Badge variant="outline" className="gap-1 border-white/20 text-hero-foreground/80">
              <Sparkles className="size-3" /> {snap.ai.provider === 'claude' ? t('chat.byClaude') : snap.ai.provider === 'ollama' ? t('chat.byOllama') : snap.ai.provider === 'dify' ? t('assist.dify') : t('home.aiBuiltIn')}
            </Badge>
          )}
        </div>
        <div className="relative mt-5 flex items-center gap-3 sm:pr-48">
          <Users className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-sm">
              <span>{t('home.teamGoal')}</span>
              <span className="tabular opacity-75">
                {Math.min(snap.team.smooth, snap.team.goal)}/{snap.team.goal}
              </span>
            </div>
            <Progress value={Math.min(100, (snap.team.smooth / snap.team.goal) * 100)} className="mt-1.5 h-1.5 bg-white/15" aria-label={t('home.teamGoal')} />
          </div>
        </div>
      </motion.section>

      <div className="mt-8">
        <SectionTitle>{t('home.who')}</SectionTitle>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {servers.map((s) => {
          const tables = snap.tables.filter((t) => t.serverId === s.id && t.visitId).length
          const open = snap.openTasks?.[s.id] ?? 0
          return (
            <Link key={s.id} to={`/server/${s.id}`} className="group flex flex-col rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/40">
              <div className="flex items-center gap-3">
                <Avatar staff={s} className="size-11 text-lg" />
                <div className="min-w-0">
                  <div className="font-medium">
                    {s.name}
                    {s.pronouns && <span className="ml-1 text-xs font-normal text-muted-foreground">({s.pronouns})</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('home.section', { s: sectionOf(s.id) ?? '' })}</div>
                  {s.languages?.length ? (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{t('profile.speaks', { list: s.languages.map((l) => SPOKEN.find((x) => x.id === l)?.native ?? l).join(', ') })}</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="whitespace-nowrap tabular">
                  {t('home.load', { tables, cards: open })}
                </span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary">
                  {t('home.open')} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {snap.team.kudos.length > 0 && (
        <>
          <div className="mt-8">
            <SectionTitle>{t('home.kudos')}</SectionTitle>
          </div>
          <ul className="mt-3 space-y-2">
            {snap.team.kudos.slice(0, 4).map((k) => (
              <li key={k.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <HeartHandshake className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  {t('profile.thanked', { from: name(k.from), to: name(k.to), reason: reasonText(k.reason) })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8">
        <SectionTitle>{t('home.other')}</SectionTitle>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { to: '/kitchen', label: t('home.kitchenLabel'), sub: t('home.kitchenSub'), Icon: ChefHat },
          { to: '/manager', label: t('home.managerLabel'), sub: t('home.managerSub'), Icon: LayoutDashboard },
          { to: '/about', label: t('nav.how'), sub: t('home.howSub'), Icon: BookOpen },
        ].map(({ to, label, sub, Icon }) => (
          <Link key={to} to={to} className="group rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/40">
            <Icon className="size-5 text-primary" />
            <div className="mt-2 font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
