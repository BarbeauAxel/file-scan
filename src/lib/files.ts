export const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

export const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,.pdf,' + ACCEPTED_MIME_TYPES.join(',')

/** Taille max acceptée côté navigateur (le traitement se fait en local). */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/** Renvoie le type MIME effectif (certains OS laissent `file.type` vide). */
export function detectMimeType(file: File): string | null {
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TO_MIME[ext] ?? null
}

export function isPdf(file: File): boolean {
  return detectMimeType(file) === 'application/pdf'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/** Vérifie qu'un fichier est exploitable ; renvoie un message d'erreur sinon. */
export function validateFile(file: File): string | null {
  if (!detectMimeType(file)) {
    return `Format non pris en charge (« ${file.name} »). Formats acceptés : PNG, JPG, WEBP, PDF.`
  }
  if (file.size === 0) return 'Le fichier est vide.'
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Fichier trop lourd (${formatBytes(file.size)}). Taille maximale : ${formatBytes(MAX_FILE_SIZE_BYTES)}.`
  }
  return null
}
