import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { AppError } from '../lib/errors'

/** pdf.js est chargé à la demande, au premier PDF. */
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/** Résolution de rendu : ~200 dpi (72 dpi × 2,8), un bon compromis pour l'OCR. */
const DEFAULT_SCALE = 2.8
/** Garde-fou contre les pages immenses qui satureraient la mémoire. */
const MAX_CANVAS_SIDE = 5000

/** Ouvre un PDF ; appeler `close()` une fois terminé pour libérer le worker. */
export async function openPdf(file: File): Promise<{ pdf: PDFDocumentProxy; close: () => Promise<void> }> {
  const { getDocument } = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data })
  try {
    return { pdf: await task.promise, close: () => task.destroy() }
  } catch (err) {
    await task.destroy().catch(() => {})
    const name = (err as { name?: string })?.name
    if (name === 'PasswordException') {
      throw new AppError('invalid_file', 'Ce PDF est protégé par un mot de passe.', { cause: err })
    }
    throw new AppError('invalid_file', 'Impossible de lire ce PDF (fichier corrompu ou non supporté).', { cause: err })
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  const { pdf, close } = await openPdf(file)
  try {
    return pdf.numPages
  } finally {
    await close()
  }
}

/**
 * Rend chaque page du PDF dans un canvas (fond blanc), une page à la fois.
 * `onPage` est appelé pour chaque page rendue ; le canvas peut être libéré ensuite.
 */
export async function renderPdfPages(
  file: File,
  onPage: (canvas: HTMLCanvasElement, pageNumber: number, pageCount: number) => Promise<void>,
  options: { scale?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const { pdf, close } = await openPdf(file)
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      options.signal?.throwIfAborted()
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(options.scale ?? DEFAULT_SCALE, MAX_CANVAS_SIDE / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, viewport, background: '#ffffff' }).promise
      page.cleanup()
      await onPage(canvas, n, pdf.numPages)
      canvas.width = canvas.height = 0
    }
  } finally {
    await close()
  }
}
