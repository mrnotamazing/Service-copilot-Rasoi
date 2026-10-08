// Claude as the assistant's language model (used when ANTHROPIC_API_KEY or an `ant auth login`
// profile is available). Server-only: the browser demo never loads this file.
//
// The long, stable part of the system prompt (standards, menu, training notes) is cached; the
// live part (who is asking, their tables, the language) comes after the cache breakpoint.

import Anthropic from '@anthropic-ai/sdk'
import type { ChatModel, ChatTurn } from './ai.ts'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'

export function createClaude(): ChatModel {
  const client = new Anthropic()
  return {
    name: 'claude',
    label: () => MODEL,
    async reply(system, turns: ChatTurn[], onText) {
      // Streamed, so the answer appears on screen as it's written.
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 4000,
        // Short, practical answers for staff between tables: low effort keeps them quick.
        output_config: { effort: 'low' },
        // If the model declines a request, the API retries on a fallback model automatically.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: system.stable, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: system.live },
        ],
        messages: turns.map((t) => ({ role: t.role, content: t.text })),
      })
      if (onText) stream.on('text', (_delta, snapshot) => onText(snapshot))
      const response = await stream.finalMessage()
      if (response.stop_reason === 'refusal') throw new Error('The assistant can’t help with that request')
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      if (!text) throw new Error('The assistant returned an empty answer')
      return text
    },
  }
}

/** A short reason for the notice shown when Claude can't be reached and the built-in answer is used. */
export function claudeErrorReason(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected'
  if (e instanceof Anthropic.RateLimitError) return 'The AI service is busy right now'
  if (e instanceof Anthropic.APIConnectionError) return 'Couldn’t reach the AI service'
  if (e instanceof Anthropic.APIError) return `The AI service returned an error (${e.status})`
  return e instanceof Error ? e.message : String(e)
}
