// `npm run doctor`: checks why the AI isn't connecting, in plain words. Reads .env the same way the
// app does, shows which keys it found (never the key itself), and asks Gemini a one-word question
// through the app's own Gemini connection, so it picks (and reports) the model the app will use.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => console.log(`  ✗ ${s}`)
const tip = (s: string) => console.log(`    → ${s}`)
const mask = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} characters)` : `${k.length} characters`)

console.log('\nTableMate AI check\n')

const [major, minor] = process.versions.node.split('.').map(Number)
if (major > 22 || (major === 22 && minor >= 9)) ok(`Node ${process.versions.node}`)
else {
  bad(`Node ${process.versions.node} is too old to read the .env file`)
  tip('Install Node 22 or newer from nodejs.org, then run npm run dev again.')
}

const hasGemini = existsSync(join(root, 'server/gemini.ts'))
if (hasGemini) ok('This copy of TableMate has the Gemini connection')
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
  for (const l of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (/^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)\s+=|^\s*(GEMINI_API_KEY|GOOGLE_API_KEY)=\s/.test(l)) {
      bad('The Gemini line has spaces around "="')
      tip('Write it as GEMINI_API_KEY=your-key with no spaces or quotes.')
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
} else if (hasGemini) {
  const key = gemini.trim().replace(/^["']|["']$/g, '')
  ok(`GEMINI_API_KEY found: ${mask(key)}`)
  if (key.length < 30) tip('That key looks short. Check you copied the whole key from AI Studio.')
  const { createGemini, geminiErrorReason } = await import('../server/gemini.ts')
  const g = createGemini({ key, model: process.env.GEMINI_MODEL })
  const model = await g.resolveModel()
  try {
    const reply = await g.model.reply({ stable: 'Answer in one word.', live: '' }, [{ role: 'user', text: 'Reply with the single word: ready' }], undefined, { maxTokens: 20 })
    ok(`Gemini answered using ${g.model.label?.() ?? model}: "${reply}"`)
    if (process.env.GEMINI_MODEL && g.model.label?.() !== process.env.GEMINI_MODEL) tip(`GEMINI_MODEL=${process.env.GEMINI_MODEL} is retired; remove that line from .env.`)

    // A practice turn, judged the way the app does it: a poor reply should score low with a reason.
    const { createAi } = await import('../server/ai.ts')
    const { Hub, memoryStore } = await import('../server/hub.ts')
    const ai = createAi(new Hub(memoryStore()), { chat: g.model, chatErrorReason: geminiErrorReason })
    const turn = await ai.ask({ kind: 'chat', mode: 'practice', staffId: 's_aisha', scenario: 'cold_food', messages: [{ role: 'assistant', text: 'Excuse me. My lamb is lukewarm, and we waited forty minutes for it.' }, { role: 'user', text: 'the chef died sorry' }] })
    if (turn.source === 'gemini' && turn.score !== undefined) {
      ok(`Practice is judged by Gemini: "the chef died sorry" scored ${turn.score}/100`)
      tip(`Coach: ${turn.feedback ?? '–'}`)
      tip(`Guest: ${turn.text}`)
    } else {
      bad(`Practice fell back to the built-in checklist${turn.notice ? `: ${turn.notice}` : ''}`)
      tip('Send this output to whoever is helping you; the app log shows the model’s raw reply.')
    }
  } catch (e) {
    bad(`Gemini said no (model ${g.model.label?.() ?? model}): ${e instanceof Error ? e.message : String(e)}`)
    tip(geminiErrorReason(e))
    const status = (e as { status?: number }).status
    if (status === 404) tip('Remove any GEMINI_MODEL line from .env, or set GEMINI_MODEL to the model named above.')
  }
}

console.log('\nWhen everything above has a ✓, restart the app: press Ctrl+C, then npm run dev.')
console.log('The terminal should say: AI: Google Gemini (…)\n')
