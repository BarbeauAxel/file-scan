import { OCR_LANGUAGES, OCR_SPACE } from '../config'
import { AppError } from '../lib/errors'
import { detectMimeType, formatBytes, isPdf } from '../lib/files'
import { getPdfPageCount, renderPdfPages } from './pdf'
import type { OcrEngine, OcrOptions, OcrPage } from './types'

/**
 * OCR.space (https://ocr.space/ocrapi) — plan gratuit : 1 Mo par fichier, 3 pages par PDF.
 * Les images sont compressées / redimensionnées côté client pour passer sous 1 Mo.
 * OCR.space ne fournit pas de score de confiance : `confidence` vaut null.
 */

interface OcrSpaceResponse {
  ParsedResults?: { ParsedText?: string; FileParseExitCode?: number | string; ErrorMessage?: string | null }[]
  OCRExitCode?: number | string
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[] | null
  ErrorDetails?: string | null
  error?: string
  details?: string
}

export const ocrSpaceEngine: OcrEngine = {
  id: 'ocrspace',
  label: 'OCR.space (API gratuite)',
  requiresApiKey: true,

  async recognize(file: File, options: OcrOptions): Promise<OcrPage[]> {
    const { apiKey, signal } = options
    const report = options.onProgress ?? (() => {})
    if (!apiKey) {
      throw new AppError('missing_key', 'OCR.space nécessite une clé API gratuite : renseignez-la dans les réglages, ou utilisez Tesseract.')
    }
    const language = toOcrSpaceLanguage(options.languages)

    if (isPdf(file)) {
      report({ progress: 0, status: 'Lecture du PDF' })
      const count = await getPdfPageCount(file)
      if (count > OCR_SPACE.maxPdfPages) {
        throw new AppError(
          'too_many_pages',
          `Ce PDF compte ${count} pages : le plan gratuit d’OCR.space est limité à ${OCR_SPACE.maxPdfPages} pages par PDF. Utilisez Tesseract (sans limite) ou découpez le PDF.`,
        )
      }
      // PDF léger : envoyé tel quel (une seule requête, une entrée par page).
      if (file.size <= OCR_SPACE.maxFileBytes) {
        report({ progress: 0.1, status: `Envoi à OCR.space (${count} page${count > 1 ? 's' : ''})` })
        const pages = await callOcrSpace(file, file.name, 'PDF', language, apiKey, signal)
        report({ progress: 1, status: 'OCR terminé' })
        return pages
      }
      // PDF trop lourd : chaque page est rendue puis compressée en JPEG.
      const pages: OcrPage[] = []
      await renderPdfPages(
        file,
        async (canvas, n, total) => {
          report({ progress: (n - 1) / total, status: `Compression et envoi à OCR.space — page ${n}/${total}` })
          const blob = await compressCanvas(canvas)
          const [page] = await callOcrSpace(blob, `page-${n}.jpg`, 'JPG', language, apiKey, signal)
          pages.push({ ...page, page: n })
        },
        { scale: 2, signal },
      )
      report({ progress: 1, status: 'OCR terminé' })
      return pages
    }

    // Image : envoyée telle quelle si possible, sinon convertie en JPEG compressé.
    const mime = detectMimeType(file)
    const direct = file.size <= OCR_SPACE.maxFileBytes && (mime === 'image/png' || mime === 'image/jpeg')
    report({ progress: 0.1, status: direct ? 'Envoi à OCR.space' : 'Compression de l’image (limite OCR.space : 1 Mo)' })
    const payload = direct ? file : await compressCanvas(await imageToCanvas(file))
    if (!direct) report({ progress: 0.3, status: 'Envoi à OCR.space' })
    const pages = await callOcrSpace(payload, direct ? file.name : 'image.jpg', direct ? (mime === 'image/png' ? 'PNG' : 'JPG') : 'JPG', language, apiKey, signal)
    report({ progress: 1, status: 'OCR terminé' })
    return pages
  },
}

/** Une seule langue → son code OCR.space ; plusieurs → détection automatique (moteur 2). */
function toOcrSpaceLanguage(languages: string[]): string {
  if (languages.length !== 1) return 'auto'
  return OCR_LANGUAGES.find((l) => l.code === languages[0])?.ocrSpace ?? 'auto'
}

async function callOcrSpace(
  blob: Blob,
  filename: string,
  filetype: 'PDF' | 'PNG' | 'JPG',
  language: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<OcrPage[]> {
  if (blob.size > OCR_SPACE.maxFileBytes) {
    throw new AppError('file_too_large', `Fichier trop lourd pour OCR.space (${formatBytes(blob.size)} > 1 Mo).`)
  }
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('filetype', filetype)
  form.append('language', language)
  form.append('OCREngine', String(OCR_SPACE.engine))
  form.append('scale', 'true')
  form.append('detectOrientation', 'true')
  form.append('isOverlayRequired', 'false')

  let res: Response
  try {
    res = await fetch(OCR_SPACE.endpoint, { method: 'POST', headers: { apikey: apiKey }, body: form, signal })
  } catch (err) {
    signal?.throwIfAborted()
    throw new AppError('network', 'Impossible de joindre OCR.space : vérifiez votre connexion.', { cause: err })
  }
  const data = (await res.json().catch(() => null)) as OcrSpaceResponse | null
  const message = errorText(data)

  if (!res.ok || data?.error) throw ocrSpaceError(res.status, message)
  if (!data) throw new AppError('ocr_failed', `Réponse illisible d’OCR.space (HTTP ${res.status}).`)

  const exit = Number(data.OCRExitCode)
  if (data.IsErroredOnProcessing && !(exit === 2 && data.ParsedResults?.length)) {
    throw ocrSpaceError(res.status, message)
  }
  return (data.ParsedResults ?? []).map((r, i) => ({
    page: i + 1,
    text: (r.ParsedText ?? '').replace(/\r\n/g, '\n').trim(),
    confidence: null,
  }))
}

function errorText(data: OcrSpaceResponse | null): string {
  if (!data) return ''
  const parts = [data.error, ...(Array.isArray(data.ErrorMessage) ? data.ErrorMessage : [data.ErrorMessage]), data.ErrorDetails]
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}

function ocrSpaceError(status: number, message: string): AppError {
  if (/api ?key/i.test(message) || status === 401) {
    return new AppError('invalid_key', `Clé OCR.space invalide ou manquante. Vérifiez-la dans les réglages. (${message})`)
  }
  if (status === 429 || /maximum|times within|rate limit|quota/i.test(message)) {
    return new AppError('quota_exceeded', `Quota OCR.space atteint (plan gratuit : 25 000 requêtes/mois, 500/jour par IP). Réessayez plus tard ou utilisez Tesseract. (${message})`)
  }
  if (/size|1024 ?KB/i.test(message)) {
    return new AppError('file_too_large', `Fichier trop lourd pour OCR.space (limite : 1 Mo). (${message})`)
  }
  if (/page/i.test(message) && /limit|maximum/i.test(message)) {
    return new AppError('too_many_pages', `Trop de pages pour OCR.space (limite : 3). (${message})`)
  }
  return new AppError('ocr_failed', `Échec de l’OCR via OCR.space${status ? ` (HTTP ${status})` : ''} : ${message || 'erreur inconnue'}`)
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    throw new AppError('invalid_file', 'Impossible de lire cette image.', { cause: err })
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff' // les zones transparentes deviennent blanches en JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compression impossible'))), 'image/jpeg', quality),
  )
}

/**
 * Compresse un canvas en JPEG sous la limite d'OCR.space : baisse d'abord la qualité,
 * puis réduit les dimensions (en gardant le texte lisible le plus longtemps possible).
 */
export async function compressCanvas(source: HTMLCanvasElement, maxBytes: number = OCR_SPACE.maxFileBytes): Promise<Blob> {
  const target = maxBytes * 0.95 // marge pour l'encapsulation multipart
  let canvas = source
  for (let attempt = 0; attempt < 8; attempt++) {
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await toBlob(canvas, quality)
      if (blob.size <= target) return blob
    }
    const next = document.createElement('canvas')
    next.width = Math.max(1, Math.round(canvas.width * 0.75))
    next.height = Math.max(1, Math.round(canvas.height * 0.75))
    const ctx = next.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, next.width, next.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, next.width, next.height)
    canvas = next
  }
  throw new AppError('file_too_large', 'Impossible de compresser l’image sous 1 Mo pour OCR.space.')
}
