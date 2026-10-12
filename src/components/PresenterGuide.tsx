// The presenter's running order: each stop in the story, where to open it, what to say and what to
// point at, and whether that screen has something to show right now (with one tap to stage it if not).

import { Check, ExternalLink, Presentation, Sparkles, Square } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import { safetyIssues } from '../../shared/safety.ts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { post } from '../lib/live.ts'

interface Stop {
  title: string
  to: string
  /** The one line to say when you open it. */
  say: string
  show: string[]
  /** Something to show is on screen right now. */
  ready: boolean
  /** Moments that put it there. */
  stage?: string[]
}

function stops(snap: Snapshot, me: string): Stop[] {
  const tables = snap.tables
  const name = snap.config.staff.find((s) => s.id === me)?.name ?? 'the server'
  const mine = tables.filter((t) => t.serverId === me && t.visitId)
  const clash = mine.some((t) => t.lines.some((l) => !l.safetyResolvedAt && l.status !== 'served' && safetyIssues(snap.config.menu.find((m) => m.id === l.menuItemId), t.party).length))
  const guestTrouble = tables.some((t) => (t.mood?.value === 'unhappy' && !t.recoveredAt) || (t.managerRequestedAt && !(t.managerVisitedAt && t.managerVisitedAt >= t.managerRequestedAt)))
  return [
    {
      title: `${name}’s phone`,
      to: `/server/${me}?device=phone`,
      say: 'Each server sees only their next three moves, in the order the guests need them. Suggestions, never orders.',
      show: ['“Why this first” above the top card', 'Tap the main button and the next card slides up', 'The sparkle button: ask “Is the burrata vegetarian?”'],
      ready: (snap.openTasks?.[me] ?? 0) >= 2,
      stage: ['arrival'],
    },
    {
      title: 'The allergy safety check',
      to: `/server/${me}?device=phone`,
      say: 'A nut allergy at the table and a dish with nuts on the order: it becomes the top card the moment it’s fired. Rule-based, never an AI guess.',
      show: ['The red safety card: “Tell the kitchen”', 'The ticket on the kitchen screen gets the same flag'],
      ready: clash,
      stage: ['allergy'],
    },
    {
      title: 'The kitchen pass',
      to: '/kitchen',
      say: 'The kitchen sees every ticket with its timer, and answers guests’ questions once: the answer is saved for the next server.',
      show: ['A guest’s question waiting: answer it and tick “save to the menu”', 'Late tickets in amber', 'The 86 board: switch a dish off and servers are told'],
      ready: !!snap.questions?.some((q) => !q.answer) || tables.some((t) => t.lines.some((l) => l.status === 'fired' && snap.now > l.expectedReadyAt)),
      stage: ['question', 'kitchen_delay'],
    },
    {
      title: 'The manager’s screen',
      to: '/manager',
      say: 'The manager sees the floor and the process, never a ranking of people. Delays are split between kitchen and floor.',
      show: ['“Needs you now”: an unhappy table or a guest asking for the manager', '“Share the floor”: hand a table to a server who speaks the guests’ language', '“Why is this happening?” and “Next 15 minutes”', '“What if…?”: try “an extra grill cook”'],
      ready: guestTrouble && (snap.insights?.length ?? 0) > 0,
      stage: ['unhappy', 'language'],
    },
    {
      title: 'Training, privately',
      to: `/server/${me}?device=phone&tab=profile`,
      say: 'Practice runs on the server’s own phone; scores and XP stay with them.',
      show: ['Practice tough moments: reply “the chef died, sorry” and watch the score', 'The ideal reply to compare with', 'Their own coach tip and learning journey'],
      ready: true,
    },
    {
      title: 'What happened, step by step',
      to: '/manager',
      say: 'Every finished table leaves a receipt: each step against its standard, coloured by who controlled it.',
      show: ['Delay receipts at the bottom: open one', '“Where time goes” and the kitchen stations'],
      ready: (snap.analytics?.visits ?? 0) > 0,
    },
    {
      title: 'Plugging into the restaurant',
      to: '/demo?tab=integrations',
      say: 'TableMate listens to the POS and the booking app; nobody types orders twice.',
      show: ['Send a test booking and watch it seat a table', 'Alerts out to WhatsApp or Slack', 'Export tonight’s visits as a spreadsheet (no names)'],
      ready: true,
    },
  ]
}

export function PresenterGuide({ snap }: { snap: Snapshot }) {
  const servers = snap.config.staff.filter((s) => s.role === 'server')
  const presenter = snap.sim.presenter
  const [who, setWho] = useState(presenter ?? servers[0]?.id ?? 's_aisha')
  const [busy, setBusy] = useState<string | null>(null)
  const me = presenter ?? who

  async function prepare() {
    setBusy('prepare')
    try {
      await post('/api/sim/presenter', { staffId: who })
      toast.success(`Ready: you’re presenting as ${servers.find((s) => s.id === who)?.name}. Everyone else is on autopilot.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  async function stage(i: number, kinds: string[]) {
    setBusy(String(i))
    try {
      let staged = 0
      for (const kind of kinds) {
        const r = await post<{ ok: boolean; text: string }>('/api/sim/moment', { kind, staffId: kind === 'language' || kind === 'unhappy' ? undefined : me })
        if (r.ok) staged++
        else toast(r.text)
      }
      if (staged) toast.success('Staged: open the screen now')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="presenter" className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Presentation className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="presenter" className="font-display text-xl">
            Presenting
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            {presenter
              ? 'Service has been running for about 100 minutes, and every screen below has something to show. Anything you use up comes back within a few minutes.'
              : 'One tap sets up a service already 100 minutes in, with reports filled and a story on every screen. You play one server; everyone else, the kitchen included, runs itself.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presenter ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-sm font-medium text-primary">
                <Check className="size-4" aria-hidden /> You’re {servers.find((s) => s.id === presenter)?.name}
              </span>
              <Button variant="outline" size="sm" className="rounded-full" disabled={busy !== null} onClick={() => void prepare()}>
                <Sparkles /> Set up again
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void post('/api/sim/presenter', { on: false }).then(() => toast('Presenter mode off'))}>
                <Square /> Stop
              </Button>
            </>
          ) : (
            <>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger className="h-10 w-36" aria-label="Present as">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Play {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="h-10 rounded-full px-5" disabled={busy !== null} onClick={() => void prepare()}>
                <Sparkles /> {busy === 'prepare' ? 'Setting up…' : 'Set up a presentation'}
              </Button>
            </>
          )}
        </div>
      </div>

      <ol className="rise-stagger mt-5 grid gap-3 md:grid-cols-2">
        {stops(snap, me).map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border bg-background p-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm tabular" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-medium">{s.title}</h3>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', s.ready ? 'bg-good/12 text-good' : 'bg-warn/12 text-warn')}>
                  <span className={cn('size-1.5 rounded-full', s.ready ? 'bg-good' : 'bg-warn')} aria-hidden />
                  {s.ready ? 'Ready to show' : 'Nothing on screen yet'}
                </span>
              </div>
              <p className="mt-1 text-sm text-pretty">“{s.say}”</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {s.show.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button asChild size="sm" className="h-8 rounded-full">
                  <Link to={s.to}>Open</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 rounded-full">
                  <a href={(location.hash ? '#' : '') + s.to} target="_blank" rel="noreferrer">
                    <ExternalLink /> New tab
                  </a>
                </Button>
                {!s.ready && s.stage && (
                  <Button size="sm" variant="outline" className="h-8 rounded-full" disabled={busy !== null} onClick={() => void stage(i, s.stage!)}>
                    <Sparkles /> Stage it
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
