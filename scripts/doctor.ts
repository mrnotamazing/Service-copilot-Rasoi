// `npm run doctor`: checks why the AI isn't connecting, in plain words. Reads .env the same way the
// app does, shows which keys it found (never the key itself), and asks Gemini a one-word question.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => console.log(`  ✗ ${s}`)
const tip = (s: string) => console.log(`    → ${s}`)
const mask = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} characters)` : `${k.length} characters`)

console.log('\nTableMate AI check\n')

const [major, minor] = process.versions.node.split('.').map(Number)
if (major > 22 || (major === 22 && minor >= 9) || major >= 23) ok(`Node ${process.versions.node}`)
else {
  bad(`Node ${process.versions.node} is too old to read the .env file`)
  tip('Install Node 22 or newer from nodejs.org, then run npm run dev again.')
}

if (existsSync(join(root, 'server/gemini.ts'))) ok('This copy of TableMate has the Gemini connection')
else {
  bad('This copy is out of date: it has no Gemini connection yet')
  tip('Run: git pull origin claude/jolly-goldberg-ptlwfe && npm install')
}

const envPath = join(root, '.env')
if (!existsSync(envPath)) {
  bad(`No .env file in ${root}`)
  tip(`Run: echo 'GEMINI_API_KEY=your-key' >> "${envPath}"`)
} else {
  ok(`.env found in ${root}`)
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const l of lines) {
    if (/^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s+=|=\s+\S/.test(l) && /GEMINI|GOOGLE/.test(l)) {
      bad('The Gemini line has spaces around "="')
      tip('Write it as GEMINI_API_KEY=AIza... with no spaces or quotes.')
    }
    if (/^\s*export\s/.test(l)) tip(`Remove "export " from: ${l.split('=')[0]}`)
  }
}

const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
const claude = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
if (claude) {
  bad('ANTHROPIC_API_KEY is also set, so Claude is used instead of Gemini')
  tip('To use Gemini, delete the value after ANTHROPIC_API_KEY= in .env (leave the line empty).')
}
if (!gemini) {
  bad('GEMINI_API_KEY is not set (the app can’t see it)')
  tip('Add a line GEMINI_API_KEY=your-key to .env, save it, then run npm run doctor again.')
} else {
  const key = gemini.trim().replace(/^["']|["']$/g, '')
  ok(`GEMINI_API_KEY found: ${mask(key)}`)
  if (!key.startsWith('AIza')) tip('Gemini keys from AI Studio usually start with "AIza". Check you copied the whole key.')
  try {
    const base = 'https://generativelanguage.googleapis.com/v1beta'
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ready' }] }], generationConfig: { maxOutputTokens: 20 } }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json()) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] }
    if (res.ok) ok(`Gemini answered (${model}): "${data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()}"`)
    else {
      bad(`Gemini said no (${res.status}): ${data.error?.message ?? 'unknown error'}`)
      if (res.status === 400) tip('The key looks wrong. Create a new one at aistudio.google.com → Get API key.')
      if (res.status === 403) tip('This key can’t use the Gemini API. Create the key in AI Studio (not Google Cloud Console).')
      if (res.status === 404) tip('That model name isn’t available to your key. Remove GEMINI_MODEL from .env.')
      if (res.status === 429) tip('The free limit is used up for now. Wait a minute and try again.')
    }
  } catch (e) {
    bad(`Couldn’t reach Gemini: ${e instanceof Error ? e.message : String(e)}`)
    tip('Check the internet connection (and any VPN or office firewall).')
  }
}

console.log('\nWhen everything above has a ✓, restart the app: press Ctrl+C, then npm run dev.')
console.log('The terminal should say: AI: Google Gemini (…)\n')
