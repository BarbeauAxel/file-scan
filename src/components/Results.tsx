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
  high: { label: 'Confiance élevée', className: 'bg-emerald-100 text-emerald-800' },
  medium: { label: 'Confiance moyenne', className: 'bg-amber-100 text-amber-800' },
  low: { label: 'Confiance faible', className: 'bg-red-100 text-red-800' },
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

  const tabClass = (t: Tab) =>
    [
      'rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition',
      tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800',
    ].join(' ')

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Résultats">
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={[
            'mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
            notice.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
          ].join(' ')}
        >
          <span data-testid="notice">{notice.message}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="rounded-md border border-current px-2 py-1 text-xs font-medium">
              Relancer la structuration
            </button>
          )}
        </div>
      )}
      {doc && (
        <div className="mb-4 space-y-2" data-testid="summary">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 uppercase tracking-wide text-indigo-800">{doc.document_type}</span>
            {doc.language && <span className="rounded-full bg-slate-100 px-2.5 py-1 uppercase text-slate-700">{doc.language}</span>}
            <span className={`rounded-full px-2.5 py-1 ${CONFIDENCE_STYLES[doc.confidence].className}`}>
              {CONFIDENCE_STYLES[doc.confidence].label}
            </span>
          </div>
          <p className="text-slate-700">{doc.summary}</p>
          {doc.warnings.length > 0 && (
            <ul className="list-inside list-disc rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {doc.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200">
        <div role="tablist" className="flex">
          <button role="tab" aria-selected={tab === 'json'} className={tabClass('json')} onClick={() => setTab('json')}>
            JSON structuré
          </button>
          <button role="tab" aria-selected={tab === 'text'} className={tabClass('text')} onClick={() => setTab('text')}>
            Texte OCR brut
          </button>
        </div>
        <div className="flex gap-2 pb-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {copied === 'ok' ? 'Copié ✓' : copied === 'error' ? 'Copie impossible' : 'Copier'}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Télécharger .json
          </button>
        </div>
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === 'json' ? (
          <JsonViewer json={json} />
        ) : (
          <div className="space-y-4" data-testid="ocr-text">
            {pages.map((p) => (
              <div key={p.page}>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Page {p.page}</span>
                  <span>
                    {p.confidence === null ? 'confiance non fournie' : `confiance ${Math.round(p.confidence * 100)} %`}
                  </span>
                </div>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                  {p.text || <span className="italic text-slate-400">(aucun texte détecté)</span>}
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
