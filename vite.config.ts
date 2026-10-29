import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const API = `http://localhost:${process.env.COPILOT_PORT ?? 4000}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    // The demo ships as one self-contained HTML file, so keep it to a single chunk.
    rollupOptions: process.env.VITE_STANDALONE === '1' ? { output: { inlineDynamicImports: true } } : undefined,
  },
  server: {
    host: true,
    proxy: {
      '/api': API,
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
  },
})
