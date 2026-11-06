import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import { openrouterProvider } from './openrouter'
import type { LlmProvider, LlmProviderId } from './types'

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProvider> = {
  openrouter: openrouterProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
}

export { structureDocument } from './structure'
export type { StructuredDocument } from './prompt'
export type { LlmProvider, LlmProviderId } from './types'
