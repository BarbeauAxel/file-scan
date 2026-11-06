import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_FALLBACK_MODELS, LLM_MAX_OUTPUT_TOKENS } from '../config'
import { AppError } from '../lib/errors'
import { networkError, toLlmError } from './errors'
import type { CompletionRequest, LlmProvider } from './types'

function client(apiKey: string) {
  // dangerouslyAllowBrowser ajoute l'en-tête `anthropic-dangerous-direct-browser-access: true`.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
}

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  keyUrl: 'https://platform.claude.com/settings/keys',

  async complete({ system, user, schema, model, apiKey, signal }: CompletionRequest): Promise<string> {
    const params = {
      model,
      max_tokens: LLM_MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user' as const, content: user }],
      output_config: { format: { type: 'json_schema' as const, schema } },
    }
    let message: Anthropic.Message | Anthropic.Beta.BetaMessage
    try {
      message = ANTHROPIC_FALLBACK_MODELS.has(model)
        ? // Repli automatique côté serveur si le modèle refuse la requête (faux positif de sécurité).
          await client(apiKey).beta.messages.create(
            { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },
            { signal },
          )
        : await client(apiKey).messages.create(params, { signal })
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionError) throw networkError('Anthropic', err)
      throw toLlmError(err, 'Anthropic', model)
    }

    if (message.stop_reason === 'refusal') {
      throw new AppError('refusal', 'Le modèle a refusé de traiter ce document. Essayez un autre modèle.')
    }
    if (message.stop_reason === 'max_tokens') {
      throw new AppError('invalid_json', 'Réponse tronquée : le document est trop long pour la limite de sortie du modèle.')
    }
    return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
  },

  async listModels(apiKey, signal) {
    if (!apiKey) return []
    try {
      const models = []
      for await (const m of client(apiKey).models.list({ limit: 100 }, { signal })) {
        models.push({ id: m.id, label: m.display_name })
      }
      return models
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionError) throw networkError('Anthropic', err)
      throw toLlmError(err, 'Anthropic', '—')
    }
  },
}
