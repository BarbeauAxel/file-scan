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
      <div className="alert alert--success flex-wrap items-center justify-between">
        <span>
          {label} enregistrée : <code className="text-[12.5px] text-text">{maskKey(value)}</code>
        </span>
        <button type="button" onClick={() => onSave(null)} className="link-btn text-[13px]">
          Supprimer
        </button>
      </div>
    )
  }

  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) {
          onSave(draft)
          setDraft('')
        }
      }}
    >
      <label htmlFor={id} className="label">
        {label}{' '}
        <a href={keyUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-normal text-muted">
          (obtenir une clé)
        </a>
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <div className="relative min-w-0 flex-1 basis-48">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="input input--mono pr-20"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="btn btn--ghost btn--sm absolute inset-y-1 right-1 min-h-0 px-2.5 text-xs"
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        <button type="submit" disabled={!draft.trim()} className="btn">
          Enregistrer
        </button>
      </div>
    </form>
  )
}
