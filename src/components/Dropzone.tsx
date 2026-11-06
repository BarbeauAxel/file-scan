import { useEffect, useMemo, useRef, useState } from 'react'
import { ACCEPT_ATTRIBUTE, formatBytes, isPdf, validateFile } from '../lib/files'

interface DropzoneProps {
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

export default function Dropzone({ file, onFileChange, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function accept(candidate: File | undefined) {
    if (!candidate) return
    const problem = validateFile(candidate)
    setError(problem)
    if (!problem) onFileChange(candidate)
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragOver(false)
    if (disabled) return
    accept(event.dataTransfer.files[0])
  }

  return (
    <section className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
          dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <svg aria-hidden className="mb-3 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3m0 0L7.5 7.5M12 3l4.5 4.5M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
        </svg>
        <p className="font-medium text-slate-700">
          Glissez-déposez un document ici, ou <span className="text-indigo-600 underline">parcourez</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">PNG, JPG, WEBP ou PDF (multi-pages)</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {file && previewUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700" title={file.name}>
              {file.name} <span className="font-normal text-slate-500">· {formatBytes(file.size)}</span>
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setError(null)
                onFileChange(null)
              }}
              className="shrink-0 rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            >
              Retirer
            </button>
          </div>
          {isPdf(file) ? (
            <object data={previewUrl} type="application/pdf" className="h-96 w-full rounded-md bg-slate-100">
              <p className="p-4 text-sm text-slate-500">Aperçu PDF indisponible dans ce navigateur.</p>
            </object>
          ) : (
            <img src={previewUrl} alt={`Aperçu de ${file.name}`} className="mx-auto max-h-96 rounded-md object-contain" />
          )}
        </div>
      )}
    </section>
  )
}
