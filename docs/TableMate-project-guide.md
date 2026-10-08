# TableMate: project guide

**The right service. At the right time.**

TableMate is an employee-centric AI copilot for fine-dining floor staff. It reads what the restaurant's point-of-sale (POS) system already knows, applies the restaurant's own service standards, and shows each server their next three moves. Around that core it adds a kitchen relay, a fair way of attributing delays, private motivation, inclusive design, and an AI trainer that coaches servers and managers in their own language.

> OB project, Working Group B3: *An AI-Based Intervention to Help Serving Staff Execute Service Standards in Real Time*.

This guide covers the problem, the objective, the solution, every feature and how it works, why it is employee-centric, how each person uses it, what is still missing, and ideas for taking it further.

---

## Contents

1. [The problem](#1-the-problem)
2. [The objective](#2-the-objective)
3. [The solution in one page](#3-the-solution-in-one-page)
4. [How it works under the hood](#4-how-it-works-under-the-hood)
5. [Every feature, screen by screen](#5-every-feature-screen-by-screen)
6. [Where AI is used, and where it deliberately isn't](#6-where-ai-is-used-and-where-it-deliberately-isnt)
7. [Why it is employee-centric](#7-why-it-is-employee-centric)
8. [How each person uses it](#8-how-each-person-uses-it)
9. [Presenting the project](#9-presenting-the-project)
10. [How to evaluate it (the study)](#10-how-to-evaluate-it-the-study)
11. [Current limitations](#11-current-limitations)
12. [Roadmap: more AI that could help](#12-roadmap-more-ai-that-could-help)
13. [Checklist to complete the project](#13-checklist-to-complete-the-project)
14. [Running it](#14-running-it)
15. [Glossary](#15-glossary)

---

## 1. The problem

Restaurants digitised the order. They didn't digitise the server's job.

**Everything lives in one head.** A server looking after six tables is tracking, at the same time: who hasn't been greeted, who is ready to order, which dishes are at the pass, who needs a check-in, which course is finished, who wants the bill, which table needs resetting, and which guest has an allergy. Each standard is simple ("greet within 2 minutes"). Together, during a rush, they overload working memory, and steps get missed.

**Information stops at the pass.** The POS knows when a dish is late or has run out. The server usually finds out when the guest asks. News between kitchen and floor still travels by shouting across the pass.

**Blame lands on the floor.** Guests and managers see the server, so a slow grill reads as slow service. Service failures cost return visits (Chung & Hoffman, 1998), and the person who carries the blame often isn't the person who controlled the delay.

**Training is thin and uneven.** New staff learn by shadowing during real service, where mistakes happen in front of guests. Tough moments (a complaint, a rude guest, an allergy question, a harassing customer) are rarely rehearsed. Staff who are still learning the language, or who think differently, get the least support.

**Typical "digital" fixes make it worse.** Monitoring dashboards and leaderboards increase surveillance, stress and perceived unfairness. They measure people rather than helping them.

---

## 2. The objective

Help serving staff deliver the restaurant's service standards in real time, **without** surveillance, extra data entry or blame, and make them better at their job over time.

Concretely, TableMate aims to:

| Goal | What it means | How we'd know |
|---|---|---|
| Reduce cognitive load | The app holds the state of every table; the server sees only the next 3 moves | Lower NASA-TLX scores |
| Fewer missed standards | Greetings, check-ins, bills and resets happen on time | Fewer SOP lapses per shift |
| Fair attribution | Kitchen delays are never counted against servers | Higher justice perceptions (Colquitt) |
| Motivation without control | Autonomy, competence and relatedness, not rankings | Higher BPNS-W, lower perceived monitoring |
| Safer service | Allergy and diet clashes caught before food goes out | Safety catches; zero missed allergies |
| Better skills | Practice tough moments and get coached, in your own language | Practice scores improve; confidence |
| Inclusion | Works for every staff member and every guest | Usable in 6 languages, accessibility settings used |

---

## 3. The solution in one page

TableMate sits on top of the POS the restaurant already uses. It needs no new hardware and no data entry.

1. **The POS reports what happens**: a table is seated, an order (KOT) is fired, food is ready, a dish runs out, a bill is printed or paid.
2. **The restaurant's own standards turn events into tasks**, each with a time limit ("greet within 2 minutes").
3. **Tasks are ranked** by guest impact × urgency, plus a nudge for tables left alone longest, and **each server sees only their top three**.
4. **Cards close themselves** when the POS shows the step happened. The server rarely taps "done", and can always push a card to "Later". Cards are worded as help, never orders.

Around this core:

- **A kitchen relay**: the kitchen screen shows tickets with timers; notes travel both ways in a tap.
- **Fairness**: every visit is split into steps, and each delay is attributed to whoever controlled that step (floor or kitchen).
- **Safety**: a rule-based check flags any dish that clashes with a guest's allergy or diet the moment it's ordered.
- **Private motivation**: XP, ranks, streaks, badges and quests only the server sees; a cooperative team goal and kudos instead of a leaderboard.
- **An AI trainer and coach (Ask TableMate)** for servers and managers: answers questions about service, the menu and tonight's tables, and runs realistic role-plays that score each reply and show an ideal one, in six languages.
- **Inclusive by design**: six languages, read-aloud with correct dish pronunciation, accessibility settings, "simple words", respectful wording, and guest needs turned into what to do.
- **Demo & setup**: a simulator that runs a full dinner service, with staged moments and a hands-free showcase mode, plus the restaurant's standards, AI and POS settings.

---

## 4. How it works under the hood

### The event pipeline

```
POS / kitchen event ──► canonical event ──► engine state ──► SOP rules ──► task cards ──► ranked ──► top 3 per server
                                                                 ▲
                        a later event closes the card automatically (no manual ticking)
```

Every source (a real POS, the kitchen screen, a server's tap, the simulator) produces the same canonical events (`shared/events.ts`). The engine (`shared/engine.ts`) is pure and deterministic: fed the same events, it produces the same state, the same tasks and the same game. Events are stored in an append-only log (`data/events.ndjson`), so a whole service can be replayed or exported for research.

### Where each card comes from

| Trigger | Card | Closes when |
|---|---|---|
| Table seated | Welcome T4 (party size, guest name, occasion, allergy, needs) | Server taps Greeted, or the POS shows an order |
| Greeted, no order yet | T4 may be ready to order | Order fired |
| Order fired for a table with an allergy | Flag the allergy to the kitchen (one tap sends it) | Confirmed |
| A dish clashes with an allergy or diet | Safety check: tell the kitchen or confirm with the guest | Resolved |
| Dish 86'd after being ordered | Risotto is off: tell T6 (with alternatives) | Guest told |
| Ticket past its forecast + tolerance | T4 mains running 6 min late: give a heads-up | Told / food ready |
| Food ready at the pass | Pick up T4 mains | Served |
| Course served + N min | Check in on T4 (one-tap mood) | Checked in |
| Guests not happy at check-in | Recovery: suggested line or call the manager | Won back / manager visited |
| Course finished | Clear and fire mains / offer dessert / coffee | Cleared |
| Bill printed | Present T7's bill | Presented / paid |
| Bill settled | Say goodbye to T7 | Done |
| Paid and left | Reset T2 (checklist) | Table available |
| Kitchen note | "Grill backed up" | Got it |

**Priority** = guest impact × urgency against the standard's deadline (it keeps rising once overdue), plus a small boost for tables left longest without attention and for regulars. Related jobs ride on one card: food for two tables at the pass, a second job at the same table, or the table next door.

### Architecture

| Part | Technology | Where |
|---|---|---|
| Engine, events, safety, game, practice | TypeScript, pure functions, unit-tested | `shared/` |
| API, WebSocket live updates, event log, simulator, POS adapters, AI | Node.js | `server/` |
| App (server, kitchen, manager, demo & setup, how it works) | React 19, Vite, Tailwind CSS v4, shadcn/ui, Motion | `src/` |
| AI providers | Claude (Anthropic SDK), Ollama (local), Dify, built-in | `server/ai.ts`, `server/claude.ts`, `server/ollama.ts` |
| Shareable demo | The same engine running in the browser | `dist-demo/` |

**Privacy by design**: live snapshots are cut per role on the server. A server's personal stats physically never reach the manager's screen.

---

## 5. Every feature, screen by screen

### 5.1 Getting in: roles and the start page

- **Floor staff (the start page)** lists tonight's servers with how many tables and open tasks each has. Tap a name to open their app.
- **Signed in as** (bottom of the sidebar, or the Profile tab on a phone) switches the device between a server's app, the kitchen display and the manager console. Each role gets its own home and navigation, all in the same TableMate theme.
- **First launch** shows a short onboarding for servers.

### 5.2 The server app (phone or tablet)

Phones get bottom tabs; tablets and laptops get a side rail with cards, the floor plan, guests and the kitchen thread side by side.

**Home tab**
- **Next up**: the top three cards, ranked. Swipe right for done, left for Later, or use the buttons. Cards close themselves when the POS shows the step happened.
- **One trip, several jobs**: combined cards when jobs are next to each other.
- **Coming up**: what's about to need you (food nearly ready, a course about to finish, a bill about to be asked for).
- **"What do I say?"** on guest-facing cards (greeting, delay, dish unavailable, goodbye) writes a gracious line to say at the table.
- **Brief me**: a rundown of your section (allergies, regulars, occasions, anything the kitchen is behind on).
- **My section**: a top-down floor plan (see below).
- **Team goal**: the floor's shared target for tables served fully to standard.

**Tables tab**
- **Floor plan**: the section drawn as a room (kitchen pass at the top, entrance at the bottom), each table to size with chairs, its open-task count, flags for allergies, needs and occasions, visit progress traced around the edge, and the last mood.
- **Tap a table** for **Now** (every open task with its buttons), **Coming up**, **the order** (forecast ready times and safety flags) and **Done so far** (a timeline of the visit).
- **Guest list** with each party's needs, written as what to do ("hard of hearing: face them, speak clearly, offer to write").

**Kitchen tab**
- The two-way thread with the pass: notes from the kitchen ("grill backed up", "risotto is off") and quick notes to it.

**Profile tab**
- **Rank, XP and level ring**: Commis → Server → Senior server → Captain → Head of floor → Maître d’.
- **Streak and shields**: tables served fully to standard build a streak; every third earns a shield that absorbs one slip.
- **Combo** for consecutive on-time actions, **badges** (several reachable on the first shift) and **tonight's quests**.
- **Kudos** to and from teammates.
- **Practice tough moments** (see 5.6).
- **Private coach**: one tip drawn from your own shift, visible only to you.
- **Wrap up my shift**: a private debrief showing where your time went step by step against the standard, your strongest step, the one to work on, safety catches, tables won back and a coaching tip.
- **Profile editor**: photo (cropped and shrunk on the device), illustrated avatar and colour, display name, pronouns, languages spoken.

**In the header**
- **Ask TableMate** (the sparkle button): the AI trainer (see 5.6).
- **Comfort & access** (the accessibility icon): see 5.8.
- **Language** (EN and five more) and **light / dark / system theme**.

### 5.3 Safety, timing and guest care (inside the cards)

- **Allergy and diet safety check**: each dish lists what it contains. Any dish that clashes with a guest's allergy (nuts, dairy, gluten, egg, fish, shellfish) or diet (vegetarian, vegan, Jain, halal, no beef, no pork) becomes the top card the moment it's ordered, and the kitchen ticket shows the flag. This is deliberately rule-based, never an AI guess.
- **Honest kitchen times**: ready times are forecast from tonight's real prep times plus each station's queue, so late dishes are flagged before they're late, with "ready in about N min" for the guest.
- **Guest mood and recovery**: check-ins are one tap (happy / okay / not happy). "Not happy" opens a recovery card with a suggested line or a manager call.
- **Guest needs from the booking**: wheelchair, hearing, vision, high chair, quiet table (sensory needs), assistance animal, Jain, halal, vegan, no beef, no pork and fasting. They appear on the greeting card, the guest list and the briefing as what to do, and diet needs feed the safety check.

### 5.4 The kitchen pass screen

- **Counts strip**: dishes on the line, running late, and waiting at the pass; a **station filter** (grill, hot, cold, pastry, bar).
- **On the line**: tickets with table, server, course, elapsed time against the forecast, a progress bar, allergy and diet clashes, and a large **Ready** button.
- **At the pass**: food waiting, how long it has waited, and a **Nudge** that tells the server.
- **All-day counts** per dish, **notes from the floor** (allergy notes highlighted), **quick notes to the floor**, and the **86 board** to switch dishes off (servers with that dish on order are told straight away).

### 5.5 The manager console

- **Needs you now**: guests asking for the manager (with a Visited button), unresolved allergy or diet clashes, food running late, bills waiting past the standard, and unhappy tables. "All calm" when there's nothing.
- **Pulse**: guests seated, tables served, served to standard, late steps (floor vs kitchen) and happy check-ins.
- **Live floor**: every section as a floor plan with its server and load (tables and open tasks). Load, never performance.
- **Where time goes**: average time per step against the standard, coloured by who controls it (floor or kitchen).
- **Kitchen stations**: tickets, how many past standard and by how much.
- **Suggestions**: e.g. a section over its table limit.
- **Guest mood and safety tonight**, **team goal and recognition** (kudos), **shift summary** (AI, in plain English) and **delay receipts** (each recent visit as a bar of steps, coloured by owner).
- **Ask TableMate** for managers (see 5.6).
- **No individual rankings, anywhere.** Personal scores stay on each server's own phone.

### 5.6 Ask TableMate: the AI trainer and coach

Opened with the sparkle button (servers) or **Ask TableMate** on the manager console. Two tabs: **Ask** and **Practice**.

**Ask**
- A chat that knows the restaurant's service standards, the menu (what each dish contains), diet and faith rules, and **50 training notes** written the way a senior trainer would explain them:
  - **For servers**: the first two minutes, being slammed, kitchen delays, complaints (LAST), when to bring the manager, allergies, Jain, vegan and halal, recommending without pushing, describing a dish, drinks and pairings, explaining Indian food to first-timers, occasions and regulars, owning a mistake, teamwork and handovers, guests who've had too much, looking after yourself, phone bookings, check-backs, the bill, the goodbye, table reset.
  - **For managers**: pre-shift briefings, guests asking for the manager, comps and recovery, giving feedback (situation, behaviour, impact), recognising good work, rushes and short shifts, supporting staff after a hard guest, team conflict, allergic reactions and emergencies (call 112 first), welcoming new staff, keeping the team inclusive (fair rosters around festivals, prayer and childcare), handling harassment reports under India's POSH Act, end-of-shift debriefs, using TableMate's data fairly, floor and kitchen working together.
  - **For everyone (inclusion)**: the same welcome for every guest, service without assumptions, religious and cultural food needs and fasting, neurodivergent and sensory-sensitive guests, assistance animals, older guests, getting names right, respect in the team, harassment.
- **It knows tonight**: servers' answers use their own tables; managers' use the whole floor (load by section, never rankings).
- **Diet and allergy lists from the menu**: "What dishes are Jain?" or "what can someone with a nut allergy eat?" is answered from the ingredient tags (suitable as listed, and not, with the reason), never guessed.
- **Starter questions** and **follow-up suggestions**; **dictation** (speak instead of type); **read aloud**; answers **stream** as they're written.
- **Simple words**: a switch for short sentences and everyday words, for anyone still learning the language or who prefers plain wording.
- Replies in the language the person writes in.

**Practice tough moments**
- **Servers' situations**: cold food, long wait, dish sold out, allergy question, rude guest, wrong bill; and inclusive service: speaking to a wheelchair user directly, a guest fasting for Navratri, getting a guest's form of address wrong.
- **Managers' situations**: a guest demanding the manager, a feedback conversation, a server being harassed, team conflict, a struggling new hire, an allergic reaction. TableMate plays the guest or the team member.
- **Every reply is scored out of 100** against what a great reply does in that situation (for example: apologise, say what you'll do, give a time), with a ✓ or a tip for each, stars, and the **XP** it earned. Blaming the kitchen, guessing about allergens, or judging someone's faith or diet is heavily penalised.
- **See an ideal reply** to compare with yours, read or listened to.
- **A realistic other side**: a "How they feel" meter rises with strong replies and falls with weak ones. A good reply calms them but they raise a real follow-up; a vague one gets pushed for specifics; blame or judgement makes them more upset. Two strong replies win them over; two poor ones (or blame) lose them.
- **The debrief** follows automatically: how it ended, average score, total XP, what worked, what to practise, and the ideal replies.
- **Every line, ideal reply and coaching tip exists in all six languages**, and replies are scored fairly in any of them.

**Practice XP**: up to 10 XP per scored reply; at the end 10 per star plus 10 for winning them over; capped at 150 practice XP a day so it rewards learning, not grinding. Badges *First rehearsal*, *Smooth talker* and *Well rehearsed*, and a *Practise one tough moment* quest. Managers earn training XP too.

### 5.7 Voice

- **Read aloud** new top tasks and any card, in the chosen language, at an adjustable speed, with the most natural voice on the device.
- **Dish pronunciation that code-switches like a person**: dish words are spoken by a voice from their own cuisine (Hindi for paneer tikka, Italian for gnocchi, French for crème brûlée), the rest in the server's language. Missing voices fall back to respellings.
- **Speech-friendly text**: "T3" becomes "Table 3", "2×" becomes "2".
- **Dictation** in the chat and practice room.

### 5.8 Comfort & access (each person sets it for themselves)

- **Six languages**: English, हिन्दी, नेपाली, বাংলা, தமிழ், Español. Task cards, actions, badges, quests, onboarding, the chat and practice all translate.
- **Reading**: larger text, an easy-to-read font (Atkinson Hyperlegible), high contrast, simple words.
- **Alerts without sound**: a flashing screen edge for Deaf and hard-of-hearing staff, plus an optional chime and vibration.
- **Calm and focus**: one card at a time, reduced motion, quiet celebrations (XP still counts), and a left-handed layout.
- **Respectful wording**: every AI prompt asks for gender-neutral, respectful language (no assumed "sir/madam"); optional pronouns on the profile.
- **True dark theme** for dim dining rooms.

### 5.9 Demo & setup

**Run the demo** tab
- **Control bar**: tables seated, speed, guests waiting, IST time; Start / Pause; Reset (with confirmation).
- **Showcase mode**: the whole restaurant runs on autopilot (servers act on their cards, the kitchen cooks, the manager answers visit requests) and a new moment is staged every few minutes.
- **Start a fresh demo**: reset, then start showcase mode at 10× speed with a busy service.
- **Stage a moment**: allergy guest, kitchen falls behind, birthday regulars, unhappy table, access need, dish runs out, guest asks for the manager, bill request, new arrival, sudden rush. Each says why if it can't happen yet.
- **Pace**: speed 1× to 30×; how busy (quiet, normal, busy, rush).
- **Who's on autopilot**: each server, the kitchen, the manager. Switch one off to play them live.
- **Live feed**: every step in plain words, newest first.
- **Open the screens**: each server's phone, the kitchen and the manager console in new tabs.

**Setup** tab
- **Service standards (SOPs)**: greet within, order nudge, kitchen-delay tolerance, pick-up time, check-back, course check, bill, goodbye, reset, max tables per server. Saving re-scores the whole service.
- **AI assistance**: which AI is connected, with step-by-step instructions for Ollama (free, local) or Claude (paid).
- **POS integrations**: a generic event API (ready), Petpooja (needs partner access for dine-in), Restroworks, Toast and Square (planned), the simulator (ready), with event counts.

### 5.10 How it works (the explainer page)

A page for the audience covering the problem, how a card is born, fairness, AI on the floor, inclusion, the theory behind the design, adoption, motivation without surveillance, the technology, AI where words matter, and how it will be tested.

---

## 6. Where AI is used, and where it deliberately isn't

TableMate uses AI for language and coaching, and plain rules for anything safety-critical or that decides what someone should do next. That keeps it predictable, explainable and fair.

| Area | Approach | Why |
|---|---|---|
| Which task is next, and its priority | Rules from the restaurant's SOPs | Predictable and explainable; the server can see why |
| Allergy and diet safety | Rules on ingredient tags | Never trust a guess with someone's health |
| Kitchen ready times | Statistics: tonight's prep times + station queues | Honest estimates that improve through the night |
| Delay attribution (floor vs kitchen) | Rules on who controlled each step | Fairness must be auditable |
| "What do I say?", briefings, shift summary, coach tip | Language model, fed only facts the engine built | Natural wording; the facts stay correct |
| Ask TableMate | Language model with the standards, menu, training notes and live context; checked menu facts added | Expert answers in any language |
| Practice role-plays | Language model plays the part and scores; blended with a rule-based rubric | Realistic, multilingual and hard to game |
| Built-in trainer (no AI connected) | Rules and written content in six languages | Every button always works |

**AI providers, in order of preference**

1. **Claude** (Anthropic API, paid): best quality in every language; the long standards-and-menu prompt is cached; answers stream.
2. **Ollama** (free, runs on the computer, nothing leaves it): picked up automatically; tuned for laptops with a compact prompt of only the relevant notes, a fixed context size and a warm-up load.
3. **Dify**: for managing prompts in a Dify app.
4. **Built-in**: always available; questions in English, role-plays in all six languages.

The shareable demo link uses Claude through the viewer's own claude.ai account.

**Guardrails**
- The safety check and menu facts are computed from data and given to the model to answer from; local models also show the menu's own facts under their answer.
- Practice scores from small local models are blended with the rule-based rubric; placeholders or echoed lines fall back to written content.
- Any AI failure falls back to the built-in answer with a short notice; staff never see a crash.

---

## 7. Why it is employee-centric

TableMate is designed around the person doing the work, not around watching them. Each choice maps to organisational-behaviour research.

| Principle | What TableMate does | Theory |
|---|---|---|
| **Reduce load, don't add it** | At most three cards; the app holds the state of every table; zero data entry; cards close themselves | Cognitive Load Theory (Sweller) |
| **Autonomy** | Cards are suggestions, never orders; "Later" on every card; you choose your order of work | Self-Determination Theory (Deci & Ryan) |
| **Competence** | Personal XP, streaks, badges and bests against yourself; a private coach; practice with instant feedback | Self-Determination Theory |
| **Relatedness** | Team goal, kudos between teammates, a two-way kitchen thread | Self-Determination Theory |
| **Fairness** | Delay receipts split every visit into floor- and kitchen-owned steps; kitchen delays are never counted against servers | Attribution theory (Kelley), Equity theory (Adams), organisational justice (Colquitt) |
| **Feedback about the task, not the person** | "T4 is waiting on the bill", never "you're slow" | Feedback Intervention Theory (Kluger & DeNisi) |
| **No surveillance** | No individual rankings; personal stats physically never reach the manager's screen; managers see steps, stations and load | Electronic performance monitoring research |
| **Cooperative, not competitive** | No leaderboards (they lowered motivation in Hanus & Fox, 2015); late steps still earn a little XP; streak shields absorb a slip | Gamification research |
| **Inclusion** | Six languages, read-aloud, accessibility settings, simple words, pronouns, inclusive training, respectful AI wording | Universal design, diversity and inclusion |
| **Wellbeing and safety** | Training on self-care, harassment (POSH Act), support after hard guests; the manager coach puts staff safety before a guest's spend | Psychological safety (Edmondson) |
| **Learning without risk** | Rehearse tough moments privately before facing them for real | Deliberate practice, experiential learning |
| **Easy to adopt** | Sits on the existing POS, uses the restaurant's own SOPs, no new hardware, one section or one shift at a time | Diffusion of Innovations (Rogers) |

In short: it **helps** people do the job well, **protects** them from unfair blame, **rewards** them privately, **trains** them in their own language, and **never ranks or watches** them.

---

## 8. How each person uses it

### Servers

1. **Before service**: open your app (tap your name on Floor staff). Set your language and comfort settings once. Tap **Brief me** for your section.
2. **During service**: look at **Next up**. Do the top card; it closes itself or swipe it done. Swipe left for "Later". Use **What do I say?** for a delay or a dish that has run out. Tap a table on the floor plan for its full picture. Read kitchen notes in the **Kitchen** tab.
3. **When something's wrong**: a safety card means a dish clashes with a guest's allergy or diet; tell the kitchen in one tap. A "not happy" check-in opens recovery; you can call the manager.
4. **Between tables**: ask TableMate anything ("How do I explain this dish to a first-timer?").
5. **After service**: **Wrap up my shift** for your private debrief and coach tip; send kudos to a teammate.
6. **To get better**: practise a tough moment in **Practice**, compare with the ideal reply, earn XP.

### Kitchen

1. Keep the pass screen open. Filter by station if you like.
2. Tap **Ready** when a dish is up; servers are told.
3. Use **Tell the floor** for timings ("mains in 5 min", "grill is backed up").
4. Switch dishes off on the **86 board** when they run out; servers with that dish on order get a card straight away.
5. Watch **notes from the floor**: allergy notes are highlighted.

### Managers

1. **Pre-shift**: ask TableMate "Plan my pre-shift briefing" for a briefing built from tonight's floor. Check standards in **Demo & setup → Setup**.
2. **During service**: watch **Needs you now** (visit requests, safety clashes, late food, bills waiting, unhappy tables). Use **Live floor** to rebalance sections by load. Tap **Visited** after seeing a table.
3. **After service**: **Summarise** for the shift summary; **Where time goes** and **Kitchen stations** show bottlenecks by step and station; **delay receipts** show what happened in each visit. Fix the system, not the person.
4. **Coaching and leadership**: ask TableMate about feedback, conflict, harassment reports, fair rosters; practise hard conversations in **Practice**.

### Trainers and new starters

- Use **Practice** as a safe rehearsal room, in the trainee's own language, with **Simple words** on if helpful.
- Run the simulator with one server's autopilot off, so the trainee plays them on a phone through a full service without real guests.

---

## 9. Presenting the project

**Set-up (two minutes)**
1. Run `npm run dev` and open **Demo & setup**.
2. Click **Start a fresh demo** (showcase mode on, 10× speed, a busy service).
3. Under **Open the screens**, open Aisha's phone, the kitchen and the manager console; put them side by side or on other devices.

**A seven-minute story**
1. **The problem** (How it works page): one head, the pass, blame.
2. **The server's view**: Aisha's Next up cards closing themselves; the floor plan; tap a table.
3. **Stage "Allergy guest"**: the safety card on Aisha's phone, the flag on the kitchen ticket.
4. **Stage "Kitchen falls behind"**: the delay card, "What do I say?", and the manager's "Where time goes" attributing it to the kitchen, not Aisha.
5. **Stage "Unhappy table"**: recovery card; then "Guest asks for manager" appears in Needs you now.
6. **Ask TableMate**: "What dishes are Jain?" in Hindi; then Practice "Cold food" with a weak reply, then a strong one, showing the meter, score, ideal reply and XP.
7. **Employee-centric**: the Profile tab (private XP, streaks, wrap-up), and the manager console with no rankings.
8. **Reset** when done.

Leave showcase mode running during questions: the live feed narrates everything.

---

## 10. How to evaluate it (the study)

Run the same simulated rush in three conditions:

1. **No app** (paper / memory).
2. **A monitoring-style app**: rankings, everything visible to the manager.
3. **TableMate**.

Measure:

| Construct | Instrument |
|---|---|
| Cognitive load | NASA-TLX |
| Perceived electronic monitoring | Perceived EPM scale |
| Need satisfaction (autonomy, competence, relatedness) | BPNS-W |
| Justice perceptions | Colquitt's organisational justice scale |
| Service performance | SOP lapses per shift, exported from `GET /api/events/export` |
| Learning | Practice scores across sessions; self-rated confidence |

The simulator makes the rush identical across conditions, and the event log gives exact timings for every step.

---

## 11. Current limitations

Being honest about what is not done yet:

- **Single restaurant, no login.** Anyone on the same network can open any screen, including the manager console. Needs staff accounts, roles and per-restaurant data.
- **Simulated data.** The POS adapters are built, but Petpooja's dine-in (table, KOT, bill) events need partner access; other POS systems are planned stubs.
- **Rules-based task engine.** Priorities and standards are hand-designed; they don't yet learn from each restaurant.
- **Built-in trainer answers questions in English.** Without an AI connected, Ask answers from English notes (role-plays are in all six languages).
- **Rule-based practice scoring is approximate.** It matches key phrases and word stems; an AI model scores better, and the two are blended for local models.
- **Local AI quality depends on the computer.** Small models are slower and weaker in some languages.
- **Preferences live on the device.** Comfort settings don't follow a person between devices.
- **No offline mode yet.**
- **Not yet tested with real staff.** The study in section 10 is planned, not run.
- **Data protection.** Guest names, allergies and staff data would need consent, retention rules and compliance with India's Digital Personal Data Protection Act, 2023 in a real deployment.

---

## 12. Roadmap: more AI that could help

Ideas for taking TableMate further. Each keeps the same rules: AI for language, coaching and suggestions; rules for safety and fairness; nothing that ranks or watches people.

### For servers

| Idea | How it would work | Value | Effort |
|---|---|---|---|
| **Hands-free voice commands** | Speech-to-text on the phone: "Table 4 greeted", "T6 not happy"; intent matched to card actions | Hands stay on plates; faster in a rush | Medium |
| **Live guest translation** | Server speaks their language, the phone speaks the guest's (and back), with dish names kept | Serve tourists and guests with other languages | Medium |
| **Spoken practice** | Practice by voice: speech-to-text for replies, TTS for the guest; feedback on pace and clarity | Closer to the real moment | Medium |
| **Personalised micro-learning** | Track which rubric checks a person misses most; suggest a 2-minute practice and a training note; spaced repetition | Targets each person's real gaps | Low–medium |
| **Adaptive practice difficulty** | Patience starts lower and follow-ups get harder as scores rise | Keeps practice challenging | Low |
| **Generated scenarios** | AI writes new role-plays from real (anonymised) incidents and reviews, checked by a trainer | Fresh, relevant practice | Medium |
| **Menu knowledge quiz** | Flashcards and quizzes from the menu data (ingredients, allergens, pairings, pronunciation) | Faster onboarding | Low |
| **Regulars' preferences (with consent)** | Remember a regular's usual drink or seating; suggest on the greeting card | Warmer, personal service | Medium |
| **Ethical recommendations** | Suggest two dishes that fit the table's diet, allergies and pace, never pushing | Better guest experience | Low |
| **Smartwatch / haptic nudge** | Top card as a gentle buzz pattern on a watch | Less phone-checking | Medium |
| **Personalised ranking** | Learn each server's preferred sequencing from their "Later" choices | The app adapts to the person | Medium |

### For the kitchen

| Idea | How it would work | Value | Effort |
|---|---|---|---|
| **Fire-timing suggestions** | Predict when each table will finish a course; suggest when to fire the next | Courses arrive at the right time | Medium |
| **Prep forecasting** | Forecast covers and dish mix from bookings, weather and history | Less waste, fewer 86s | Medium–high |
| **Early 86 warning** | Predict a dish running out from stock and tonight's pace | Servers stop selling it in time | Medium |
| **Ticket-time models** | Learn prep time per dish, station and load across nights | More accurate ready times | Medium |

### For managers

| Idea | How it would work | Value | Effort |
|---|---|---|---|
| **Ask your data** | Natural-language questions over the event log ("Why were Friday's bills slow?"), answered with charts; about steps and stations, never people | Insight without dashboards | Medium |
| **Live section balancing** | Suggest which section the next party should go to, from load and forecast | Fewer overloaded servers | Low–medium |
| **Fair rostering** | Optimise rosters for cover and fairness (rotating weekends and festivals, preferences, rest) | Fairer schedules, less burnout | High |
| **Review mining** | Analyse Google and Zomato reviews for themes; map them to training notes and practice scenarios | Training targets real complaints | Medium |
| **SOP tuning** | Suggest standards that fit the restaurant from what happened (e.g. greeting at 2 min is rarely achievable at peak) | Realistic standards | Medium |
| **Anonymous team pulse** | Short weekly check-in (workload, safety, fairness); AI summarises themes, only in aggregate | Hear problems early | Low–medium |
| **Incident reports** | Guided reports for allergic reactions, accidents, harassment, with the right next steps | Safer, documented responses | Low |

### For guests

| Idea | How it would work | Value | Effort |
|---|---|---|---|
| **Allergen-aware digital menu** | QR menu filtered by the guest's allergies and diet, from the same ingredient data | Guests self-check; fewer errors | Low–medium |
| **Needs at booking** | Collect access, diet and occasion needs when booking; feed them to TableMate | Ready before the guest arrives | Low |
| **In-the-moment feedback** | A QR at the table for a one-tap reaction during the meal; unhappy goes straight to recovery | Fix problems before guests leave | Low |

### Wellbeing and fairness

| Idea | How it would work | Value | Effort |
|---|---|---|---|
| **Load-aware break nudges** | Suggest breaks when a server's load has been high for a long time | Fewer mistakes, less burnout | Low |
| **Safe reporting channel** | A private way to report harassment by guests or colleagues, routed to the Internal Committee | Psychological safety | Medium |
| **Fairness audit** | Regularly check that task load, sections and tips are spread fairly across staff groups | Catch hidden bias | Medium |

### Making the AI trustworthy

- **Evaluate practice scoring**: compare AI and rubric scores with experienced trainers on the same replies; report agreement (e.g. Cohen's kappa).
- **Test every language** with native speakers for tone and accuracy.
- **Red-team** the assistant: unsafe allergy answers, stereotypes, manipulation.
- **Log and review** AI answers (with consent) to improve training notes.

---

## 13. Checklist to complete the project

### Must (for the project submission)

- [ ] Run the evaluation study (section 10) with real servers, even a small pilot (5–10 people)
- [ ] Collect feedback from a restaurant manager and kitchen staff on the screens
- [ ] Have native speakers review the Hindi, Nepali, Bengali, Tamil and Spanish text
- [ ] Rehearse the presentation with Demo & setup (section 9)
- [ ] Write up results: workload, fairness, motivation, lapses, practice scores
- [ ] Add the ethics note: consent, data use, no surveillance, DPDP Act

### Should (to make it real)

- [ ] Staff login and roles (server, kitchen, manager), so the manager console isn't open to everyone
- [ ] Multi-restaurant support
- [ ] One real POS integration end to end (Petpooja partner access, or a generic POS via middleware)
- [ ] An SOP editor for custom rules beyond the built-in ones
- [ ] A menu editor (dishes, stations, prep times, ingredient tags)
- [ ] Preferences that follow the person between devices
- [ ] Offline mode and install as an app (PWA)
- [ ] Practice history: progress over weeks for the person (private)

### Could (from the roadmap)

- [ ] Hands-free voice commands
- [ ] Live guest translation
- [ ] Spoken practice
- [ ] Personalised micro-learning from practice gaps
- [ ] Manager "ask your data"
- [ ] Allergen-aware guest menu
- [ ] Anonymous team pulse

---

## 14. Running it

```bash
npm install
npm run dev      # app on http://localhost:5173, API on :4000
npm test         # all tests
```

- **Free AI**: install Ollama, run `ollama pull gemma3:4b`. See `docs/ollama-setup.md`.
- **Best AI**: put `ANTHROPIC_API_KEY=...` in `.env`.
- **Present**: open **Demo & setup** → **Start a fresh demo**.
- **Step by step for beginners**: `docs/getting-started.md`.

| Where | What |
|---|---|
| `shared/` | Engine, events, safety, game, practice, training notes, narration, tests |
| `server/` | API, live updates, event log, simulator, POS adapters, AI providers |
| `src/` | The app: server, kitchen, manager, demo & setup, how it works |
| `docs/` | Getting started, Ollama, Dify, this guide |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **SOP** | Standard operating procedure: the restaurant's service standards, e.g. "greet within 2 minutes" |
| **POS** | Point of sale: the restaurant's ordering and billing system (e.g. Petpooja) |
| **KOT** | Kitchen order ticket: an order sent to the kitchen |
| **The pass** | Where finished dishes wait for servers to take them to the table |
| **86 / 86'd** | A dish that has run out for the night |
| **Covers** | The number of guests served |
| **Check-back** | Checking with a table a few minutes after food arrives |
| **Comp** | A dish or drink given free, usually to make up for a problem |
| **Section** | The group of tables one server looks after |
| **LAST** | Listen, Apologise, Solve, Thank: a complaint-handling method |
| **POSH Act** | India's Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 |
| **DPDP Act** | India's Digital Personal Data Protection Act, 2023 |
| **XP** | Experience points earned for good actions and practice |
