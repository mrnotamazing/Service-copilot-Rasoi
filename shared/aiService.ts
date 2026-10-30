// Several free cloud AI services share the source "cloud"; their model labels ("groq: openai/gpt-oss-120b")
// say which one it was, so screens can name the service that answered.

export const SERVICE_NAMES: Record<string, string> = { groq: 'Groq', openrouter: 'OpenRouter', cerebras: 'Cerebras' }
/** "groq: openai/gpt-oss-120b" → "Groq": which cloud service a model label belongs to. */
export function serviceOf(label: string | undefined): string | undefined {
  const id = label?.split(':')[0].trim().toLowerCase()
  return id ? (SERVICE_NAMES[id] ?? undefined) : undefined
}
