// AI assistance. When a Dify app is configured (DIFY_API_URL + DIFY_API_KEY), requests go to
// Dify's chat-messages API; otherwise a built-in writer produces a useful, plain answer so the
// copilot always works. The copilot builds the facts; Dify only phrases them.

import type { RestaurantConfig, TableState, Task } from '../shared/types.ts'
import { analytics } from '../shared/engine.ts'
import type { Hub } from './hub.ts'

export type AiKind = 'guest_script' | 'briefing' | 'shift_summary' | 'ask_sop'

export interface AiRequest {
  kind: AiKind
  staffId?: string
  taskId?: string
  question?: string
}

export interface AiAnswer {
  text: string
  source: 'dify' | 'built-in'
  /** Set when Dify was configured but the call failed and the built-in answer was used instead. */
  notice?: string
}

export interface DifyOptions {
  url?: string
  key?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const MIN = 60_000

export function createAi(hub: Hub, opts: DifyOptions = {}) {
  const dify = opts.url && opts.key ? { url: opts.url.replace(/\/+$/, ''), key: opts.key } : null
  const doFetch = opts.fetchImpl ?? fetch

  const name = (id?: string) => hub.config.staff.find((s) => s.id === id)?.name ?? 'the team'

  /** Facts + instruction for each kind. Kept short and concrete so any model phrases it well. */
  function build(req: AiRequest): { prompt: string; fallback: string } {
    const now = hub.clock.now()
    const cfg = hub.config
    switch (req.kind) {
      case 'guest_script': {
        const task = req.taskId ? hub.tasks(now).find((t) => t.id === req.taskId) : undefined
        if (!task) throw new AiError('That card is no longer open.')
        const table = hub.state.tables[task.tableId]
        return { prompt: guestScriptPrompt(task, table, cfg, now), fallback: guestScriptFallback(task, table, cfg) }
      }
      case 'briefing': {
        const mine = Object.values(hub.state.tables).filter((t) => t.serverId === req.staffId)
        const facts = briefingFacts(mine, cfg, hub.state.unavailable, now)
        return {
          prompt:
            `Write a pre-shift / mid-shift briefing for ${name(req.staffId)}, a server in a fine-dining restaurant. ` +
            `Use 3-6 short bullet points, most important first (allergies, regulars and occasions, kitchen issues). ` +
            `Be warm and practical; no performance judgement.\n\nFacts:\n${facts.join('\n')}`,
          fallback: facts.length ? facts.map((f) => `• ${f.replace(/^- /, '')}`).join('\n') : '• No tables yet. Section is clear.',
        }
      }
      case 'shift_summary': {
        const a = analytics(hub.state, cfg)
        const facts = [
          `Tables completed: ${a.visits}; served fully to standard: ${a.smoothRate == null ? 'n/a' : Math.round(a.smoothRate * 100) + '%'}`,
          `Lapses past standard: floor-controlled ${a.lapsesByOwner.floor}, kitchen ${a.lapsesByOwner.kitchen}`,
          ...a.stages.filter((s) => s.count).map((s) => `${s.label} (${s.owner}): avg ${s.avgMin} min vs standard ${s.avgTargetMin} min, ${Math.round(s.lapseRate * 100)}% late`),
          ...a.stations.map((s) => `Kitchen ${s.station} station: ${s.lapses}/${s.tickets} tickets late, avg ${s.avgOverMin} min over`),
          ...a.suggestions.map((s) => `Suggestion: ${s}`),
        ]
        return {
          prompt:
            `Write an end-of-shift summary for the restaurant manager in 4-6 sentences. Focus on process bottlenecks ` +
            `(stages, stations, staffing) and one or two concrete actions for next service. Never single out or rank ` +
            `individual staff.\n\nFacts:\n${facts.map((f) => `- ${f}`).join('\n')}`,
          fallback: shiftSummaryFallback(a),
        }
      }
      case 'ask_sop': {
        const q = (req.question ?? '').trim()
        if (!q) throw new AiError('Type a question first.')
        return {
          prompt:
            `A restaurant staff member asks about service standards: "${q}". Answer in 1-3 short sentences using the ` +
            `restaurant's SOP manual (knowledge base) and these configured standards:\n${sopFacts(cfg).join('\n')}`,
          fallback: sopFallback(q, cfg),
        }
      }
    }
  }

  async function callDify(prompt: string, req: AiRequest): Promise<string> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000)
    try {
      const res = await doFetch(`${dify!.url}/chat-messages`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${dify!.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: { kind: req.kind }, query: prompt, response_mode: 'blocking', user: req.staffId ?? 'copilot' }),
      })
      const data = (await res.json().catch(() => ({}))) as { answer?: string; message?: string }
      if (!res.ok) throw new Error(data.message ?? `Dify returned ${res.status}`)
      if (!data.answer?.trim()) throw new Error('Dify returned an empty answer')
      return data.answer.trim()
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    provider: (dify ? 'dify' : 'built-in') as 'dify' | 'built-in',
    async ask(req: AiRequest): Promise<AiAnswer> {
      const { prompt, fallback } = build(req)
      if (!dify) return { text: fallback, source: 'built-in' }
      try {
        return { text: await callDify(prompt, req), source: 'dify' }
      } catch (e) {
        const reason = e instanceof Error ? (e.name === 'AbortError' ? 'Dify took too long to answer' : e.message) : String(e)
        return { text: fallback, source: 'built-in', notice: `${reason}. Showing the built-in answer.` }
      }
    },
  }
}

export class AiError extends Error {}

// ---------------------------------------------------------------------------
// Prompts and built-in answers

function guestName(t?: TableState) {
  return t?.party?.guestName ?? ''
}

function guestScriptPrompt(task: Task, t: TableState | undefined, cfg: RestaurantConfig, now: number) {
  const facts = [
    `Table ${task.tableName}, party of ${t?.party?.size ?? '?'}${guestName(t) ? `, guest ${guestName(t)}` : ''}${t?.party?.occasion ? `, celebrating a ${t.party.occasion}` : ''}${t?.party?.vip ? ', a regular' : ''}`,
    `Situation: ${task.title}`,
    `Detail: ${task.hint}`,
  ]
  if (task.kind === 'kitchen_delay') {
    const late = t?.lines.filter((l) => l.status === 'fired') ?? []
    if (late.length) facts.push(`Dishes: ${late.map((l) => l.name).join(', ')}; about ${Math.max(1, Math.round((now - Math.min(...late.map((l) => l.expectedReadyAt))) / MIN))} min past the usual time`)
  }
  return (
    `You help a fine-dining server speak to guests. Write exactly what the server can say at the table, ` +
    `in 1-2 natural, gracious sentences. Be honest about the wait or the change, offer a small gesture or ` +
    `alternative, and never blame the kitchen or colleagues. Restaurant: ${cfg.name}.\n\nFacts:\n${facts.map((f) => `- ${f}`).join('\n')}`
  )
}

function guestScriptFallback(task: Task, t: TableState | undefined, cfg: RestaurantConfig): string {
  const who = guestName(t) ? `${guestName(t)}, ` : ''
  if (task.kind === 'unavailable') {
    const off = t?.lines.find((l) => l.status === 'unavailable' && !l.unavailableInformedAt)
    const alts = cfg.menu.filter((m) => off && m.course === off.course && m.id !== off.menuItemId).slice(0, 2).map((m) => m.name.toLowerCase())
    return `${who}I’m so sorry. The ${off?.name.toLowerCase() ?? 'dish you chose'} has just run out for tonight. ${alts.length ? `May I suggest the ${alts.join(' or the ')} instead? ` : ''}I’ll make sure it comes out quickly.`
  }
  if (task.kind === 'kitchen_delay') {
    const late = t?.lines.filter((l) => l.status === 'fired') ?? []
    const dish = late.length === 1 ? `your ${late[0].name.toLowerCase()}` : `your ${late[0]?.course ?? 'dishes'}s`
    const occasion = t?.party?.occasion ? ` We want everything perfect for your ${t.party.occasion}.` : ''
    return `${who}I just checked with the kitchen: ${dish} will be with you in a few more minutes.${occasion} Can I bring you some bread or top up your drinks while you wait?`
  }
  if (task.kind === 'farewell') return `${who}thank you so much for joining us tonight.${t?.party?.occasion ? ` Happy ${t.party.occasion}!` : ''} We hope to see you again soon.`
  if (task.kind === 'greet') return `Good evening${guestName(t) ? ` ${guestName(t)}` : ''}, welcome to ${cfg.name}.${t?.party?.occasion ? ` I hear it’s a special ${t.party.occasion}; congratulations!` : ''} May I start you with some water while you look at the menu?`
  return `${task.title}. ${task.hint}`
}

function briefingFacts(tables: TableState[], cfg: RestaurantConfig, unavailable: Record<string, number>, now: number): string[] {
  const out: string[] = []
  const active = tables.filter((t) => t.visitId)
  out.push(`- ${active.length} of ${tables.length} tables in the section are seated`)
  for (const t of active) {
    const bits = [`${t.name}: party of ${t.party?.size ?? '?'}`, `seated ${Math.round((now - (t.seatedAt ?? now)) / MIN)} min`]
    if (t.party?.guestName) bits.push(t.party.guestName)
    if (t.party?.vip) bits.push('regular guest')
    if (t.party?.occasion) bits.push(t.party.occasion)
    if (t.party?.allergies.length) bits.push(`ALLERGY ${t.party.allergies.join(', ')}`)
    const late = t.lines.filter((l) => l.status === 'fired' && now > l.expectedReadyAt)
    if (late.length) bits.push(`kitchen running late on ${late.map((l) => l.name).join(', ')}`)
    out.push(`- ${bits.join(', ')}`)
  }
  const off = Object.keys(unavailable).map((id) => cfg.menu.find((m) => m.id === id)?.name ?? id)
  if (off.length) out.push(`- Off the menu tonight: ${off.join(', ')}`)
  return out
}

function shiftSummaryFallback(a: ReturnType<typeof analytics>): string {
  if (!a.visits) return 'No tables have finished yet. The summary fills in as tables complete.'
  const lapses = a.lapsesByOwner.floor + a.lapsesByOwner.kitchen
  const worstStage = [...a.stages].filter((s) => s.count).sort((x, y) => y.lapseRate - x.lapseRate)[0]
  const parts = [
    `${a.visits} tables completed, ${a.smoothRate == null ? '' : `${Math.round(a.smoothRate * 100)}% fully to standard`}.`,
    lapses ? `Of ${lapses} steps that ran past standard, ${a.lapsesByOwner.kitchen} were in the kitchen and ${a.lapsesByOwner.floor} on the floor.` : 'No step ran past standard.',
    worstStage && worstStage.lapseRate > 0 ? `The stage most often late was ${worstStage.label.toLowerCase()} (${Math.round(worstStage.lapseRate * 100)}% of the time, avg ${worstStage.avgMin} vs ${worstStage.avgTargetMin} min).` : '',
    ...a.suggestions,
  ]
  return parts.filter(Boolean).join(' ')
}

function sopFacts(cfg: RestaurantConfig): string[] {
  const s = cfg.sop
  return [
    `- Greet seated guests within ${s.greetWithinMin} min`,
    `- If menus have been down ${s.orderNudgeAfterMin} min after greeting, check whether they are ready to order`,
    `- Tell guests when the kitchen is more than ${s.kitchenDelayToleranceMin} min behind`,
    `- Take food from the pass to the table within ${s.pickupWithinMin} min`,
    `- Check back ${s.checkbackAfterMin} min after serving`,
    `- Present the bill within ${s.billPresentWithinMin} min of it being asked for`,
    `- Say goodbye within ${s.farewellWithinMin} min of payment`,
    `- Reset a table within ${s.resetWithinMin} min: clear & wipe, fresh linen & napkins, cutlery & glassware, condiments, menus & candle`,
    `- Allergies are flagged to the kitchen as soon as the order is placed`,
  ]
}

function sopFallback(q: string, cfg: RestaurantConfig): string {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  const ranked = sopFacts(cfg)
    .map((f) => ({ f, hits: words.filter((w) => f.toLowerCase().includes(w.replace(/s$/, ''))).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  if (!ranked.length) return 'I can only answer from the service standards set up here. Connect Dify with your SOP manual for full answers.'
  return ranked.slice(0, 2).map((x) => x.f.replace(/^- /, '')).join('. ') + '.'
}
