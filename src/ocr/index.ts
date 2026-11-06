import { tesseractEngine } from './tesseract'
import type { OcrEngine, OcrEngineId } from './types'

export const OCR_ENGINES: Record<OcrEngineId, OcrEngine> = {
  tesseract: tesseractEngine,
  ocrspace: tesseractEngine, // remplacé à l'étape OCR.space
}

export type { OcrEngine, OcrEngineId, OcrPage, OcrProgress } from './types'
