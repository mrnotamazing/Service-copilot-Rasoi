// Turns the demo build into one self-contained HTML body for sharing as a single page.
import { readFileSync, writeFileSync } from 'node:fs'
const dir = 'dist-demo'
let html = readFileSync(`${dir}/index.html`, 'utf8')
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/g, (_, f) => `<script type="module">${readFileSync(`${dir}/${f}`, 'utf8').replace(/<\/script/g, '<\\/script')}</script>`)
// Fonts referenced from the CSS become data: URIs so the single file is complete.
const inlineFonts = (css) =>
  css.replace(/url\(\.\/([\w.-]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(`${dir}/assets/${f}`).toString('base64')})`)
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/g, (_, f) => `<style>${inlineFonts(readFileSync(`${dir}/${f}`, 'utf8'))}</style>`)
// Icons: embed the SVG; manifest and touch icons only make sense for the installed app.
const iconSvg = readFileSync('public/icon.svg', 'utf8')
html = html
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}" />`)
  .replace(/\s*<link rel="(apple-touch-icon|manifest)"[^>]*>/g, '')
// The artifact host supplies the doctype/html/head/body skeleton.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
writeFileSync(`${dir}/service-copilot-demo.html`, head.trim() + '\n' + body.trim() + '\n')
console.log('wrote', `${dir}/service-copilot-demo.html`)
