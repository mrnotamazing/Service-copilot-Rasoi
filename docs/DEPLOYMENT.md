# Deploying TableMate

TableMate is one Node process: the API, the live WebSocket and the built web app, on one port (4000).

## Run it

```bash
docker compose up -d --build        # http://localhost:4000
# or without Docker
npm ci && npm run build && npm start
```

Put it behind HTTPS (Caddy, nginx or your host's load balancer). Check `GET /api/health`.
Data (events and setup) is kept in `data/`; mount it as a volume so it survives restarts.

## Settings (`.env`, see `.env.example`)

| Setting | What it does |
| --- | --- |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Live AI for the assistant, practice, briefings. Without one the built-in trainer answers (practice shows a notice). |
| `ELEVENLABS_API_KEY` | Natural read-aloud voice. Without it, the device's own voice reads. `ELEVENLABS_VOICE_ID` changes the voice. |
| `COPILOT_INGEST_KEY` | Required `x-copilot-key` header on POS webhooks. Set it in production. |
| `COPILOT_PORT` | Port (default 4000). |

Keys live only on the server. The browser asks `/api/tts` and `/api/ai`; it never sees a key.
Voice requests are capped at 600 characters, 30 a minute per caller, and repeated text is served from a cache.

## Hosting with every feature working

| Feature | What it needs | Works on |
| --- | --- | --- |
| Live floor (real-time cards, kitchen relay, manager) | A server that keeps connections open and saves data | Railway, Render, Fly.io, a VPS, Google Cloud Run, Azure Container Apps (use the Dockerfile) |
| Cloud AI (Groq, Gemini, Claude) | Keys in the server's environment | Same server; keys never reach the browser |
| Natural voice (ElevenLabs) | `ELEVENLABS_API_KEY` on the server | Same server |
| Local AI (Ollama) | A machine running Ollama next to the server | A VPS or an on-site mini PC; not Vercel, not most small PaaS plans |
| Sign-in, game, practice | Nothing extra | Anywhere |
| Vibration | HTTPS page opened on an Android phone (Chrome); iPhone gets a tap on touch only; iPads have no motor | Any host with HTTPS |
| Install on the home screen | HTTPS and the included manifest | Any host with HTTPS |

Recommended: **one container on Railway or Render** (the Dockerfile builds the app and the server together, one URL, HTTPS included, a small volume for `data/`). Add `GROQ_API_KEY` (or Gemini/Claude) and, if you want it, `ELEVENLABS_API_KEY`. Everything works from that one address, including the live connection.

Vercel: good for the front-end only. Put the front-end on Vercel and the server on Railway, and proxy `/api` to the server with a rewrite in `vercel.json`. Vercel cannot proxy the live connection (WebSocket), so use the server's own address for that, or host everything on the server and skip Vercel. The self-contained demo build (`npm run build:demo`) runs on Vercel or any static host, with simulated data and the built-in answers.

For real vibration on iPhone (including alerts that arrive on their own) and push notifications, wrap the app with Capacitor (Haptics and Push plugins) and publish it through TestFlight or the App Store.

## Kitchen priorities and alerts

Setup → **Kitchen priorities** is filled in when a restaurant is onboarded (like each dish's allergens) and can be changed any time: how much an allergy or diet clash, a dish past or close to its standard time, a VIP, an occasion, a big party and the course matter (0–10 each), when a dish counts as "approaching" (default 80% of its standard time) and how often the pass is reminded while a ticket stays late (default 2 minutes).

- The pass sorts tickets by these, shows the reasons on each card ("3 min over standard · nuts allergy · VIP"), and marks the first one "Do first".
- It is alerted (chime, screen flash, buzz, as each person chose in Settings) when a dish nears its time, again when it goes late, and again every few minutes while it stays late.
- **Chef's call** asks the AI for a short read of what to send first, weighing the tickets with the restaurant's own priorities. The order never depends on the AI; if it is busy a plain-words summary is shown.
- A task a server puts off ("later") comes back with a notice, "Back from later", and a higher priority each time it returns, so it doesn't sink below newer jobs.

## Sign-in (demo)

`/login`: choose Server (then who), Kitchen or Manager and enter the shared demo password (set in `src/lib/auth.ts`, `DEMO_PASSWORD`). Each person only opens their own screen: servers their own app, the kitchen the pass, the manager the floor and the servers overview. Sessions are per browser tab, so closing the tab signs out, and one laptop can show several roles in several tabs. "Wrap up my shift" ends in "Finish my shift and sign out". This is a presentation gate, not security: before a real roll-out, check passwords on the server with one account per person.

## AI models: always one that answers

The server keeps a line-up of every AI model it has a key for and asks them best first. If one is rate limited, offline or gives an unusable answer (empty, or repeating its instructions), the next answers at once, and the one that failed rests for 30 seconds, then 2 minutes, then 10 while it keeps failing. The built-in trainer is always the last resort.

Every model in the line-up (Claude, Gemini, each free cloud service you add keys for such as Groq, Cerebras or OpenRouter, and Ollama) gets the same knowledge, the same instructions and the same settings for the same kind of job (`server/tasks.ts`): a steady temperature of 0.3 for judging a practice reply, 0.4 for summaries, 0.5 for everyday answers; the same answer-length caps; the same output format.

**The order depends on the job.** Quick everyday answers (a guest line, a tip, a short question) go to the fast, good model first. Careful jobs (scoring a practice reply, a debrief) lean towards the strongest model. Each model's rank is its quality minus a penalty for slowness: a second of waiting costs a quick job 6 points, a standard job 3 and a careful job 1. Quality comes from `npm run eval:ai`, or a sensible starting guess until you run it; speed is measured while the app runs, so a model having a slow day moves down by itself. Pin an order yourself with `AI_PRIORITY=openrouter,gemini,groq`. The built-in trainer is always the last resort, and a failing model rests for 30 seconds, then 2 minutes, then 10.

Run `npm run eval:ai` (optionally `npm run eval:ai gemini`, `npm run eval:ai openrouter`) to test each model on the same 20 checks (safety, fairness, languages, scoring, product knowledge, clean formatting). It prints a report and writes `data/ai-ranking.json`; a model that scores clearly better is asked first from then on. `GET /api/health` shows the line-up and how each model is doing.

## Before you roll out

- `npm run typecheck && npm test && npm run build` (CI runs these, plus `npm audit` on production dependencies).
- Set `COPILOT_INGEST_KEY`, and rotate any key that has been pasted into chat or email.
- Responses carry `nosniff`, `SAMEORIGIN` framing and a strict referrer policy; hashed assets are cached for a year, the page itself is never cached.

## The promo film

`npm run dev`, then in another terminal:

```bash
node scripts/film/render.mjs            # frames into film-cache/frames (needs Chromium: CHROMIUM_PATH=...)
ELEVENLABS_API_KEY=... node scripts/film/voiceover.mjs
```

The script in `scripts/film/narration.json` is the narration and the sound effects; a test keeps it in step with the scenes. Generated audio is cached in `film-cache/`, so re-mixing never pays for the same clip twice.
