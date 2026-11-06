import type { ModelOption } from '../config'

export type LlmProviderId = 'openai' | 'anthropic' | 'openrouter'

export type JsonSchema = Record<string, unknown>

export interface CompletionRequest {
  system: string
  user: string
  /** Schéma JSON (compatible mode strict) que la réponse doit respecter. */
  schema: JsonSchema
  schemaName: string
  model: string
  apiKey: string
  signal?: AbortSignal
}

/**
 * Un fournisseur LLM renvoie le texte brut de la réponse (censé être du JSON).
 * L'analyse, la validation et la nouvelle tentative sont communes (llm/structure.ts).
 *
 * En V2, le mode vision pourra ajouter des images à `CompletionRequest`
 * sans changer le reste du pipeline.
 */
export interface LlmProvider {
  id: LlmProviderId
  label: string
  /** Lien vers la page où l'utilisateur crée sa clé. */
  keyUrl: string
  complete(request: CompletionRequest): Promise<string>
  /** Liste des modèles disponibles (facultatif ; `apiKey` peut être requis). */
  listModels?(apiKey: string | null, signal?: AbortSignal): Promise<ModelOption[]>
}
