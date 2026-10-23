// AI assistance. In order of preference: Claude (ANTHROPIC_API_KEY, see server/claude.ts), a
// Dify app (DIFY_API_URL + DIFY_API_KEY), or a built-in writer and trainer so the copilot always
// works. The copilot builds the facts; the model only phrases them and holds the conversation.

import { guestWith, readWishes, suggestFallback } from '../shared/suggest.ts'
import type { MenuItem } from '../shared/types.ts'
import type { RestaurantConfig, Segment, TableState, Task, VisitRecord } from '../shared/types.ts'
import { floorInsights } from '../shared/floorInsights.ts'
import { dishesNamed } from '../shared/dishNames.ts'
import { answerAboutDish, dishLine, SPICE_WORDS } from '../shared/menuAnswer.ts'
import { analytics, segmentsFor } from '../shared/engine.ts'
import { practiceText } from '../shared/practiceText/index.ts'
import { coachFor, MAX_REPLIES, moodFor, type Mood, type Outcome, patienceAfter, PATIENCE_MAX, practiceDebrief, practiceStep, scenarioById, scenarioOpening, type Score, scoreReply, starsFor } from '../shared/practice.ts'
import { forecast, liveVisit as liveVisitOf, reconstructVisit, shiftIntel } from '../shared/intel.ts'
import { predictReady } from '../shared/predict.ts'
import { menuForNeed, safetyIssues } from '../shared/safety.ts'
import { istClock } from '../shared/time.ts'
import { type Audience, findLessons, type Lesson, lessonsFor, MANAGER_STARTERS, STARTERS } from '../shared/training.ts'
import { describeTicket, kitchenTickets, PRIORITY_FIELDS, priorityOf } from '../shared/priority.ts'
import { createRanker, type Ranker } from './ranker.ts'
import { profileFor, type Tier } from './tasks.ts'
import type { Hub } from './hub.ts'
import { parseWhatIf, runWhatIf, whatIfText } from './whatif.ts'

export type AiKind = 'guest_script' | 'briefing' | 'shift_summary' | 'ask_sop' | 'coach' | 'practice' | 'chat' | 'complaint' | 'incident' | 'kitchen_triage' | 'menu_suggest'

/** One message in the assistant chat. In practice mode the guest's lines are the assistant's. */
export type AiProvider = 'claude' | 'gemini' | 'cloud' | 'ollama' | 'dify' | 'built-in'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  /** Practice: the score (0–100) this reply already got, so the other side's patience carries over. */
  score?: number
}

/** A conversational language model (Claude, or a local Ollama model). `stable` is cacheable; `live` changes every message. */
export interface ChatModel {
  name: 'claude' | 'gemini' | 'cloud' | 'ollama'
  /** A unique key for this model in the line-up and the ranking (several cloud services share the name "cloud"). Defaults to the name. */
  id?: string
  /** False while the model can't be used (e.g. the demo page hasn't been granted Claude); the next provider answers. */
  available?(): boolean
  /** Small local models can get menu facts wrong: add the menu's own line for any dish the question names. */
  checkFacts?: boolean
  /** A slower local model: send a compact prompt (only the training notes that matter for this question). */
  compact?: boolean
  /** A cloud model with a small free allowance: send the compact prompt (fewer tokens), but trust its judgement fully. */
  lean?: boolean
  /** Which model is answering, for the Setup page (e.g. "gemma3:4b"). */
  label?(): string | undefined
  /** `reminder` restates the format and length in one line; small local models follow it far better than the long system prompt. */
  /** `onText`, when given, receives the whole answer so far as it's written (for streaming to the screen). */
  /** `opts.maxTokens` caps the answer's length; `opts.signal` cancels a request that is taking too long. */
  reply(system: { stable: string; live: string; reminder?: string }, turns: ChatTurn[], onText?: (text: string) => void, opts?: { maxTokens?: number; temperature?: number; signal?: AbortSignal; json?: Record<string, unknown> }): Promise<string>
}

export interface PracticeTurn {
  role: 'guest' | 'server'
  text: string
}

export interface AiRequest {
  kind: AiKind
  staffId?: string
  taskId?: string
  question?: string
  /** Language code of the asking device (en, hi, ne, bn, ta, es). Dify replies in it. */
  lang?: string
  /** Practice: which tough moment, and the conversation so far. */
  scenario?: string
  history?: PracticeTurn[]
  /** Chat: the conversation so far, ask or practice mode, and whether to wrap up a practice. */
  messages?: ChatTurn[]
  mode?: 'ask' | 'practice'
  finish?: boolean
  /** The person asked for simple, everyday words. */
  simple?: boolean
  /** Complaint help: the table. Incident story: the visit. */
  tableId?: string
  visitId?: string
  /** Menu suggestions: the dish to recommend ("suggest this dish"). */
  dishId?: string
}

/** Language names for the prompt; unknown codes fall back to English. */
export const AI_LANGUAGES: Record<string, string> = { en: 'English', hi: 'Hindi', ne: 'Nepali', bn: 'Bengali', ta: 'Tamil', es: 'Spanish' }

/**
 * House style for every answer: inclusive, respectful wording. Applied to all prompts so
 * staff and guests are never assumed to be a gender, ability, age or background.
 */
export const INCLUSIVE_STYLE =
  'Use gender-neutral language: address guests by the name given or as "you"; never assume gender ' +
  '(no sir/madam, ladies/gentlemen, guys) and use they/them for anyone whose pronouns are unknown. ' +
  'Be respectful of disability, age, faith, diet and background; describe needs, not people. Use plain, short sentences.'

export interface AiAnswer {
  text: string
  source: AiProvider
  /** Set when Dify was configured but the call failed and the built-in answer was used instead. */
  notice?: string
  /** Practice only: coaching on the server's last reply, 1–3 stars, and whether the role-play is over. */
  feedback?: string
  stars?: number
  done?: boolean
  /** Chat: good next questions to offer. */
  suggestions?: string[]
  /** Practice: the reply's score out of 100, what it did and missed, and an ideal reply to learn from. */
  score?: number
  criteria?: Score['criteria']
  ideal?: string
  /** Practice: who judged the reply: the AI model, or the built-in rubric (when the model sent no usable score). */
  judgedBy?: 'model' | 'rubric'
  /** Practice: how the other side took it, their patience (0–4) and, at the end, how it went. */
  mood?: Mood
  patience?: number
  outcome?: Outcome
  /** Practice: XP earned by this turn (added by the API, which records it), and the score a reply needs to earn any. */
  xp?: number
  xpMin?: number
  /** Language of `text` when it isn't the app's language (the built-in trainer answers in English). */
  lang?: string
  /** A question about a dish: offer to send it to the kitchen (`unsure`: the menu notes didn't answer it). */
  askKitchen?: { menuItemId?: string; question: string; unsure: boolean }
  /** Menu suggestions: the dishes the answer recommends (menu item ids). */
  dishes?: string[]
}

export interface DifyOptions {
  /** A conversational model (Claude or Ollama), preferred over Dify when present. */
  /** Models best first. When one fails or answers badly, the next is asked; the built-in trainer is last. */
  chat?: ChatModel | ChatModel[]
  ranker?: Ranker
  /** Turns a model error into a short reason for the notice. */
  chatErrorReason?: (e: unknown, model?: ChatModel) => string
  url?: string
  key?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const MIN = 60_000

export function createAi(hub: Hub, opts: DifyOptions = {}) {
  const dify = opts.url && opts.key ? { url: opts.url.replace(/\/+$/, ''), key: opts.key } : null
  const models = [opts.chat ?? []].flat()
  const ranker = opts.ranker ?? createRanker()
  /** The models that can answer now, best first. */
  const idOf = (m: ChatModel) => m.id ?? m.name
  const candidates = (tier: Tier = 'quick') => ranker.order(models.filter((m) => m.available?.() ?? true).map(idOf), tier).map((n) => models.find((m) => idOf(m) === n)!)
  const doFetch = opts.fetchImpl ?? fetch

  const name = (id?: string) => hub.config.staff.find((s) => s.id === id)?.name ?? 'the team'
  const pronouns = (id?: string) => hub.config.staff.find((s) => s.id === id)?.pronouns

  /** Facts + instruction for each kind. Kept short and concrete so any model phrases it well. */
  function build(req: AiRequest): Built {
    const now = hub.clock.now()
    const cfg = hub.config
    switch (req.kind) {
      case 'guest_script': {
        const task = req.taskId ? hub.tasks(now).find((t) => t.id === req.taskId) : undefined
        if (!task) throw new AiError('That card is no longer open.')
        const table = hub.state.tables[task.tableId]
        const etaMin = table ? etaMinutes(hub, table, now) : undefined
        return { prompt: guestScriptPrompt(task, table, cfg, now, etaMin), fallback: guestScriptFallback(task, table, cfg, etaMin) }
      }
      case 'briefing': {
        const mine = Object.values(hub.state.tables).filter((t) => t.serverId === req.staffId)
        const facts = briefingFacts(mine, cfg, hub.state.unavailable, now)
        return {
          prompt:
            `Write a pre-shift / mid-shift briefing for ${name(req.staffId)}${pronouns(req.staffId) ? ` (${pronouns(req.staffId)})` : ''}, a server in a fine-dining restaurant. ` +
            `Use 3-6 short bullet points, most important first (allergies, guest access needs, regulars and occasions, kitchen issues). ` +
            `Be warm and practical; no performance judgement.\n\nFacts:\n${facts.join('\n')}`,
          fallback: facts.length ? facts.map((f) => `• ${f.replace(/^- /, '')}`).join('\n') : '• No tables yet. Section is clear.',
        }
      }
      case 'shift_summary': {
        const a = analytics(hub.state, cfg)
        const intel = shiftIntel(hub.state, cfg)
        const facts = [
          ...intel.why.map((w) => `Why: ${w}`),
          ...forecast(hub.state, cfg, now, hub.tasks(now)).headlines.map((h) => `Next 15 min: ${h}`),
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
          fallback: a.visits || intel.bottleneck ? [intel.why.join(' '), intel.actions.length ? `Next: ${intel.actions.join(' ')}` : ''].filter(Boolean).join('\n\n') : shiftSummaryFallback(a),
        }
      }
      case 'kitchen_triage': {
        const list = kitchenTickets(hub.state, cfg, now)
        const p = priorityOf(cfg)
        const rules = PRIORITY_FIELDS.filter((f) => f.max === 10).map((f) => `${f.label}: ${p[f.key]}/10`)
        const top = list.slice(0, 6)
        const facts = [
          `Tickets on the line: ${list.length}; late: ${list.filter((k) => k.level === 'late' || k.level === 'critical').length}; approaching the standard time: ${list.filter((k) => k.level === 'soon').length}`,
          ...top.map((k, i) => `${i + 1}. ${describeTicket(k)}; priority score ${k.score}, ${k.level}${k.minsOver ? `, ${k.minsOver} min over` : ''}`),
        ]
        const fallback = !list.length
          ? 'Nothing on the line. Clear the pass and get ahead on prep.'
          : [`Do first: ${describeTicket(top[0])}.`, top[1] ? `Then: ${describeTicket(top[1])}.` : '', top.some((k) => k.reasons.some((r) => /allerg|diet/.test(r))) ? 'Allergy and diet tickets are always checked with the chef before they leave the pass.' : ''].filter(Boolean).join(' ')
        return {
          prompt:
            `You are the pass's calm second pair of eyes. In 2-4 short sentences tell the kitchen what to send out first and why, then one heads-up if something is about to go late. ` +
            `Use the restaurant's own priorities below to weigh the tickets; keep the order given unless the facts clearly say otherwise. Allergy and diet tickets are always confirmed by the chef. ` +
            `Never blame a person or a station. Name tables (like T4), not guests.\n\nThe restaurant's priorities:\n${rules.map((r) => `- ${r}`).join('\n')}\n\nTickets, most urgent first:\n${facts.map((f) => `- ${f}`).join('\n')}`,
          fallback,
        }
      }
      case 'menu_suggest': {
        // What to offer this table: built from the menu, the table's allergies and diet, tonight's
        // switched-off dishes and every wish the server has typed. Safety is decided by rules, never by the model.
        const t = req.tableId ? hub.state.tables[req.tableId] : undefined
        const off = Object.keys(hub.state.unavailable)
        const wishes = (req.messages ?? []).filter((m) => m.role === 'user').map((m) => m.text)
        // Allergies and diets the server mentions while asking count as much as the ones on the table.
        const party = guestWith(t?.party, readWishes(wishes))
        const built = suggestFallback(cfg.menu, off, party, wishes, req.dishId, t?.name)
        const language = AI_LANGUAGES[req.lang ?? 'en'] ?? 'English'
        const safe = cfg.menu.filter((m) => !off.includes(m.id) && !safetyIssues(m, party).length)
        const unsafe = cfg.menu.filter((m) => off.includes(m.id) || safetyIssues(m, party).length)
        const dish = req.dishId ? cfg.menu.find((m) => m.id === req.dishId) : undefined
        const line = (m: MenuItem) => `- ${m.name} (${m.course}; spice ${m.spice ?? 0}/3; contains ${(m.contains ?? []).join(', ') || 'nothing listed'}): ${m.description ?? ''}${m.adjust ? ` Kitchen can: ${m.adjust}` : ''}`
        const ordered = t?.lines.map((l) => l.name).join(', ')
        const tableFacts = t
          ? [`Table ${t.name}, party of ${party.size}`, party.allergies.length ? `allergies: ${party.allergies.join(', ')}` : 'no allergies noted', party.needs?.length ? `needs: ${party.needs.join(', ')}` : '', party.occasion ? `occasion: ${party.occasion}` : '', ordered ? `already ordered: ${ordered}` : ''].filter(Boolean).join('; ')
          : 'No table chosen.'
        const convo = (req.messages ?? []).map((m) => `${m.role === 'user' ? 'SERVER' : 'YOU'}: ${m.text}`).join('\n')
        const ask = dish
          ? `The server tapped "Suggest this dish" for the ${dish.name}. ${safetyIssues(dish, party).length || off.includes(dish.id) ? 'It is NOT safe or not available for this table: say so in one sentence and suggest one safe alternative from the list.' : 'Write one or two warm, natural lines the server can say to the guests to recommend it (in quotes), using its description; add one short tip only if it fits what the guests said they like.'}`
          : `Suggest 2 or 3 dishes from the SAFE list that fit everything the guests want in the conversation (later wishes win). For each: the dish name, a few words on why it fits, and one short line in quotes the server can say. If nothing fits, say so and suggest asking the kitchen.`
        return {
          prompt:
            `You help a fine-dining server choose what to recommend at the table. Reply in ${language}, but keep dish names exactly as written. Be brief: a short bulleted list, no preamble. ` +
            `Only ever recommend dishes from the SAFE list. Never guess about allergens beyond the tags given.\n\n${tableFacts}\n\nSAFE for this table tonight:\n${safe.map(line).join('\n')}\n\n` +
            `NOT for this table tonight (allergy, diet or switched off): ${unsafe.map((m) => m.name).join(', ') || 'none'}\n\nConversation so far:\n${convo || '(none)'}\n\n${ask}`,
          fallback: built.text,
          extra: { dishes: built.dishes },
          parse: (answer: string) => ({ text: answer.trim(), dishes: cfg.menu.filter((m) => answer.toLowerCase().includes(m.name.toLowerCase()) && safe.includes(m)).map((m) => m.id) }),
        }
      }
      case 'complaint': {
        const t = req.tableId ? hub.state.tables[req.tableId] : undefined
        if (!t?.visitId) throw new AiError('That table has no guests right now.')
        const facts = complaintFacts(hub, t, now)
        return {
          prompt:
            `A guest at ${t.name} is unhappy and ${name(req.staffId)}, their server, needs help right now. Using only these facts, write:\n` +
            `SAY: one or two sentences the server can say to the guest now (a sincere apology, what they will do, and a time if one is known; never blame the kitchen or a colleague; never guess about allergens)\n` +
            `DO: two to four short steps, most important first.\nKeep it calm and practical.\n\nFacts:\n${facts.join('\n')}`,
          fallback: complaintFallback(hub, t, now),
          parse: (answer: string) => ({ text: answer.replace(/\*\*(SAY|DO):?\*\*:?/gi, '$1:').trim() }),
        }
      }
      case 'incident': {
        const v = hub.state.visits.find((x) => x.visitId === req.visitId)
        const liveT = v ? undefined : Object.values(hub.state.tables).find((x) => x.visitId && x.visitId === req.visitId)
        const visit = v ?? (liveT ? liveVisitOf(liveT, cfg, now) : null)
        if (!visit) throw new AiError('That visit is no longer on record.')
        const r = reconstructVisit(visit, cfg, !v)
        return {
          prompt:
            `Explain to the restaurant manager what happened at this table, in 3-5 plain sentences, in time order. Say which steps ran ` +
            `past standard and who controlled each (kitchen or floor). Never blame or judge a person; talk about steps, stations and load. ` +
            `End with one process change that would have helped.\n\nFacts:\n${[...r.story, ...r.helped.map((h) => `Would have helped: ${h}`)].map((f) => `- ${f}`).join('\n')}`,
          fallback: [r.story.join(' '), ...(r.helped.length ? [`What would help: ${r.helped.join(' ')}`] : [])].join('\n\n'),
        }
      }
      case 'coach': {
        // Finished tables plus steps already done at tables still being served.
        const live = Object.values(hub.state.tables)
          .filter((t) => t.serverId === req.staffId && t.visitId)
          .map((t) => ({ ...liveVisit(t, cfg) }))
        const mine = [...hub.state.visits.filter((v) => v.serverId === req.staffId), ...live]
        const facts = coachFacts(mine, cfg)
        return {
          prompt:
            `You are a warm, private coach for ${name(req.staffId)}, a fine-dining server. Using only their own data below, ` +
            `write 3 short lines: one thing that went well (be specific), one thing to try next shift (practical, ` +
            `one habit), and one sentence of encouragement. Never compare them with colleagues. Kitchen delays are not ` +
            `their fault and must not be mentioned as their weakness.\n\nTheir data:\n${facts.join('\n')}`,
          fallback: coachFallback(mine, cfg),
        }
      }
      case 'practice':
        return practiceTurn(req)
      case 'chat':
        return chatTurn(req, now)
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

  /** Practice role-play (older single-shot kind): the guest's next line plus coaching on the server's last reply. */
  function practiceTurn(req: AiRequest): Built {
    const sc = scenarioById(req.scenario)
    if (!sc) throw new AiError('Pick a situation to practise.')
    const history = req.history ?? []
    const replies = history.filter((h) => h.role === 'server').map((h) => h.text)
    const step = practiceStep(sc.id, replies, req.lang)
    const builtFeedback = step.scored ? coachLines(step.scored, req.lang) : undefined
    return {
      prompt:
        `Role-play to train a fine-dining server. You play a guest in this situation: "${scenarioOpening(sc.id)}". ` +
        `Conversation so far:\n${history.map((h) => `${h.role === 'guest' ? 'GUEST' : 'SERVER'}: ${h.text}`).join('\n') || '(none yet)'}\n\n` +
        (replies.length
          ? `First, coach the server's last reply in 2 short lines starting with ✓ for what worked and → for one improvement (apology, empathy, a clear next step, a time, no blaming the kitchen, never guessing about allergens). `
          : '') +
        (step.done ? 'Then end the role-play as the guest.' : 'Then reply as the guest, in one or two natural sentences, staying in character.') +
        `\nFormat exactly:\nCOACH: <coaching or "-">\nGUEST: <guest line>`,
      fallback: step.text,
      extra: { feedback: builtFeedback, stars: step.scored?.stars, done: step.done },
      parse: (answer: string) => {
        const coach = answer.match(/COACH:\s*([\s\S]*?)(?:\n\s*GUEST:|$)/i)?.[1]?.trim()
        const guest = answer.match(/GUEST:\s*([\s\S]*)$/i)?.[1]?.trim()
        return { text: guest || answer.trim(), feedback: coach && coach !== '-' ? coach : builtFeedback }
      },
    }
  }

  /** The assistant chat: expert answers in ask mode, a guest plus a coach in practice mode. */
  function chatTurn(req: AiRequest, now: number): Built {
    const cfg = hub.config
    const turns = (req.messages ?? []).filter((t) => t.text.trim()).slice(-16)
    const practice = req.mode === 'practice'
    const sc = practice ? scenarioById(req.scenario) : undefined
    if (practice && !sc) throw new AiError('Pick a situation to practise.')
    if (!practice && turns.at(-1)?.role !== 'user') throw new AiError('Type a message first.')
    const language = AI_LANGUAGES[req.lang ?? 'en'] ?? 'English'
    // Who is asking decides the voice and the knowledge: the staff list marks managers.
    const audience: Audience = sc?.for ?? (cfg.staff.find((x) => x.id === req.staffId)?.role === 'manager' ? 'manager' : 'server')
    const manager = audience === 'manager'
    const asker = manager ? 'the manager' : 'the server'
    const other = sc?.plays === 'staff' ? 'team member' : 'guest'
    const mine = Object.values(hub.state.tables).filter((t) => (manager ? !!t.visitId : t.serverId === req.staffId))
    // Practice: every reply so far, its score (the app sends back what each one got) and the other side's patience.
    const replies = turns.filter((t) => t.role === 'user')
    const rubric = sc ? replies.map((t) => scoreReply(sc.id, t.text, req.lang)) : []
    // (Questions aren't scored: this only applies to role-plays.)
    const past = sc ? replies.slice(0, -1).map((t, i) => ({ score: t.score ?? rubric[i].score, penalty: rubric[i].penalty })) : []
    const patienceBefore = patienceAfter(past).patience
    const opening = practice && !replies.length
    // A diet or allergy list worked out from the ingredient tags, so every model answers from facts.
    const asked = practice ? '' : turns.at(-1)!.text
    const forNeed = asked ? menuForNeed(asked, cfg.menu) : null
    // A manager's "what if…": run it in the sandbox so the answer comes from a simulation, not a guess.
    const whatIf = manager && asked ? parseWhatIf(asked, cfg) : null
    const whatIfRun = whatIf ? runWhatIf(cfg, whatIf) : null
    const live = [
      'Live context (changes every message):',
      `- Asking: ${name(req.staffId)}${pronouns(req.staffId) ? ` (${pronouns(req.staffId)})` : ''}, ${manager ? 'the floor manager' : 'a server'}`,
      `- Their app language: ${language}. Reply in the language they write in; if unclear, use ${language}. Keep dish names as on the menu.`,
      ...(req.simple ? ['- They asked for simple words: short sentences, everyday words, one idea per sentence; explain any restaurant term.'] : []),
      `- Time: ${istClock(now)} IST`,
      ...(practice
        ? [
            `- Mode: PRACTICE. You play a ${other} in this situation (their opening line, to say in ${language}): "${scenarioOpening(sc!.id)}"`,
            `- Play them like a real person, not a pushover: react to exactly what ${asker} said. One polite sentence doesn't fix things. If they're vague, push for specifics (what exactly, how long). If they apologise, act and give a time, soften a little but raise a real follow-up worry. Excuses, blame, guesses about safety or judging you make you more upset. Natural spoken ${language}, 1-2 short sentences, real emotion, no stage directions, never abusive or cartoonish.`,
            `- Judge only what the reply actually says about THIS situation. A reply that is off-topic, ignores or denies the concern ("is that even real?", "you're overreacting"), is rude, dismissive, or makes no sense scores 0-20, and the ${other} reacts the way a real person would: confused, irritated or more upset. They never thank, praise or cheer up after such a reply, and never answer as if it were helpful.`,
            `- The ${other}'s patience right now: ${patienceBefore}/${PATIENCE_MAX} (0 = gives up and leaves or asks for the manager, ${PATIENCE_MAX} = won over). A good reply (score 70+) raises it by 1, a poor one (under 35) lowers it by 1, and two strong replies in total win them over. If it reaches ${PATIENCE_MAX}, close warmly and add [END]; if it reaches 0, leave or ask for the manager and add [END]. After ${MAX_REPLIES} replies, wrap up either way with [END].`,
            req.finish
              ? `- ${manager ? 'The manager' : 'The server'} asked to finish. Step out of character and give a short, warm debrief in ${language}: start by thanking them and naming two things they did well, then one thing to try next time phrased as an encouraging suggestion (never a criticism), and a final line "STARS: n" (1-5, be generous: a sincere effort is at least 3).`
              : opening
                ? `- Start the role-play: say the opening line in ${language}, in character. Format exactly:\nCOACH: -\nGUEST: <the ${other}'s opening line>`
                : `${calibration(sc!.id)}\n- Judge ${asker}'s last reply like a kind, encouraging trainer: they are practising, nobody is expected to be perfect, and the goal is that they want to try again. Judge what the reply means, not exact wording; spoken, imperfect, short-but-caring replies deserve credit. A reply that is polite, takes the concern seriously and offers some next step scores 65-85 even if it misses a detail; a great one 90+. Keep low scores (under 30) only for replies that are rude, blame the chef, kitchen or a colleague, guess about allergens, make things up, mock the guest, or ignore what they actually said. COACH always starts with ✓ and genuine, specific praise for something they did, then → one gentle, practical tip phrased as "Next time, try…" with an example. Never use harsh words like wrong, bad, poor or failed; be honest but warm. Then score it against the practice rubric and answer as the ${other}. Write COACH, IDEAL and GUEST in ${language}; keep the labels in English. Format exactly:\nCOACH: ✓ <specific praise> → <one gentle tip: Next time, try…>\nSCORE: <0-100>\nIDEAL: <what an excellent ${manager ? 'manager' : 'server'} would have said instead, 1-2 sentences>\nGUEST: <the ${other}'s next line, in character>`,
          ]
        : [manager ? '- Mode: ASK. Answer as their operations coach and peer.' : '- Mode: ASK. Answer as their expert trainer and colleague.']),
      ...(forNeed ? ['- Checked from the menu’s ingredient tags for this question (use exactly this; do not add dishes):', ...forNeed.split('\n').map((l) => `  ${l}`)] : []),
      ...(whatIfRun ? ['- Simulation for this question (use these results; say they come from a simulation):', ...whatIfText(whatIfRun).split('\n').map((l) => `  ${l}`)] : []),
      manager ? '- The floor right now (seated tables):' : '- Their section right now:',
      ...briefingFacts(mine, cfg, hub.state.unavailable, now),
      ...(manager ? floorFacts(hub, now) : []),
    ].join('\n')
    // The API needs the conversation to start with the server; a practice opens with the guest.
    const apiTurns: ChatTurn[] = turns[0]?.role === 'user' ? [...turns] : [{ role: 'user', text: practice ? `(Start the role-play with the ${other}’s opening line.)` : '(Start.)' }, ...turns]
    if (practice && req.finish) apiTurns.push({ role: 'user', text: '(Finish the practice and give me my debrief.)' })
    else if (practice && apiTurns.at(-1)?.role === 'assistant') apiTurns.push({ role: 'user', text: '(Continue.)' })
    const builtIn = practice ? practiceBuiltIn(sc!.id, replies, req.lang, !!req.finish) : askBuiltIn(turns.at(-1)!.text, req, now, audience)
    const facts = practice ? [] : forNeed ? [forNeed] : dishesNamed(asked, cfg.menu).slice(0, 2).map(dishFacts)
    return {
      facts,
      prompt: `${stableSystem(cfg, audience)}\n\n${live}\n\nConversation so far:\n${apiTurns.map((t) => `${t.role === 'user' ? (manager ? 'MANAGER' : 'SERVER') : practice ? other.toUpperCase() : 'TABLEMATE'}: ${t.text}`).join('\n')}`,
      fallback: builtIn.text,
      // Everything the built-in answer knows (score, ideal, mood…) except its text, which is the fallback.
      extra: Object.fromEntries(Object.entries(builtIn).filter(([k]) => k !== 'text')) as Partial<AiAnswer>,
      // Slower local models get only the notes that matter: for a question, the best matches; for a
      // role-play, the ones about that situation (the rubric and the scene are in the live part).
      compact: {
        stable: stableSystem(cfg, audience, findLessons(practice ? scenarioOpening(sc!.id) : turns.at(-1)!.text, practice ? 2 : 3, audience)),
        live,
      },
      streamable: !practice,
      instant: opening && !req.finish,
      system: {
        stable: stableSystem(cfg, audience),
        live,
        reminder: practice
          ? req.finish
            ? `Step out of character, in ${language}: thank me, name two things I did well, then one encouraging thing to try next time, then a last line "STARS: n" (1-5, generous for a sincere effort).`
            : opening
              ? `Say the ${other}'s opening line in ${language}. Format exactly:\nCOACH: -\nGUEST: <line>`
              : `Reply in exactly this format, nothing else (text in ${language}, labels in English):\nCOACH: ✓ <specific praise> → <one gentle tip: Next time, try…>\nSCORE: <0-100>\nIDEAL: <a better reply I could have given>\nGUEST: <the ${other}’s next line, in character>`
          : `You are TableMate, my ${manager ? 'management coach' : 'trainer'}${req.simple ? '; use simple everyday words' : ''}. Answer my last message directly in 2-5 short sentences or bullets, no headings, no thinking out loud. Use ${language} unless I wrote in another language.`,
      },
      turns: apiTurns,
      // Models that support it (Gemini) answer a scored practice turn as fixed fields, so nothing gets lost.
      json: practice && !opening && !req.finish ? PRACTICE_JSON : undefined,
      parse: practice
        ? (raw: string, opts?: { local?: boolean }) => {
            // Smaller models often bold the labels (**COACH:**); read them either way.
            const answer = fromJson(raw).replace(/\*\*\s*(COACH|GUEST|STARS|SCORE|IDEAL)\s*:?\s*\*\*\s*:?/gi, '$1:')
            if (!opening && !req.finish && !/(COACH|SCORE):/i.test(answer)) console.warn('[practice] The model’s reply had no COACH/SCORE; using the rubric. Reply was:', raw.slice(0, 400))
            // A field the model left as the format's placeholder ("<what worked>", "0-100") counts as missing.
            const field = (label: string) => {
              const v = answer.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:COACH|SCORE|IDEAL|GUEST|STARS):|$)`, 'i'))?.[1]?.trim()
              if (!v || /<[^>]{2,60}>/.test(v) && v.replace(/<[^>]*>/g, '').trim().length < 12) return undefined
              return v.replace(/^<|>$/g, '').replace(/^["“](.*)["”]$/s, '$1').trim() || undefined
            }
            if (req.finish) {
              // Stars follow the scores the replies actually got, so the debrief and the XP agree.
              return { ...builtIn, text: cleanDebrief(answer) || builtIn.text, feedback: undefined }
            }
            if (opening) {
              const line = field('GUEST') ?? answer.split('\n').filter((l) => !/^\s*COACH:/i.test(l)).join('\n').trim()
              return { text: line.replace(/\[END\]/gi, '').trim() || builtIn.text, lang: undefined }
            }
            const coach = field('COACH')
            // Without labels, keep the other side's words and drop any stray coaching lines.
            let guest =
              field('GUEST') ??
              answer
                .split('\n')
                .filter((l) => !/^\s*(✓|→|COACH:|SCORE:|IDEAL:)/i.test(l))
                .join('\n')
                .trim()
            const ended = /\[END\]/i.test(guest)
            guest = guest.replace(/\[END\]/gi, '').trim()
            // A small model sometimes repeats the last thing it said; the scripted reaction is better than an echo.
            const said = turns.filter((t) => t.role === 'assistant').map((t) => t.text.trim())
            if (said.includes(guest)) guest = ''
            // The model's score, held back where the rubric caught blame, judgement or a safety guess.
            const own = rubric.at(-1)!
            const scoreText = field('SCORE')
            const modelScore = scoreText && !/\d\s*[-–]\s*\d/.test(scoreText) ? Number(scoreText.match(/\d{1,3}/)?.[0]) : NaN
            // A small local model is a shakier judge: blend its score with the rubric's.
            const judged = Number.isFinite(modelScore) ? (opts?.local ? Math.round((modelScore + own.score) / 2) : modelScore) : own.score
            // A model can be too kind: where the rubric finds nothing of value (off-topic, dismissive, rude, nonsense),
            // the model's score may rise only a little above the rubric's.
            const kind = own.score <= 20 ? Math.min(judged, own.score + 10) : judged
            const score = Math.max(0, Math.min(own.penalty ? 40 : 100, kind))
            // Encouragement always comes first: a coaching note that opens with criticism gets a word of credit in front.
            const warm = (raw: string) => {
              // Praise and tip on their own lines, so each gets its own mark in the app.
              const c = raw.replace(/\s*→\s*/g, '\n→ ').trim()
              return /^\s*✓/.test(c) ? c : `✓ ${practiceText(req.lang).debrief.effort}\n${c.startsWith('→') ? c : `→ ${c}`}`
            }
            const state = patienceAfter([...past, { score, penalty: own.penalty }])
            const done = ended || !!state.outcome
            const outcome = state.outcome ?? (done ? (state.patience >= 3 ? 'won' : state.patience <= 1 ? 'lost' : 'ok') : undefined)
            return {
              judgedBy: coach && Number.isFinite(modelScore) ? ('model' as const) : ('rubric' as const),
              // No usable line (e.g. only coaching came back): the scripted line stands in.
              text: guest || builtIn.text,
              feedback: coach && coach !== '-' ? warm(coach) : builtIn.feedback,
              score,
              stars: starsFor(score),
              criteria: undefined,
              ideal: field("IDEAL") || (builtIn as PracticeAnswer).ideal,
              mood: moodFor(score, own.penalty),
              patience: state.patience,
              outcome,
              done,
              lang: undefined,
            }
          }
        : (answer: string) => {
            // The model marks a dish question the menu notes didn't answer; the app offers "Ask the kitchen".
            const unsure = /\[ASK_KITCHEN\]/i.test(answer)
            const dish = dishesNamed(asked, cfg.menu)[0]
            const askKitchen = dish || unsure ? { menuItemId: dish?.id, question: asked, unsure } : undefined
            return { text: answer.replace(/\[ASK_KITCHEN\]/gi, '').trim(), suggestions: builtIn.suggestions, askKitchen }
          },
    }
  }

  /** Built-in expert: today's section, the menu, the standards and the training notes. */
  function askBuiltIn(question: string, req: AiRequest, now: number, audience: Audience = 'server'): { text: string; suggestions: string[]; feedback?: string; stars?: number; done?: boolean; askKitchen?: AiAnswer['askKitchen'] } {
    const cfg = hub.config
    const q = question.toLowerCase()
    const starters = audience === 'manager' ? MANAGER_STARTERS : STARTERS
    if (audience === 'manager' && /brief|line-?up|huddle|the floor right now/.test(q)) {
      const seated = Object.values(hub.state.tables).filter((t) => t.visitId)
      const facts = [...briefingFacts(seated, cfg, hub.state.unavailable, now).slice(1), ...floorFacts(hub, now)]
      const how = findLessons('pre-shift briefing', 1, 'manager')[0]
      return {
        text: [`Tonight so far: ${seated.length} of ${Object.keys(hub.state.tables).length} tables seated.`, ...facts.map((f) => `• ${f.replace(/^- /, '')}`), '', how.answer].join('\n'),
        suggestions: how.next,
      }
    }
    if (audience === 'manager') {
      const w = parseWhatIf(question, cfg)
      if (w) return { text: whatIfText(runWhatIf(cfg, w)), suggestions: ['What if we’re 30% busier?', 'What if we add a second grill cook?', 'Why is service slow tonight?'] }
      if (/\bwhy\b|what('?s| is) (going on|happening|wrong)|went wrong|bottleneck|slow|behind/.test(q)) {
        const intel = shiftIntel(hub.state, cfg)
        return { text: [...intel.why, '', ...intel.actions.map((x) => `• ${x}`)].join('\n').trim(), suggestions: ['What happens in the next 15 minutes?', 'What if we add a second grill cook?'] }
      }
      if (/\b(move|hand ?over|reassign|swap|share|language|speak|overload|help (out|each)|who (should|can) take)\b/.test(q)) {
        const ins = floorInsights(hub.state, cfg, now, hub.tasks(now))
        return {
          text: ins.length ? ins.map((i) => `• ${i.title}. ${i.why}`).join('\n') + '\n\nEach one has a button under “Share the floor”.' : 'Load looks fair and every seated table has a server who speaks their language. Nothing to move right now.',
          suggestions: ['What happens in the next 15 minutes?', 'Why is service slow tonight?'],
        }
      }
      if (/forecast|next (15|fifteen|half|few)|predict|coming up|about to|going to/.test(q)) {
        const f = forecast(hub.state, cfg, now, hub.tasks(now))
        const lines = f.headlines.length ? f.headlines : ['Nothing looks likely to fall behind in the next 15 minutes.', ...f.stations.slice(0, 2).map((x) => x.text)]
        return { text: lines.map((x) => `• ${x}`).join('\n'), suggestions: ['Why is service slow tonight?', 'What if we’re 30% busier?'] }
      }
    }
    if (audience === 'server' && /brief|my section|my tables|section|tables right now/.test(q)) {
      const facts = briefingFacts(Object.values(hub.state.tables).filter((t) => t.serverId === req.staffId), cfg, hub.state.unavailable, now)
      return { text: facts.map((f) => `• ${f.replace(/^- /, '')}`).join('\n'), suggestions: ['How do I warn guests about a delay?', 'Explain Jain food'] }
    }
    const dish = dishesNamed(question, cfg.menu)[0]
    if (dish) {
      // Answered from what the restaurant recorded (spice, contents, description, the kitchen's earlier
      // answers); when that doesn't cover it, the answer says so and offers to ask the kitchen.
      const a = answerAboutDish(question, dish)
      return { text: a.general ? dishFacts(dish) : a.text, suggestions: ['How do I describe a dish well?', 'How do I handle allergies?'], askKitchen: { menuItemId: dish.id, question, unsure: !a.known } }
    }
    // Diet or allergy lists come from the ingredient tags, never a guess.
    const forNeed = menuForNeed(question, cfg.menu)
    if (forNeed) return { text: forNeed, suggestions: ['How do I handle allergies?', 'Explain Jain food'] }
    if (/onion or garlic|contain/.test(q)) {
      const list = cfg.menu.filter((m) => m.contains?.includes('root'))
      return { text: list.length ? `Contain onion, garlic or root vegetables: ${list.map((m) => m.name).join(', ')}. Always confirm with the kitchen.` : 'None on tonight’s menu by the ingredient list.', suggestions: ['Explain Jain food', 'How do I handle allergies?'] }
    }
    const lessons = findLessons(question, 2, audience)
    if (lessons.length) return { text: lessons.map((l, i) => (i === 0 ? l.answer : `Also: ${l.answer}`)).join('\n\n'), suggestions: lessons[0].next }
    const sop = sopFallback(question, cfg)
    if (!sop.startsWith('I can only')) return { text: sop, suggestions: starters.slice(1, 3) }
    return {
      text:
        audience === 'manager'
          ? 'That one needs the AI coach, which isn’t connected right now, so I can only answer from the built-in notes: briefings, escalations and comps, feedback and recognition, rushes, staff support, conflict, emergencies, inclusion and harassment reports. Try one of these, or connect Ollama or Claude in Demo & setup → Setup.'
          : 'That one needs the AI trainer, which isn’t connected right now, so I can only answer from the built-in notes: service standards, tonight’s menu and what’s in each dish, allergies and diets, complaints, access and inclusion, and your section. Try one of these, or ask your manager to connect AI in Demo & setup → Setup.',
      suggestions: starters,
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
    get provider(): AiProvider {
      return candidates()[0]?.name ?? (dify ? 'dify' : 'built-in')
    },
    get modelLabel(): string | undefined {
      return candidates()[0]?.label?.()
    },
    /** Which models are ready, in the order they are asked, for the Setup page and health check. */
    get lineup() {
      return ranker.snapshot(models.map(idOf)).map((r) => ({ ...r, ready: models.find((m) => idOf(m) === r.name)?.available?.() ?? true }))
    },
    /** `onText` receives the answer so far while a model writes it (plain-text answers only). */
    async ask(req: AiRequest, onText?: (text: string) => void): Promise<AiAnswer> {
      const built = build(req)
      const language = AI_LANGUAGES[req.lang ?? 'en'] ?? 'English'
      const prompt = `${built.prompt}\n\nStyle: ${INCLUSIVE_STYLE}\nReply in ${language}.`
      const fallback = built.fallback
      if (built.instant) return { text: fallback, source: 'built-in', ...built.extra }
      let notice: string | undefined
      const profile = profileFor(req)
      const line = candidates(profile.tier)
      let partial: { model: ChatModel; answer: string } | undefined
      const done = (model: ChatModel, answer: string) => {
        const out = { ...built.extra, ...(built.parse ? built.parse(answer, { local: model.compact }) : { text: answer }), source: model.name }
        if (model.checkFacts && built.facts?.length) out.text = `${out.text}\n\nFrom the menu: ${built.facts.join('\n')}`
        return out
      }
      for (const [n, model] of line.entries()) {
        // Quick buttons ("What do I say?", briefings, summaries…) carry their facts in the prompt, so they
        // get a short system prompt, a length cap, streaming, and a deadline for the first words.
        // With another model waiting, a slow one gets less time before the next takes over.
        const quick = !built.system
        const ctrl = new AbortController()
        let started = false
        const deadline = quick ? setTimeout(() => !started && ctrl.abort(), n < line.length - 1 ? QUICK_FIRST_WORDS_MS / 2 : QUICK_FIRST_WORDS_MS) : undefined
        const t0 = Date.now()
        try {
          const full = built.system ?? { stable: quickSystem(hub.config), live: `Reply in ${language}.` }
          const system = (model.compact || model.lean) && built.compact ? { ...built.compact, reminder: full.reminder } : full
          const stream = quick || built.streamable ? (t: string) => ((started = true), onText?.(t)) : undefined
          const answer = await model.reply(system, built.turns ?? [{ role: 'user', text: built.prompt }], stream, { maxTokens: quick ? (QUICK_TOKENS[req.kind] ?? 240) : undefined, signal: ctrl.signal, temperature: profile.temperature, json: built.json })
          const bad = unusable(answer)
          if (bad) throw new Error(bad)
          // A scored practice turn with no score: another model may judge it properly, so ask the next one
          // and keep this answer (the rubric will score it) in case none does.
          if (built.json && !/SCORE:\s*\d/i.test(fromJson(answer)) && n < line.length - 1) {
            partial ??= { model, answer }
            console.warn(`[ai] ${model.name} sent no score for the practice reply; asking the next model`)
            continue
          }
          ranker.ok(idOf(model), Date.now() - t0)
          return done(model, answer)
        } catch (e) {
          ranker.fail(idOf(model))
          console.warn(`[ai] ${model.name} couldn't answer (${e instanceof Error ? e.message : e}); ${n < line.length - 1 ? 'asking the next model' : 'no model left'}`.slice(0, 220))
          notice = ctrl.signal.aborted ? 'The AI took too long, so this is the built-in answer.' : `${opts.chatErrorReason?.(e, model) ?? (e instanceof Error ? e.message : String(e))}. Showing the built-in answer.`
        } finally {
          clearTimeout(deadline)
        }
      }
      if (partial) return done(partial.model, partial.answer)
      if (!dify) return { text: fallback, source: 'built-in', notice, ...built.extra }
      try {
        const answer = await callDify(prompt, req)
        return { ...built.extra, ...(built.parse ? built.parse(answer) : { text: answer }), source: 'dify' }
      } catch (e) {
        const reason = e instanceof Error ? (e.name === 'AbortError' ? 'Dify took too long to answer' : e.message) : String(e)
        return { text: fallback, source: 'built-in', notice: `${reason}. Showing the built-in answer.`, ...built.extra }
      }
    },
  }
}

export class AiError extends Error {}

/** Why an answer can't be shown, or null when it is fine: empty, a repeat of the instructions, or an echo of the prompt. */
export function unusable(answer: string): string | null {
  const t = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  if (t.length < 2) return 'The AI returned an empty answer'
  if (/Service standards:|Training notes \(the house|Practice rubric \(for role-plays\)|You are TableMate, the assistant inside/i.test(t)) return 'The AI repeated its instructions'
  return null
}

/** The fields of a scored practice turn, as a response schema (Gemini's format). */
const PRACTICE_JSON = {
  type: 'OBJECT',
  properties: {
    coach: { type: 'STRING', description: '"✓ specific praise for something they did → one gentle tip: Next time, try…", in the app language. Always start with praise; never harsh.' },
    score: { type: 'INTEGER', description: '0-100, judged kindly and fairly on what the reply means (a sincere, partly right reply is 55-85)' },
    ideal: { type: 'STRING', description: 'What an excellent reply would have said instead, 1-2 sentences' },
    guest: { type: 'STRING', description: 'The other person’s next line, in character, 1-2 sentences' },
    ended: { type: 'BOOLEAN', description: 'True when the conversation is over (won over, or they give up)' },
  },
  required: ['coach', 'score', 'ideal', 'guest'],
  propertyOrdering: ['coach', 'score', 'ideal', 'guest', 'ended'],
}

/** A reply given as JSON fields becomes the labelled text the parser reads; anything else is unchanged. */
/** A debrief as plain readable text: no end marker, stars line, stray rules or markdown emphasis. */
export function cleanDebrief(raw: string): string {
  return raw
    .replace(/\[END\]/gi, '')
    .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/gm, '')
    .replace(/\*{3,}/g, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*\*\s+/gm, '• ')
    // The stars line is read by the app, not shown (after the markdown is gone, so "**STARS: 3**" is caught too).
    .replace(/^\s*STARS:\s*[1-5]\s*(?:\/\s*[35])?\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function fromJson(raw: string): string {
  const m = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '').match(/\{[\s\S]*\}/)
  if (!m) return raw
  try {
    const j = JSON.parse(m[0]) as { coach?: string; score?: number; ideal?: string; guest?: string; ended?: boolean }
    if (j.guest === undefined && j.coach === undefined) return raw
    return [`COACH: ${j.coach ?? '-'}`, j.score !== undefined ? `SCORE: ${j.score}` : '', j.ideal ? `IDEAL: ${j.ideal}` : '', `GUEST: ${j.guest ?? ''}${j.ended ? ' [END]' : ''}`].filter(Boolean).join('\n')
  } catch {
    return raw
  }
}

/** No words from the model by then: show the built-in answer instead of keeping someone waiting. */
const QUICK_FIRST_WORDS_MS = 12_000
/** Rough answer lengths for the quick buttons (tokens): a line to say is short, a summary longer. */
const QUICK_TOKENS: Partial<Record<AiKind, number>> = { guest_script: 140, coach: 180, briefing: 240, complaint: 240, ask_sop: 180, incident: 280, shift_summary: 320, kitchen_triage: 200, menu_suggest: 320 }

/** The whole system prompt for a quick button: the facts are in the request itself. */
export function quickSystem(cfg: RestaurantConfig): string {
  return `You are TableMate, the assistant inside the floor team's app at ${cfg.name}, a fine-dining restaurant in India. Write only what is asked, using only the facts given: short, warm and natural, no headings, no preamble. Never blame the kitchen or colleagues and never guess about allergens. ${INCLUSIVE_STYLE}`
}

interface Built {
  prompt: string
  fallback: string
  /** Fields returned alongside the text (practice feedback, stars, done). */
  extra?: Partial<AiAnswer>
  /** Splits a structured model answer into fields. */
  parse?: (answer: string, opts?: { local?: boolean }) => Partial<AiAnswer> & { text: string }
  /** Menu lines for dishes the question names, for models that need a fact check. */
  facts?: string[]
  /** The same instructions with only the training notes that matter here, for slower local models. */
  compact?: { stable: string; live: string }
  /** The answer is plain text that can be shown while it's written. */
  streamable?: boolean
  /** Answer with the built-in text straight away (e.g. a role-play's opening line, already in every language). */
  instant?: boolean
  /** A response schema for models that can answer in fixed fields (Gemini); others use the labels. */
  json?: Record<string, unknown>
  /** Chat kinds: the system prompt (cacheable part + live part) and the turns for a chat model. */
  system?: { stable: string; live: string; reminder?: string }
  turns?: ChatTurn[]
}

/**
 * The assistant's standing brief: who it is, how it answers, the restaurant's standards, the
 * menu with what each dish contains, and the training notes. Identical on every request for a
 * given config, so it caches.
 */
/**
 * The long, stable part of the assistant's instructions. `lessons` narrows the training notes to the
 * ones that matter for this question (for slower local models); by default all of them are included.
 */
/** What the app itself does and its rules, so any model can explain TableMate correctly and stay within it. */
const PRODUCT_FACTS = (manager: boolean) => [
  'About TableMate (the app you live in; answer questions about it from this):',
  '- Orders, seatings and table changes arrive from the POS. TableMate turns them into each server’s top 3 task cards, in the order guests need them, each with the reason why. Cards are suggestions, never orders: a server can always use their own judgement.',
  '- Safety first: when an order contains something a guest is allergic to or avoids, the card is flagged the moment the order is fired and the kitchen is told. The kitchen confirms; TableMate never decides an allergen is safe.',
  '- Fair delays: every step of a visit (greeted, order in, mains ready, bill) is credited to whoever controlled it, the floor or the kitchen. A kitchen delay is never a server’s, and each finished table leaves a receipt showing where the time went.',
  '- The kitchen screen shows what to cook and what is late; dish questions from servers go to the chef through the kitchen relay and the answer comes back to the server.',
  manager
    ? '- Managers see the floor, tables, sections, load, language needs and delays, never a ranking of people. They can hand a table to a colleague who speaks the guests’ language, run a what-if (for example an extra grill cook), and read the shift summary. Never produce a leaderboard or compare individuals.'
    : '- A server’s personal stats (XP, level, streak, badges) are private to their own screen; managers never see a ranking and there is no leaderboard. The team goal is shared.',
  '- Practice room: private role-plays of hard moments, each reply rated out of 5 stars (scored kindly: a sincere effort earns credit) with a short note that starts with praise and an ideal reply; the other side’s patience rises or falls with the replies; XP is earned with a daily cap. It is for learning, not assessment.',
  '- Everyone: six languages (English, Hindi, Nepali, Bengali, Tamil, Spanish), read aloud, large text, colour-safe palettes, flash alerts that need no sound, reduced motion, and a simple-words mode.',
]

export function stableSystem(cfg: RestaurantConfig, audience: Audience = 'server', lessons: Lesson[] = lessonsFor(audience)): string {
  const manager = audience === 'manager'
  return [
    manager
      ? `You are TableMate, the assistant inside the floor team's app at ${cfg.name}, a fine-dining restaurant in India, talking to a floor manager. You are an experienced restaurant operations coach and a supportive peer: running service, guest recovery and escalations, comps, pre-shift briefings and debriefs, coaching and feedback, fair and inclusive team leadership, wellbeing and safety, and Indian workplace norms (including the POSH Act).`
      : `You are TableMate, the assistant inside the floor team's app at ${cfg.name}, a fine-dining restaurant in India. You are an expert service trainer and a friendly colleague: hospitality standards, guest recovery, allergens and dietary practice (vegan, Jain, halal, religious fasting), accessibility etiquette, inclusive service, recommending with care, teamwork and staying calm in a rush.`,
    '',
    'How to answer:',
    manager
      ? '- You are talking to a busy manager during or around service. Lead with the decision or the next step. Short and practical: 1-5 short sentences, or a few bullets; add a ready-to-say line when it helps.'
      : '- You are talking to a busy server between tables. Lead with the answer. Short, practical and warm: 1-4 short sentences, or a few bullets.',
    '- Use the restaurant’s standards and menu below. If something isn’t covered, say so and suggest asking ' + (manager ? 'the owner, the chef or HR.' : 'the manager or the chef.'),
    '- Safety first: never say a dish is safe for an allergy or diet from memory. Use the ingredient tags below and always tell them to confirm with the kitchen. In a medical emergency, say to call 112 first.',
    manager
      ? '- Fairness: never rank, compare or name-and-shame staff. Talk about steps, stations and load. Kitchen delays are the kitchen’s, not a server’s. Coach in private, praise in public.'
      : '- Never blame the kitchen or colleagues. Kitchen delays are the kitchen’s, not the server’s. Personal stats are private; never compare people.',
    '- Inclusion: every guest and every colleague gets the same respect whatever their caste, religion, region, language, accent, gender, sexuality, age, body, disability or background. Don’t assume; ask kindly. Describe needs as what to do, never as labels for people. Never repeat or endorse stereotypes, even if asked.',
    `- ${INCLUSIVE_STYLE}`,
    '- Multilingual: reply in the language the person writes in (English, Hindi, Nepali, Bengali, Tamil, Spanish and others), in a natural, spoken register. Keep dish names as written on the menu.',
    '- If they ask for simple words, use short sentences and everyday words, one idea per sentence, and explain any restaurant term.',
    '',
    ...PRODUCT_FACTS(manager),
    '',
    'Service standards:',
    ...sopFacts(cfg),
    '',
    'Menu (everything the restaurant recorded about each dish):',
    ...cfg.menu.map(dishLine),
    'Questions about a dish (spice, ingredients, how it’s made, changes): answer only from these notes. If they don’t answer it, say you’re not sure, never guess, say you can ask the kitchen, and end your reply with [ASK_KITCHEN].',
    'Diet rules: vegetarian avoids meat, fish, shellfish. Vegan also avoids dairy, egg, honey. Jain avoids meat, fish, shellfish, egg and root vegetables (onion, garlic, potato). Halal avoids pork, alcohol and non-halal meat. Some guests avoid beef or pork only; religious fasts differ, so ask.',
    '',
    manager
      ? 'Practice rubric (for role-plays): a great manager listens first, takes ownership, keeps feedback private and specific (situation, behaviour, impact), looks after the person (staff safety and wellbeing come before a guest’s spend), agrees a follow-up, never shames or blames, and in an emergency acts first (call 112).'
      : 'Practice rubric (for role-plays): a great reply apologises sincerely, shows understanding, gives a clear next step and a time, never blames the kitchen, never guesses about allergens (checks with the chef), speaks to the guest directly, and asks rather than assumes.',
    '',
    manager ? 'Training notes (the house way of managing):' : 'Training notes (the house way of doing things):',
    ...lessons.map((l) => `- ${l.title}: ${l.answer}`),
  ].join('\n')
}

function dishFacts(m: RestaurantConfig['menu'][number]): string {
  const c = m.contains ?? []
  const clashes = [
    c.some((x) => ['meat', 'fish', 'shellfish'].includes(x)) ? 'vegetarian' : '',
    c.some((x) => ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey'].includes(x)) ? 'vegan' : '',
    c.some((x) => ['meat', 'fish', 'shellfish', 'egg', 'root'].includes(x)) ? 'Jain' : '',
    c.some((x) => ['pork', 'alcohol', 'nonhalal'].includes(x)) ? 'halal' : '',
  ].filter(Boolean)
  const word: Record<string, string> = { root: 'onion, garlic or root veg', nonhalal: 'non-halal meat' }
  const extra = [m.description, m.spice !== undefined ? `Spice: ${SPICE_WORDS[m.spice]}.` : '', m.adjust ? `Can be changed: ${m.adjust}` : ''].filter(Boolean).join(' ')
  return `${m.name}: ${m.course === 'main' ? 'a main' : `a ${m.course}`} from the ${m.station} station, about ${m.prepMin} minutes. Contains: ${c.map((x) => word[x] ?? x).join(', ') || 'not listed'}.${clashes.length ? ` Not suitable as-is for ${clashes.join(', ')} guests.` : ''}${extra ? ` ${extra}` : ''} Always confirm allergies with the kitchen.`
}

/** Minutes until the table's late dishes are most likely ready, using tonight's station load. */
function etaMinutes(hub: Hub, t: TableState, now: number): number | undefined {
  const fired = t.lines.filter((l) => l.status === 'fired')
  if (!fired.length) return undefined
  const eta = Math.max(...fired.map((l) => predictReady(hub.state, hub.config, l, now)))
  return Math.max(1, Math.round((eta - now) / MIN))
}

// ---------------------------------------------------------------------------
// Private coach: built only from the server's own visits.

const FLOOR_STAGES: Segment['stage'][] = ['greet', 'pickup', 'bill', 'reset']
const STAGE_WORDS: Record<string, { name: string; tip: string }> = {
  greet: { name: 'greetings', tip: 'As soon as a table is seated, drop water and menus first, then come back for the chat.' },
  pickup: { name: 'pass-to-table times', tip: 'When a card says food is coming up soon, stay near the pass for that minute.' },
  bill: { name: 'bill presentation', tip: 'Once desserts are cleared, print the bill in advance so it’s ready the moment they ask.' },
  reset: { name: 'table resets', tip: 'Reset in one pass with the checklist: clear, linen, cutlery, condiments, candle.' },
}

function stageStats(visits: VisitRecord[]) {
  return FLOOR_STAGES.map((stage) => {
    const segs = visits.flatMap((v) => v.segments).filter((x) => x.stage === stage && x.owner === 'floor')
    const avg = segs.length ? segs.reduce((a, x) => a + (x.end - x.start) / MIN, 0) / segs.length : 0
    const target = segs.length ? segs.reduce((a, x) => a + x.targetMin, 0) / segs.length : 0
    return { stage, n: segs.length, lapses: segs.filter((x) => x.lapse).length, avg, target }
  }).filter((x) => x.n > 0)
}

/** A table still being served, shaped like a finished visit so the coach can learn from it. */
function liveVisit(t: TableState, cfg: RestaurantConfig): VisitRecord {
  const segments = segmentsFor(t, cfg)
  return {
    visitId: t.visitId!,
    tableId: t.id,
    tableName: t.name,
    serverId: t.serverId,
    partySize: t.party?.size ?? 0,
    seatedAt: t.seatedAt ?? 0,
    endedAt: 0,
    segments,
    smooth: false,
    mood: t.mood?.value,
    recovered: t.mood?.value === 'unhappy' ? !!t.recoveredAt : undefined,
  }
}

const mmss = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`

function coachFacts(visits: VisitRecord[], cfg: RestaurantConfig): string[] {
  void cfg
  const moods = visits.filter((v) => v.mood)
  return [
    `- Tables finished tonight: ${visits.filter((v) => v.endedAt > 0).length}; fully to standard: ${visits.filter((v) => v.smooth).length}`,
    ...stageStats(visits).map((s) => `- ${STAGE_WORDS[s.stage].name}: average ${mmss(s.avg)} vs standard ${mmss(s.target)}, ${s.lapses} of ${s.n} past standard`),
    moods.length ? `- Guest mood at check-ins: ${moods.filter((v) => v.mood === 'happy').length} happy of ${moods.length}; unhappy tables won back: ${visits.filter((v) => v.recovered).length}` : '',
  ].filter(Boolean)
}

function coachFallback(visits: VisitRecord[], cfg: RestaurantConfig): string {
  void cfg
  if (!stageStats(visits).length) return 'Finish a table or two and I’ll have a tip for you. Kitchen delays never count against you here.'
  const stats = stageStats(visits)
  const finished = visits.filter((v) => v.endedAt > 0)
  const best = [...stats].filter((s) => s.avg <= s.target).sort((a, b) => a.lapses / a.n - b.lapses / b.n || a.avg / a.target - b.avg / b.target)[0]
  const focus = [...stats].filter((s) => s.lapses > 0).sort((a, b) => b.lapses / b.n - a.lapses / a.n)[0]
  const lines = [
    best ? `What went well: your ${STAGE_WORDS[best.stage].name} averaged ${mmss(best.avg)} against a ${mmss(best.target)} standard.` : '',
    focus && focus !== best
      ? `One thing to try: ${STAGE_WORDS[focus.stage].name} ran past standard on ${focus.lapses} of ${focus.n} tables. ${STAGE_WORDS[focus.stage].tip}`
      : 'One thing to try: keep doing exactly this, and use the “Coming up” list to get one step ahead.',
    finished.length ? `${finished.filter((v) => v.smooth).length} of ${finished.length} finished tables went fully to standard. Kitchen delays aren’t counted against you.` : 'Kitchen delays aren’t counted against you.',
  ]
  return lines.filter(Boolean).join('\n')
}

// ---------------------------------------------------------------------------
// Prompts and built-in answers

function guestName(t?: TableState) {
  return t?.party?.guestName ?? ''
}

function guestScriptPrompt(task: Task, t: TableState | undefined, cfg: RestaurantConfig, now: number, etaMin?: number) {
  const facts = [
    `Table ${task.tableName}, party of ${t?.party?.size ?? '?'}${guestName(t) ? `, guest ${guestName(t)}` : ''}${t?.party?.occasion ? `, celebrating a ${t.party.occasion}` : ''}${t?.party?.vip ? ', a regular' : ''}`,
    ...(t?.party?.needs?.length ? [`Guest needs: ${t.party.needs.join(', ')} (accommodate naturally, never draw attention to them)`] : []),
    `Situation: ${task.title}`,
    `Detail: ${task.hint}`,
  ]
  if (task.kind === 'kitchen_delay') {
    const late = t?.lines.filter((l) => l.status === 'fired') ?? []
    if (late.length) facts.push(`Dishes: ${late.map((l) => l.name).join(', ')}; about ${Math.max(1, Math.round((now - Math.min(...late.map((l) => l.expectedReadyAt))) / MIN))} min past the usual time`)
    if (etaMin) facts.push(`Kitchen forecast: ready in about ${etaMin} minutes`)
  }
  if (task.kind === 'recovery') facts.push('The table seemed unhappy at the last check-in. Ask what went wrong, apologise sincerely and offer to put it right.')
  return (
    `You help a fine-dining server speak to guests. Write exactly what the server can say at the table, ` +
    `in 1-2 natural, gracious sentences. Be honest about the wait or the change, offer a small gesture or ` +
    `alternative, and never blame the kitchen or colleagues. Restaurant: ${cfg.name}.\n\nFacts:\n${facts.map((f) => `- ${f}`).join('\n')}`
  )
}

function guestScriptFallback(task: Task, t: TableState | undefined, cfg: RestaurantConfig, etaMin?: number): string {
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
    const when = etaMin ? `in about ${etaMin} minute${etaMin === 1 ? '' : 's'}` : 'in a few more minutes'
    return `${who}I just checked with the kitchen: ${dish} will be with you ${when}.${occasion} Can I bring you some bread or top up your drinks while you wait?`
  }
  if (task.kind === 'recovery')
    return `${who}I’m sorry tonight hasn’t been quite right. Could you tell me what we can do better? I’d like to fix it for you straight away.`
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
    for (const n of t.party?.needs ?? []) bits.push(NEED_BRIEF[n] ?? n)
    const late = t.lines.filter((l) => l.status === 'fired' && now > l.expectedReadyAt)
    if (late.length) bits.push(`kitchen running late on ${late.map((l) => l.name).join(', ')}`)
    out.push(`- ${bits.join(', ')}`)
  }
  const off = Object.keys(unavailable).map((id) => cfg.menu.find((m) => m.id === id)?.name ?? id)
  if (off.length) out.push(`- Off the menu tonight: ${off.join(', ')}`)
  return out
}

/** What a manager needs to know right now: load by section (never performance) and what needs them. */
/**
 * Worked examples for the judge, so scores mean the same thing on every model: what this situation
 * needs, a reply worth 90+ (the scenario's own ideal), and what middling and poor replies score.
 */
export function calibration(scenarioId: string): string {
  const sc = scenarioById(scenarioId)
  const en = practiceText('en')
  const tx = en.scenarios[scenarioId]
  if (!sc || !tx) return ''
  return [
    `- What this situation needs (each one missing costs points): ${sc.musts.map((c) => en.checks[c.id].tip).join(' ')}`,
    `- Calibration (be generous; staff are learning): "${tx.ideal[0]}" scores about 95. A sincere reply that does most of the above but stays vague on one point scores 70-85. A caring reply that gets only part of it right scores 55-70. "Sorry about that" alone scores about 40. An excuse, blame, a joke, a safety guess or a made-up reason scores 0-25, however polite.`,
  ].join('\n')
}

function floorFacts(hub: Hub, now: number): string[] {
  const cfg = hub.config
  const a = analytics(hub.state, cfg)
  const out: string[] = []
  for (const [section, staffId] of Object.entries(cfg.sections)) {
    const l = a.load.find((x) => x.staffId === staffId)
    out.push(`- Section ${section}: ${l?.activeTables ?? 0} active tables${l?.overloaded ? ` (over the limit of ${cfg.sop.maxActiveTablesPerServer})` : ''}`)
  }
  for (const r of a.managerRequests) out.push(`- NEEDS YOU: a server asked you to visit ${r.tableName}`)
  for (const h of forecast(hub.state, cfg, now, hub.tasks(now)).headlines) out.push(`- Next 15 min: ${h}`)
  for (const i of floorInsights(hub.state, cfg, now, hub.tasks(now))) out.push(`- Suggested (on the manager's screen with a button): ${i.title}. ${i.why}`)
  for (const t of Object.values(hub.state.tables)) if (t.handover) out.push(`- ${t.name} was handed from ${cfg.staff.find((s) => s.id === t.handover!.from)?.name ?? '?'} to ${cfg.staff.find((s) => s.id === t.serverId)?.name ?? '?'} for this visit`)
  for (const w of shiftIntel(hub.state, cfg).why.slice(0, 2)) out.push(`- Tonight so far: ${w}`)
  for (const t of Object.values(hub.state.tables)) {
    if (!t.visitId) continue
    const clash = t.lines.filter((l) => !l.safetyResolvedAt && l.status !== 'served' && l.status !== 'unavailable' && safetyIssues(cfg.menu.find((m) => m.id === l.menuItemId), t.party).length)
    if (clash.length) out.push(`- NEEDS YOU: ${t.name} allergy or diet clash on ${clash.map((l) => l.name).join(', ')}`)
    if (t.mood?.value === 'unhappy' && !t.recoveredAt) out.push(`- ${t.name}: guests not happy, the server is putting it right`)
    if (t.billRequestedAt && !t.billPresentedAt && now > t.billRequestedAt + cfg.sop.billPresentWithinMin * MIN) out.push(`- ${t.name}: waiting for the bill`)
  }
  return out
}

/** How a guest need reads in a briefing: what to do, not a label for the person. */
const NEED_BRIEF: Record<string, string> = {
  wheelchair: 'uses a wheelchair: keep a step-free route and space at the table',
  hearing: 'hard of hearing: face them, speak clearly, offer to write',
  vision: 'low vision: read out the specials, offer the large-print menu',
  highchair: 'needs a high chair',
  jain: 'Jain: no root vegetables, onion or garlic',
  halal: 'halal',
  vegan: 'vegan',
  quiet: 'prefers a quiet table: away from speakers and the kitchen door, calm check-ins',
  service_animal: 'has an assistance animal: room for it to lie down, a water bowl, don’t pet or feed it',
  no_beef: 'no beef',
  no_pork: 'no pork',
  fasting: 'fasting: ask what they can eat tonight',
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

const STOP = new Set('the and are was were what when where which who whom why how can could should would will does did has have had for from with into about this that these those then than there their they them you your yours our out not but all any some its it’s just also very more most much many one two get got make made after before over under min mins minute minutes'.split(' '))

function sopFallback(q: string, cfg: RestaurantConfig): string {
  // Whole words only, minus filler, so an unrelated question doesn't "match" a standard via "the" or "what".
  const words = [...new Set(q.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w)))].map((w) => w.replace(/s$/, ''))
  const ranked = sopFacts(cfg)
    .map((f) => {
      const have = new Set(f.toLowerCase().split(/\W+/).map((w) => w.replace(/s$/, '')))
      return { f, hits: words.filter((w) => have.has(w)).length }
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  if (!ranked.length) return 'I can only answer from the service standards set up here. Connect Dify with your SOP manual for full answers.'
  return ranked.slice(0, 2).map((x) => x.f.replace(/^- /, '')).join('. ') + '.'
}

/** Built-in role-play: scripted guest lines and rubric coaching, with a debrief on finish. */
/** Coaching lines for a scored reply: encouragement first (✓), then one gentle thing to try (→). */
function coachLines(sc: Score, lang?: string): string {
  return coachFor(sc, lang)
}

type PracticeAnswer = Partial<AiAnswer> & { text: string }

/** Built-in role-play in the app's language: a realistic next line, a score, an ideal reply, or the debrief. */
function practiceBuiltIn(scenarioId: string, replies: ChatTurn[], lang: string | undefined, finish: boolean): PracticeAnswer {
  if (finish) {
    if (!replies.length) return { text: practiceDebrief(scenarioId, [], lang).text.split('\n')[0], done: false }
    const d = practiceDebrief(
      scenarioId,
      replies.map((r) => r.text),
      lang,
      replies.map((r) => r.score ?? NaN).map((x) => (Number.isFinite(x) ? x : undefined)) as number[],
    )
    return { text: d.text, score: d.score, stars: d.stars, outcome: d.outcome, done: true }
  }
  const step = practiceStep(
    scenarioId,
    replies.map((r) => r.text),
    lang,
  )
  return {
    text: step.text,
    feedback: step.scored ? coachLines(step.scored, lang) : undefined,
    score: step.scored?.score,
    stars: step.scored?.stars,
    criteria: step.scored?.criteria,
    ideal: step.ideal,
    mood: step.mood,
    patience: step.patience,
    outcome: step.outcome,
    done: step.done,
  }
}

// ---------------------------------------------------------------------------
// Complaint help: what is really going on at the table, and what to say.

function complaintFacts(hub: Hub, t: TableState, now: number): string[] {
  const cfg = hub.config
  const out: string[] = []
  const seated = t.seatedAt ? Math.round((now - t.seatedAt) / MIN) : null
  out.push(`- ${t.name}: party of ${t.party?.size ?? '?'}${t.party?.guestName ? ` (${t.party.guestName})` : ''}${seated !== null ? `, seated ${seated} min ago` : ''}${t.party?.vip ? ', regulars' : ''}${t.party?.occasion ? `, celebrating a ${t.party.occasion}` : ''}`)
  if (t.party?.allergies.length) out.push(`- Allergies: ${t.party.allergies.join(', ')} (never guess; confirm with the kitchen)`)
  for (const n of t.party?.needs ?? []) out.push(`- Guest need: ${NEED_BRIEF[n] ?? n}`)
  const byCourse = new Map<string, typeof t.lines>()
  for (const l of t.lines) byCourse.set(l.course, [...(byCourse.get(l.course) ?? []), l])
  for (const [course, lines] of byCourse) {
    const fired = lines.filter((l) => l.status === 'fired')
    const ready = lines.filter((l) => l.status === 'ready')
    const off = lines.filter((l) => l.status === 'unavailable')
    if (fired.length) {
      const eta = Math.max(...fired.map((l) => predictReady(hub.state, cfg, l, now)))
      const late = Math.max(...fired.map((l) => now - l.expectedReadyAt))
      out.push(`- ${course}s cooking (${fired.map((l) => l.name).join(', ')}): ordered ${Math.round((now - Math.min(...fired.map((l) => l.firedAt))) / MIN)} min ago, ${late > 0 ? `${Math.round(late / MIN)} min past the usual time, ` : ''}likely ready in about ${Math.max(1, Math.round((eta - now) / MIN))} min${fired.some((l) => l.delayInformedAt) ? '; guests were already told about the delay' : ''}`)
    }
    if (ready.length) out.push(`- ${course}s READY at the pass now (${ready.map((l) => l.name).join(', ')}), waiting ${Math.round((now - Math.min(...ready.map((l) => l.readyAt ?? now))) / MIN)} min`)
    const served = lines.filter((l) => l.servedAt)
    if (served.length) out.push(`- ${course}s served ${Math.round((now - Math.max(...served.map((l) => l.servedAt!))) / MIN)} min ago (${served.map((l) => l.name).join(', ')})`)
    if (off.length) out.push(`- Ran out: ${off.map((l) => l.name).join(', ')}${off.some((l) => l.unavailableInformedAt) ? ' (guests were told)' : ' (guests not told yet)'}`)
  }
  if (!t.lines.length) out.push(`- No order yet${t.greetedAt ? `; greeted ${Math.round((now - t.greetedAt) / MIN)} min ago` : '; not greeted yet'}`)
  if (t.mood) out.push(`- At the last check-in (${Math.round((now - t.mood.at) / MIN)} min ago) they were ${t.mood.value}${t.recoveredAt ? ', and were won back' : ''}`)
  if (t.lastAttentionAt) out.push(`- Last time someone was at the table: ${Math.round((now - t.lastAttentionAt) / MIN)} min ago`)
  if (t.billRequestedAt && !t.billPresentedAt) out.push(`- Asked for the bill ${Math.round((now - t.billRequestedAt) / MIN)} min ago and still waiting`)
  out.push(t.managerRequestedAt ? `- The manager was asked to visit ${Math.round((now - t.managerRequestedAt) / MIN)} min ago${t.managerVisitedAt && t.managerVisitedAt >= t.managerRequestedAt ? ' and has been' : ''}` : '- The manager is on the floor and can be asked to visit')
  return out
}

/** The built-in answer: the likely cause from the table's own facts, a line to say, and the steps. */
function complaintFallback(hub: Hub, t: TableState, now: number): string {
  const cfg = hub.config
  const who = t.party?.guestName ? `${t.party.guestName}, ` : ''
  const fired = t.lines.filter((l) => l.status === 'fired')
  const ready = t.lines.filter((l) => l.status === 'ready')
  const off = t.lines.filter((l) => l.status === 'unavailable' && !l.unavailableInformedAt)
  const steps: string[] = []
  let say: string
  if (ready.length) {
    say = `${who}I’m so sorry for the wait. Your ${ready[0].course} is ready right now; I’m bringing it straight over.`
    steps.push('Take the food from the pass now.', 'Check back two minutes after it lands.')
  } else if (fired.length) {
    const eta = Math.max(1, Math.round((Math.max(...fired.map((l) => predictReady(hub.state, cfg, l, now))) - now) / MIN))
    say = `${who}I’m really sorry about the wait for your ${fired[0].course}. I’ve checked with the kitchen and it will be with you in about ${eta} minutes. I’ll bring it the moment it’s ready.`
    steps.push('Tell the kitchen this table is unhappy and ask them to prioritise it (Kitchen tab).', 'Offer something while they wait, like bread or a drink, if your manager allows.', 'Go back as soon as the food lands, and check in two minutes later.')
  } else if (off.length) {
    const alt = cfg.menu.filter((m) => m.course === off[0].course && m.id !== off[0].menuItemId && hub.state.unavailable[m.id] === undefined).slice(0, 2).map((m) => m.name)
    say = `${who}I’m very sorry: the ${off[0].name} has just run out tonight.${alt.length ? ` May I suggest the ${alt.join(' or the ')}? I can have it fired straight away.` : ''}`
    steps.push('Offer two alternatives and fire the new choice at once.', 'Tell the kitchen it’s a replacement so it goes to the front.')
  } else if (t.lines.some((l) => l.servedAt)) {
    say = `${who}I’m sorry it isn’t right. Could you tell me what’s wrong? I can have it remade or bring you something else straight away.`
    steps.push('Listen fully before you answer; don’t explain or defend.', 'Offer to remake it or bring an alternative, and tell the kitchen why.', 'Mark how it went at your next check-in.')
  } else if (!t.lines.length) {
    say = `${who}I’m so sorry to keep you waiting. Are you ready to order, or can I help you choose?`
    steps.push('Take the order now and fire it.', 'Say roughly how long the first course will take.')
  } else {
    say = `${who}I’m sorry, I want to put this right. What can I do for you?`
    steps.push('Listen fully, apologise once, and agree a next step with a time.')
  }
  if (t.party?.allergies.length) steps.push(`Don’t guess about their ${t.party.allergies.join(', ')} allergy: confirm any new dish with the kitchen.`)
  steps.push(t.managerRequestedAt ? 'The manager has been asked; let the guests know they are on the way.' : 'If they are still unhappy, ask the manager to visit (Ask manager on the table).')
  return `Say: “${say}”\n\nThen:\n${steps.slice(0, 4).map((x, i) => `${i + 1}. ${x}`).join('\n')}`
}
