import type { LoggerMessage, Worker } from 'tesseract.js'
import { AppError } from '../lib/errors'
import { isPdf } from '../lib/files'
import { renderPdfPages } from './pdf'
import type { OcrEngine, OcrOptions, OcrPage } from './types'

const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Chargement du moteur OCR',
  'initializing tesseract': 'Initialisation du moteur OCR',
  'initialized tesseract': 'Moteur OCR prêt',
  'loading language traineddata': 'Téléchargement des données de langue',
  'loading language traineddata (from cache)': 'Chargement des données de langue',
  'initializing api': 'Initialisation',
  'initialized api': 'Initialisation',
  'recognizing text': 'Reconnaissance du texte',
}

/**
 * OCR 100 % local via tesseract.js. Le fichier ne quitte pas le navigateur :
 * seuls le moteur WASM et les données de langue sont téléchargés (puis mis en cache).
 */
export const tesseractEngine: OcrEngine = {
  id: 'tesseract',
  label: 'Tesseract.js (local)',
  requiresApiKey: false,

  async recognize(file: File, options: OcrOptions): Promise<OcrPage[]> {
    const languages = options.languages.length ? options.languages : ['eng']
    const report = options.onProgress ?? (() => {})
    // Avancement : la page courante (index, total) est mise à jour au fil du traitement.
    let pageIndex = 0
    let pageCount = 1
    // Les messages d'initialisation ne sont affichés qu'avant la première page.
    let started = false

    const logger = (m: LoggerMessage) => {
      const label = STATUS_LABELS[m.status] ?? m.status
      if (m.status === 'recognizing text') {
        report({
          progress: (pageIndex + m.progress) / pageCount,
          status: `${label} — page ${pageIndex + 1}/${pageCount}`,
        })
      } else if (!started) {
        report({ progress: 0, status: label })
      }
    }

    report({ progress: 0, status: 'Chargement du moteur OCR' })
    let worker: Worker
    try {
      const { createWorker } = await import('tesseract.js') // chargé à la demande
      worker = await createWorker(languages, 1, { logger })
    } catch (err) {
      throw new AppError(
        'ocr_failed',
        `Impossible de charger Tesseract ou les langues « ${languages.join('+')} ». Vérifiez votre connexion (téléchargement initial des données de langue).`,
        { cause: err },
      )
    }

    const onAbort = () => void worker.terminate()
    options.signal?.addEventListener('abort', onAbort)
    const pages: OcrPage[] = []
    try {
      const recognize = async (image: HTMLCanvasElement | File, pageNumber: number) => {
        options.signal?.throwIfAborted()
        started = true
        const { data } = await worker.recognize(image)
        pages.push({ page: pageNumber, text: data.text.trim(), confidence: round(data.confidence / 100) })
      }

      if (isPdf(file)) {
        await renderPdfPages(
          file,
          async (canvas, n, total) => {
            pageIndex = n - 1
            pageCount = total
            await recognize(canvas, n)
            if (n < total) report({ progress: n / total, status: `Rendu de la page ${n + 1}/${total}` })
          },
          { signal: options.signal },
        )
      } else {
        await recognize(file, 1)
      }
      report({ progress: 1, status: 'OCR terminé' })
      return pages
    } catch (err) {
      options.signal?.throwIfAborted()
      if (err instanceof AppError) throw err
      throw new AppError('ocr_failed', `Échec de l'OCR : ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
      await worker.terminate().catch(() => {})
    }
  },
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
