import { ArrowRight, BookOpen, ChefHat, LayoutDashboard, Settings, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { AppHeader, Loading, SectionTitle } from '../components/kit.tsx'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSnapshot } from '../lib/live.ts'

export default function Home() {
  const { snap } = useSnapshot('kitchen')
  if (!snap) return <Loading />
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const sectionOf = (id: string) => Object.entries(snap.config.sections).find(([, s]) => s === id)?.[0]
  const idle = snap.sim.startedAt === null && snap.tables.every((t) => !t.visitId)
  const seated = snap.tables.filter((t) => t.visitId).length

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Sparkles className="size-3" /> {snap.ai.provider === 'dify' ? 'AI via Dify' : 'Built-in AI writer'}
          </Badge>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{snap.config.name}</h1>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            A copilot for the floor. It reads what your POS already knows and brings up each server’s next three moves, sorted by what matters most to the guest.
          </p>
          {!idle && (
            <p className="mt-2 text-sm tabular text-muted-foreground">
              Service is running: {seated} of {snap.tables.length} tables seated.
            </p>
          )}
        </motion.div>

        <div className="mt-6 grid gap-3">
          {idle && (
            <Link to="/setup" className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-accent/50 p-4 text-sm transition-colors hover:bg-accent">
              <span>
                <span className="font-medium">No service running.</span> Start the simulator in Setup to see a dinner rush, or connect your POS.
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          )}
          <Link to="/about" className="flex items-center gap-3 rounded-xl border p-4 text-sm transition-colors hover:bg-secondary">
            <BookOpen className="size-5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">New here?</span> <span className="text-muted-foreground">Read how the copilot works: the problem, the design and the theory behind it.</span>
            </span>
            <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        <div className="mt-10">
          <SectionTitle>I’m on the floor</SectionTitle>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {servers.map((s) => (
            <Link key={s.id} to={`/server/${s.id}`} className="group block rounded-xl">
              <Card className="transition-shadow group-hover:ring-primary/50">
                <CardContent className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full font-display text-lg text-white" style={{ background: s.color }} aria-hidden>
                    {s.name[0]}
                  </span>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">Section {sectionOf(s.id)}</div>
                  </div>
                  <ArrowRight className="ml-auto size-4 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <SectionTitle>Other screens</SectionTitle>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { to: '/kitchen', label: 'Kitchen pass', sub: 'Tickets, availability, notes from the floor', Icon: ChefHat },
            { to: '/manager', label: 'Manager', sub: 'Bottlenecks, delay receipts, shift summary', Icon: LayoutDashboard },
            { to: '/setup', label: 'Setup', sub: 'Service standards, POS, AI, simulator', Icon: Settings },
          ].map(({ to, label, sub, Icon }) => (
            <Link key={to} to={to} className="group block rounded-xl">
              <Card className="h-full transition-shadow group-hover:ring-primary/50">
                <CardContent>
                  <Icon className="size-5 text-primary" />
                  <div className="mt-2 font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
