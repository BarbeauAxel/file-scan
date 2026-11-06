import { OCR_LANGUAGES } from '../config'
import type { Settings as SettingsValue } from '../storage/settings'

interface SettingsProps {
  settings: SettingsValue
  onChange: (settings: SettingsValue) => void
  disabled?: boolean
}

export default function Settings({ settings, onChange, disabled }: SettingsProps) {
  function toggleLanguage(code: string) {
    const has = settings.ocrLanguages.includes(code)
    const next = has ? settings.ocrLanguages.filter((c) => c !== code) : [...settings.ocrLanguages, code]
    if (next.length === 0) return // au moins une langue
    onChange({ ...settings, ocrLanguages: next })
  }

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-slate-700">Réglages</legend>
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
    </fieldset>
  )
}
