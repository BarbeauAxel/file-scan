import { toUserMessage } from './lib/errors'
import { LLM_PROVIDERS, structureDocument } from './llm'
import { OCR_ENGINES, type OcrPage, type OcrProgress } from './ocr'
import type { KeyId } from './storage/keys'
import type { Settings } from './storage/settings'

export interface ScanResult {
  pages: OcrPage[]
  /** JSON final, indenté, prêt à afficher / télécharger. */
  json: string
  /** true si le JSON vient du LLM, false en mode OCR seul. */
  structured: boolean
  notice: { tone: 'info' | 'error'; message: string } | null
}

export type ScanStep = 'ocr' | 'llm'

export interface ScanContext {
  settings: Settings
  keys: Record<KeyId, string | null>
  onProgress: (step: ScanStep, progress: OcrProgress | null) => void
  signal: AbortSignal
}

/** JSON minimal renvoyé en mode OCR seul. */
export function ocrOnlyJson(pages: OcrPage[]) {
  return { pages: pages.map((p) => ({ page: p.page, text: p.text, confidence: p.confidence })) }
}

export async function runScan(file: File, ctx: ScanContext): Promise<ScanResult> {
  const { settings, keys, signal } = ctx
  const engine = OCR_ENGINES[settings.ocrEngine]
  const pages = await engine.recognize(file, {
    languages: settings.ocrLanguages,
    apiKey: keys.ocrspace ?? undefined,
    signal,
    onProgress: (p) => ctx.onProgress('ocr', p),
  })
  return structurePages(pages, ctx)
}

/**
 * Étape LLM. Si aucun LLM n'est configuré, ou s'il échoue, on renvoie le JSON OCR seul :
 * le travail d'OCR n'est jamais perdu.
 */
export async function structurePages(pages: OcrPage[], ctx: ScanContext): Promise<ScanResult> {
  const { settings, keys, signal } = ctx
  const ocrOnly = (notice: ScanResult['notice']): ScanResult => ({
    pages,
    json: JSON.stringify(ocrOnlyJson(pages), null, 2),
    structured: false,
    notice,
  })

  if (settings.llmProvider === 'none') return ocrOnly(null)
  const provider = LLM_PROVIDERS[settings.llmProvider]
  const apiKey = keys[settings.llmProvider]
  if (!apiKey) {
    return ocrOnly({
      tone: 'info',
      message: `Aucune clé ${provider.label} enregistrée : résultat en mode OCR seul.`,
    })
  }
  if (pages.every((p) => !p.text.trim())) {
    return ocrOnly({ tone: 'info', message: 'Aucun texte détecté par l’OCR : structuration LLM ignorée.' })
  }

  ctx.onProgress('llm', { progress: 0, status: `Structuration par ${provider.label}…` })
  try {
    const doc = await structureDocument(provider, pages, settings.models[settings.llmProvider], apiKey, signal)
    return { pages, json: JSON.stringify(doc, null, 2), structured: true, notice: null }
  } catch (err) {
    signal.throwIfAborted()
    return ocrOnly({
      tone: 'error',
      message: `${toUserMessage(err)} Le résultat ci-dessous est le JSON de l’OCR seul.`,
    })
  }
}
