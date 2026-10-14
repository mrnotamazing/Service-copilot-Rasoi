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

const SOP_FIELDS: { key: keyof Sop; label: string; unit: string }[] = [
  { key: 'greetWithinMin', label: 'Greet a seated table within', unit: 'min' },
  { key: 'orderNudgeAfterMin', label: 'Nudge to take order after greeting', unit: 'min' },
  { key: 'kitchenDelayToleranceMin', label: 'Warn guests when kitchen is late by', unit: 'min' },
  { key: 'pickupWithinMin', label: 'Pick up food from the pass within', unit: 'min' },
  { key: 'checkbackAfterMin', label: 'Check back after serving', unit: 'min' },
  { key: 'courseCheckAfterMin', label: 'Check if a course is finished after', unit: 'min' },
  { key: 'billPresentWithinMin', label: 'Present the bill within', unit: 'min' },
  { key: 'farewellWithinMin', label: 'Say goodbye within', unit: 'min' },
  { key: 'resetWithinMin', label: 'Reset a table within', unit: 'min' },
  { key: 'maxActiveTablesPerServer', label: 'Max active tables per server', unit: 'tables' },
]

function Heading({ children }: { children: React.ReactNode }) {
  return <CardTitle className="font-display text-lg">{children}</CardTitle>
}

/** Service standards and AI assistance (integrations have their own tab). */
export function SetupPanels({ snap }: { snap: Snapshot }) {
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
          <Heading>Service standards (SOPs)</Heading>
          <CardDescription>Every card the copilot raises comes from one of these. Saving re-scores the whole service.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-2.5"
            onSubmit={async (e) => {
              e.preventDefault()
              await post('/api/config', { sop })
              toast.success('Standards saved')
            }}
          >
            {SOP_FIELDS.map((f) => (
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
            <Button type="submit">Save standards</Button>
          </form>
        </CardContent>
      </Card>

      <KitchenPriorities snap={snap} />

      <Card>
        <CardHeader>
          <Heading>AI assistance</Heading>
          <CardDescription>The assistant chat and practice room, suggested lines for guests, section briefings, the private coach and the manager’s shift summary.</CardDescription>
          <CardAction>
            <Badge variant={snap.ai.provider === 'built-in' ? 'secondary' : 'default'} className="gap-1">
              <Sparkles className="size-3" /> {snap.ai.provider === 'claude' ? 'Claude connected' : snap.ai.provider === 'gemini' ? 'Gemini connected' : snap.ai.provider === 'cloud' ? 'Cloud AI connected' : snap.ai.provider === 'ollama' ? 'Local AI connected' : dify ? 'Dify connected' : 'Built-in trainer'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm">
          {snap.ai.provider === 'claude' ? (
            <p className="text-muted-foreground">The assistant runs on Claude: it answers in each server’s language, knows your standards and menu, and plays guests in practice. If Claude can’t be reached, the built-in trainer answers and says so.</p>
          ) : snap.ai.provider === 'gemini' ? (
            <p className="text-muted-foreground">
              The assistant runs on Google <span className="text-foreground">{snap.ai.model ?? 'Gemini'}</span>: fast on any computer, in every app language, with your standards, menu and training notes sent with each question. If Gemini can’t be reached or the free limit is used up, the built-in trainer answers and says so.
            </p>
          ) : snap.ai.provider === 'cloud' ? (
            <p className="text-muted-foreground">
              The assistant runs on <span className="text-foreground">{snap.ai.model}</span>, a free cloud AI: fast, in every app language, with your standards, menu and training notes sent with each question. If the free limit is reached, the next model answers, then the built-in trainer.
            </p>
          ) : snap.ai.provider === 'ollama' ? (
            <p className="text-muted-foreground">
              The assistant runs on <span className="text-foreground">{snap.ai.model}</span> through Ollama, free and on this computer: nothing is sent anywhere. Answers are slower than a cloud AI and weaker in some languages. If Ollama is closed, the built-in trainer answers and says so.
            </p>
          ) : dify ? (
            <p className="text-muted-foreground">Requests go to your Dify app. If Dify is unreachable, the copilot falls back to the built-in trainer and says so on the answer.</p>
          ) : STANDALONE ? (
            <p className="text-muted-foreground">This demo runs in the browser. Opened on claude.ai, it asks Claude on your own account (you’ll be asked to allow it the first time). Opened anywhere else, or if you decline, it uses the built-in trainer (English, set questions only). On your own computer, add an Anthropic API key for full answers.</p>
          ) : (
            <div className="space-y-3 text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">Recommended: free and fast (Google Gemini)</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    Go to <span className="text-foreground">aistudio.google.com</span>, sign in with a Google account and click <span className="text-foreground">Get API key → Create API key</span>.
                  </li>
                  <li>
                    In the project folder, copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code> and set <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> to the key.
                  </li>
                  <li>Restart <code className="rounded bg-muted px-1">npm run dev</code>. This badge turns to “Gemini connected”. (See <code className="rounded bg-muted px-1">docs/gemini-setup.md</code>.)</li>
                </ol>
              </div>
              <div>
                <div className="font-medium text-foreground">Offline, on this computer (Ollama)</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    Install Ollama from <span className="text-foreground">ollama.com</span> and open it.
                  </li>
                  <li>
                    In a terminal, run <code className="rounded bg-muted px-1">ollama pull gemma3:4b</code> (a 3 GB download, once).
                  </li>
                  <li>Within a few seconds this badge turns to “Local AI connected”. No restart needed.</li>
                </ol>
              </div>
              <div>
                <div className="font-medium text-foreground">Best quality (Claude, paid)</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    Get an API key from <span className="text-foreground">console.anthropic.com</span>.
                  </li>
                  <li>
                    In the project folder, copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code> and set <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code>.
                  </li>
                  <li>Restart <code className="rounded bg-muted px-1">npm run dev</code>. This badge turns to “Claude connected”.</li>
                  <li>Prefer Dify? Set <code className="rounded bg-muted px-1">DIFY_API_URL</code> and <code className="rounded bg-muted px-1">DIFY_API_KEY</code> instead (see <code className="rounded bg-muted px-1">docs/dify-setup.md</code>).</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MenuEditor snap={snap} />

      <Card className="lg:col-span-2">
        <CardHeader>
          <Heading>POS and other systems</Heading>
          <CardDescription>Petpooja and other POS, booking apps, online orders, rosters, alerts to WhatsApp or Slack, and data exports are on the Integrations tab.</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link to="/demo?tab=integrations">
                <Plug /> Open Integrations
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
  const [p, setP] = useState<PriorityConfig>(() => priorityOf(snap.config))
  const [dirty, setDirty] = useState(false)
  return (
    <Card>
      <CardHeader>
        <Heading>Kitchen priorities</Heading>
        <CardDescription>How much each thing matters when the pass decides what to send next. Tickets are sorted by this, the pass is alerted as dishes near and pass their standard time, and the AI explains its call using these.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            await post('/api/config', { priority: p })
            setDirty(false)
            toast.success('Kitchen priorities saved')
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
              Save priorities
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setP(DEFAULT_PRIORITY)
                setDirty(true)
              }}
            >
              Reset to defaults
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
