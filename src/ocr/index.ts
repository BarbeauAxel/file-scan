import { ocrSpaceEngine } from './ocrspace'
import { tesseractEngine } from './tesseract'
import type { OcrEngine, OcrEngineId } from './types'

export const OCR_ENGINES: Record<OcrEngineId, OcrEngine> = {
  tesseract: tesseractEngine,
  ocrspace: ocrSpaceEngine,
}

export type { OcrEngine, OcrEngineId, OcrPage, OcrProgress } from './types'
