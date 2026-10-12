import { BookOpen, ChefHat, Clapperboard, HeartHandshake, LayoutDashboard, ShieldCheck, Timer, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Mascot } from '../brand/marks.tsx'
import { AppShell } from '../components/kit.tsx'
import { useT, type Key } from '../i18n/index.ts'
import { useRolePage } from '../lib/role.ts'

const SCREENS: { to: string; label: Key; sub: Key; Icon: typeof Users }[] = [
  { to: '/servers', label: 'nav.servers', sub: 'start.serversSub', Icon: Users },
  { to: '/manager', label: 'nav.manager', sub: 'start.managerSub', Icon: LayoutDashboard },
  { to: '/kitchen', label: 'nav.kitchen', sub: 'start.kitchenSub', Icon: ChefHat },
  { to: '/demo', label: 'nav.demo', sub: 'start.demoSub', Icon: Clapperboard },
]

const PROMISE: { title: Key; sub: Key; Icon: typeof Users }[] = [
  { title: 'start.quick', sub: 'start.quickSub', Icon: Timer },
  { title: 'start.correct', sub: 'start.correctSub', Icon: ShieldCheck },
  { title: 'start.together', sub: 'start.togetherSub', Icon: HeartHandshake },
]

/** The front door: the same four sections as the menu, one card each. */
export default function Start() {
  useRolePage(null)
  const t = useT()
  return (
    <AppShell wide={false}>
      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 text-hero-foreground md:p-8">
        <Mascot className="pointer-events-none absolute -bottom-2 right-6 w-40 max-sm:hidden" speed="var(--hero-foreground)" />
        <h1 className="font-display text-3xl md:text-4xl">{t('start.title')}</h1>
        <p className="mt-2 max-w-[48ch] text-sm opacity-80 md:text-base">{t('start.sub')}</p>
      </section>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {SCREENS.map(({ to, label, sub, Icon }) => (
          <li key={to}>
            <Link to={to} className="group flex h-full items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xl">{t(label)}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{t(sub)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* The brand promise: quick and correct, and shared across the team. */}
      <section aria-labelledby="promise" className="relative mt-12 border-t pt-6">
        {/* The chef runs along the rule: the service line, kept moving. */}
        <Mascot className="absolute -top-[36px] left-0 w-[60px]" speed="var(--muted-foreground)" />
        <h2 id="promise" className="font-display text-2xl text-balance md:text-3xl">
          {t('start.promise')}
        </h2>
        <ul className="mt-5 grid gap-5 sm:grid-cols-3">
          {PROMISE.map(({ title, sub, Icon }) => (
            <li key={title} className="border-l-2 border-primary pl-4">
              <div className="flex items-center gap-2 font-display text-lg">
                <Icon className="size-4 text-primary" aria-hidden /> {t(title)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">{t(sub)}</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-sm text-muted-foreground">{t('start.present')}</p>
      <Link to="/about" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <BookOpen className="size-4" /> {t('nav.how')}
      </Link>
    </AppShell>
  )
}
