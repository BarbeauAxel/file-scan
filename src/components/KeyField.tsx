import { useState } from 'react'
import { maskKey } from '../storage/keys'

interface KeyFieldProps {
  label: string
  value: string | null
  onSave: (value: string | null) => void
  keyUrl: string
  placeholder?: string
}

/** Saisie d'une clé API : jamais réaffichée en clair une fois enregistrée. */
export default function KeyField({ label, value, onSave, keyUrl, placeholder }: KeyFieldProps) {
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState(false)
  const id = `key-${label.replace(/\W+/g, '-').toLowerCase()}`

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
        <span className="text-emerald-800">
          {label} enregistrée : <code className="font-mono">{maskKey(value)}</code>
        </span>
        <button type="button" onClick={() => onSave(null)} className="text-emerald-700 underline hover:text-emerald-900">
          Supprimer
        </button>
      </div>
    )
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) {
          onSave(draft)
          setDraft('')
        }
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}{' '}
        <a href={keyUrl} target="_blank" rel="noreferrer" className="font-normal text-indigo-600 underline">
          (obtenir une clé)
        </a>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-16 font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-2 text-xs text-slate-500 hover:text-slate-800"
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
    </form>
  )
}
