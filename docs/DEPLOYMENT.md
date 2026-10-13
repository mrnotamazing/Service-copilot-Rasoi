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

## AI models: always one that answers

The server keeps a line-up of every AI model it has a key for and asks them best first. If one is rate limited, offline or gives an unusable answer (empty, or repeating its instructions), the next answers at once, and the one that failed rests for 30 seconds, then 2 minutes, then 10 while it keeps failing. The built-in trainer is always the last resort.

Default order: Claude, Gemini, free cloud AI (Groq, Cerebras or OpenRouter), Ollama (local). Change it with `AI_PRIORITY=cloud,gemini,ollama,claude`; use only the local model with `AI_PROVIDER=ollama`.

Every model gets the same knowledge: the restaurant's standards, menu with ingredient tags, training notes, the app's own rules (suggestions not orders, safety check, fair delays, private stats, no rankings) and the practice rubric.

Run `npm run eval:ai` (optionally `npm run eval:ai gemini`) to test each model on the same 20 checks (safety, fairness, languages, scoring, product knowledge, clean formatting). It prints a report and writes `data/ai-ranking.json`; a model that scores clearly better is asked first from then on. `GET /api/health` shows the line-up and how each model is doing.

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
