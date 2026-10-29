# TableMate (service copilot)

Real-time SOP assistant for fine-dining servers. POS events → engine (`shared/engine.ts`) → each server's top 3 task cards; kitchen relay; delay attribution (floor vs kitchen). AI wording via Dify (`server/ai.ts`) with a built-in fallback.

- Stack: React 19 + Vite + Tailwind v4 + shadcn/ui (`src/components/ui`), Motion, Sonner; Node server with WebSocket (`server/`).
- Commands: `npm run dev` (app :5173, API :4000), `npm test`, `npm run typecheck`, `npm run build:demo` (single-file demo).
- Brand: TableMate. Tokens in `src/index.css` (tomato/chocolate/cream, Outfit); logo, mascot and wordmark in `src/brand/marks.tsx`. Use `--tomato` for brand art, `--primary` for UI (contrast-safe).
- Design rules: light/dark theme tokens live in `src/index.css`; use shadcn components and theme tokens, never hard-coded colours. Cards are suggestions, never orders. Never show per-person rankings to managers; personal stats stay on the server's own screen.
- For UI work use the `frontend-design`, `ui-styling` and `web-design-guidelines` skills; check changes in a browser with `webapp-testing` and finish with `verification-before-completion`.
