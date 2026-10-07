# Getting started from scratch

This guide assumes nothing is installed. It takes about 15 minutes.

## 1. Install the tools (one time)

1. **Node.js:** download the **LTS** version from https://nodejs.org and install it with the default options.
2. **Git:** download from https://git-scm.com/downloads and install with the default options.
3. Open a terminal:
   - **Windows:** press Start, type `PowerShell`, open it.
   - **Mac:** press `Cmd + Space`, type `Terminal`, open it.
4. Check both are installed. Type these and press Enter after each; each should print a version number:
   ```bash
   node -v
   git --version
   ```

## 2. Download the app

In the same terminal:

```bash
cd Desktop
git clone https://github.com/mrnotamazing/Service-copilot-Rasoi.git
cd Service-copilot-Rasoi
```

GitHub may ask you to sign in because the repository is private. Follow the prompt.

The app is now in a folder called **Service-copilot-Rasoi** on your Desktop.

## 3. Install and start it

```bash
npm install
npm run dev
```

`npm install` takes a minute the first time. When `npm run dev` is ready you’ll see lines like:

```
[api] Service Copilot API on http://localhost:4000 · AI: built-in …
[web]   ➜  Local:   http://localhost:5173/
[web]   ➜  Network: http://192.168.1.23:5173/
```

Leave this terminal open; closing it stops the app.

## 4. Use it

1. Open **http://localhost:5173** in Chrome.
2. Click **Setup** → **Start service**, and set **Speed** to about 10×.
3. Open **Manager** to watch the floor, or pick **Aisha / Rohan / Meera** to see a server’s phone screen.
4. To play a server yourself, switch off their **autopilot** and tap the cards as they come up. Try **What do I say?** on a greeting or delay card, and **Brief me** in the Briefing tab.

**On your phone:** connect it to the same wifi as your laptop and open the `Network` address the terminal printed (for example `http://192.168.1.23:5173`). Everyone in your group can play a different server at the same time.

## 5. Connect AI through Dify (optional)

Follow [dify-setup.md](./dify-setup.md). Without Dify, the AI buttons still work using the built-in writer.

## Stopping and restarting

- Stop: click the terminal and press `Ctrl + C`.
- Start again later: open a terminal and run
  ```bash
  cd Desktop/Service-copilot-Rasoi
  npm run dev
  ```
- Get the latest changes: `git pull`, then `npm install`, then `npm run dev`.

## If something goes wrong

| You see | Do this |
|---|---|
| `node: command not found` / `'node' is not recognized` | Install Node.js (step 1), then close and reopen the terminal |
| `EADDRINUSE … 4000` or `5173` | The app is already running in another terminal. Close that one, or restart your computer |
| The page says “Connecting to service…” forever | The `api` part isn’t running. Check the terminal for a red error and send it to Claude |
| Phone can’t open the Network address | Phone and laptop must be on the same wifi; some college/office networks block this, so try a phone hotspot |
