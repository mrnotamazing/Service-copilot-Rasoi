import { ArrowRight, ChefHat, Hand, HeartPulse, Receipt, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '../../shared/types.ts'
import { AppHeader } from '../components/kit.tsx'
import { TaskCard } from '../components/TaskCard.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSnapshot } from '../lib/live.ts'

const DEMO_STAFF = 's_aisha'

/** Shown when no service is running, so the hero never sits empty. */
function exampleTasks(now: number): Task[] {
  const base = { staffId: DEMO_STAFF, score: 0, actions: [] }
  return [
    {
      ...base,
      id: 'ex-delay',
      kind: 'kitchen_delay',
      tableId: 'T4',
      tableName: 'T4',
      title: 'T4 mains running 6 min late',
      hint: 'Kitchen is behind on the lamb shank. A heads-up now beats an apology later.',
      impact: 4,
      createdAt: now - 70_000,
      dueAt: now + 50_000,
      actions: [{ label: 'Told them', event: 'noop', payload: {}, primary: true }],
    },
    {
      ...base,
      id: 'ex-greet',
      kind: 'greet',
      tableId: 'T2',
      tableName: 'T2',
      title: 'Welcome T2',
      hint: 'Party of 4, Ms. Iyer, anniversary, allergy: nuts. Water, menus, today’s specials.',
      impact: 3,
      createdAt: now - 30_000,
      dueAt: now + 90_000,
      actions: [{ label: 'Greeted', event: 'noop', payload: {}, primary: true }],
    },
  ]
}

export default function AboutView() {
  const { snap } = useSnapshot('server', DEMO_STAFF)
  const now = snap?.now ?? Date.now()
  const live = snap?.me?.top ?? []
  const cards = live.length ? live.slice(0, 2) : exampleTasks(now)

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main">
        {/* Hero: the thesis, with the product itself as the image. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">OB project proposal, Working Group B3</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.25rem)] font-medium leading-[1.02] tracking-[-0.02em]">Six tables. Twelve standards. One pair of hands.</h1>
            <p className="mt-6 max-w-[38rem] text-pretty text-lg leading-relaxed text-muted-foreground">
              Rasoi is a service copilot for fine-dining servers. It reads what the restaurant’s POS already knows and puts the next three things that matter on the server’s phone, in
              the order the guest would want them done. When something runs late, it records whose step it was, so nobody is blamed for a slow grill.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link to={`/server/${DEMO_STAFF}`}>
                  <Smartphone /> Try a server’s screen
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5">
                <Link to="/manager">See the manager view</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="mx-auto max-w-[400px] rounded-[2rem] border bg-secondary/50 p-3 shadow-sm">
              <div className="flex items-center justify-between px-3 pb-3 pt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Aisha, section A</span>
                <span>{live.length ? 'Live from the simulated service' : 'Example'}</span>
              </div>
              {/* Example cards are a picture of the product, so they are not interactive. */}
              <div className="grid gap-3" inert={!live.length}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {cards.map((t, i) => (
                    <TaskCard key={t.id} task={t} now={now} lead={i === 0} staffId={DEMO_STAFF} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <Section title="The problem" lead="Restaurants digitised the order. They didn’t digitise the server’s job.">
          <div className="grid gap-8 md:grid-cols-3">
            <Point icon={<Hand />} title="Everything lives in one head">
              A server on six tables tracks greetings, courses, check-backs, bills and resets at once. Each standard is simple; together they overload working memory during a rush.
            </Point>
            <Point icon={<ChefHat />} title="Information stops at the pass">
              The POS knows a dish is late or off the menu. The server finds out when the guest asks. Two-way news between kitchen and floor still travels by shouting.
            </Point>
            <Point icon={<Receipt />} title="Blame lands on the floor">
              Guests and managers see the server, so a slow kitchen reads as slow service. Service failures cost return visits (Chung &amp; Hoffman, 1998), and the wrong person carries them.
            </Point>
          </div>
        </Section>

        <Section title="How a card is born" lead="No new hardware and no data entry. The copilot listens to events the POS already produces.">
          <ol className="grid gap-4 md:grid-cols-4">
            {[
              ['Something happens', 'The POS reports it: a table is seated, a KOT is fired, food is ready, a bill is printed, a dish is marked unavailable.'],
              ['A standard applies', 'The restaurant’s own SOPs turn the event into a task with a time limit, such as “greet within 2 minutes”.'],
              ['It’s ranked', 'Priority is guest impact × urgency against the standard, plus a nudge for tables left alone longest. Only the top three are shown.'],
              ['It closes itself', 'When the POS shows the step happened, the card disappears. The server rarely taps “done”, and “Later” is always available.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border bg-card p-5">
                <span className="font-display text-3xl text-primary tabular">{i + 1}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When the POS shows…</th>
                  <th className="px-4 py-2.5 font-medium">The server sees</th>
                  <th className="px-4 py-2.5 font-medium">It clears when</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['A table is seated', 'Welcome T4, with party size, guest name, occasion and allergies', 'The server taps Greeted, or an order arrives'],
                  ['An order with an allergy', 'Flag T3’s nut allergy to the kitchen (one tap sends it)', 'Confirmed at the pass'],
                  ['A dish is marked unavailable', 'Risotto is off: tell T6, with two alternatives to suggest', 'The guest has been told'],
                  ['A ticket runs past its usual time', 'T4 mains running 6 min late: give them a heads-up', 'Told, or the food is ready'],
                  ['Food is ready at the pass', 'Pick up T4’s mains', 'Served'],
                  ['A course has been served', 'Check in on T4, then clear and fire the next course', 'Checked in / cleared'],
                  ['The bill is printed, then paid', 'Present the bill, say goodbye, reset the table with a checklist', 'Each step is done'],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="px-4 py-3 align-top">{a}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{b}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Fair by design" lead="Every late table gets a receipt that shows which step ran long and who controlled it.">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4 text-pretty leading-relaxed text-muted-foreground">
              <p>
                A visit is split into measured steps: seated to greeted, kitchen prep, pass to table, bill, reset. Each step has an owner and a standard. A grill that runs nine minutes
                over is a kitchen delay; the server’s phone says so, and it is never counted against them.
              </p>
              <p>
                Managers see the same receipts as patterns: which stage and which station run late, and when. Suggestions are about the process, like a food runner at peak, not about
                people. Personal scores stay on each server’s own phone; the manager’s screen never receives them.
              </p>
            </div>
            <SampleReceipt />
          </div>
        </Section>

        <Section title="Why it’s built this way" lead="Each design choice answers a specific idea from organisational behaviour.">
          <dl className="divide-y rounded-2xl border">
            {[
              ['Cognitive Load Theory', 'Sweller, 1988', 'The app holds the state of every table and shows at most three cards, so working memory goes to the guest.'],
              ['Self-Determination Theory', 'Deci & Ryan, 1985', 'Autonomy: every card can wait (“Later”) and nothing is forced. Competence: streaks and personal bests against yourself. Relatedness: team metrics and two-way kitchen notes.'],
              ['Attribution Theory', 'Kelley, 1967', 'Timestamps separate what the server controlled from what the process controlled before anyone is held responsible.'],
              ['Equity and justice', 'Adams, 1963; Colquitt, 2001', 'Delay receipts make outcomes fair; consistent rules and visible evidence make the process fair.'],
              ['Feedback Intervention Theory', 'Kluger & DeNisi, 1996', 'Feedback is about the task (“T4 is waiting on the bill”), never the person (“you’re slow”).'],
              ['Electronic monitoring research', 'Ravid et al., 2020', 'Monitoring raises stress unless its purpose is developmental and transparent, so there are no leaderboards and no manager view of individuals.'],
            ].map(([t, cite, d]) => (
              <div key={t} className="grid gap-1 p-5 md:grid-cols-[16rem_1fr] md:gap-6">
                <dt>
                  <div className="font-medium">{t}</div>
                  <div className="text-xs text-muted-foreground">{cite}</div>
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Will restaurants adopt it?" lead="Rogers’ diffusion of innovations names five things that decide it. Here is how the copilot meets each.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Relative advantage', 'Fewer missed steps, no shouting to the pass, and evidence that protects servers from blame. Visible in the first shift.'],
              ['Compatibility', 'Sits on top of Petpooja or whichever POS is already there, uses the restaurant’s own SOPs, runs on existing phones.'],
              ['Low complexity', 'One screen, three cards, one tap. No typing, because the POS already has the data.'],
              ['Trialability', 'Switch on one section or one shift first. The simulator lets staff practise before a real service.'],
              ['Observability', 'End-of-shift stats for each server and a bottleneck view for the manager make results easy to see.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border bg-card p-5">
                <h3 className="font-medium">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Under the hood" lead="One event format in the middle, so any POS can plug in and every screen stays in sync.">
          <Architecture />
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <Status tone="good" title="Working now">
              Rules engine and priority scoring, server, kitchen and manager screens, delay receipts, the dinner-rush simulator, any POS sending events to the open endpoint.
            </Status>
            <Status tone="warn" title="Needs Petpooja partner access">
              Item stock and food-ready callbacks follow Petpooja’s public API. Table, KOT and bill events for dine-in are partner-only; the endpoint is built and waiting for their format.
            </Status>
            <Status tone="muted" title="Next">
              Restroworks, Toast and Square adapters; staff logins; learning each server’s preferred order from their “Later” taps; watch vibrations for the top card.
            </Status>
          </div>
        </Section>

        <Section title="AI where words matter" lead="The copilot works out what needs doing. Dify, an open-source AI platform, helps with how to say it.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              [<Sparkles key="a" />, 'What do I say?', 'A gracious line for a delay, a dish that has run out, a greeting or a goodbye.'],
              [<Smartphone key="b" />, 'Brief me', 'Your section at a glance: allergies, regulars, occasions and anything the kitchen is behind on.'],
              [<HeartPulse key="c" />, 'Ask', 'Answers about service standards, from the restaurant’s own SOP manual.'],
              [<ShieldCheck key="d" />, 'Shift summary', 'Tonight’s bottlenecks in plain English for the manager, never ranking individuals.'],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="rounded-2xl border bg-card p-5">
                <span className="text-primary [&_svg]:size-5">{icon}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[65ch] text-sm text-muted-foreground">The copilot gathers the facts and sends them to Dify. If Dify isn’t connected or doesn’t answer, a built-in writer responds instead, so the buttons always work.</p>
        </Section>

        <Section title="How we’ll test it" lead="The prototype tests one claim: an autonomy-supportive design reduces perceived surveillance while improving service consistency.">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['No app', 'Servers work a simulated six-table rush the usual way.'],
              ['Monitoring-style app', 'Same tasks, but with rankings and everything visible to the manager.'],
              ['Rasoi copilot', 'Top-three cards, self-closing tasks, private stats, delay receipts.'],
            ].map(([t, d], i) => (
              <div key={t} className={cn('rounded-2xl border p-5', i === 2 ? 'border-primary/50 bg-accent/40' : 'bg-card')}>
                <div className="text-sm text-muted-foreground">Condition {i + 1}</div>
                <h3 className="mt-1 font-medium">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[65ch] leading-relaxed text-muted-foreground">
            Measures: workload (NASA-TLX), perceived electronic monitoring, need satisfaction at work (BPNS-W), justice perceptions (Colquitt) and missed service steps, exported from the
            event log. The second condition is what shows that the design, not just having an app, makes the difference.
          </p>
        </Section>

        <section className="border-t bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl">Working Group B3</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Drishti Gulati, Div Mehta, Sehaj Mittal, Vidush Srivastava, Shobith Das, Arnavi Khandelwal and Jonnah Harshith.</p>
              <Button asChild className="mt-5">
                <Link to="/">
                  Open the app <ArrowRight />
                </Link>
              </Button>
            </div>
            <div>
              <h2 className="font-display text-2xl">References</h2>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>Adams, J. S. (1963). Towards an understanding of inequity. <i>Journal of Abnormal and Social Psychology</i>, 67(5), 422–436.</li>
                <li>Chung, B., &amp; Hoffman, K. D. (1998). Critical incidents: Service failures that matter most. <i>Cornell HRA Quarterly</i>, 39(3), 66–71.</li>
                <li>Colquitt, J. A. (2001). On the dimensionality of organizational justice. <i>Journal of Applied Psychology</i>, 86(3), 386–400.</li>
                <li>Deci, E. L., &amp; Ryan, R. M. (1985). <i>Intrinsic motivation and self-determination in human behavior</i>. Plenum.</li>
                <li>Kelley, H. H. (1967). Attribution theory in social psychology. <i>Nebraska Symposium on Motivation</i>, 15, 192–238.</li>
                <li>Kluger, A. N., &amp; DeNisi, A. (1996). The effects of feedback interventions on performance. <i>Psychological Bulletin</i>, 119(2), 254–284.</li>
                <li>Ravid, D. M., et al. (2020). EPM 2020: A review and meta-analysis of electronic performance monitoring. <i>Personnel Psychology</i>, 73(1), 1–56.</li>
                <li>Rogers, E. M. (2003). <i>Diffusion of innovations</i> (5th ed.). Free Press.</li>
                <li>Sweller, J. (1988). Cognitive load during problem solving. <i>Cognitive Science</i>, 12(2), 257–285.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-3xl leading-tight md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-[60ch] text-pretty text-lg text-muted-foreground">{lead}</p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

function Point({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary [&_svg]:size-5">{icon}</span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

function Status({ tone, title, children }: { tone: 'good' | 'warn' | 'muted'; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Badge variant="outline" className={cn('gap-1.5', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn')}>
        <span className={cn('size-1.5 rounded-full', tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : 'bg-muted-foreground')} />
        {title}
      </Badge>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

/** A worked example of a delay receipt: one table's evening, step by step. */
function SampleReceipt() {
  const steps: { label: string; start: number; end: number; owner: 'floor' | 'kitchen'; lapse?: boolean; note: string }[] = [
    { label: 'Seated → greeted', start: 0, end: 1.5, owner: 'floor', note: '1.5 of 2 min' },
    { label: 'Starters in kitchen', start: 6, end: 15, owner: 'kitchen', note: '9 of 13 min' },
    { label: 'Pass → table', start: 15, end: 16, owner: 'floor', note: '1 of 1.5 min' },
    { label: 'Mains in kitchen', start: 30, end: 52, owner: 'kitchen', lapse: true, note: '22 of 18 min, grill' },
    { label: 'Pass → table', start: 52, end: 53, owner: 'floor', note: '1 of 1.5 min' },
    { label: 'Bill asked → presented', start: 88, end: 90, owner: 'floor', note: '2 of 3 min' },
  ]
  const span = 95
  return (
    <figure className="rounded-2xl border bg-card p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">T4</span> <span className="text-muted-foreground">5 guests, 7:40 to 9:15 pm</span>
        </span>
        <span className="text-xs text-muted-foreground">Example</span>
      </figcaption>
      <div className="relative mt-4 h-5 rounded bg-muted" role="img" aria-label="Timeline of T4's visit: every floor step within standard; mains ran 4 minutes over in the kitchen.">
        {steps.map((s) => (
          <div
            key={s.label + s.start}
            className={cn('absolute top-0 h-full rounded-sm', s.lapse && 'ring-2 ring-warn')}
            style={{ left: `${(s.start / span) * 100}%`, width: `max(4px, ${((s.end - s.start) / span) * 100}%)`, background: s.owner === 'floor' ? 'var(--floor-mark)' : 'var(--kitchen-mark)' }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.label + s.start} className="flex items-center gap-2">
            <span className="h-2 w-4 shrink-0 rounded-sm" style={{ background: s.owner === 'floor' ? 'var(--floor-mark)' : 'var(--kitchen-mark)' }} aria-hidden />
            <span className="min-w-0 flex-1">{s.label}</span>
            <span className={cn('text-xs tabular', s.lapse ? 'font-medium text-warn' : 'text-muted-foreground')}>{s.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm">
        Verdict: every floor step to standard. The 4-minute overrun was the grill’s. The server keeps their streak, and the manager sees a grill pattern, not a slow server.
      </p>
    </figure>
  )
}

/** Data flow from POS to screens, drawn with layout rather than a picture so it reads at any width. */
function Architecture() {
  const box = 'rounded-xl border bg-card px-4 py-3 text-sm'
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1.1fr_auto_1fr]">
      <div className="grid gap-2">
        <div className="text-sm text-muted-foreground">Sources</div>
        <div className={box}>Petpooja POS</div>
        <div className={box}>Other POS or middleware</div>
        <div className={box}>Service simulator</div>
      </div>
      <Arrow />
      <div className="grid content-start gap-2">
        <div className="text-sm text-muted-foreground">Copilot server</div>
        <div className={cn(box, 'border-primary/50 bg-accent/40')}>
          <div className="font-medium">One event format</div>
          <div className="text-muted-foreground">table seated, order fired, food ready, dish off, bill printed, paid</div>
        </div>
        <div className={cn(box, 'border-primary/50 bg-accent/40')}>
          <div className="font-medium">Rules engine</div>
          <div className="text-muted-foreground">SOP standards → ranked cards; visits → delay receipts</div>
        </div>
        <div className={box}>
          <div className="font-medium">Dify (optional)</div>
          <div className="text-muted-foreground">phrases briefings, guest lines, summaries</div>
        </div>
      </div>
      <Arrow />
      <div className="grid gap-2">
        <div className="text-sm text-muted-foreground">Screens, updated live</div>
        <div className={box}>Server phones: top three cards, private stats</div>
        <div className={box}>Kitchen pass: tickets, availability, notes</div>
        <div className={box}>Manager: bottlenecks and receipts, no rankings</div>
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground" aria-hidden>
      <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
    </div>
  )
}
