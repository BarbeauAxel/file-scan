import { AppError } from '../lib/errors'
import type { OcrPage } from '../ocr/types'
import {
  buildRetryPrompt,
  buildUserPrompt,
  DOCUMENT_TYPES,
  RESPONSE_SCHEMA,
  SCHEMA_NAME,
  SYSTEM_PROMPT,
  type Confidence,
  type DocumentType,
  type Scalar,
  type StructuredDocument,
} from './prompt'
import type { LlmProvider } from './types'

/** Signale une réponse inexploitable ; déclenche l'unique nouvelle tentative. */
class InvalidResponse extends Error {}

/**
 * Envoie le texte OCR au LLM et renvoie l'enveloppe validée.
 * En cas de JSON invalide, fait une seule nouvelle tentative en expliquant l'erreur au modèle.
 */
export async function structureDocument(
  provider: LlmProvider,
  pages: OcrPage[],
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<StructuredDocument> {
  const request = { system: SYSTEM_PROMPT, schema: RESPONSE_SCHEMA, schemaName: SCHEMA_NAME, model, apiKey, signal }

  let problem: string
  try {
    return parseDocument(await provider.complete({ ...request, user: buildUserPrompt(pages) }))
  } catch (err) {
    if (!(err instanceof InvalidResponse)) throw err
    problem = err.message
  }

  try {
    return parseDocument(await provider.complete({ ...request, user: buildRetryPrompt(pages, problem) }))
  } catch (err) {
    if (!(err instanceof InvalidResponse)) throw err
    throw new AppError(
      'invalid_json',
      `Le LLM a renvoyé un JSON invalide, deux fois de suite (${err.message}). Essayez un autre modèle.`,
      { cause: err },
    )
  }
}

/** Analyse la réponse brute (tolère les blocs ```json et le texte autour). */
export function parseDocument(raw: string): StructuredDocument {
  const text = raw.trim()
  if (!text) throw new InvalidResponse('réponse vide')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) throw new InvalidResponse('aucun objet JSON trouvé dans la réponse')
    try {
      value = JSON.parse(text.slice(start, end + 1))
    } catch (err) {
      throw new InvalidResponse(`JSON mal formé (${(err as Error).message})`)
    }
  }
  return normalizeDocument(value)
}

/** Valide la structure et la convertit vers l'enveloppe finale. */
export function normalizeDocument(value: unknown): StructuredDocument {
  if (!isObject(value)) throw new InvalidResponse('la réponse n’est pas un objet JSON')
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter((w): w is string => typeof w === 'string') : []

  if (typeof value.summary !== 'string') throw new InvalidResponse('champ « summary » manquant ou invalide')
  if (value.fields === undefined) throw new InvalidResponse('champ « fields » manquant')
  if (value.tables !== undefined && !Array.isArray(value.tables)) throw new InvalidResponse('« tables » doit être une liste')

  let documentType = value.document_type
  if (!(DOCUMENT_TYPES as readonly unknown[]).includes(documentType)) {
    if (typeof documentType === 'string' && documentType) warnings.push(`Type de document non standard « ${documentType} » ramené à « autre ».`)
    documentType = 'autre'
  }
  const confidence: Confidence = ['high', 'medium', 'low'].includes(value.confidence as string)
    ? (value.confidence as Confidence)
    : 'low'

  return {
    document_type: documentType as DocumentType,
    language: typeof value.language === 'string' && value.language ? value.language : null,
    summary: value.summary,
    fields: normalizeFields(value.fields),
    tables: (Array.isArray(value.tables) ? value.tables : []).map(normalizeTable),
    confidence,
    warnings,
  }
}

function normalizeFields(fields: unknown): Record<string, unknown> {
  // Format natif (objet) accepté pour les modèles sans structured outputs.
  if (isObject(fields)) return fields
  if (!Array.isArray(fields)) throw new InvalidResponse('« fields » doit être une liste de paires { key, value }')
  const out: Record<string, unknown> = {}
  for (const entry of fields) {
    if (!isObject(entry) || typeof entry.key !== 'string' || !entry.key.trim()) {
      throw new InvalidResponse('chaque élément de « fields » doit avoir une clé « key » non vide')
    }
    setPath(out, entry.key.trim(), toScalar(entry.value))
  }
  return out
}

/**
 * Place la valeur à son chemin (« vendeur.nom » → { vendeur: { nom } }).
 * En cas de conflit (une clé à la fois feuille et groupe), la clé complète est gardée à plat.
 */
function setPath(target: Record<string, unknown>, path: string, value: Scalar) {
  const parts = path.split('.').filter(Boolean)
  let node = target
  for (let i = 0; i < parts.length - 1; i++) {
    const existing = node[parts[i]]
    if (existing === undefined) node[parts[i]] = {}
    else if (!isObject(existing)) {
      target[path] = value
      return
    }
    node = node[parts[i]] as Record<string, unknown>
  }
  const leaf = parts[parts.length - 1] ?? path
  if (isObject(node[leaf])) target[path] = value
  else node[leaf] = value
}

function normalizeTable(table: unknown, index: number): StructuredDocument['tables'][number] {
  if (!isObject(table)) throw new InvalidResponse(`le tableau n°${index + 1} n’est pas un objet`)
  const columns = Array.isArray(table.columns) ? table.columns.map((c) => String(c)) : []
  const rows = Array.isArray(table.rows) ? table.rows : []
  return {
    name: typeof table.name === 'string' ? table.name : `tableau_${index + 1}`,
    columns,
    rows: rows.map((row) => (Array.isArray(row) ? row.map(toScalar) : [toScalar(row)])),
  }
}

function toScalar(v: unknown): Scalar {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return JSON.stringify(v)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
