# Google Gemini setup (free, fast)

Gemini runs in Google's cloud, so answers are quick on any laptop, in all six app languages. An
AI Studio key has a free tier that is plenty for a class demo and a small pilot.

## Steps (about 3 minutes)

1. Go to **https://aistudio.google.com** and sign in with a Google account.
2. Click **Get API key**, then **Create API key**. Copy it.
3. In the project folder, make your settings file (skip if you already have a `.env`):
   ```bash
   cp .env.example .env
   ```
4. Open `.env` and paste the key after `GEMINI_API_KEY=`:
   ```
   GEMINI_API_KEY=AIza...your key...
   ```
   Leave `ANTHROPIC_API_KEY` empty, or Claude is used instead.
5. Restart the app (`Ctrl+C`, then `npm run dev`). The terminal says
   `AI: Google Gemini (gemini-…-flash)`, and Demo & setup → Setup shows **Gemini connected**.

With a Gemini key set, Ollama is not used, so you can close the Ollama app.

## Does it need training?

No. Every question is sent with the restaurant's service standards, tonight's menu (with what each
dish contains, its spice level and kitchen notes), the 50 training lessons, and the asker's live
tables. That part is identical each time, so Gemini caches it and answers quickly. Edit the menu or
standards in TableMate and the next answer uses the new version.

## Which model

TableMate picks the newest **Gemini Flash** model your key can use (fast and capable). To choose one
yourself, set `GEMINI_MODEL`, e.g. `GEMINI_MODEL=gemini-2.5-flash`.

## If something goes wrong

The answer still appears (from the built-in trainer) with a short note saying why:

| Note | What to do |
|---|---|
| The Gemini API key was rejected | Copy the key again from AI Studio; no spaces or quotes in `.env`. |
| Gemini's free limit is used up for now | Wait a minute (per-minute limit) or until tomorrow (daily limit). |
| Couldn't reach Gemini | Check the internet connection. |

## Privacy

Questions and the restaurant context are sent to Google. On the free tier Google may use them to
improve its products, so don't type guests' personal details into the chat. For a real restaurant,
use a paid key (not used for training) or Ollama (nothing leaves the computer).
