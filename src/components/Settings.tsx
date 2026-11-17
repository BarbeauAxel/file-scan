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
    <fieldset disabled={disabled} className="m-0 grid min-w-0 border-0 p-0 gap-x-8 gap-y-6 @2xl:grid-cols-2">
      <legend className="sr-only">Réglages</legend>

      {/* --- OCR --- */}
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="subhead">
          <span className="mr-2 font-mono text-[13px] font-normal text-accent">a.</span>OCR
        </h3>
        <div className="field">
          <label htmlFor="ocr-engine" className="label">
            Moteur
          </label>
          <select
            id="ocr-engine"
            value={settings.ocrEngine}
            onChange={(e) => onChange({ ...settings, ocrEngine: e.target.value as OcrEngineId })}
            className="input"
          >
            {Object.values(OCR_ENGINES).map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.label}
              </option>
            ))}
          </select>
          <p className="hint">
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
        <div className="field">
          <span className="label">Langues du document</span>
          <div className="flex flex-wrap gap-1.5">
            {OCR_LANGUAGES.map((l) => {
              const active = settings.ocrLanguages.includes(l.code)
              return (
                <button
                  key={l.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLanguage(l.code)}
                  className="chip chip-toggle"
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- LLM --- */}
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="subhead">
          <span className="mr-2 font-mono text-[13px] font-normal text-accent">b.</span>Structuration par LLM
        </h3>
        <div className="field">
          <label htmlFor="llm-provider" className="label">
            Fournisseur
          </label>
          <select
            id="llm-provider"
            value={provider}
            onChange={(e) => onChange({ ...settings, llmProvider: e.target.value as SettingsValue['llmProvider'] })}
            className="input"
          >
            <option value="none">Aucun — OCR seul</option>
            {PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>
                {LLM_PROVIDERS[id].label}
                {keys[id] ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <p className="hint">
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
              <div className="flex flex-col gap-2">
                <button type="button" onClick={onOpenRouterLogin} className="btn btn--primary w-full">
                  Se connecter avec OpenRouter
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <p className="hint text-center">
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass pt-5 @2xl:col-span-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted">
          <input type="checkbox" checked={!remember} onChange={(e) => setRemember(!e.target.checked)} className="checkbox" />
          Ne pas mémoriser mes clés (effacées à la fermeture de l’onglet)
        </label>
        <button type="button" onClick={clearKeys} disabled={!hasAnyKey} className="btn btn--danger btn--sm">
          Effacer toutes les clés enregistrées
        </button>
      </div>
    </fieldset>
  )
}
