import OpenAI from 'openai'
import { APP_TITLE, type ModelOption } from '../config'
import { toLlmError } from './errors'
import { chatCompletion } from './openai'
import type { LlmProvider } from './types'

const BASE_URL = 'https://openrouter.ai/api/v1'

interface OpenRouterModel {
  id: string
  name: string
  supported_parameters?: string[]
  architecture?: { output_modalities?: string[] }
}

/** Liste publique des modèles (sans clé), mise en cache pour la session. */
let catalog: Promise<OpenRouterModel[]> | null = null

function loadCatalog(signal?: AbortSignal): Promise<OpenRouterModel[]> {
  catalog ??= fetch(`${BASE_URL}/models`, { signal })
    .then(async (res) => {
      if (!res.ok) throw toLlmError({ status: res.status, error: await res.json().catch(() => null) }, 'OpenRouter', '—')
      return ((await res.json()) as { data: OpenRouterModel[] }).data
    })
    .catch((err) => {
      catalog = null
      throw toLlmError(err, 'OpenRouter', '—')
    })
  return catalog
}

export const openrouterProvider: LlmProvider = {
  id: 'openrouter',
  label: 'OpenRouter',
  keyUrl: 'https://openrouter.ai/settings/keys',

  async complete(request) {
    const sdk = new OpenAI({
      apiKey: request.apiKey,
      baseURL: BASE_URL,
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
      defaultHeaders: { 'HTTP-Referer': window.location.origin, 'X-OpenRouter-Title': APP_TITLE },
    })
    // Choisit le meilleur format de sortie selon les capacités du modèle.
    const params = await loadCatalog(request.signal)
      .then((models) => models.find((m) => m.id === request.model)?.supported_parameters)
      .catch(() => undefined)

    if (!params || params.includes('structured_outputs')) {
      return chatCompletion(
        sdk,
        'OpenRouter',
        request,
        { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
        // N'oriente que vers les hébergeurs qui respectent response_format.
        { provider: { require_parameters: true } },
      )
    }
    // Repli : mode JSON simple, puis validation et nouvelle tentative côté client.
    return chatCompletion(sdk, 'OpenRouter', request, params.includes('response_format') ? { type: 'json_object' } : undefined)
  },

  async listModels(_apiKey, signal): Promise<ModelOption[]> {
    const models = await loadCatalog(signal)
    return models
      .filter((m) => (m.architecture?.output_modalities ?? ['text']).includes('text'))
      .filter((m) => m.supported_parameters?.some((p) => p === 'structured_outputs' || p === 'response_format'))
      .filter((m) => !m.id.endsWith(':batch'))
      .map((m) => ({ id: m.id, label: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  },
}
