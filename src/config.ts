/**
 * Configuration modifiable de l'application.
 *
 * Les listes de modèles ci-dessous sont des valeurs par défaut, vérifiées dans la
 * documentation de chaque fournisseur en novembre 2026. Elles évoluent vite :
 * modifiez-les ici librement. L'interface permet aussi de saisir n'importe quel
 * identifiant de modèle, et la liste OpenRouter est chargée dynamiquement.
 */

import type { LlmProviderId } from './llm/types'

export interface ModelOption {
  id: string
  label: string
}

export const DEFAULT_MODELS: Record<LlmProviderId, ModelOption[]> = {
  // https://platform.claude.com/docs/en/about-claude/models/overview
  anthropic: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  ],
  // https://developers.openai.com/api/docs/models
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
    { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
  ],
  // https://openrouter.ai/api/v1/models — liste complète chargée à l'exécution.
  openrouter: [
    { id: 'anthropic/claude-opus-5.5', label: 'Anthropic: Claude Opus 5.5' },
    { id: 'anthropic/claude-sonnet-5.5', label: 'Anthropic: Claude Sonnet 5.5' },
    { id: 'anthropic/claude-haiku-5.5', label: 'Anthropic: Claude Haiku 5.5' },
    { id: 'openai/gpt-6-astra', label: 'OpenAI: GPT-6 Astra' },
    { id: 'openai/gpt-6.1-sol', label: 'OpenAI: GPT-6.1 Sol' },
    { id: 'openai/gpt-6-luna', label: 'OpenAI: GPT-6 Luna' },
    { id: 'google/gemini-3.8-flash', label: 'Google: Gemini 3.8 Flash' },
  ],
}

/**
 * Modèles Anthropic qui acceptent le repli automatique côté serveur en cas de refus
 * (`fallbacks: "default"`). Les autres modèles sont appelés sans ce paramètre.
 */
export const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'])

/** Nombre maximal de tokens générés par le LLM pour le JSON structuré. */
export const LLM_MAX_OUTPUT_TOKENS = 16000

/** Langues OCR proposées (codes Tesseract ISO 639-2/T). */
export const OCR_LANGUAGES: { code: string; label: string; ocrSpace: string }[] = [
  { code: 'fra', label: 'Français', ocrSpace: 'fre' },
  { code: 'eng', label: 'Anglais', ocrSpace: 'eng' },
  { code: 'deu', label: 'Allemand', ocrSpace: 'ger' },
  { code: 'spa', label: 'Espagnol', ocrSpace: 'spa' },
  { code: 'ita', label: 'Italien', ocrSpace: 'ita' },
  { code: 'por', label: 'Portugais', ocrSpace: 'por' },
  { code: 'nld', label: 'Néerlandais', ocrSpace: 'dut' },
]

export const DEFAULT_OCR_LANGUAGES = ['fra', 'eng']

/** Limites du plan gratuit OCR.space (https://ocr.space/ocrapi). */
export const OCR_SPACE = {
  endpoint: 'https://api.ocr.space/parse/image',
  maxFileBytes: 1024 * 1024,
  maxPdfPages: 3,
  /** Moteur 2 : détection automatique de la langue, meilleur sur les chiffres. */
  engine: 2,
} as const

/** Titre envoyé à OpenRouter (classement des applis, facultatif). */
export const APP_TITLE = 'file-scan'
