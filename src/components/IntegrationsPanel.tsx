// The Integrations tab: how TableMate connects to what a restaurant already runs. Events come in
// from the POS, booking apps and middleware; alerts go out to WhatsApp, Slack or Sheets through a
// webhook; the night's data goes out as a CSV. Grouped by what each system does for the team.

import { BellRing, CalendarCheck, Download, FileSpreadsheet, Plug, Send, ShoppingBag, Star, Store, UsersRound, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { IntegrationCategory, IntegrationStatus, Snapshot } from '../../shared/snapshot.ts'
import type { AlertKind } from '../../shared/types.ts'
import { ALERT_KINDS } from '../../server/outbound.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { clock } from '../lib/format.ts'
import { STANDALONE, post } from '../lib/live.ts'
import { PanelTitle } from './kit.tsx'

const GROUPS: { id: IntegrationCategory; title: string; why: string; Icon: typeof Store }[] = [
  { id: 'pos', title: 'POS and billing', why: 'The core feed: seated tables, orders (KOTs), food ready, bills and what’s off the menu.', Icon: Store },
  { id: 'bookings', title: 'Bookings and waitlist', why: 'Who is coming, and what they need, before they arrive.', Icon: CalendarCheck },
  { id: 'orders', title: 'Online orders', why: 'Delivery orders load the same kitchen, so ETAs stay honest.', Icon: ShoppingBag },
  { id: 'staff', title: 'Staff rosters', why: 'Who is on tonight and which section is theirs.', Icon: UsersRound },
  { id: 'stock', title: 'Stock', why: 'Warn the floor before a dish runs out.', Icon: Warehouse },
  { id: 'messaging', title: 'Alerts and messaging', why: 'Send what matters to where the team already is.', Icon: BellRing },
  { id: 'reviews', title: 'Reviews', why: 'What guests say afterwards, turned into training.', Icon: Star },
  { id: 'data', title: 'Data out', why: 'For owners, accounts and the evaluation study.', Icon: FileSpreadsheet },
]

const MODE: Record<IntegrationStatus['mode'], { label: string; tone: string }> = {
  live: { label: 'Ready', tone: 'bg-good text-background' },
  'needs-partner-access': { label: 'Needs partner access', tone: 'border-warn text-warn' },
  planned: { label: 'Planned', tone: 'bg-secondary text-secondary-foreground' },
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle>
      <PanelTitle>{children}</PanelTitle>
    </CardTitle>
  )
}

export function IntegrationsPanel({ snap }: { snap: Snapshot }) {
  const list = snap.integrations ?? []
  const live = list.filter((i) => i.mode === 'live').length
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-hero p-5 text-hero-foreground md:p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Plug className="size-5 text-primary" /> Works with what you already use
        </h2>
        <p className="mt-2 max-w-[70ch] text-sm opacity-80">
          TableMate sits on top of the restaurant’s POS and booking apps: no new hardware and no typing. Events come in from them; alerts go out to WhatsApp, Slack or email; the night’s data goes out to Excel or Sheets. {live} connections work today, and any other system can plug in through the open event format or Zapier/n8n.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <TryIt />
        <Alerts snap={snap} />
        <ExportCard />
      </div>

      {GROUPS.map((g) => {
        const items = list.filter((i) => i.category === g.id)
        if (!items.length) return null
        return (
          <section key={g.id} aria-labelledby={`grp-${g.id}`}>
            <div className="mb-3 flex items-baseline gap-2">
              <g.Icon className="size-4 shrink-0 translate-y-0.5 text-primary" />
              <h2 id={`grp-${g.id}`} className="font-display text-xl">
                {g.title}
              </h2>
              <p className="text-sm text-muted-foreground">{g.why}</p>
            </div>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((i) => (
                <li key={i.id} className="flex flex-col rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <Badge variant="outline" className={cn('shrink-0', MODE[i.mode].tone)}>
                      {MODE[i.mode].label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm">{i.uses}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{i.note}</p>
                  {i.endpoints.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {i.endpoints.map((e) => (
                        <li key={e.path} className="text-xs">
                          <code className="break-all rounded bg-muted px-1.5 py-0.5 text-[11px] text-primary">
                            {e.method} {e.path}
                          </code>
                          <div className="mt-0.5 text-muted-foreground">{e.purpose}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {i.mode !== 'planned' && i.id !== 'export' && (
                    <div className="mt-auto pt-3 text-[11px] text-muted-foreground tabular">
                      {i.eventCount ? `${i.eventCount} ${i.id === 'webhook' ? 'alerts sent' : 'events'}, last at ${i.lastEventAt ? clock(i.lastEventAt) : '–'}` : i.id === 'webhook' ? 'No alerts sent yet' : 'No events received yet'}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** Show data arriving from an outside system, as a booking app or POS would send it. */
function TryIt() {
  const [busy, setBusy] = useState(false)
  return (
    <Card>
      <CardHeader>
        <Heading>Try it: data coming in</Heading>
        <CardDescription>Sends a booking through the open endpoint, exactly as a POS or booking app would. Watch it appear on the server’s phone and the manager screen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await post<{ text: string }>('/api/integrations/test')
              toast.success(r.text)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Send /> Send a test booking
        </Button>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">{`POST /api/events
{ "type": "table.seated",
  "payload": { "tableId": "T5", "partySize": 2,
    "guestName": "Neha Gupta",
    "occasion": "anniversary",
    "allergies": ["shellfish"] } }`}</pre>
      </CardContent>
    </Card>
  )
}

/** Alerts out: a webhook URL (Zapier, n8n, Make) and which alerts to send. */
function Alerts({ snap }: { snap: Snapshot }) {
  const saved = snap.config.alerts
  const [url, setUrl] = useState(saved?.url ?? '')
  const [kinds, setKinds] = useState<AlertKind[]>(saved?.kinds ?? ['manager', 'unhappy', 'sold_out'])
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const status = snap.integrations?.find((i) => i.id === 'webhook')
  const run = async (what: 'save' | 'test') => {
    setBusy(what)
    try {
      if (what === 'save') {
        await post('/api/alerts', { url, kinds })
        toast.success(url ? 'Alerts saved' : 'Alerts turned off')
      } else {
        const r = await post<{ error: string | null }>('/api/alerts/test', { url })
        if (r.error) toast.error(r.error)
        else toast.success('Test alert sent')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card>
      <CardHeader>
        <Heading>Alerts to WhatsApp, Slack or email</Heading>
        <CardDescription>Paste a webhook from Zapier, n8n or Make, then connect it to WhatsApp Business, Slack, Teams, email or a Google Sheet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/…" aria-label="Webhook address" inputMode="url" autoComplete="off" />
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Send these alerts</legend>
          {ALERT_KINDS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={kinds.includes(a.id)} onCheckedChange={(v) => setKinds((k) => (v ? [...k, a.id] : k.filter((x) => x !== a.id)))} />
              {a.label}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!!busy} onClick={() => void run('save')}>
            Save
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || !url} onClick={() => void run('test')}>
            <Send /> Send a test alert
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {status?.eventCount ? `${status.eventCount} alerts sent, last at ${status.lastEventAt ? clock(status.lastEventAt) : '–'}. ` : ''}
          {STANDALONE ? 'In this shared demo, alerts are sent from your browser; some services only accept them from the app running on a computer. ' : ''}
          No webhook yet? webhook.site gives you a test address in one click.
        </p>
      </CardContent>
    </Card>
  )
}

/** Tonight's finished visits, step by step, as a CSV for Excel, Sheets or Tally. */
function ExportCard() {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const rows = await post<Record<string, string | number>[]>('/api/export/visits')
      if (!rows.length) {
        toast('No finished tables yet. The export fills in as tables pay and leave.')
        return
      }
      const cols = Object.keys(rows[0])
      const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
      const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c] ?? '')).join(','))].join('\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      a.download = `tablemate-visits-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`Downloaded ${rows.length} steps`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <Heading>Data out: Excel, Sheets, Tally</Heading>
        <CardDescription>Every finished visit, step by step: how long it took against the standard, and whether the floor or the kitchen controlled it. No per-person scores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" disabled={busy} onClick={() => void download()}>
          <Download /> Download tonight as CSV
        </Button>
        <p className="text-xs text-muted-foreground">Columns: date, table, guests, step, controlled by, station, minutes, standard, past standard, guest mood.</p>
      </CardContent>
    </Card>
  )
}
