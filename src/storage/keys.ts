import { useCallback, useState } from 'react'

/**
 * Clés API de l'utilisateur. Elles restent dans le navigateur :
 * - localStorage si « mémoriser » est actif (par défaut),
 * - sessionStorage sinon (effacées à la fermeture de l'onglet).
 * Elles ne sont jamais loguées ni envoyées ailleurs que chez le fournisseur concerné.
 */
export type KeyId = 'openai' | 'anthropic' | 'openrouter' | 'ocrspace'

export const KEY_IDS: KeyId[] = ['openai', 'anthropic', 'openrouter', 'ocrspace']

const PREFIX = 'file-scan:key:'
const REMEMBER_KEY = 'file-scan:remember-keys'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function getRemember(): boolean {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== 'false', true)
}

export function getKey(id: KeyId): string | null {
  return safe(() => sessionStorage.getItem(PREFIX + id) ?? localStorage.getItem(PREFIX + id), null)
}

export function setKey(id: KeyId, value: string | null): void {
  safe(() => {
    sessionStorage.removeItem(PREFIX + id)
    localStorage.removeItem(PREFIX + id)
    const trimmed = value?.trim()
    if (trimmed) (getRemember() ? localStorage : sessionStorage).setItem(PREFIX + id, trimmed)
  }, undefined)
}

/** Change le mode de stockage et déplace les clés existantes. */
export function setRemember(remember: boolean): void {
  const current = KEY_IDS.map((id) => [id, getKey(id)] as const)
  safe(() => localStorage.setItem(REMEMBER_KEY, String(remember)), undefined)
  for (const [id, value] of current) setKey(id, value)
}

export function clearAllKeys(): void {
  for (const id of KEY_IDS) setKey(id, null)
}

export function loadKeys(): Record<KeyId, string | null> {
  return Object.fromEntries(KEY_IDS.map((id) => [id, getKey(id)])) as Record<KeyId, string | null>
}

/** Affiche une clé sans la révéler : « sk-…4f2a ». */
export function maskKey(key: string): string {
  return key.length <= 8 ? '••••' : `${key.slice(0, 3)}…${key.slice(-4)}`
}

/** État React synchronisé avec le stockage des clés. */
export function useKeys() {
  const [keys, setKeys] = useState(loadKeys)
  const [remember, setRememberState] = useState(getRemember)

  const update = useCallback((id: KeyId, value: string | null) => {
    setKey(id, value)
    setKeys(loadKeys())
  }, [])

  const changeRemember = useCallback((value: boolean) => {
    setRemember(value)
    setRememberState(value)
    setKeys(loadKeys())
  }, [])

  const clear = useCallback(() => {
    clearAllKeys()
    setKeys(loadKeys())
  }, [])

  return { keys, remember, setKey: update, setRemember: changeRemember, clearKeys: clear }
}
