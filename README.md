# Service Copilot

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
| `/server/:staffId` | Each server (phone) | Top 3 cards, my tables, two-way kitchen notes, private shift stats |
| `/kitchen` | Pass / expo screen | Open tickets with timers, Ready button, 86 board, notes to/from floor |
| `/manager` | Floor manager | Load per section, bottlenecks by stage and station, delay receipts, suggestions. **No individual rankings.** |
| `/setup` | Manager | SOP standards, POS integrations, service simulator |

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

## Run it

```bash
cd service-copilot
npm install
npm run dev      # API on :4000, web app on :5173 (open on phones via your LAN IP)
npm test         # engine tests
```

Production: `npm run build && npm start` serves the app and API on port 4000.

Then open **Setup → Start service**. Use the speed slider to compress an evening.
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
