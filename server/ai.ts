// AI assistance. In order of preference: Claude (ANTHROPIC_API_KEY, see server/claude.ts), a
// Dify app (DIFY_API_URL + DIFY_API_KEY), or a built-in writer and trainer so the copilot always
// works. The copilot builds the facts; the model only phrases them and holds the conversation.

import type { RestaurantConfig, Segment, TableState, Task, VisitRecord } from '../shared/types.ts'
import { dishesNamed } from '../shared/dishNames.ts'
import { analytics, segmentsFor } from '../shared/engine.ts'
import { SCENARIOS, scoreReply } from '../shared/practice.ts'
import { predictReady } from '../shared/predict.ts'
import { safetyIssues } from '../shared/safety.ts'
import { istClock } from '../shared/time.ts'
import { type Audience, findLessons, lessonsFor, MANAGER_STARTERS, STARTERS } from '../shared/training.ts'
import type { Hub } from './hub.ts'

export type AiKind = 'guest_script' | 'briefing' | 'shift_summary' | 'ask_sop' | 'coach' | 'practice' | 'chat'

/** One message in the assistant chat. In practice mode the guest's lines are the assistant's. */
export type AiProvider = 'claude' | 'ollama' | 'dify' | 'built-in'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

/** A conversational language model (Claude, or a local Ollama model). `stable` is cacheable; `live` changes every message. */
export interface ChatModel {
  name: 'claude' | 'ollama'
  /** False while the model can't be used (e.g. the demo page hasn't been granted Claude); the next provider answers. */
  available?(): boolean
  /** Small local models can get menu facts wrong: add the menu's own line for any dish the question names. */
  checkFacts?: boolean
  /** Which model is answering, for the Setup page (e.g. "gemma3:4b"). */
  label?(): string | undefined
  /** `reminder` restates the format and length in one line; small local models follow it far better than the long system prompt. */
  reply(system: { stable: string; live: string; reminder?: string }, turns: ChatTurn[]): Promise<string>
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
}

export interface DifyOptions {
  /** A conversational model (Claude or Ollama), preferred over Dify when present. */
  chat?: ChatModel
  /** Turns a model error into a short reason for the notice. */
  chatErrorReason?: (e: unknown) => string
  url?: string
  key?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const MIN = 60_000

export function createAi(hub: Hub, opts: DifyOptions = {}) {
  const dify = opts.url && opts.key ? { url: opts.url.replace(/\/+$/, ''), key: opts.key } : null
  const model = opts.chat ?? null
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

  /** Practice role-play: the guest's next line plus coaching on the server's last reply. */
  function practiceTurn(req: AiRequest): Built {
    const sc = SCENARIOS.find((x) => x.id === req.scenario)
    if (!sc) throw new AiError('Pick a situation to practise.')
    const history = req.history ?? []
    const replies = history.filter((h) => h.role === 'server')
    const last = replies.at(-1)?.text ?? ''
    const done = replies.length >= 2
    const score = last ? scoreReply(sc.id, last) : null
    const builtFeedback = score ? [...score.good.map((g) => `✓ ${g}`), ...score.tips.slice(0, 2).map((t) => `→ ${t}`)].join('\n') : undefined
    const nextGuest = done ? 'Thank you. That helped.' : sc.guest[replies.length]
    return {
      prompt:
        `Role-play to train a fine-dining server. You play a guest in this situation: "${sc.guest[0]}". ` +
        `Conversation so far:\n${history.map((h) => `${h.role === 'guest' ? 'GUEST' : 'SERVER'}: ${h.text}`).join('\n') || '(none yet)'}\n\n` +
        (last
          ? `First, coach the server's last reply in 2 short lines starting with ✓ for what worked and → for one improvement (apology, empathy, a clear next step, a time, no blaming the kitchen, never guessing about allergens). `
          : '') +
        (done ? 'Then end the role-play kindly as the guest.' : 'Then reply as the guest, in one or two natural sentences, staying in character.') +
        `\nFormat exactly:\nCOACH: <coaching or "-">\nGUEST: <guest line>`,
      fallback: nextGuest,
      extra: { feedback: builtFeedback, stars: score?.stars, done },
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
    const sc = practice ? SCENARIOS.find((x) => x.id === req.scenario) : undefined
    if (practice && !sc) throw new AiError('Pick a situation to practise.')
    if (!practice && turns.at(-1)?.role !== 'user') throw new AiError('Type a message first.')
    const language = AI_LANGUAGES[req.lang ?? 'en'] ?? 'English'
    // Who is asking decides the voice and the knowledge: the staff list marks managers.
    const audience: Audience = sc?.for ?? (cfg.staff.find((x) => x.id === req.staffId)?.role === 'manager' ? 'manager' : 'server')
    const manager = audience === 'manager'
    const asker = manager ? 'the manager' : 'the server'
    const other = sc?.plays === 'staff' ? 'team member' : 'guest'
    const mine = Object.values(hub.state.tables).filter((t) => (manager ? !!t.visitId : t.serverId === req.staffId))
    const live = [
      'Live context (changes every message):',
      `- Asking: ${name(req.staffId)}${pronouns(req.staffId) ? ` (${pronouns(req.staffId)})` : ''}, ${manager ? 'the floor manager' : 'a server'}`,
      `- Their app language: ${language}. Reply in the language they write in; if unclear, use ${language}. Keep dish names as on the menu.`,
      ...(req.simple ? ['- They asked for simple words: short sentences, everyday words, one idea per sentence; explain any restaurant term.'] : []),
      `- Time: ${istClock(now)} IST`,
      ...(practice
        ? [
            `- Mode: PRACTICE. You play a ${other} in this situation: "${sc!.guest[0]}" Stay in character; be realistic, not cartoonish; respond like a real person would when ${asker} handles it well or badly.`,
            req.finish
              ? `- ${manager ? 'The manager' : 'The server'} asked to finish. Step out of character and give a short debrief: two things they did well, one thing to practise, and a final line "STARS: n" (1-3).`
              : `- After each reply from ${asker}, first coach it in 1-2 short lines starting with ✓ (what worked) and → (one improvement), using the practice rubric. Then reply as the ${other}. Format exactly:\nCOACH: <coaching, or - before they have spoken>\nGUEST: <the ${other}'s next line>\nIf the situation is resolved, end the ${other}'s line with [END].`,
          ]
        : [manager ? '- Mode: ASK. Answer as their operations coach and peer.' : '- Mode: ASK. Answer as their expert trainer and colleague.']),
      manager ? '- The floor right now (seated tables):' : '- Their section right now:',
      ...briefingFacts(mine, cfg, hub.state.unavailable, now),
      ...(manager ? floorFacts(hub, now) : []),
    ].join('\n')
    // The API needs the conversation to start with the server; a practice opens with the guest.
    const apiTurns: ChatTurn[] = turns[0]?.role === 'user' ? [...turns] : [{ role: 'user', text: practice ? `(Start the role-play with the ${other}’s opening line.)` : '(Start.)' }, ...turns]
    if (practice && req.finish) apiTurns.push({ role: 'user', text: '(Finish the practice and give me my debrief.)' })
    else if (practice && apiTurns.at(-1)?.role === 'assistant') apiTurns.push({ role: 'user', text: '(Continue.)' })
    const builtIn = practice ? practiceBuiltIn(sc!.id, turns, !!req.finish) : askBuiltIn(turns.at(-1)!.text, req, now, audience)
    const facts = practice ? [] : dishesNamed(turns.at(-1)!.text, cfg.menu).slice(0, 2).map(dishFacts)
    return {
      facts,
      prompt: `${stableSystem(cfg, audience)}\n\n${live}\n\nConversation so far:\n${apiTurns.map((t) => `${t.role === 'user' ? (manager ? 'MANAGER' : 'SERVER') : practice ? other.toUpperCase() : 'TABLEMATE'}: ${t.text}`).join('\n')}`,
      fallback: builtIn.text,
      extra: { feedback: builtIn.feedback, stars: builtIn.stars, done: builtIn.done, suggestions: builtIn.suggestions },
      system: {
        stable: stableSystem(cfg, audience),
        live,
        reminder: practice
          ? req.finish
            ? 'Step out of character: two things I did well, one thing to practise, then a last line "STARS: n" (1-3).'
            : `Reply in exactly this format, nothing else:\nCOACH: ✓ <what worked> → <one improvement>\nGUEST: <the ${other}’s next line, in character>`
          : `You are TableMate, my ${manager ? 'management coach' : 'trainer'}${req.simple ? '; use simple everyday words' : ''}. Answer my last message directly in 2-5 short sentences or bullets, no headings, no thinking out loud. Use ${language} unless I wrote in another language.`,
      },
      turns: apiTurns,
      parse: practice
        ? (raw: string) => {
            // Smaller models often bold the labels (**COACH:**); read them either way.
            const answer = raw.replace(/\*\*\s*(COACH|GUEST|STARS)\s*:?\s*\*\*\s*:?/gi, '$1:')
            if (req.finish) {
              const stars = Number(answer.match(/STARS:\s*([1-3])/i)?.[1]) || builtIn.stars
              return { text: answer.replace(/STARS:\s*[1-3]\s*$/i, '').trim(), stars, done: true, feedback: undefined }
            }
            const coach = answer.match(/COACH:\s*([\s\S]*?)(?:\n\s*GUEST:|$)/i)?.[1]?.trim()
            // Without labels, keep the guest's words and drop any stray coaching lines.
            let guest =
              answer.match(/GUEST:\s*([\s\S]*)$/i)?.[1]?.trim() ??
              answer
                .split('\n')
                .filter((l) => !/^\s*(✓|→|COACH:)/i.test(l))
                .join('\n')
                .trim()
            const done = /\[END\]/i.test(guest)
            guest = guest.replace(/\[END\]/gi, '').trim()
            const last = [...turns].reverse().find((t) => t.role === 'user')?.text
            // If the model skipped the coaching, the rubric's own coaching stands in.
            // No usable guest line (e.g. only coaching came back): the scripted guest line stands in.
            return { text: guest || builtIn.text, feedback: coach && coach !== '-' ? coach : builtIn.feedback, stars: last ? scoreReply(sc!.id, last).stars : undefined, done }
          }
        : (answer: string) => ({ text: answer, suggestions: builtIn.suggestions }),
    }
  }

  /** Built-in expert: today's section, the menu, the standards and the training notes. */
  function askBuiltIn(question: string, req: AiRequest, now: number, audience: Audience = 'server'): { text: string; suggestions: string[]; feedback?: string; stars?: number; done?: boolean } {
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
    if (audience === 'server' && /brief|my section|my tables|section|tables right now/.test(q)) {
      const facts = briefingFacts(Object.values(hub.state.tables).filter((t) => t.serverId === req.staffId), cfg, hub.state.unavailable, now)
      return { text: facts.map((f) => `• ${f.replace(/^- /, '')}`).join('\n'), suggestions: ['How do I warn guests about a delay?', 'Explain Jain food'] }
    }
    const dish = dishesNamed(question, cfg.menu)[0]
    if (dish) return { text: dishFacts(dish), suggestions: ['How do I describe a dish well?', 'How do I handle allergies?'] }
    if (/vegan dishes|which dishes|onion or garlic|contain/.test(q)) {
      const tag = /onion|garlic|jain/.test(q) ? 'root' : /vegan/.test(q) ? null : null
      const list = cfg.menu.filter((m) => (tag ? m.contains?.includes(tag) : !m.contains?.some((c) => ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey'].includes(c))))
      return {
        text: list.length
          ? `${tag ? 'Contain onion, garlic or root vegetables' : 'No animal products listed'}: ${list.map((m) => m.name).join(', ')}. Always confirm with the kitchen.`
          : 'None on tonight’s menu by the ingredient list. Ask the kitchen what they can adapt.',
        suggestions: ['Explain Jain food', 'How do I handle allergies?'],
      }
    }
    const lessons = findLessons(question, 2, audience)
    if (lessons.length) return { text: lessons.map((l, i) => (i === 0 ? l.answer : `Also: ${l.answer}`)).join('\n\n'), suggestions: lessons[0].next }
    const sop = sopFallback(question, cfg)
    if (!sop.startsWith('I can only')) return { text: sop, suggestions: starters.slice(1, 3) }
    return {
      text:
        audience === 'manager'
          ? 'That one needs the AI coach, which isn’t connected right now, so I can only answer from the built-in notes: briefings, escalations and comps, feedback and recognition, rushes, staff support, conflict, emergencies, inclusion and harassment reports. Try one of these, or connect Ollama or Claude in Setup.'
          : 'That one needs the AI trainer, which isn’t connected right now, so I can only answer from the built-in notes: service standards, tonight’s menu and what’s in each dish, allergies and diets, complaints, access and inclusion, and your section. Try one of these, or ask your manager to connect AI in Setup.',
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

  const modelReady = () => !!model && (model.available?.() ?? true)

  return {
    get provider(): AiProvider {
      return modelReady() ? model!.name : dify ? 'dify' : 'built-in'
    },
    get modelLabel(): string | undefined {
      return modelReady() ? model!.label?.() : undefined
    },
    async ask(req: AiRequest): Promise<AiAnswer> {
      const built = build(req)
      const language = AI_LANGUAGES[req.lang ?? 'en'] ?? 'English'
      const prompt = `${built.prompt}\n\nStyle: ${INCLUSIVE_STYLE}\nReply in ${language}.`
      const fallback = built.fallback
      let notice: string | undefined
      if (model && modelReady()) {
        try {
          const system = built.system ?? { stable: stableSystem(hub.config), live: `Reply in ${language}.` }
          const answer = await model.reply(system, built.turns ?? [{ role: 'user', text: built.prompt }])
          const out = { ...built.extra, ...(built.parse ? built.parse(answer) : { text: answer }), source: model.name }
          if (model.checkFacts && built.facts?.length) out.text = `${out.text}\n\nFrom the menu: ${built.facts.join('\n')}`
          return out
        } catch (e) {
          notice = `${opts.chatErrorReason?.(e) ?? (e instanceof Error ? e.message : String(e))}. Showing the built-in answer.`
          if (!dify) return { text: fallback, source: 'built-in', notice, ...built.extra }
        }
      }
      if (!dify) return { text: fallback, source: 'built-in', ...built.extra }
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

interface Built {
  prompt: string
  fallback: string
  /** Fields returned alongside the text (practice feedback, stars, done). */
  extra?: Partial<AiAnswer>
  /** Splits a structured model answer into fields. */
  parse?: (answer: string) => Partial<AiAnswer> & { text: string }
  /** Menu lines for dishes the question names, for models that need a fact check. */
  facts?: string[]
  /** Chat kinds: the system prompt (cacheable part + live part) and the turns for a chat model. */
  system?: { stable: string; live: string; reminder?: string }
  turns?: ChatTurn[]
}

/**
 * The assistant's standing brief: who it is, how it answers, the restaurant's standards, the
 * menu with what each dish contains, and the training notes. Identical on every request for a
 * given config, so it caches.
 */
export function stableSystem(cfg: RestaurantConfig, audience: Audience = 'server'): string {
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
    'Service standards:',
    ...sopFacts(cfg),
    '',
    'Menu (course, station, what it contains):',
    ...cfg.menu.map((m) => `- ${m.name}: ${m.course}, ${m.station}, about ${m.prepMin} min; contains ${m.contains?.join(', ') || 'not listed'}`),
    'Diet rules: vegetarian avoids meat, fish, shellfish. Vegan also avoids dairy, egg, honey. Jain avoids meat, fish, shellfish, egg and root vegetables (onion, garlic, potato). Halal avoids pork, alcohol and non-halal meat. Some guests avoid beef or pork only; religious fasts differ, so ask.',
    '',
    manager
      ? 'Practice rubric (for role-plays): a great manager listens first, takes ownership, keeps feedback private and specific (situation, behaviour, impact), looks after the person (staff safety and wellbeing come before a guest’s spend), agrees a follow-up, never shames or blames, and in an emergency acts first (call 112).'
      : 'Practice rubric (for role-plays): a great reply apologises sincerely, shows understanding, gives a clear next step and a time, never blames the kitchen, never guesses about allergens (checks with the chef), speaks to the guest directly, and asks rather than assumes.',
    '',
    manager ? 'Training notes (the house way of managing):' : 'Training notes (the house way of doing things):',
    ...lessonsFor(audience).map((l) => `- ${l.title}: ${l.answer}`),
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
  return `${m.name}: ${m.course === 'main' ? 'a main' : `a ${m.course}`} from the ${m.station} station, about ${m.prepMin} minutes. Contains: ${c.map((x) => word[x] ?? x).join(', ') || 'not listed'}.${clashes.length ? ` Not suitable as-is for ${clashes.join(', ')} guests.` : ''} Always confirm allergies with the kitchen.`
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
function floorFacts(hub: Hub, now: number): string[] {
  const cfg = hub.config
  const a = analytics(hub.state, cfg)
  const out: string[] = []
  for (const [section, staffId] of Object.entries(cfg.sections)) {
    const l = a.load.find((x) => x.staffId === staffId)
    out.push(`- Section ${section}: ${l?.activeTables ?? 0} active tables${l?.overloaded ? ` (over the limit of ${cfg.sop.maxActiveTablesPerServer})` : ''}`)
  }
  for (const r of a.managerRequests) out.push(`- NEEDS YOU: a server asked you to visit ${r.tableName}`)
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
function practiceBuiltIn(scenarioId: string, turns: ChatTurn[], finish: boolean): { text: string; feedback?: string; stars?: number; done?: boolean; suggestions?: string[] } {
  const sc = SCENARIOS.find((x) => x.id === scenarioId)!
  const replies = turns.filter((t) => t.role === 'user').map((t) => t.text)
  if (finish) {
    if (!replies.length) return { text: 'Reply at least once, then I can give you feedback.', done: false }
    const scores = replies.map((r) => scoreReply(sc.id, r))
    const stars = Math.round(scores.reduce((a, s) => a + s.stars, 0) / scores.length)
    const good = [...new Set(scores.flatMap((s) => s.good))].slice(0, 2)
    const tip = scores.flatMap((s) => s.tips)[0]
    return { text: [good.length ? `What worked: ${good.join(' ')}` : '', tip ? `To practise: ${tip}` : 'To practise: keep doing exactly this.'].filter(Boolean).join('\n'), stars, done: true }
  }
  const last = replies.at(-1)
  const score = last ? scoreReply(sc.id, last) : null
  const feedback = score ? [...score.good.map((g) => `✓ ${g}`), ...score.tips.slice(0, 2).map((t) => `→ ${t}`)].join('\n') : undefined
  const line = replies.length < sc.guest.length ? sc.guest[replies.length] : 'Alright. Thank you for sorting that out.'
  return { text: line, feedback, stars: score?.stars, done: replies.length >= sc.guest.length }
}
