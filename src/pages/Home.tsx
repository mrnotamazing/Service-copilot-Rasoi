import { ChefHat, LayoutDashboard, Settings, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSnapshot } from '../lib/live.ts'
import { Loading } from './ServerView.tsx'

export default function Home() {
  const { snap } = useSnapshot('kitchen')
  if (!snap) return <Loading />
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const sectionOf = (id: string) => Object.entries(snap.config.sections).find(([, s]) => s === id)?.[0]

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron">Service Copilot</div>
      <h1 className="mt-2 font-display text-4xl leading-tight">{snap.config.name}</h1>
      <p className="mt-2 max-w-xl text-muted">
        A copilot for the floor. It reads what your POS already knows and brings up each server’s next three moves, sorted by what matters most to the guest.
      </p>

      {snap.sim.startedAt === null && snap.tables.every((t) => !t.visitId) && (
        <Link to="/setup" className="mt-6 block rounded-2xl border border-saffron/50 bg-saffron/10 p-4 text-sm">
          <span className="font-semibold text-saffron">No service running.</span> Start the simulator in Setup to see a dinner rush, or connect your POS.
        </Link>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">I’m on the floor</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {servers.map((s) => (
          <Link key={s.id} to={`/server/${s.id}`} className="group rounded-2xl border border-line bg-surface p-4 transition hover:border-saffron/60">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full font-display text-lg text-bg" style={{ background: s.color }}>
                {s.name[0]}
              </span>
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted">Section {sectionOf(s.id)}</div>
              </div>
              <Smartphone className="ml-auto size-4 text-faint group-hover:text-saffron" />
            </div>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Other screens</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { to: '/kitchen', label: 'Kitchen pass', sub: 'Tickets, 86 board, floor notes', Icon: ChefHat },
          { to: '/manager', label: 'Manager', sub: 'Bottlenecks & delay receipts', Icon: LayoutDashboard },
          { to: '/setup', label: 'Setup', sub: 'SOPs, POS, simulator', Icon: Settings },
        ].map(({ to, label, sub, Icon }) => (
          <Link key={to} to={to} className="rounded-2xl border border-line bg-surface p-4 transition hover:border-saffron/60">
            <Icon className="size-5 text-saffron" />
            <div className="mt-2 font-semibold">{label}</div>
            <div className="text-xs text-muted">{sub}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
