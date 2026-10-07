// Turns the demo build into one self-contained HTML body for sharing as a single page.
import { readFileSync, writeFileSync } from 'node:fs'
const dir = 'dist-demo'
let html = readFileSync(`${dir}/index.html`, 'utf8')
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/g, (_, f) => `<script type="module">${readFileSync(`${dir}/${f}`, 'utf8').replace(/<\/script/g, '<\\/script')}</script>`)
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/g, (_, f) => `<style>${readFileSync(`${dir}/${f}`, 'utf8')}</style>`)
// The artifact host supplies the doctype/html/head/body skeleton.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
writeFileSync(`${dir}/service-copilot-demo.html`, head.trim() + '\n' + body.trim() + '\n')
console.log('wrote', `${dir}/service-copilot-demo.html`)
