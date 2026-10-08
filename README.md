# TableMate

**The right service. At the right time.**

> **New here?** Start with [docs/getting-started.md](docs/getting-started.md): install, run and use it, step by step.
> **Free AI chat:** install [Ollama](https://ollama.com), run `ollama pull gemma3:4b`, then `npm run dev`. No key, nothing leaves your computer. Step by step: [docs/ollama-setup.md](docs/ollama-setup.md). For the best answers, put `ANTHROPIC_API_KEY=...` in `.env` instead (see `.env.example`). Dify is still supported: [docs/dify-setup.md](docs/dify-setup.md).

An AI service copilot for fine-dining floor staff. It reads what the restaurant's
POS already knows (tables seated, KOTs fired, food ready, bills printed and
settled), applies the restaurant's own SOPs, and shows each server **their next
three moves, sorted by priority**. The server stays in charge: cards close
themselves when the POS shows the step happened, can be pushed to "Later", and
are worded as help, not orders.

A fairness layer sits underneath it. Every delay is split into steps and
attributed to whoever controlled that step (floor or kitchen), so servers are
not blamed for a slow grill.

> OB project, Working Group B3: *An AI-Based Intervention to Help Serving Staff
> Execute Service Standards in Real Time*.

## Screens

| Route | Who | What |
|---|---|---|
| `/server/:staffId` | Each server (phone or iPad) | Phone: bottom tabs. iPad/laptop (≥768px): side rail with next-up cards, section map, guests and kitchen thread side by side. `?device=phone` previews the phone layout on a big screen. |
| `/kitchen` | Pass / expo screen | Counts strip and station filter; tickets on the line (timer, progress, allergy and diet clashes, Ready) and food waiting at the pass (Nudge the server); all-day counts, notes from the floor, quick notes to the floor, 86 board |
| `/manager` | Floor manager | **Needs you now** (visit requests, safety clashes, late kitchen, bills waiting, unhappy tables), a five-number pulse, every section as a live floor plan with its load, bottlenecks by stage and station, mood, team goal, delay receipts. **No individual rankings.** |
| `/demo` | Manager / presenter | **Demo & setup**. *Run the demo* tab: start, pause, reset; speed (1–30×) and how busy; who's on autopilot (each server, kitchen, manager); **Stage a moment** on cue (allergy guest, kitchen falls behind, birthday regulars, unhappy table, access need, dish runs out, guest asks for manager, bill, arrival, rush); **Showcase mode** runs the whole restaurant itself and stages a moment every few minutes; a live feed narrates every step; links open each screen in its own tab. *Setup* tab (`/setup` opens it): service standards (SOPs), AI assistance, POS integrations. |

## How a card is born

```
POS / kitchen event ──► canonical event ──► engine state ──► SOP rules ──► task cards ──► ranked ──► top 3 per server
                                                                  ▲
                         a later event closes the card automatically (no manual ticking)
```

| Trigger | Card | Closes when |
|---|---|---|
| Table seated | Welcome T4 (party, guest name, occasion, allergy) | Server taps Greeted, or POS shows an order |
| Greeted, no order yet | T4 may be ready to order | Order fired |
| Order fired for a table with an allergy | Flag the allergy to the kitchen (one tap sends it) | Confirmed |
| Item 86'd after being ordered | Risotto is off: tell T6 (with alternatives) | Told guest |
| Ticket past prep time + tolerance | T4 mains running 6 min late: give a heads-up | Told them / food ready |
| Food ready at the pass | Pick up T4 mains | Served |
| Course served + N min | Check in on T4 | Checked in |
| Course finished | Clear & fire mains / offer dessert / offer coffee | Cleared |
| Bill printed | Present T7's bill | Presented / paid |
| Bill settled | Say goodbye to T7 | Done |
| Paid & left | Reset T2 (clean, linen, cutlery, condiments, menus) | Table available |
| Kitchen note | Kitchen: "grill backed up" | Got it |

**Priority** = guest impact × urgency against the SOP deadline (keeps rising once
overdue), plus a small boost for tables that have gone longest without attention
and for regulars. See `scoreTask` in `shared/engine.ts`.

## Design principles (and the OB theory behind them)

- **Cognitive Load Theory (Sweller):** at most 3 cards; the app holds the state of every table so the server doesn't have to.
- **Self-Determination Theory (Deci & Ryan):** *autonomy*: "Later" on every card, nothing forced; *competence*: personal streaks and bests against yourself; *relatedness*: team-level metrics, two-way kitchen notes.
- **Attribution & Equity Theory (Kelley, Adams):** delay receipts split every visit into floor- and kitchen-owned steps; kitchen delays are shown to the server as "not counted against you".
- **Feedback Intervention Theory (Kluger & DeNisi):** feedback is about the task ("T4 is waiting on the bill"), never the person.
- **Privacy by design:** snapshots are cut per role on the server, so personal stats physically never reach the manager screen.
- **Rogers' Diffusion of Innovations:** *relative advantage* (fewer misses, blame protection); *compatibility* (sits on the existing POS, uses the restaurant's own SOPs, no new hardware); *low complexity* (one screen, tap to dismiss, zero data entry); *trialability/divisibility* (one section or one shift; simulator for training); *observability* (end-of-shift stats, manager bottleneck view).

## POS integrations

All adapters translate vendor payloads into one canonical event format (`shared/events.ts`).

| Integration | Status | Notes |
|---|---|---|
| Generic `POST /api/events` | Ready | Canonical JSON from any POS, middleware (UrbanPiper, n8n, Zapier) or custom bridge |
| **Petpooja** | Needs partner access | `stock` and `order-status` follow Petpooja's public Online Ordering API v2.1. Dine-in table/KOT/bill events are **not** public. `dine-in` accepts a proposed format until Petpooja shares the partner payload. |
| Restroworks (Posist), Toast, Square | Planned | Adapter stubs listed in `server/adapters/index.ts` |
| Simulator | Ready | Emits the same events a POS would |

Set `COPILOT_INGEST_KEY` to require an `x-copilot-key` header on POS webhooks.

Example:

```bash
# Petpooja: item out of stock (public API format)
curl -X POST localhost:4000/api/integrations/petpooja/stock -H 'content-type: application/json' \
  -d '{"restID":"abc","inStock":false,"type":"item","itemID":["2003"]}'

# Petpooja dine-in (proposed partner format)
curl -X POST localhost:4000/api/integrations/petpooja/dine-in -H 'content-type: application/json' \
  -d '{"event":"kot_created","table_no":"4","kot_id":"K88","items":[{"itemid":"2001","qty":2}]}'

# Any POS, canonical format
curl -X POST localhost:4000/api/events -H 'content-type: application/json' \
  -d '{"type":"table.seated","payload":{"tableId":"T3","partySize":4,"allergies":["nuts"]}}'
```

## Gamification (private, cooperative)

Built on the research about motivating without controlling (see `shared/game.ts`):

- **XP** for every good move: swift welcomes, heads-ups before guests ask, food hot from the pass. Late steps still earn a little; nothing is ever taken away.
- **Ranks**: Commis → Server → Senior server → Captain → Head of floor → Maître d’.
- **Streaks with shields**: tables served fully to standard build a streak; every third earns a shield that absorbs one slip (streak freezes make streaks last far longer).
- **Combo** for consecutive on-time actions, **badges** (several reachable in the first shift), and **three quests** per night.
- **Team goal and kudos** instead of a leaderboard: competitive leaderboards lowered motivation in Hanus & Fox (2015); the social layer here is cooperative.
- **Private**: XP, streaks and badges only reach the server’s own phone. Managers see the team goal and kudos.
- **Feels like an app**: swipe cards right/left, haptics on wins, confetti for badges and ranks, onboarding, shift recap, bottom tabs, installable to the home screen.

## AI that works the floor with you

- **Allergy and diet safety check** (`shared/safety.ts`): menu items list what they contain; any dish that clashes with a guest's allergy or diet (vegan, Jain, halal) becomes the top card the moment it's fired. "Tell the kitchen" posts a safety note to the pass, and tickets show the flag. Deliberately rule-based, never an AI guess.
- **Honest kitchen times** (`shared/predict.ts`): ready times learned from tonight's real prep times plus each station's queue. Late dishes are flagged *before* they're late, with "ready in about N min" for the guest.
- **One trip, several jobs**: food for two tables at the pass, a second job at the same table, or the table next door ride on one card.
- **Coming up**: food about to be ready, a course about to finish (from tonight's eating times), a bill about to be asked for.
- **Guest mood and recovery**: check-ins are one tap (happy / okay / not happy). Not happy opens a recovery card with a suggested line or a manager call; the manager sees requests and tonight's mood by table, never by server.
- **Private coach**: one tip from the server's own shift, visible only to them (`coach` AI kind; built-in fallback from their own visits).
- **Practice tough moments**: a role-play chat (`shared/practice.ts`). Each reply is scored out of 100 against what a great reply does in that situation (with ✓ / tip for each), shown with stars, the XP it earned and an **ideal reply** to compare with. The other side reacts like a real person: a patience meter (0–4) rises with strong replies and falls with weak ones; a good reply calms them but they raise a real follow-up, a vague one gets pushed for specifics, blame or judgement makes them more upset. Two strong replies win them over; two poor ones (or blame) lose them. The debrief shows the outcome, average score, total XP and the ideal replies. Everything (lines, ideal replies, coaching) is written in all six app languages (`shared/practiceText/`), and replies are scored fairly in any of them; with an AI model connected, it scores, coaches and plays the part in the person's language.
- **Practice XP**: up to 10 XP per scored reply and 10 per star (plus 10 for winning them over) at the end, capped at 150 practice XP a day; badges *First rehearsal*, *Smooth talker* and *Well rehearsed*, and a *Practise one tough moment* quest (`practice.scored` events in `shared/game.ts`). Managers earn training XP too. Servers: cold food, long wait, sold out, allergy question, rude guest, wrong bill, plus inclusive service (speaking to a wheelchair user directly, a fasting guest, getting a guest's form of address wrong). Managers: a guest demanding the manager, a feedback talk, a harassed server, team conflict, a struggling new hire, an allergic reaction. TableMate plays the guest or the team member; managers are coached on listening, privacy, looking after people, follow-up and acting first in emergencies.
- **Ask TableMate**: a chat trainer for servers (sparkle button) and a coach for managers (**Ask TableMate** on the manager console). It knows the restaurant's standards, the menu (what each dish contains), diet and faith rules, and 50 training notes (`shared/training.ts`): service skills for servers; briefings, escalations, comps, feedback, rushes, staff support, conflict, emergencies, onboarding, fair rosters, POSH reports and using the data fairly for managers; and inclusion notes for everyone (the same welcome for every guest, no assumptions, faith and fasting, neurodivergent and sensory-sensitive guests, assistance animals, older guests, names, respect and harassment). Servers' answers use their live tables, managers' the whole floor (load by section, never rankings). It answers in the person's language and offers follow-up questions.
- **Simple words**: a switch in the chat (and in Comfort & access) asks the AI for short sentences and everyday words, for anyone still learning the language or who simply prefers it.
- **Voice**: a pronunciation guide for dishes (`src/lib/pronounce.ts`), speech-friendly text ("T3" → "Table 3", "2×" → "2"), the most natural voice on the device (choose one in Language & accessibility), read sentence by sentence.
- **IST everywhere**: service starts at 7:00 pm IST and every clock shows IST, whatever timezone the server or device is in (`shared/time.ts`).

## Floor plan

Home and Tables show the section as a room (`src/components/FloorPlan.tsx`): the kitchen pass at the top, the entrance at the bottom, every table drawn to its size with chairs, its open-task count, allergy/needs/occasion flags, visit progress and last mood. Tap a table for **Now** (every open task, with its buttons), **Coming up**, the **order** (forecast ready times, safety flags) and **Done so far** (`shared/timeline.ts`). Table positions live in the config (`pos`).

## Dish pronunciation

Read-aloud code-switches like a person: dish words are spoken by a voice from their own cuisine (Hindi for paneer tikka, Italian for gnocchi, French for crème brûlée), the rest in the server's language (`src/lib/pronounce.ts`). Missing voices fall back to respellings. **Language & accessibility → Hear the dish names** plays the menu and shows which cuisine voices the device has.

## Roles, profiles and themes

- **Signed in as** (bottom of the sidebar, or the Profile tab on a phone): switch the device between a server's app, the kitchen display and the manager console. Each role has its own home and navigation; every role uses the same TableMate theme (`src/lib/role.ts`).
- **Profiles**: each server can upload a photo (cropped and shrunk on the device), pick an illustrated avatar and colour, change their display name, set pronouns and list the languages they speak (`src/components/ProfileEditor.tsx`, validated by `shared/profile.ts`).
- **True dark theme**: near-black surfaces with hairline edges; reactions and icons are vector, so they look the same on every phone.
- **Wrap up my shift**: a private debrief — where your time went step by step against the standard, your strongest step, the one to work on, safety catches, tables won back, and one tip from the coach.
- **Time**: clocks show the real time in IST; a new simulated service starts now.

## Inclusive by design

Each server sets these up for themselves from the **Comfort & access** button (the accessibility icon in the header). Settings are saved on the device (`src/lib/prefs.ts`).

- **Six languages** for the server app: English, हिन्दी, नेपाली, বাংলা, தமிழ், Español (`src/i18n/`). Task cards, actions, badges, quests and onboarding all translate. The engine sends task text as keys and values, so each phone shows it in its own language. Kitchen notes and kudos are stored in English so everyone can read them.
- **Read aloud**: new top tasks are spoken in the chosen language with the device's own voice (`src/lib/speech.ts`), at an adjustable speed. Every card has a speaker button.
- **Reading**: larger text, an easy-to-read font (Atkinson Hyperlegible) and high contrast.
- **Alerts without sound**: a flashing screen edge for Deaf and hard-of-hearing staff, plus an optional chime and vibration.
- **Calm and focus**: one card at a time, reduced motion, quiet celebrations (XP still counts) and a left-handed layout.
- **Respectful wording**: every AI prompt asks for gender-neutral, respectful language (no "sir/madam", they/them when unknown) and replies in the server's language. Staff can add optional pronouns on their Profile tab (`POST /api/staff/profile`).
- **Guest needs**: wheelchair, hearing, vision, high chair, quiet table (sensory needs), assistance animal, Jain, halal, vegan, no beef, no pork and fasting needs from the booking (`needs` on `table.seated`) appear on the greeting card, the guest list and the briefing as what to do. Diet needs feed the allergy and diet safety check.

## AI assistance (Claude, Ollama, Dify or built-in)

| Where | Button | AI writes |
|---|---|---|
| Guest-facing cards (greet, delay, dish unavailable, goodbye) | What do I say? | A gracious line to say at the table |
| Server → Briefing | Brief me | Section rundown: allergies, regulars, occasions, kitchen delays |
| Server → sparkle button | Ask TableMate | A multi-turn chat: SOP, menu, diets, tough guests, in the server's language |
| Server → Profile | Practice tough moments | A role-play guest, coaching per reply and a debrief |
| Manager | Summarise | The night's bottlenecks in plain English |

The copilot builds the facts; a language model phrases them (`server/ai.ts`). Chat answers stream to the screen as they're written (`POST /api/ai/stream`, one JSON line per update). Order of preference: **Claude** (`server/claude.ts`, official Anthropic SDK, set `ANTHROPIC_API_KEY`; the long standards-and-menu prompt is cached), then **Ollama** (`server/ollama.ts`: a free model on this computer, picked up automatically whenever the Ollama app is running with a model installed; `gemma3:4b` is a good multilingual choice; tuned for laptops with a compact prompt of only the relevant training notes, a fixed small context, capped answers and a warm-up load, see [docs/ollama-setup.md](docs/ollama-setup.md#speed)), then **Dify**, then a **built-in** writer and trainer (English, set topics only), so every button always works. The shareable demo has no server: opened on claude.ai, it asks Claude on the viewer's own account through the artifact's `sample` capability (`src/lib/standalone.ts`), so custom questions work there without a key. If the model declines a request, the API retries on a fallback model automatically.

## Front end

Brand: TableMate (tomato `#D34F2F`, chocolate `#34251D`, cream `#FBF8F0`, Outfit typeface, running-chef mascot in `src/brand/marks.tsx`). React 19 + Vite + Tailwind CSS v4, with [shadcn/ui](https://ui.shadcn.com) components (`src/components/ui`), [Motion](https://motion.dev) for card animations, [Sonner](https://sonner.emilkowal.ski) toasts and [Lucide](https://lucide.dev) icons. Light and dark themes (toggle in the header). Add more shadcn components with `npx shadcn@latest add <name>`.

## Run it

```bash
npm install
npm run dev      # API on :4000, web app on :5173 (open on phones via your LAN IP)
npm test         # engine tests
```

Production: `npm run build && npm start` serves the app and API on port 4000.

Then open **Demo & setup** and click **Start a fresh demo** (or **Start service**, with the speed set to compress an evening).
For a role-play study, turn a server's autopilot off and play them on a phone.

## Using it for the study

Run the same simulated rush in three conditions: **no app**, a **monitoring-style**
app (rankings, everything visible to the manager), and **this copilot**. Measure
NASA-TLX (cognitive load), perceived electronic monitoring, need satisfaction
(BPNS-W), justice perceptions (Colquitt) and SOP lapses (exported from
`GET /api/events/export`).

## Code map

```
shared/   types, canonical events, demo restaurant config, the engine (+ tests)
server/   HTTP + WebSocket API, event log (data/events.ndjson), simulator, POS adapters
src/      React app: server, kitchen, manager, setup screens
```

## Next steps

- Real Petpooja dine-in feed once partner credentials are available
- Login per staff member and per-restaurant tenancy (currently a single-restaurant, trusted-LAN app)
- Learn each server's preferred sequencing from their "Later" choices to personalise ranking
- Haptic or smartwatch nudges for the top card; PWA install and offline mode
- SOP editor for custom rules beyond the built-in ones
