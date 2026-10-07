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
