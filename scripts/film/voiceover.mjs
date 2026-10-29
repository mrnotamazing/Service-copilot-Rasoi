// Builds the film's sound: the narration (ElevenLabs voice), sound effects (ElevenLabs sound
// generation) and a soft music bed, mixed with ffmpeg and laid over the rendered frames.
//
//   ELEVENLABS_API_KEY=... node scripts/film/voiceover.mjs [frames-dir | existing-video.mp4] [out.mp4]
// Give it an existing video (e.g. TableMate-promo-HD-v3.mp4) to replace its sound and keep its picture.
//
// Every clip the service generates is saved in film-cache/ and reused on later runs, so editing the
// mix or the picture never pays for the same audio twice. Nothing here is retried automatically:
// a failed request stops the run with the service's message, and re-running continues from the cache.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cache = join(here, '../../film-cache')
const key = process.env.ELEVENLABS_API_KEY
const [framesDir = join(cache, 'frames'), out = join(cache, 'TableMate-promo.mp4')] = process.argv.slice(2)
const FPS = 24
if (!key) {
  console.error('Set ELEVENLABS_API_KEY first (elevenlabs.io → Developers → API keys).')
  process.exit(1)
}
mkdirSync(cache, { recursive: true })
const plan = JSON.parse(readFileSync(join(here, 'narration.json'), 'utf8'))

async function generate(file, url, body) {
  if (existsSync(file)) return file
  const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`ElevenLabs said ${r.status}: ${(await r.text()).slice(0, 300)}`)
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  console.log('made', file)
  return file
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr.slice(-600)}`)
  return r.stdout.trim()
}
const seconds = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))

// 1. Narration and effects, one clip per scene.
let start = 0
const inputs = []
const filters = []
let n = 0
const place = (file, at, gain, label) => {
  inputs.push('-i', file)
  filters.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${gain},adelay=${Math.round(at)}|${Math.round(at)}[${label}${n}]`)
  return `[${label}${n++}]`
}
const voices = []
const fx = []
for (const s of plan.scenes) {
  const v = await generate(join(cache, `say-${s.id}.mp3`), `https://api.elevenlabs.io/v1/text-to-speech/${plan.voice}?output_format=mp3_44100_128`, { text: s.say, model_id: plan.model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } })
  const len = seconds(v) * 1000
  if (len > s.ms - 400) console.warn(`! "${s.id}" runs ${Math.round(len)} ms in a ${s.ms} ms scene: shorten the line or lengthen the scene`)
  voices.push(place(v, start + 400, 1.0, 'v'))
  if (s.sfx) {
    const f = await generate(join(cache, `sfx-${s.id}.mp3`), 'https://api.elevenlabs.io/v1/sound-generation', { text: s.sfx.text, duration_seconds: s.sfx.seconds, prompt_influence: 0.5 })
    fx.push(place(f, start + s.sfx.at, s.sfx.gain, 'x'))
  }
  start += s.ms
}
const total = start / 1000

// 2. Music bed (synthesised, needs python3 with numpy and soundfile), ducked under the voice.
const bed = join(cache, 'bed.wav')
if (!existsSync(bed)) spawnSync('python3', [join(here, 'bed.py'), bed], { stdio: 'inherit' })
const hasBed = existsSync(bed)
if (hasBed) inputs.push('-i', bed)
const bedIdx = n

const voiceMix = `${voices.join('')}amix=inputs=${voices.length}:normalize=0[voice]`
const fxMix = `${fx.join('')}amix=inputs=${fx.length}:normalize=0[fx]`
const graph = [
  ...filters,
  voiceMix,
  fxMix,
  '[voice]asplit=2[vo][vsc]',
  hasBed ? `[${bedIdx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.55[bed0];[bed0][vsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=500[bed]` : '',
  hasBed ? '[vo][fx][bed]amix=inputs=3:normalize=0[mix]' : '[vo][fx]amix=inputs=2:normalize=0[mix]',
  `[mix]loudnorm=I=-16:TP=-1.5:LRA=9,atrim=0:${total},afade=t=out:st=${total - 1.5}:d=1.5[a]`,
].filter(Boolean).join(';')

const picture = framesDir.endsWith('.mp4') ? ['-i', framesDir] : ['-framerate', String(FPS), '-i', join(framesDir, 'f%05d.jpg')]
run('ffmpeg', ['-y', ...picture, ...inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out])
console.log('Film ready:', out)
