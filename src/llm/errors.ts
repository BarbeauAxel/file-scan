import { AppError, isAbortError } from '../lib/errors'

interface HttpLikeError {
  status?: number
  message?: string
  headers?: Headers | Record<string, string | null | undefined>
  error?: unknown
  name?: string
}

function header(headers: HttpLikeError['headers'], name: string): string | null {
  if (!headers) return null
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name)
  return (headers as Record<string, string | null | undefined>)[name] ?? null
}

/** Extrait le message d'erreur renvoyé par le fournisseur, quel que soit son format. */
function providerMessage(err: HttpLikeError): string {
  const body = err.error as { message?: string; error?: { message?: string } } | undefined
  return body?.error?.message ?? body?.message ?? err.message ?? ''
}

/** Erreur réseau (fournisseur injoignable, CORS, coupure…). */
export function networkError(provider: string, cause: unknown, hint = ''): AppError {
  return new AppError('network', `Impossible de joindre ${provider} : vérifiez votre connexion.${hint ? ' ' + hint : ''}`, { cause })
}

/**
 * Convertit une erreur des SDK OpenAI / Anthropic (ou d'un fetch) en AppError lisible.
 * Le message ne contient jamais la clé API.
 */
export function toLlmError(err: unknown, provider: string, model: string): AppError {
  if (err instanceof AppError) return err
  if (isAbortError(err)) return new AppError('aborted', 'Opération annulée.', { cause: err })

  const e = (err ?? {}) as HttpLikeError
  const detail = providerMessage(e)
  const suffix = detail ? ` Détail : ${detail}` : ''

  switch (e.status) {
    case 401:
      return new AppError('invalid_key', `Clé API ${provider} invalide, expirée ou révoquée. Vérifiez-la dans les réglages.`, { cause: err })
    case 402:
      return new AppError('insufficient_credits', `Crédits ${provider} insuffisants. Rechargez votre compte puis réessayez.`, { cause: err })
    case 403:
      return new AppError('invalid_key', `Accès refusé par ${provider} (droits, budget ou modération).${suffix}`, { cause: err })
    case 404:
      return new AppError('provider_error', `Modèle « ${model} » introuvable ou inaccessible chez ${provider}.${suffix}`, { cause: err })
    case 413:
      return new AppError('file_too_large', `Le texte du document est trop long pour ${provider}.${suffix}`, { cause: err })
    case 429: {
      const retry = header(e.headers, 'retry-after')
      const wait = retry ? ` Réessayez dans ${retry} s.` : ' Patientez un peu avant de réessayer.'
      return new AppError('rate_limited', `Quota dépassé ou trop de requêtes chez ${provider} (HTTP 429).${wait}${suffix}`, { cause: err })
    }
    case 400:
    case 422:
      return new AppError('provider_error', `Requête refusée par ${provider} (modèle « ${model} »).${suffix}`, { cause: err })
  }
  if (typeof e.status === 'number' && e.status >= 500) {
    return new AppError('provider_error', `${provider} est momentanément indisponible (HTTP ${e.status}). Réessayez plus tard.`, { cause: err })
  }
  if (err instanceof TypeError) return networkError(provider, err)
  return new AppError('provider_error', `Erreur ${provider} : ${detail || String(err)}`, { cause: err })
}
