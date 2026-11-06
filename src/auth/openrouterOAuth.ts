import { APP_TITLE } from '../config'
import { AppError } from '../lib/errors'

/**
 * « Se connecter avec OpenRouter » — OAuth PKCE, sans client ID ni secret.
 * Doc : https://openrouter.ai/docs/guides/overview/auth/oauth
 *
 * 1. On génère un code_verifier aléatoire et son challenge SHA-256, puis on redirige vers openrouter.ai/auth.
 * 2. OpenRouter redirige vers l'appli avec ?code=… ; on échange ce code (+ verifier) contre une clé API
 *    liée au compte de l'utilisateur, qui paie avec ses propres crédits.
 */

const AUTH_URL = 'https://openrouter.ai/auth'
const EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys'
const PENDING_KEY = 'file-scan:openrouter-oauth'

interface PendingLogin {
  verifier: string
  state: string
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** URL de retour : la page courante, sans paramètres. */
function callbackUrl(): string {
  return window.location.origin + window.location.pathname
}

export async function startOpenRouterLogin(): Promise<void> {
  if (!window.isSecureContext || !crypto.subtle) {
    throw new AppError('oauth', 'La connexion OpenRouter nécessite HTTPS (ou localhost).')
  }
  const pending: PendingLogin = { verifier: randomString(32), state: randomString(16) }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))

  const url = new URL(AUTH_URL)
  url.searchParams.set('callback_url', callbackUrl())
  url.searchParams.set('code_challenge', await sha256Challenge(pending.verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', pending.state)
  url.searchParams.set('key_label', APP_TITLE)
  window.location.assign(url.toString())
}

let completion: Promise<string | null> | null = null

/**
 * À appeler au chargement de la page. Renvoie la clé API si l'URL contient un retour
 * OAuth valide, null sinon. Idempotent (sûr avec le double rendu de React en dev).
 */
export function completeOpenRouterLogin(): Promise<string | null> {
  completion ??= doComplete()
  return completion
}

async function doComplete(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code) return null

  // Retire immédiatement le code de l'URL (historique, partage de lien…).
  window.history.replaceState(null, '', callbackUrl() + window.location.hash)

  const raw = sessionStorage.getItem(PENDING_KEY)
  sessionStorage.removeItem(PENDING_KEY)
  if (!raw) {
    throw new AppError('oauth', 'Connexion OpenRouter expirée ou lancée depuis un autre onglet. Recommencez.')
  }
  const pending = JSON.parse(raw) as PendingLogin
  if (state !== pending.state) {
    throw new AppError('oauth', 'Réponse OpenRouter invalide (paramètre state inattendu). Recommencez la connexion.')
  }

  let res: Response
  try {
    res = await fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: pending.verifier, code_challenge_method: 'S256' }),
    })
  } catch (err) {
    throw new AppError('network', 'Impossible de joindre OpenRouter pour finaliser la connexion.', { cause: err })
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    const detail = body?.error?.message ? ` (${body.error.message})` : ''
    const reason = res.status === 400 || res.status === 403 ? 'code d’autorisation invalide ou expiré' : `HTTP ${res.status}`
    throw new AppError('oauth', `Échec de la connexion OpenRouter : ${reason}${detail}. Recommencez.`)
  }
  const { key } = (await res.json()) as { key?: string }
  if (!key) throw new AppError('oauth', 'OpenRouter n’a pas renvoyé de clé API. Recommencez.')
  return key
}
