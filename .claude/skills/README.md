# Project skills

Claude Code loads these automatically when you open this repository (terminal, desktop app or claude.ai/code).
Each was reviewed before it was added. Update one by re-copying its folder from the source repo.

| Skill | What it gives Claude | Source (commit) | Licence |
|---|---|---|---|
| `frontend-design` | Distinctive visual direction: typography, palette, layout that doesn't look templated | [anthropics/skills](https://github.com/anthropics/skills) `683bc88` | Apache-2.0 |
| `theme-factory` | 10 ready colour/font themes it can apply or adapt | anthropics/skills `683bc88` | Apache-2.0 |
| `webapp-testing` | Drives the running app in a real browser (Playwright) to check UI and take screenshots | anthropics/skills `683bc88` | Apache-2.0 |
| `web-design-guidelines` | Audits UI code against Vercel's Web Interface Guidelines (accessibility, UX). Fetches the latest rules from GitHub when run | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `063bee9` | MIT |
| `react-best-practices` | React performance and correctness rules from Vercel | vercel-labs/agent-skills `063bee9` | MIT |
| `composition-patterns` | Component architecture: compound components instead of prop soup | vercel-labs/agent-skills `063bee9` | MIT |
| `ui-ux-pro-max` | Searchable design knowledge: styles, palettes, font pairings, UX rules (needs `python3`) | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) `477bcb2` | MIT |
| `ui-styling` | shadcn/ui + Tailwind CSS patterns, theming and accessibility (this app's stack) | nextlevelbuilder/ui-ux-pro-max-skill `477bcb2` | MIT |
| `systematic-debugging` | Root-cause-first debugging instead of guess-and-patch | [obra/superpowers](https://github.com/obra/superpowers) `8ca22db` | MIT |
| `verification-before-completion` | Makes Claude prove a change works (run it, test it) before saying it's done | obra/superpowers `8ca22db` | MIT |

Considered and left out: **Impeccable** (downloads a separate binary and installs edit hooks),
**AccessLint** (needs its own plugin server to work), and Superpowers' **brainstorming/writing-plans**
(built to chain into the rest of that pack).
