import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CopilotEvent } from '../shared/events.ts'
import type { HubStore } from './hub.ts'

/** Append-only NDJSON event log plus a JSON config file. */
export function fileStore(eventsPath: string, configPath: string): HubStore {
  mkdirSync(dirname(eventsPath), { recursive: true })
  return {
    loadEvents() {
      if (!existsSync(eventsPath)) return []
      const out: CopilotEvent[] = []
      for (const line of readFileSync(eventsPath, 'utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          out.push(JSON.parse(line) as CopilotEvent)
        } catch {
          // skip a torn last line
        }
      }
      return out
    },
    append: (ev) => appendFileSync(eventsPath, JSON.stringify(ev) + '\n'),
    clear: () => writeFileSync(eventsPath, ''),
    loadConfig: () => (existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : null),
    saveConfig: (config) => writeFileSync(configPath, JSON.stringify(config, null, 2)),
  }
}
