import { DEFAULT_MODELS, DEFAULT_OCR_LANGUAGES } from '../config'
import type { LlmProviderId } from '../llm/types'
import type { OcrEngineId } from '../ocr/types'

/** Réglages non sensibles, mémorisés dans localStorage. Les clés API sont gérées à part (storage/keys.ts). */
export interface Settings {
  ocrEngine: OcrEngineId
  ocrLanguages: string[]
  /** `none` = mode OCR seul. */
  llmProvider: LlmProviderId | 'none'
  models: Record<LlmProviderId, string>
}

const STORAGE_KEY = 'file-scan:settings'

export const DEFAULT_SETTINGS: Settings = {
  ocrEngine: 'tesseract',
  ocrLanguages: DEFAULT_OCR_LANGUAGES,
  llmProvider: 'none',
  models: {
    anthropic: DEFAULT_MODELS.anthropic[0].id,
    openai: DEFAULT_MODELS.openai[0].id,
    openrouter: DEFAULT_MODELS.openrouter[0].id,
  },
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      models: { ...DEFAULT_SETTINGS.models, ...parsed.models },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Stockage indisponible (navigation privée stricte) : les réglages restent en mémoire.
  }
}
