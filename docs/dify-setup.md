# Connecting Dify (AI assistance)

The copilot works without AI: it has a built-in writer. Connecting Dify makes four features AI-written:

| Where | Button | What the AI writes |
|---|---|---|
| Server phone, on guest-facing cards (greet, kitchen delay, dish unavailable, goodbye) | **What do I say?** | One or two gracious sentences the server can say at the table |
| Server phone → Briefing tab | **Brief me** | A short rundown of the section: allergies, regulars, occasions, kitchen delays |
| Server phone → Ask tab | **Ask** | Answers about service standards, from your SOP manual |
| Manager → Shift summary | **Summarise** | The night's bottlenecks in plain English, with next-service actions |

The copilot gathers the facts (tables, timings, allergies) and sends them to Dify. Dify phrases the answer. If Dify is down or slow, the copilot shows the built-in answer and says so.

## 1. Get Dify running

Pick one:

- **Dify Cloud (easiest):** sign up at https://cloud.dify.ai. Your API address is `https://api.dify.ai/v1`.
- **On your own computer:** install Docker Desktop, then:
  ```bash
  git clone https://github.com/langgenius/dify.git
  cd dify/docker
  cp .env.example .env
  docker compose up -d
  ```
  Open http://localhost/install and create the admin account. Your API address is `http://localhost/v1`.

## 2. Add a model

In Dify: your avatar (top right) → **Settings** → **Model Provider**. Install a provider (for example Anthropic or OpenAI) and paste its API key.

## 3. Create the copilot app

1. **Studio** → **Create from Blank** → **Chatbot**. Name it `Rasoi Copilot`.
2. In **Instructions** (the system prompt), paste:

   ```
   You are the assistant inside Rasoi Copilot, a tool used by front-of-house staff in a fine-dining restaurant during service.

   Each message gives you a task and a list of facts. Follow the task exactly and use only the facts given (plus the restaurant's SOP manual if one is attached as knowledge). Never invent dishes, names, times or policies.

   Style: warm, gracious, concise, natural spoken English suitable for a fine-dining guest. No emojis, no lists unless the task asks for bullet points.

   Never blame the kitchen, colleagues or the guest. Never judge or rank individual staff members.
   ```
3. Optional, for the **Ask** tab: under **Knowledge**, add your restaurant's SOP manual (PDF or Word). Dify will answer service questions from it.
4. Click **Publish**.
5. Open **API Access** (left sidebar) → **API Key** → **Create new secret key**. Copy it (it starts with `app-`).

## 4. Point the copilot at Dify

In the copilot folder:

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in:

```
DIFY_API_URL=https://api.dify.ai/v1        # or http://localhost/v1 for your own Dify
DIFY_API_KEY=app-xxxxxxxxxxxxxxxx
```

Restart the copilot (`Ctrl+C`, then `npm run dev`). The terminal prints `AI: Dify at …`, and **Demo & setup → Setup → AI assistance** shows **Dify connected**.

## How the copilot calls Dify

`POST {DIFY_API_URL}/chat-messages` with `response_mode: "blocking"`, the facts in `query`, `inputs.kind` set to one of `guest_script`, `briefing`, `shift_summary` or `ask_sop`, and the staff member's id as `user`. The answer text comes back in `answer`. See `server/ai.ts`.
