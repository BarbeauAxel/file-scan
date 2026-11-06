import { OCR_LANGUAGES } from '../config'
import { LLM_PROVIDERS, type LlmProviderId } from '../llm'
import { OCR_ENGINES, type OcrEngineId } from '../ocr'
import type { useKeys } from '../storage/keys'
import type { Settings as SettingsValue } from '../storage/settings'
import KeyField from './KeyField'
import ModelPicker from './ModelPicker'

interface SettingsProps {
  settings: SettingsValue
  onChange: (settings: SettingsValue) => void
  keyStore: ReturnType<typeof useKeys>
  onOpenRouterLogin: () => void
  disabled?: boolean
}

const PROVIDER_ORDER: LlmProviderId[] = ['openrouter', 'openai', 'anthropic']

const KEY_PLACEHOLDERS: Record<LlmProviderId, string> = {
  openrouter: 'sk-or-…',
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
}

export default function Settings({ settings, onChange, keyStore, onOpenRouterLogin, disabled }: SettingsProps) {
  const { keys, remember, setKey, setRemember, clearKeys } = keyStore
  const provider = settings.llmProvider
  const hasAnyKey = Object.values(keys).some(Boolean)

  function toggleLanguage(code: string) {
    const has = settings.ocrLanguages.includes(code)
    const next = has ? settings.ocrLanguages.filter((c) => c !== code) : [...settings.ocrLanguages, code]
    if (next.length === 0) return // au moins une langue
    onChange({ ...settings, ocrLanguages: next })
  }

  return (
    <fieldset disabled={disabled} className="grid gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-slate-700">Réglages</legend>

      {/* --- OCR --- */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">1. OCR</h2>
        <div className="space-y-1">
          <label htmlFor="ocr-engine" className="block text-sm font-medium text-slate-700">
            Moteur
          </label>
          <select
            id="ocr-engine"
            value={settings.ocrEngine}
            onChange={(e) => onChange({ ...settings, ocrEngine: e.target.value as OcrEngineId })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.values(OCR_ENGINES).map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {settings.ocrEngine === 'tesseract'
              ? 'Gratuit et sans quota : le fichier ne quitte pas votre navigateur.'
              : 'Le fichier est envoyé à OCR.space. Plan gratuit : 25 000 requêtes/mois, 1 Mo par fichier (images compressées automatiquement), 3 pages max par PDF.'}
          </p>
        </div>
        {settings.ocrEngine === 'ocrspace' && (
          <KeyField
            label="Clé OCR.space"
            value={keys.ocrspace}
            onSave={(v) => setKey('ocrspace', v)}
            keyUrl="https://ocr.space/ocrapi/freekey"
            placeholder="K8…"
          />
        )}
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Langues du document</h3>
          <div className="flex flex-wrap gap-2">
            {OCR_LANGUAGES.map((l) => {
              const active = settings.ocrLanguages.includes(l.code)
              return (
                <button
                  key={l.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLanguage(l.code)}
                  className={[
                    'rounded-full border px-3 py-1 text-sm transition',
                    active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600 hover:border-slate-400',
                  ].join(' ')}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- LLM --- */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">2. Structuration par LLM</h2>
        <div className="space-y-1">
          <label htmlFor="llm-provider" className="block text-sm font-medium text-slate-700">
            Fournisseur
          </label>
          <select
            id="llm-provider"
            value={provider}
            onChange={(e) => onChange({ ...settings, llmProvider: e.target.value as SettingsValue['llmProvider'] })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="none">Aucun — OCR seul</option>
            {PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>
                {LLM_PROVIDERS[id].label}
                {keys[id] ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Vous utilisez vos propres crédits. Le texte OCR est envoyé directement depuis votre navigateur au fournisseur choisi.
          </p>
        </div>

        {provider !== 'none' && (
          <>
            <ModelPicker
              provider={provider}
              apiKey={keys[provider]}
              value={settings.models[provider]}
              onChange={(model) => onChange({ ...settings, models: { ...settings.models, [provider]: model } })}
            />
            {provider === 'openrouter' && !keys.openrouter && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onOpenRouterLogin}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Se connecter avec OpenRouter
                </button>
                <p className="text-center text-xs text-slate-500">
                  Vous autorisez file-scan sur openrouter.ai ; une clé liée à votre compte est créée. Ou saisissez une clé
                  existante :
                </p>
              </div>
            )}
            <KeyField
              label={`Clé ${LLM_PROVIDERS[provider].label}`}
              value={keys[provider]}
              onSave={(v) => setKey(provider, v)}
              keyUrl={LLM_PROVIDERS[provider].keyUrl}
              placeholder={KEY_PLACEHOLDERS[provider]}
            />
          </>
        )}
      </div>

      {/* --- Clés --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 md:col-span-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!remember}
            onChange={(e) => setRemember(!e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ne pas mémoriser mes clés (effacées à la fermeture de l’onglet)
        </label>
        <button
          type="button"
          onClick={clearKeys}
          disabled={!hasAnyKey}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Effacer toutes les clés enregistrées
        </button>
      </div>
    </fieldset>
  )
}
