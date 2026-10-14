import { useT, L } from '../i18n/index.ts'
import { Plug, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MenuEditor } from './MenuEditor.tsx'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Snapshot } from '../../shared/snapshot.ts'
import type { Sop } from '../../shared/types.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { DEFAULT_PRIORITY, PRIORITY_FIELDS, priorityOf, type PriorityConfig } from '../../shared/priority.ts'
import { STANDALONE, post } from '../lib/live.ts'

// The restaurant's setup, shown on the Demo & setup page: service standards, the AI behind the
// assistant, and a pointer to the Integrations tab. (Running the simulated service lives on the same page.)

const SOP_FIELDS = (): { key: keyof Sop; label: string; unit: string }[] => [
  { key: 'greetWithinMin', label: L('Greet a seated table within'), unit: 'min' },
  { key: 'orderNudgeAfterMin', label: L('Nudge to take order after greeting'), unit: 'min' },
  { key: 'kitchenDelayToleranceMin', label: L('Warn guests when kitchen is late by'), unit: 'min' },
  { key: 'pickupWithinMin', label: L('Pick up food from the pass within'), unit: 'min' },
  { key: 'checkbackAfterMin', label: L('Check back after serving'), unit: 'min' },
  { key: 'courseCheckAfterMin', label: L('Check if a course is finished after'), unit: 'min' },
  { key: 'billPresentWithinMin', label: L('Present the bill within'), unit: 'min' },
  { key: 'farewellWithinMin', label: L('Say goodbye within'), unit: 'min' },
  { key: 'resetWithinMin', label: L('Reset a table within'), unit: 'min' },
  { key: 'maxActiveTablesPerServer', label: L('Max active tables per server'), unit: 'tables' },
]

function Heading({ children }: { children: React.ReactNode }) {
  return <CardTitle className="font-display text-lg">{children}</CardTitle>
}

/** Service standards and AI assistance (integrations have their own tab). */
export function SetupPanels({ snap }: { snap: Snapshot }) {
  const tx = useT()
  const [sop, setSop] = useState<Sop | null>(null)
  useEffect(() => {
    if (!sop) setSop(snap.config.sop)
  }, [snap, sop])
  if (!sop) return null
  const dify = snap.ai.provider === 'dify'
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <Heading>{tx('ui.setup.service_standards_sops')}</Heading>
          <CardDescription>{tx('ui.setup.every_card_the_copilot')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-2.5"
            onSubmit={async (e) => {
              e.preventDefault()
              await post('/api/config', { sop })
              toast.success(L('Standards saved'))
            }}
          >
            {SOP_FIELDS().map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`sop-${f.key}`}>{f.label}</label>
                <span className="inline-flex items-center gap-1.5">
                  <Input
                    id={`sop-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    name={`sop-${f.key}`}
                    min={0}
                    step={0.5}
                    value={sop[f.key]}
                    onChange={(e) => setSop({ ...sop, [f.key]: Number(e.target.value) })}
                    className="h-8 w-20 text-right tabular"
                  />
                  <span className="w-10 text-xs text-muted-foreground">{f.unit}</span>
                </span>
              </div>
            ))}
            <Separator className="my-3" />
            <Button type="submit">{tx('ui.setup.save_standards')}</Button>
          </form>
        </CardContent>
      </Card>

      <KitchenPriorities snap={snap} />

      <Card>
        <CardHeader>
          <Heading>{tx('ui.setup.ai_assistance')}</Heading>
          <CardDescription>{tx('ui.setup.the_assistant_chat_and')}</CardDescription>
          <CardAction>
            <Badge variant={snap.ai.provider === 'built-in' ? 'secondary' : 'default'} className="gap-1">
              <Sparkles className="size-3" /> {snap.ai.provider === 'claude' ? L('Claude connected') : snap.ai.provider === 'gemini' ? L('Gemini connected') : snap.ai.provider === 'cloud' ? L('Cloud AI connected') : snap.ai.provider === 'ollama' ? L('Local AI connected') : dify ? L('Dify connected') : L('Built-in trainer')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm">
          {snap.ai.provider === 'claude' ? (
            <p className="text-muted-foreground">{tx('ui.setup.the_assistant_runs_on')}</p>
          ) : snap.ai.provider === 'gemini' ? (
            <p className="text-muted-foreground">
              {tx('ui.setup.the_assistant_runs_on_2')} <span className="text-foreground">{snap.ai.model ?? 'Gemini'}</span>{tx('ui.setup.fast_on_any_computer')}
            </p>
          ) : snap.ai.provider === 'cloud' ? (
            <p className="text-muted-foreground">
              {tx('ui.setup.the_assistant_runs_on_3')} <span className="text-foreground">{snap.ai.model}</span>{tx('ui.setup.a_free_cloud_ai')}
            </p>
          ) : snap.ai.provider === 'ollama' ? (
            <p className="text-muted-foreground">
              {tx('ui.setup.the_assistant_runs_on_3')} <span className="text-foreground">{snap.ai.model}</span> {tx('ui.setup.through_ollama_free_and')}
            </p>
          ) : dify ? (
            <p className="text-muted-foreground">{tx('ui.setup.requests_go_to_your')}</p>
          ) : STANDALONE ? (
            <p className="text-muted-foreground">{tx('ui.setup.this_demo_runs_in')}</p>
          ) : (
            <div className="space-y-3 text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">{tx('ui.setup.recommended_free_and_fast')}</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    {tx('ui.setup.go_to')} <span className="text-foreground">{tx('ui.setup.aistudio_google_com')}</span>{tx('ui.setup.sign_in_with_a')} <span className="text-foreground">{tx('ui.setup.get_api_key_create')}</span>.
                  </li>
                  <li>
                    {tx('ui.setup.in_the_project_folder')} <code className="rounded bg-muted px-1">.env.example</code> {tx('ui.setup.to')} <code className="rounded bg-muted px-1">.env</code> {tx('ui.setup.and_set')} <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> {tx('ui.setup.to_the_key')}
                  </li>
                  <li>{tx('ui.setup.restart')} <code className="rounded bg-muted px-1">npm run dev</code>{tx('ui.setup.this_badge_turns_to')} <code className="rounded bg-muted px-1">docs/gemini-setup.md</code>.)</li>
                </ol>
              </div>
              <div>
                <div className="font-medium text-foreground">{tx('ui.setup.offline_on_this_computer')}</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    {tx('ui.setup.install_ollama_from')} <span className="text-foreground">{tx('ui.setup.ollama_com')}</span> {tx('ui.setup.and_open_it')}
                  </li>
                  <li>
                    {tx('ui.setup.in_a_terminal_run')} <code className="rounded bg-muted px-1">ollama pull gemma3:4b</code> {tx('ui.setup.a_3_gb_download')}
                  </li>
                  <li>{tx('ui.setup.within_a_few_seconds')}</li>
                </ol>
              </div>
              <div>
                <div className="font-medium text-foreground">{tx('ui.setup.best_quality_claude_paid')}</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    {tx('ui.setup.get_an_api_key')} <span className="text-foreground">{tx('ui.setup.console_anthropic_com')}</span>.
                  </li>
                  <li>
                    {tx('ui.setup.in_the_project_folder')} <code className="rounded bg-muted px-1">.env.example</code> {tx('ui.setup.to')} <code className="rounded bg-muted px-1">.env</code> {tx('ui.setup.and_set')} <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code>.
                  </li>
                  <li>{tx('ui.setup.restart')} <code className="rounded bg-muted px-1">npm run dev</code>{tx('ui.setup.this_badge_turns_to_2')}</li>
                  <li>{tx('ui.setup.prefer_dify_set')} <code className="rounded bg-muted px-1">DIFY_API_URL</code> {tx('ui.setup.and')} <code className="rounded bg-muted px-1">DIFY_API_KEY</code> {tx('ui.setup.instead_see')} <code className="rounded bg-muted px-1">docs/dify-setup.md</code>).</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MenuEditor snap={snap} />

      <Card className="lg:col-span-2">
        <CardHeader>
          <Heading>{tx('ui.setup.pos_and_other_systems')}</Heading>
          <CardDescription>{tx('ui.setup.petpooja_and_other_pos')}</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link to="/demo?tab=integrations">
                <Plug /> {tx('ui.setup.open_integrations')}
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  )
}

/**
 * What the kitchen should do first. Set once when a restaurant is onboarded (like each dish's allergens) and
 * changeable any time: the pass sorts its tickets by these, and the AI's "chef's call" explains the order with them.
 */
function KitchenPriorities({ snap }: { snap: Snapshot }) {
  const tx = useT()
  const [p, setP] = useState<PriorityConfig>(() => priorityOf(snap.config))
  const [dirty, setDirty] = useState(false)
  return (
    <Card>
      <CardHeader>
        <Heading>{tx('ui.setup.kitchen_priorities')}</Heading>
        <CardDescription>{tx('ui.setup.how_much_each_thing')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            await post('/api/config', { priority: p })
            setDirty(false)
            toast.success(L('Kitchen priorities saved'))
          }}
        >
          {PRIORITY_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <label htmlFor={`pri-${f.key}`}>{f.label}</label>
                <span className="tabular text-xs text-muted-foreground">
                  {p[f.key]}
                  {f.unit ?? ' / 10'}
                </span>
              </div>
              <Slider
                id={`pri-${f.key}`}
                min={0}
                max={f.max}
                step={f.max > 10 ? 5 : 1}
                value={[p[f.key]]}
                onValueChange={([v]) => {
                  setP({ ...p, [f.key]: v })
                  setDirty(true)
                }}
                aria-label={f.label}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
          <Separator className="my-3" />
          <div className="flex gap-2">
            <Button type="submit" disabled={!dirty}>
              {tx('ui.setup.save_priorities')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setP(DEFAULT_PRIORITY)
                setDirty(true)
              }}
            >
              {tx('ui.setup.reset_to_defaults')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
