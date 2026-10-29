// Renders the film frame by frame (deterministic, independent of machine speed).
//   npm run dev  (in another terminal), then: node scripts/film/render.mjs [frames-dir] [base-url]
import { chromium } from 'playwright-core'
import { mkdirSync, rmSync } from 'node:fs'
const dir = process.argv[2] ?? 'film-cache/frames'
const BASE = process.argv[3] ?? 'http://localhost:5173'
const FPS = 24
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const pg = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
const errs = []; pg.on('pageerror', (e) => errs.push(String(e)))
await pg.goto(`${BASE}/intro?bare=1&play=0`, { waitUntil: 'load' })
await pg.waitForFunction(() => window.__tm, null, { timeout: 60000 })
await pg.evaluate(() => document.fonts.ready)
const scenes = await pg.evaluate(() => window.__tm.scenes)
const raf2 = () => pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const seek = async (a, b) => {
  for (let k = 0; k < 4; k++) {
    try { await pg.evaluate(([x, y]) => window.__tm.seek(x, y), [a, b]); return } catch {
      await pg.goto(`${BASE}/intro?bare=1&play=0`, { waitUntil: 'load' })
      await pg.waitForFunction(() => window.__tm, null, { timeout: 60000 })
      await pg.evaluate(() => document.fonts.ready)
      await pg.waitForTimeout(500)
    }
  }
  throw new Error('seek failed')
}
let n = 0
const t0 = Date.now()
for (let s = 0; s < scenes.length; s++) {
  await seek(s, 0)
  await pg.waitForTimeout(700) // the scene change finishes its crossfade
  const frames = Math.floor((scenes[s] / 1000) * FPS)
  for (let f = 0; f < frames; f++) {
    await seek(s, (f * 1000) / FPS)
    await raf2()
    await pg.screenshot({ path: `${dir}/f${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 95 })
  }
  console.log('scene', s + 1, 'done', n, 'frames', Math.round((Date.now() - t0) / 1000) + 's')
}
console.log('frames', n, errs.slice(0, 3)); await b.close()
