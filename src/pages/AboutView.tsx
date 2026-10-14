import { useT, L } from '../i18n/index.ts'
import { Accessibility, ArrowRight, ChefHat, Clock3, Route, ShieldAlert, Smile, Sprout, Flame, Hand, HeartPulse, Receipt, ShieldCheck, Smartphone, Sparkles, Trophy, UserRound, Users, Volume2, Languages, Compass, TrendingUp, History, GraduationCap, FlaskConical } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '../../shared/types.ts'
import { Mascot, TAGLINE, Wordmark } from '../brand/marks.tsx'
import { AppShell } from '../components/kit.tsx'
import { TaskCard } from '../components/TaskCard.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSnapshot } from '../lib/live.ts'
import { useRolePage } from '../lib/role.ts'

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
      title: L('T4 mains running 6 min late'),
      hint: L('Kitchen is behind on the lamb shank. A heads-up now beats an apology later.'),
      impact: 4,
      createdAt: now - 70_000,
      dueAt: now + 50_000,
      actions: [{ label: L('Told them'), event: 'noop', payload: {}, primary: true }],
    },
    {
      ...base,
      id: 'ex-greet',
      kind: 'greet',
      tableId: 'T2',
      tableName: 'T2',
      title: L('Welcome T2'),
      hint: L('Party of 4, Ms. Iyer, anniversary, allergy: nuts. Water, menus, today’s specials.'),
      impact: 3,
      createdAt: now - 30_000,
      dueAt: now + 90_000,
      actions: [{ label: L('Greeted'), event: 'noop', payload: {}, primary: true }],
    },
  ]
}

export default function AboutView() {
  const tx = useT()
  useRolePage(null)
  const { snap } = useSnapshot('server', DEMO_STAFF)
  const now = snap?.now ?? Date.now()
  const live = snap?.me?.top ?? []
  const cards = live.length ? live.slice(0, 2) : exampleTasks(now)

  return (
    <AppShell bare>
      <>
        {/* Hero: the thesis, with the product itself as the image. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="min-w-0">
            <Mascot className="-ml-2 w-[min(320px,70vw)]" speed="var(--foreground)" title={tx('ui.about.tablemate_s_running_chef')} />
            <p className="tagline mt-4 text-muted-foreground">{TAGLINE}</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] tracking-[-0.035em]">{tx('ui.about.six_tables_twelve_standards')}</h1>
            <p className="mt-6 max-w-[38rem] text-pretty text-lg leading-relaxed text-muted-foreground">
              {tx('ui.about.tablemate_is_a_service')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link to={`/server/${DEMO_STAFF}`}>
                  <Smartphone /> {tx('ui.about.try_a_server_s')}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5">
                <Link to="/manager">{tx('ui.about.see_the_manager_view')}</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-w-0">
            <h2 className="sr-only">{tx('ui.about.what_a_server_sees')}</h2>
            <div className="mx-auto max-w-[400px] rounded-[2rem] border bg-secondary/50 p-3 shadow-sm">
              <div className="flex items-center justify-between px-3 pb-3 pt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{tx('ui.about.aisha_section_a')}</span>
                <span>{live.length ? L('Live from the simulated service') : 'Example'}</span>
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

        <Section title={tx('ui.about.the_problem')} lead="Restaurants digitised the order. They didn’t digitise the server’s job.">
          <div className="grid gap-8 md:grid-cols-3">
            <Point icon={<Hand />} title={tx('ui.about.everything_lives_in_one')}>
              {tx('ui.about.a_server_on_six')}
            </Point>
            <Point icon={<ChefHat />} title={tx('ui.about.information_stops_at_the')}>
              {tx('ui.about.the_pos_knows_a')}
            </Point>
            <Point icon={<Receipt />} title={tx('ui.about.blame_lands_on_the')}>
              {tx('ui.about.guests_and_managers_see')}
            </Point>
          </div>
        </Section>

        <Section title={tx('ui.about.how_a_card_is')} lead="No new hardware and no data entry. The copilot listens to events the POS already produces.">
          <ol className="grid gap-4 md:grid-cols-4">
            {[
              [L('Something happens'), L('The POS reports it: a table is seated, a KOT is fired, food is ready, a bill is printed, a dish is marked unavailable.')],
              [L('A standard applies'), L('The restaurant’s own SOPs turn the event into a task with a time limit, such as “greet within 2 minutes”.')],
              [L('It’s ranked'), L('Priority is guest impact × urgency against the standard, plus a nudge for tables left alone longest. Only the top three are shown.')],
              [L('It closes itself'), L('When the POS shows the step happened, the card disappears. The server rarely taps “done”, and “Later” is always available.')],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border bg-card p-5">
                <span className="font-display text-3xl text-primary tabular">{i + 1}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <div tabIndex={0} role="region" aria-label={tx('ui.about.how_pos_events_become')} className="mt-8 overflow-x-auto rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tx('ui.about.when_the_pos_shows')}</th>
                  <th className="px-4 py-2.5 font-medium">{tx('ui.about.the_server_sees')}</th>
                  <th className="px-4 py-2.5 font-medium">{tx('ui.about.it_clears_when')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  [L('A table is seated'), L('Welcome T4, with party size, guest name, occasion and allergies'), L('The server taps Greeted, or an order arrives')],
                  [L('An order with an allergy'), L('Flag T3’s nut allergy to the kitchen (one tap sends it)'), L('Confirmed at the pass')],
                  [L('A dish is marked unavailable'), L('Risotto is off: tell T6, with two alternatives to suggest'), L('The guest has been told')],
                  [L('A ticket runs past its usual time'), L('T4 mains running 6 min late: give them a heads-up'), L('Told, or the food is ready')],
                  [L('Food is ready at the pass'), L('Pick up T4’s mains'), 'Served'],
                  [L('A course has been served'), L('Check in on T4, then clear and fire the next course'), L('Checked in / cleared')],
                  [L('The bill is printed, then paid'), L('Present the bill, say goodbye, reset the table with a checklist'), L('Each step is done')],
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

        <Section title={tx('ui.about.fair_by_design')} lead="Every late table gets a receipt that shows which step ran long and who controlled it.">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4 text-pretty leading-relaxed text-muted-foreground">
              <p>
                {tx('ui.about.a_visit_is_split')}
              </p>
              <p>
                {tx('ui.about.managers_see_the_same')}
              </p>
            </div>
            <SampleReceipt />
          </div>
        </Section>

        <Section title={tx('ui.about.ai_that_works_the')} lead="Every feature takes something off the server’s mind. Safety stays rule-based; AI is used where judgement and wording help.">
          <div className="grid gap-8 md:grid-cols-3">
            <Point icon={<ShieldAlert />} title={tx('ui.about.allergy_and_diet_safety')}>
              {tx('ui.about.each_dish_carries_its')}
            </Point>
            <Point icon={<Clock3 />} title={tx('ui.about.honest_kitchen_times')}>
              {tx('ui.about.ready_times_come_from')}
            </Point>
            <Point icon={<Route />} title={tx('ui.about.one_trip_several_jobs')}>
              {tx('ui.about.food_for_two_tables')}
            </Point>
            <Point icon={<Sparkles />} title={tx('ui.about.coming_up')}>
              {tx('ui.about.from_how_long_tables')}
            </Point>
            <Point icon={<Smile />} title={tx('ui.about.guest_mood_then_recovery')}>
              {tx('ui.about.a_check_in_is')}
            </Point>
            <Point icon={<Sprout />} title={tx('ui.about.private_coach_and_practice')}>
              {tx('ui.about.a_short_tip_from')}
            </Point>
          </div>
          <p className="mt-6 max-w-[65ch] leading-relaxed text-muted-foreground">
            {tx('ui.about.read_aloud_now_says')}
          </p>
        </Section>

        <Section title={tx('ui.about.inclusive_by_design')} lead="Kitchens and floors are multilingual, and not everyone reads, hears or moves the same way. Every server sets TableMate up for themselves.">
          <div className="grid gap-8 md:grid-cols-3">
            <Point icon={<Languages />} title={tx('ui.about.their_language')}>
              {tx('ui.about.english_and_espa_ol')}
            </Point>
            <Point icon={<Volume2 />} title={tx('ui.about.read_aloud')}>
              {tx('ui.about.new_tasks_can_be')}
            </Point>
            <Point icon={<Accessibility />} title={tx('ui.about.comfort_access')}>
              {tx('ui.about.larger_text_an_easy')}
            </Point>
            <Point icon={<UserRound />} title={tx('ui.about.respectful_wording')}>
              {tx('ui.about.the_assistant_uses_gender')}
            </Point>
            <Point icon={<HeartPulse />} title={tx('ui.about.guests_needs_ready_in')}>
              {tx('ui.about.access_sensory_dietary_and')}
            </Point>
            <Point icon={<ShieldCheck />} title={tx('ui.about.nothing_extra_is_collected')}>
              {tx('ui.about.comfort_settings_stay_on')}
            </Point>
          </div>
        </Section>

        <Section title={tx('ui.about.why_it_s_built')} lead="Each design choice answers a specific idea from organisational behaviour.">
          <dl className="divide-y rounded-2xl border">
            {[
              [L('Cognitive Load Theory'), L('Sweller, 1988'), L('The app holds the state of every table and shows at most three cards, so working memory goes to the guest.')],
              [L('Self-Determination Theory'), L('Deci & Ryan, 1985'), L('Autonomy: every card can wait (“Later”) and nothing is forced. Competence: streaks and personal bests against yourself. Relatedness: team metrics and two-way kitchen notes.')],
              [L('Attribution Theory'), L('Kelley, 1967'), L('Timestamps separate what the server controlled from what the process controlled before anyone is held responsible.')],
              [L('Equity and justice'), L('Adams, 1963; Colquitt, 2001'), L('Delay receipts make outcomes fair; consistent rules and visible evidence make the process fair.')],
              [L('Feedback Intervention Theory'), L('Kluger & DeNisi, 1996'), L('Feedback is about the task (“T4 is waiting on the bill”), never the person (“you’re slow”).')],
              [L('Inclusion and universal design'), L('Shore et al., 2011; CAST UDL'), L('People feel included when they belong and can stay themselves. Options for language, reading, hearing and pace are built in for everyone, not added as special cases.')],
              [L('Electronic monitoring research'), L('Ravid et al., 2020'), L('Monitoring raises stress unless its purpose is developmental and transparent, so there are no leaderboards and no manager view of individuals.')],
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

        <Section title={tx('ui.about.will_restaurants_adopt_it')} lead="Rogers’ diffusion of innovations names five things that decide it. Here is how the copilot meets each.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [L('Relative advantage'), L('Fewer missed steps, no shouting to the pass, and evidence that protects servers from blame. Visible in the first shift.')],
              ['Compatibility', L('Sits on top of Petpooja or whichever POS is already there, uses the restaurant’s own SOPs, runs on existing phones.')],
              [L('Low complexity'), L('One screen, three cards, one tap. No typing, because the POS already has the data.')],
              ['Trialability', L('Switch on one section or one shift first. The simulator lets staff practise before a real service.')],
              ['Observability', L('End-of-shift stats for each server and a bottleneck view for the manager make results easy to see.')],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border bg-card p-5">
                <h3 className="font-medium">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={tx('ui.about.assist_predict_explain_learn')} lead="More than a task list: the same events power a copilot that helps now, warns early, explains what happened and turns it into practice.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [<Compass key="a" />, 'Assist', L('The next best action with why it comes first, and help with an upset guest built from what is really happening at that table.')],
              [<TrendingUp key="b" />, 'Predict', L('Dishes likely to be late, a busy patch about to hit a server, a station about to fall behind, a section about to be swamped.')],
              [<History key="c" />, 'Explain', L('Any table reconstructed step by step, and why tonight is going the way it is: floor or kitchen, the bottleneck, when it bunched up.')],
              [<GraduationCap key="d" />, 'Learn', L('A private learning journey: practice scores over time and practice suggested from the server’s own shift.')],
              [<FlaskConical key="e" />, 'Decide', L('What if 30% more guests come, a server is off sick or a second grill cook joins? Run tonight both ways in a sandbox and compare.')],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="rounded-2xl border bg-card p-5">
                <span className="text-primary [&_svg]:size-5">{icon}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            {tx('ui.about.rules_decide_anything_safety')}
          </p>
        </Section>

        <Section title={tx('ui.about.motivation_without_surveillance')} lead="Service is a game servers already play: timing, reading the room, rescuing a table. The copilot keeps score for them, not on them.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [<Sparkles key="a" />, L('XP for every good move'), L('A swift welcome, a heads-up before the guest asks, food hot from the pass. Late steps still earn a little: the game never takes points away.')],
              [<Flame key="b" />, L('Streaks with shields'), L('Tables served fully to standard build a streak. Every third earns a shield that absorbs one slip, so one bad moment doesn’t wipe the evening.')],
              [<Trophy key="c" />, L('Ranks, badges and quests'), L('Commis to Maître d’. Badges like Allergy guardian and Heads-up hero, some reachable in the first shift, and three small quests each night.')],
              [<Users key="d" />, L('A team goal, not a leaderboard'), L('The floor works toward one shared target. Staff thank each other with kudos, which earn XP for both and show on the team board.')],
              [<Smartphone key="e" />, L('Feels like a real app'), L('Swipe a card right when it’s done, left for later. A buzz on a win, a quick celebration for a badge, a shift recap at close. Works on phones and on the iPads servers take orders on, and installs to the home screen.')],
              [<ShieldCheck key="f" />, L('Private by default'), L('XP, streaks and badges live on the server’s own phone. Managers only see the team goal and kudos, never individual scores.')],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="rounded-2xl border bg-card p-5">
                <span className="text-primary [&_svg]:size-5">{icon}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            {tx('ui.about.why_this_shape_points')}
          </p>
        </Section>

        <Section title={tx('ui.about.under_the_hood')} lead="One event format in the middle, so any POS can plug in and every screen stays in sync.">
          <Architecture />
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <Status tone="good" title={tx('ui.about.working_now')}>
              {tx('ui.about.rules_engine_and_priority')}
            </Status>
            <Status tone="warn" title={tx('ui.about.needs_petpooja_partner_access')}>
              {tx('ui.about.item_stock_and_food')}
            </Status>
            <Status tone="muted" title={tx('ui.about.next')}>
              {tx('ui.about.restroworks_toast_and_square')}
            </Status>
          </div>
        </Section>

        <Section title={tx('ui.about.ai_where_words_matter')} lead="The copilot works out what needs doing. A language model (Claude, or Dify) helps with how to say it, and trains staff in their own language.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              [<Sparkles key="a" />, L('What do I say?'), L('A gracious line for a delay, a dish that has run out, a greeting or a goodbye.')],
              [<Smartphone key="b" />, L('Brief me'), L('Your section at a glance: allergies, regulars, occasions and anything the kitchen is behind on.')],
              [<HeartPulse key="c" />, L('Ask and practise'), L('A trainer for servers and a coach for managers: it knows the standards, the menu and tonight’s floor, teaches inclusive service, and plays a tough guest or team member so people can rehearse.')],
              [<ShieldCheck key="d" />, L('Shift summary'), L('Tonight’s bottlenecks in plain English for the manager, never ranking individuals.')],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="rounded-2xl border bg-card p-5">
                <span className="text-primary [&_svg]:size-5">{icon}</span>
                <h3 className="mt-2 font-medium">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[65ch] text-sm text-muted-foreground">{tx('ui.about.the_copilot_gathers_the')}</p>
        </Section>

        <Section title={tx('ui.about.how_we_ll_test')} lead="The prototype tests one claim: an autonomy-supportive design reduces perceived surveillance while improving service consistency.">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [L('No app'), L('Servers work a simulated six-table rush the usual way.')],
              [L('Monitoring-style app'), L('Same tasks, but with rankings and everything visible to the manager.')],
              ['TableMate', L('Top-three cards, self-closing tasks, private stats, delay receipts.')],
            ].map(([t, d], i) => (
              <div key={t} className={cn('rounded-2xl border p-5', i === 2 ? 'border-primary/50 bg-accent/40' : 'bg-card')}>
                <div className="text-sm text-muted-foreground">{tx('ui.about.condition')} {i + 1}</div>
                <h3 className="mt-1 font-medium">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[65ch] leading-relaxed text-muted-foreground">
            {tx('ui.about.measures_workload_nasa_tlx')}
          </p>
        </Section>

        <section className="border-t bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
            <div>
              <Wordmark className="text-3xl" />
              <p className="tagline mt-2 text-muted-foreground">{TAGLINE}</p>
              <h2 className="mt-6 font-display text-xl">{tx('ui.about.an_ob_project_by')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tx('ui.about.drishti_gulati_div_mehta')}</p>
              <Button asChild className="mt-5">
                <Link to="/">
                  {tx('ui.about.open_the_app')} <ArrowRight />
                </Link>
              </Button>
            </div>
            <div>
              <h2 className="font-display text-2xl">{tx('ui.about.references')}</h2>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>{tx('ui.about.adams_j_s_1963')} <i>{tx('ui.about.journal_of_abnormal_and')}</i>, 67(5), 422–436.</li>
                <li>{tx('ui.about.chung_b_hoffman_k')} <i>{tx('ui.about.cornell_hra_quarterly')}</i>, 39(3), 66–71.</li>
                <li>{tx('ui.about.colquitt_j_a_2001')} <i>{tx('ui.about.journal_of_applied_psychology')}</i>, 86(3), 386–400.</li>
                <li>{tx('ui.about.deci_e_l_ryan')} <i>{tx('ui.about.intrinsic_motivation_and_self')}</i>{tx('ui.about.plenum')}</li>
                <li>{tx('ui.about.hanus_m_d_fox')} <i>{tx('ui.about.computers_education')}</i>, 80, 152–161.</li>
                <li>{tx('ui.about.kelley_h_h_1967')} <i>{tx('ui.about.nebraska_symposium_on_motivation')}</i>, 15, 192–238.</li>
                <li>{tx('ui.about.kluger_a_n_denisi')} <i>{tx('ui.about.psychological_bulletin')}</i>, 119(2), 254–284.</li>
                <li>{tx('ui.about.mekler_e_d_br')} <i>{tx('ui.about.computers_in_human_behavior')}</i>, 71, 525–534.</li>
                <li>{tx('ui.about.ravid_d_m_et')} <i>{tx('ui.about.personnel_psychology')}</i>, 73(1), 1–56.</li>
                <li>{tx('ui.about.rogers_e_m_2003')} <i>{tx('ui.about.diffusion_of_innovations')}</i> {tx('ui.about.5th_ed_free_press')}</li>
                <li>{tx('ui.about.sweller_j_1988_cognitive')} <i>{tx('ui.about.cognitive_science')}</i>, 12(2), 257–285.</li>
              </ul>
            </div>
          </div>
        </section>
      </>
    </AppShell>
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
  const tx = useT()
  const steps: { label: string; start: number; end: number; owner: 'floor' | 'kitchen'; lapse?: boolean; note: string }[] = [
    { label: L('Seated → greeted'), start: 0, end: 1.5, owner: 'floor', note: '1.5 of 2 min' },
    { label: L('Starters in kitchen'), start: 6, end: 15, owner: 'kitchen', note: '9 of 13 min' },
    { label: L('Pass → table'), start: 15, end: 16, owner: 'floor', note: '1 of 1.5 min' },
    { label: L('Mains in kitchen'), start: 30, end: 52, owner: 'kitchen', lapse: true, note: '22 of 18 min, grill' },
    { label: L('Pass → table'), start: 52, end: 53, owner: 'floor', note: '1 of 1.5 min' },
    { label: L('Bill asked → presented'), start: 88, end: 90, owner: 'floor', note: '2 of 3 min' },
  ]
  const span = 95
  return (
    <figure className="rounded-2xl border bg-card p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">T4</span> <span className="text-muted-foreground">{tx('ui.about.5_guests_7_40')}</span>
        </span>
        <span className="text-xs text-muted-foreground">{tx('ui.about.example')}</span>
      </figcaption>
      <div className="relative mt-4 h-5 rounded bg-muted" role="img" aria-label={tx('ui.about.timeline_of_t4_s')}>
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
        {tx('ui.about.verdict_every_floor_step')}
      </p>
    </figure>
  )
}

/** Data flow from POS to screens, drawn with layout rather than a picture so it reads at any width. */
function Architecture() {
  const tx = useT()
  const box = 'rounded-xl border bg-card px-4 py-3 text-sm'
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1.1fr_auto_1fr]">
      <div className="grid gap-2">
        <div className="text-sm text-muted-foreground">{tx('ui.about.sources')}</div>
        <div className={box}>{tx('ui.about.petpooja_pos')}</div>
        <div className={box}>{tx('ui.about.other_pos_or_middleware')}</div>
        <div className={box}>{tx('ui.about.service_simulator')}</div>
      </div>
      <Arrow />
      <div className="grid content-start gap-2">
        <div className="text-sm text-muted-foreground">{tx('ui.about.copilot_server')}</div>
        <div className={cn(box, 'border-primary/50 bg-accent/40')}>
          <div className="font-medium">{tx('ui.about.one_event_format')}</div>
          <div className="text-muted-foreground">{tx('ui.about.table_seated_order_fired')}</div>
        </div>
        <div className={cn(box, 'border-primary/50 bg-accent/40')}>
          <div className="font-medium">{tx('ui.about.rules_engine')}</div>
          <div className="text-muted-foreground">{tx('ui.about.sop_standards_ranked_cards')}</div>
        </div>
        <div className={box}>
          <div className="font-medium">{tx('ui.about.dify_optional')}</div>
          <div className="text-muted-foreground">{tx('ui.about.phrases_briefings_guest_lines')}</div>
        </div>
      </div>
      <Arrow />
      <div className="grid gap-2">
        <div className="text-sm text-muted-foreground">{tx('ui.about.screens_updated_live')}</div>
        <div className={box}>{tx('ui.about.server_phones_top_three')}</div>
        <div className={box}>{tx('ui.about.kitchen_pass_tickets_availability')}</div>
        <div className={box}>{tx('ui.about.manager_bottlenecks_and_receipts')}</div>
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
