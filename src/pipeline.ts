import { OCR_ENGINES, type OcrPage, type OcrProgress } from './ocr'
import type { Settings } from './storage/settings'

export interface ScanResult {
  pages: OcrPage[]
  /** JSON final, indenté, prêt à afficher / télécharger. */
  json: string
  notice: string | null
}

export interface ScanCallbacks {
  onProgress: (phase: 'ocr' | 'llm', progress: OcrProgress | null) => void
}

/** JSON minimal renvoyé en mode OCR seul. */
export function ocrOnlyJson(pages: OcrPage[]) {
  return { pages: pages.map((p) => ({ page: p.page, text: p.text, confidence: p.confidence })) }
}

export async function runScan(
  file: File,
  settings: Settings,
  callbacks: ScanCallbacks,
  signal: AbortSignal,
): Promise<ScanResult> {
  const engine = OCR_ENGINES[settings.ocrEngine]
  const pages = await engine.recognize(file, {
    languages: settings.ocrLanguages,
    signal,
    onProgress: (p) => callbacks.onProgress('ocr', p),
  })
  return { pages, json: JSON.stringify(ocrOnlyJson(pages), null, 2), notice: null }
}
