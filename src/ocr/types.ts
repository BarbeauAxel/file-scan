export interface OcrPage {
  /** Numéro de page, à partir de 1. */
  page: number
  text: string
  /** Score de confiance entre 0 et 1, ou null si le moteur n'en fournit pas. */
  confidence: number | null
}

export interface OcrProgress {
  /** Avancement global entre 0 et 1. */
  progress: number
  /** Libellé lisible de l'étape en cours. */
  status: string
}

export interface OcrOptions {
  /** Codes de langue Tesseract (ISO 639-2/T), ex. ["fra", "eng"]. */
  languages: string[]
  /** Clé API, pour les moteurs distants. */
  apiKey?: string
  onProgress?: (progress: OcrProgress) => void
  signal?: AbortSignal
}

export type OcrEngineId = 'tesseract' | 'ocrspace'

/**
 * Un moteur OCR prend un fichier (image ou PDF) et renvoie le texte de chaque page.
 * Les moteurs futurs (ex. vision LLM en V2) implémentent la même interface.
 */
export interface OcrEngine {
  id: OcrEngineId
  label: string
  /** Le moteur a-t-il besoin d'une clé API ? */
  requiresApiKey: boolean
  recognize(file: File, options: OcrOptions): Promise<OcrPage[]>
}
