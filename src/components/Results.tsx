import { useMemo, useState } from 'react'
import type { StructuredDocument } from '../llm'
import type { OcrPage } from '../ocr'
import JsonViewer from './JsonViewer'

interface ResultsProps {
  pages: OcrPage[]
  json: string
  fileName: string
  /** true si le JSON est l'enveloppe produite par le LLM. */
  structured: boolean
  /** Avertissement non bloquant (ex. structuration LLM échouée, repli sur l'OCR seul). */
  notice?: { tone: 'info' | 'error'; message: string } | null
  /** Action proposée à côté de l'avertissement (ex. relancer la structuration). */
  onRetry?: () => void
}

type Tab = 'json' | 'text'

const CONFIDENCE_STYLES: Record<StructuredDocument['confidence'], { label: string; className: string }> = {
  high: { label: 'Confiance élevée', className: 'chip--success' },
  medium: { label: 'Confiance moyenne', className: 'chip--warning' },
  low: { label: 'Confiance faible', className: 'chip--danger' },
}

export default function Results({ pages, json, fileName, structured, notice, onRetry }: ResultsProps) {
  const [tab, setTab] = useState<Tab>('json')
  const doc = useMemo(() => (structured ? (JSON.parse(json) as StructuredDocument) : null), [json, structured])
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab === 'json' ? json : pagesToText(pages))
      setCopied('ok')
    } catch {
      setCopied('error')
    }
    setTimeout(() => setCopied(null), 2000)
  }

  function download() {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.[^.]+$/, '') || 'document'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="appear flex h-full min-h-0 flex-col gap-4" aria-label="Résultats">
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`alert flex-wrap items-center justify-between ${notice.tone === 'error' ? 'alert--error' : 'alert--warning'}`}
        >
          <span data-testid="notice">{notice.message}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn--sm">
              Relancer la structuration
            </button>
          )}
        </div>
      )}
      {doc && (
        <div className="flex flex-col gap-3" data-testid="summary">
          <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
            <li className="chip chip--accent font-medium uppercase tracking-[0.06em]">
              <span className="dot" aria-hidden="true" />
              {doc.document_type}
            </li>
            {doc.language && <li className="chip uppercase">{doc.language}</li>}
            <li className={`chip ${CONFIDENCE_STYLES[doc.confidence].className}`}>{CONFIDENCE_STYLES[doc.confidence].label}</li>
          </ul>
          <p className="m-0 text-[15px] leading-relaxed text-muted">{doc.summary}</p>
          {doc.warnings.length > 0 && (
            <ul className="alert alert--warning m-0 list-inside list-disc flex-col gap-1">
              {doc.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="tabs" aria-label="Format du résultat">
          <button role="tab" aria-selected={tab === 'json'} className="tab" onClick={() => setTab('json')}>
            <span className="dot" aria-hidden="true" />
            JSON structuré
          </button>
          <button role="tab" aria-selected={tab === 'text'} className="tab" onClick={() => setTab('text')}>
            <span className="dot" aria-hidden="true" />
            Texte OCR brut
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className="btn btn--sm">
            {copied === 'ok' ? 'Copié ✓' : copied === 'error' ? 'Copie impossible' : 'Copier'}
          </button>
          <button type="button" onClick={download} className="btn btn--primary btn--sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2.5v8m0 0L4.5 7M8 10.5L11.5 7M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Télécharger .json
          </button>
        </div>
      </div>

      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {tab === 'json' ? (
          <JsonViewer json={json} />
        ) : (
          <div className="flex min-h-0 flex-col gap-4 overflow-auto" data-testid="ocr-text">
            {pages.map((p) => (
              <div key={p.page} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 px-1 text-xs text-faint">
                  <span className="eyebrow">Page {p.page}</span>
                  <span className="font-mono">
                    {p.confidence === null ? 'confiance non fournie' : `confiance ${Math.round(p.confidence * 100)} %`}
                  </span>
                </div>
                <pre className="code-block max-h-96 whitespace-pre-wrap break-words text-muted">
                  {p.text || <span className="italic text-faint">(aucun texte détecté)</span>}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function pagesToText(pages: OcrPage[]): string {
  return pages.map((p) => (pages.length > 1 ? `--- Page ${p.page} ---\n${p.text}` : p.text)).join('\n\n')
}
