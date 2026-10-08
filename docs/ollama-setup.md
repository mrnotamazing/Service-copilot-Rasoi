# Free AI with Ollama

Ollama runs an AI model on your own computer. It's free, needs no account or key, and nothing you
type leaves the computer. TableMate finds it automatically.

You need a computer with at least 8 GB of memory (16 GB is better) and about 4 GB of free disk space.

## 1. Install Ollama

1. Go to **https://ollama.com** and click **Download**. Choose your system (macOS, Windows or Linux).
2. Open the downloaded file and install it like any app (on a Mac: drag Ollama to Applications).
3. Open **Ollama**. On a Mac a small llama icon appears in the menu bar at the top of the screen.
   Keep it running while you use TableMate.

## 2. Download a model (once)

Open **Terminal** (Mac: press Cmd+Space, type Terminal, press Enter; Windows: open PowerShell) and run:

```
ollama pull gemma3:4b
```

This downloads about 3 GB. Wait until it says `success`.

Which model?

| Model | Download | Good for |
|---|---|---|
| `gemma3:4b` | 3.3 GB | **Recommended.** Good answers in English, Hindi, Bengali, Tamil, Nepali and Spanish. |
| `gemma3:12b` | 8 GB | Better answers, needs 16 GB of memory and is slower. |
| `gemma3:1b` | 0.8 GB | Only for very old computers. Often gets facts wrong; not recommended. |

## 3. Start TableMate

In the project folder:

```
npm run dev
```

Look for this line:

```
Service Copilot API on http://localhost:4000 · AI: Ollama (gemma3:4b, free and local)
```

If you started TableMate before Ollama, that's fine: it checks every few seconds and switches on its own.

## 4. Use it

1. Open **http://localhost:5173** and press Cmd+Shift+R (Windows: Ctrl+Shift+R).
2. **Setup** → the AI card says **Local AI connected**.
3. **Floor staff** → a server → the **sparkle button**. The chat badge says **Local AI (Ollama)**.
   Ask anything, in any of the app's languages.

The first answer can take up to a minute while the model loads into memory; after that answers take a few seconds.

## Speed

A local model runs on your computer's own chip, so it's slower than a cloud AI. TableMate does a
few things to keep it quick:

- **Answers appear as they're written**, word by word, instead of all at once at the end.
- **A compact prompt**: the model gets only the training notes that matter for your question
  (about 1,300 tokens instead of 4,300), so it starts answering several times sooner.
- **The model is loaded as soon as TableMate finds it**, so your first question doesn't wait for it.
- **Role-plays open instantly**: the guest's first line is already written in every language.
- **Short answers and no reloads**: answer length is capped, and the model keeps one small working-memory size, so it never has to reload between questions.

To make it faster still:

| Try | Why |
|---|---|
| Keep the Ollama app open and your Mac plugged in | The model stays loaded; Macs slow down on battery saver. |
| Close heavy apps (lots of browser tabs, video calls) | The model needs about 3–4 GB of free memory. |
| A smaller model: `ollama pull qwen2.5:3b` or `ollama pull llama3.2:3b`, then set `OLLAMA_MODEL=qwen2.5:3b` in `.env` | A little faster than `gemma3:4b`, but weaker in Hindi, Tamil, Bengali and Nepali. |
| Turn on flash attention: in Terminal run `launchctl setenv OLLAMA_FLASH_ATTENTION 1`, then quit and reopen Ollama | Uses less memory for long prompts on Apple silicon. |
| For the fastest answers, use Claude instead (`ANTHROPIC_API_KEY` in `.env`) | Cloud answers start in a second or two, in every language. Paid. |

Avoid `gemma3:1b` unless your computer is very old: it's fast but often gets facts wrong.

## What TableMate does to keep a local model safe

- Whenever a question names a dish, the answer ends with **From the menu:** and the dish's real
  ingredients from your menu, so a wrong guess about allergies or diets is caught.
- In practice role-plays, if the model skips the coaching, the built-in coaching appears instead.
- If Ollama is closed, the built-in trainer answers and says so.

## Troubleshooting

| What you see | What to do |
|---|---|
| `AI: built-in (start Ollama ...)` | Open the Ollama app, wait a few seconds. |
| `Ollama is running but has no model` | Run `ollama pull gemma3:4b`. |
| `command not found: ollama` | Reopen Terminal after installing, or reinstall from ollama.com. |
| Answers are very slow | Close other apps, or try a smaller model. |
| You also set `ANTHROPIC_API_KEY` | Claude is used instead of Ollama. Remove the key from `.env` to use Ollama. |

Optional settings go in `.env` (see `.env.example`): `OLLAMA_MODEL` picks a specific model,
`OLLAMA_HOST` points to Ollama on another computer, `OLLAMA=off` turns it off.
