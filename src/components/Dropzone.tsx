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

  // Coller une capture d'écran ou un fichier (Ctrl+V) n'importe où sur la page.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (disabled || (event.target as HTMLElement)?.closest?.('input, textarea')) return
      const pasted = Array.from(event.clipboardData?.files ?? [])[0]
      if (!pasted) return
      event.preventDefault()
      const named = pasted.name && pasted.name !== 'image.png' ? pasted : new File([pasted], `capture-${Date.now()}.png`, { type: pasted.type })
      accept(named)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

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
    <section className="flex flex-col gap-3">
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
        className={['dropzone glass-lite', dragOver ? 'is-dragover' : ''].join(' ')}
      >
        <span className="dropzone__icon" aria-hidden="true">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3m0 0L7.5 7.5M12 3l4.5 4.5M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
          </svg>
        </span>
        <p className="m-0 font-medium text-text">
          Glissez-déposez un document ici, ou{' '}
          <span className="text-accent underline decoration-[var(--accent-soft)] underline-offset-[3px]">parcourez</span>
        </p>
        <p className="hint">
          PNG, JPG, WEBP ou PDF (multi-pages) · ou collez une image avec <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">V</kbd>
        </p>
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
        <p role="alert" className="alert alert--error appear">
          {error}
        </p>
      )}

      {file && previewUrl && (
        <div className="glass-lite appear flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 pl-1 text-sm">
            <span className="truncate font-medium text-text" title={file.name}>
              {file.name} <span className="font-normal text-faint">· {formatBytes(file.size)}</span>
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setError(null)
                onFileChange(null)
              }}
              className="btn btn--ghost btn--sm shrink-0"
            >
              Retirer
            </button>
          </div>
          {isPdf(file) ? (
            <object data={previewUrl} type="application/pdf" className="preview h-96">
              <p className="hint p-4">Aperçu PDF indisponible dans ce navigateur.</p>
            </object>
          ) : (
            <img src={previewUrl} alt={`Aperçu de ${file.name}`} className="preview mx-auto max-h-96 w-auto object-contain" />
          )}
        </div>
      )}
    </section>
  )
}
