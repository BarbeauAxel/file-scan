import { useEffect, useState } from 'react'
import { DEFAULT_MODELS, type ModelOption } from '../config'
import { toUserMessage } from '../lib/errors'
import { LLM_PROVIDERS, type LlmProviderId } from '../llm'

const CUSTOM = '__custom__'

interface ModelPickerProps {
  provider: LlmProviderId
  apiKey: string | null
  value: string
  onChange: (model: string) => void
}

/**
 * Choix du modèle : liste par défaut (config.ts), liste chargée depuis le fournisseur,
 * ou identifiant saisi librement.
 */
export default function ModelPicker({ provider, apiKey, value, onChange }: ModelPickerProps) {
  const [loaded, setLoaded] = useState<Partial<Record<LlmProviderId, ModelOption[]>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)

  const options = mergeOptions(DEFAULT_MODELS[provider], loaded[provider] ?? [])
  const inList = options.some((o) => o.id === value)
  const showCustom = customMode || !inList

  async function load(signal?: AbortSignal) {
    const impl = LLM_PROVIDERS[provider]
    if (!impl.listModels) return
    setLoading(true)
    setError(null)
    try {
      const models = await impl.listModels(apiKey, signal)
      setLoaded((prev) => ({ ...prev, [provider]: models }))
    } catch (err) {
      if (!signal?.aborted) setError(toUserMessage(err))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  // La liste OpenRouter est publique : on la charge automatiquement.
  useEffect(() => {
    if (provider !== 'openrouter' || loaded.openrouter) return
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const canLoad = provider === 'openrouter' || Boolean(apiKey)

  return (
    <div className="space-y-1">
      <label htmlFor="model" className="block text-sm font-medium text-slate-700">
        Modèle
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="model"
          value={showCustom ? CUSTOM : value}
          onChange={(e) => {
            if (e.target.value === CUSTOM) setCustomMode(true)
            else {
              setCustomMode(false)
              onChange(e.target.value)
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label === o.id ? o.id : `${o.label} — ${o.id}`}
            </option>
          ))}
          <option value={CUSTOM}>Autre (saisir l’identifiant)…</option>
        </select>
        {LLM_PROVIDERS[provider].listModels && provider !== 'openrouter' && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={!canLoad || loading}
            title={canLoad ? undefined : 'Enregistrez d’abord une clé'}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            {loading ? 'Chargement…' : 'Charger les modèles du compte'}
          </button>
        )}
      </div>
      {showCustom && (
        <input
          aria-label="Identifiant du modèle"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="identifiant exact du modèle"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
        />
      )}
      {provider === 'openrouter' && loading && <p className="text-xs text-slate-500">Chargement de la liste OpenRouter…</p>}
      {loaded[provider] && (
        <p className="text-xs text-slate-500">{loaded[provider]!.length} modèles disponibles.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function mergeOptions(defaults: ModelOption[], loaded: ModelOption[]): ModelOption[] {
  const seen = new Set(defaults.map((o) => o.id))
  return [...defaults, ...loaded.filter((o) => !seen.has(o.id))]
}
