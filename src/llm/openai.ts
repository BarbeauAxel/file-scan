import type OpenAI from 'openai'
import type { ClientOptions } from 'openai'
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { LLM_MAX_OUTPUT_TOKENS } from '../config'
import { AppError } from '../lib/errors'
import { networkError, toLlmError } from './errors'
import type { CompletionRequest, LlmProvider } from './types'

/** SDK OpenAI chargé à la demande (aussi utilisé pour OpenRouter). */
export async function createOpenAiClient(options: ClientOptions): Promise<OpenAI> {
  const { default: OpenAISdk } = await import('openai')
  return new OpenAISdk({ dangerouslyAllowBrowser: true, maxRetries: 1, ...options })
}

async function isConnectionError(err: unknown): Promise<boolean> {
  const { APIConnectionError } = await import('openai')
  return err instanceof APIConnectionError
}

/**
 * Appel Chat Completions commun à OpenAI et OpenRouter (API compatible).
 * `extra` permet d'ajouter des paramètres propres au fournisseur.
 */
export async function chatCompletion(
  sdk: OpenAI,
  providerLabel: string,
  { system, user, model, signal }: CompletionRequest,
  responseFormat: ChatCompletionCreateParamsNonStreaming['response_format'] | undefined,
  extra: Record<string, unknown> = {},
  connectionHint = '',
): Promise<string> {
  const body: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_completion_tokens: LLM_MAX_OUTPUT_TOKENS,
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...extra,
  }
  let completion: OpenAI.Chat.Completions.ChatCompletion
  try {
    completion = await sdk.chat.completions.create(body, { signal })
  } catch (err) {
    if (await isConnectionError(err)) throw networkError(providerLabel, err, connectionHint)
    throw toLlmError(err, providerLabel, model)
  }

  // OpenRouter peut renvoyer une erreur avec un statut 200.
  const inlineError = (completion as unknown as { error?: { code?: number; message?: string } }).error
  if (inlineError || !completion.choices?.length) {
    throw toLlmError({ status: inlineError?.code, error: { message: inlineError?.message } }, providerLabel, model)
  }
  const choice = completion.choices[0]
  if (choice.message.refusal) {
    throw new AppError('refusal', `Le modèle a refusé de traiter ce document : ${choice.message.refusal}`)
  }
  if (choice.finish_reason === 'length') {
    throw new AppError('invalid_json', 'Réponse tronquée : le document est trop long pour la limite de sortie du modèle.')
  }
  return choice.message.content ?? ''
}

/**
 * api.openai.com n'envoie pas d'en-tête CORS sur ses réponses 401 : dans un navigateur,
 * une clé invalide apparaît donc comme une erreur réseau.
 */
const OPENAI_CONNECTION_HINT =
  'Cause la plus fréquente : clé API OpenAI invalide ou révoquée (OpenAI ne permet pas au navigateur de lire ses erreurs d’authentification).'

export const openaiProvider: LlmProvider = {
  id: 'openai',
  label: 'OpenAI',
  keyUrl: 'https://platform.openai.com/api-keys',

  async complete(request) {
    const sdk = await createOpenAiClient({ apiKey: request.apiKey })
    return chatCompletion(
      sdk,
      'OpenAI',
      request,
      { type: 'json_schema', json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
      {},
      OPENAI_CONNECTION_HINT,
    )
  },

  async listModels(apiKey, signal) {
    if (!apiKey) return []
    const sdk = await createOpenAiClient({ apiKey })
    try {
      const models = []
      for await (const m of sdk.models.list({ signal })) {
        // Ne garde que les modèles de texte généralistes.
        if (/^(gpt|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct)/.test(m.id)) {
          models.push({ id: m.id, label: m.id })
        }
      }
      return models.sort((a, b) => a.id.localeCompare(b.id))
    } catch (err) {
      if (await isConnectionError(err)) throw networkError('OpenAI', err, OPENAI_CONNECTION_HINT)
      throw toLlmError(err, 'OpenAI', '—')
    }
  },
}
