import { useEffect, useRef, useState } from 'react'
import AsciiDocToJson from './components/AsciiDocToJson'
import AsciiTitle from './components/AsciiTitle'
import { completeOpenRouterLogin, startOpenRouterLogin } from './auth/openrouterOAuth'
import Dropzone from './components/Dropzone'
import ProgressBar from './components/ProgressBar'
import Results from './components/Results'
import SectionHeader from './components/SectionHeader'
import Settings from './components/Settings'
import { isAbortError, toUserMessage } from './lib/errors'
import type { OcrPage, OcrProgress } from './ocr'
import { runScan, structurePages, type ScanContext, type ScanResult, type ScanStep } from './pipeline'
import { useKeys } from './storage/keys'
import { loadSettings, saveSettings, type Settings as SettingsValue } from './storage/settings'

type Status =
  | { phase: 'idle' }
  | { phase: 'running'; step: ScanStep; progress: OcrProgress | null }
  | { phase: 'done'; result: ScanResult }
  | { phase: 'error'; message: string }

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [settings, setSettings] = useState<SettingsValue>(loadSettings)
  const keyStore = useKeys()
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const { setKey } = keyStore

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => () => abortRef.current?.abort(), [])

  // Retour de la connexion OAuth OpenRouter (?code=…).
  useEffect(() => {
    completeOpenRouterLogin()
      .then((key) => {
        if (!key) return
        setKey('openrouter', key)
        setSettings((s) => ({ ...s, llmProvider: 'openrouter' }))
        setBanner({ tone: 'success', message: 'Connecté à OpenRouter : la clé de votre compte est enregistrée dans ce navigateur.' })
      })
      .catch((err) => setBanner({ tone: 'error', message: toUserMessage(err) }))
  }, [setKey])

  async function openRouterLogin() {
    try {
      await startOpenRouterLogin()
    } catch (err) {
      setBanner({ tone: 'error', message: toUserMessage(err) })
    }
  }

  const running = status.phase === 'running'

  async function execute(task: (ctx: ScanContext) => Promise<ScanResult>, firstStep: ScanStep) {
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ phase: 'running', step: firstStep, progress: null })
    try {
      const result = await task({
        settings,
        keys: keyStore.keys,
        signal: controller.signal,
        onProgress: (step, progress) => setStatus({ phase: 'running', step, progress }),
      })
      setStatus({ phase: 'done', result })
    } catch (err) {
      if (isAbortError(err)) setStatus({ phase: 'idle' })
      else setStatus({ phase: 'error', message: toUserMessage(err) })
    } finally {
      abortRef.current = null
    }
  }

  const scan = () => file && execute((ctx) => runScan(file, ctx), 'ocr')
  const restructure = (pages: OcrPage[]) => execute((ctx) => structurePages(pages, ctx), 'llm')

  return (
    <>
      <AsciiDocToJson busy={running} />

      {banner && (
        <div
          role={banner.tone === 'error' ? 'alert' : 'status'}
          data-testid="banner"
          className={`toast alert appear ${banner.tone === 'error' ? 'alert--error' : 'alert--success'}`}
        >
          <span>{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Fermer" className="alert__close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="app page">
        <header className="topbar">
          <div className="topbar__brand">
            <AsciiTitle />
            <p className="topbar__title">Document → OCR → JSON structuré</p>
          </div>
          <p className="topbar__tagline">
            Déposez un document (facture, CV, formulaire, ticket, courrier…), obtenez un JSON structuré. Tout se passe dans
            votre navigateur.
          </p>
          <p className="topbar__badge glass">
            <span className="pulse" aria-hidden="true" />
            100 % local
          </p>
        </header>

        <main className="bento">
          {/* 01 · Document + lancement */}
          <section className="tile tile--drop glass-lite" aria-labelledby="section-document">
            <SectionHeader index="01" title="Document" id="section-document" />
            <div className="tile__body">
              <Dropzone
                file={file}
                onFileChange={(f) => {
                  setFile(f)
                  setStatus({ phase: 'idle' })
                }}
                disabled={running}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={scan} disabled={!file || running} className="btn btn--primary btn--lg">
                {running ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    Scanner
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
              {running && (
                <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn--ghost">
                  Annuler
                </button>
              )}
              {!file && <span className="hint">Déposez d’abord un fichier.</span>}
            </div>
            {status.phase === 'running' && (
              <ProgressBar
                value={status.step === 'ocr' ? (status.progress?.progress ?? null) : null}
                label={status.progress?.status ?? (status.step === 'ocr' ? 'Préparation…' : 'Structuration par le LLM…')}
              />
            )}
            {status.phase === 'error' && (
              <p role="alert" className="alert alert--error appear">
                {status.message}
              </p>
            )}
          </section>

          {/* 02 · Réglages */}
          <section className="tile tile--settings glass-lite @container" aria-labelledby="section-settings">
            <SectionHeader index="02" title="Réglages" id="section-settings" />
            <div className="tile__body tile__body--scroll">
              <Settings
                settings={settings}
                onChange={setSettings}
                keyStore={keyStore}
                onOpenRouterLogin={openRouterLogin}
                disabled={running}
              />
            </div>
          </section>

          {/* 03 · Résultat */}
          <section className="tile tile--result glass-lite" aria-labelledby="section-result">
            <SectionHeader index="03" title="Résultat" id="section-result" />
            <div className="tile__body">
              {status.phase === 'done' && file ? (
                <Results
                  pages={status.result.pages}
                  json={status.result.json}
                  fileName={file.name}
                  structured={status.result.structured}
                  notice={status.result.notice}
                  onRetry={
                    status.result.notice?.tone === 'error' ? () => restructure((status as { result: ScanResult }).result.pages) : undefined
                  }
                />
              ) : (
                <div className="empty-state">
                  <span className="empty-state__glyph" aria-hidden="true">
                    {'{ }'}
                  </span>
                  <p className="m-0">
                    {status.phase === 'running' ? 'Analyse en cours…' : 'Le JSON structuré apparaîtra ici après le scan.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="page__footer">
          Aucun serveur file-scan : vos fichiers et vos clés restent dans ce navigateur. Avec Tesseract, l’OCR est local ; avec
          OCR.space, le fichier est envoyé à OCR.space. Le texte extrait n’est envoyé qu’au fournisseur LLM que vous choisissez.
        </footer>
      </div>
    </>
  )
}
