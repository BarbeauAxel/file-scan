export type AppErrorKind =
  | 'invalid_file'
  | 'file_too_large'
  | 'too_many_pages'
  | 'missing_key'
  | 'invalid_key'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'invalid_json'
  | 'refusal'
  | 'network'
  | 'aborted'
  | 'provider_error'
  | 'ocr_failed'
  | 'oauth'

/** Erreur affichable telle quelle à l'utilisateur (message en français). */
export class AppError extends Error {
  readonly kind: AppErrorKind
  constructor(kind: AppErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.kind = kind
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof AppError && err.kind === 'aborted') ||
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err as { name?: string })?.name === 'APIUserAbortError'
  )
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (isAbortError(err)) return 'Opération annulée.'
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'Erreur réseau : vérifiez votre connexion internet.'
  }
  return `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}`
}
