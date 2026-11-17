import { useEffect, useRef, useState } from 'react'
import AsciiDocToJson from './components/AsciiDocToJson'
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

      <div className="app">
        <header className="hero shell">
          <p className="hero__badge glass">
            <span className="pulse" aria-hidden="true" />
            100 % dans votre navigateur
          </p>
          <h1 className="hero__name">file-scan</h1>
          <p className="hero__title">Document → OCR → JSON structuré</p>
          <p className="hero__tagline">
            Déposez un document (facture, CV, formulaire, ticket, courrier…), obtenez un JSON structuré. Tout se passe dans
            votre navigateur.
          </p>
        </header>

        <main className="shell flex flex-col gap-[clamp(40px,7vw,64px)] pb-16">
          {banner && (
            <div
              role={banner.tone === 'error' ? 'alert' : 'status'}
              data-testid="banner"
              className={`alert appear ${banner.tone === 'error' ? 'alert--error' : 'alert--success'}`}
            >
              <span>{banner.message}</span>
              <button type="button" onClick={() => setBanner(null)} aria-label="Fermer" className="alert__close">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <section aria-labelledby="section-document">
            <SectionHeader index="01" title="Document" id="section-document" />
            <Dropzone
              file={file}
              onFileChange={(f) => {
                setFile(f)
                setStatus({ phase: 'idle' })
              }}
              disabled={running}
            />
          </section>

          <section aria-labelledby="section-settings">
            <SectionHeader index="02" title="Réglages" id="section-settings" />
            <Settings
              settings={settings}
              onChange={setSettings}
              keyStore={keyStore}
              onOpenRouterLogin={openRouterLogin}
              disabled={running}
            />
          </section>

          <section aria-labelledby="section-result" className="flex flex-col gap-4">
            <SectionHeader index="03" title="Résultat" id="section-result" />

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
            {status.phase === 'idle' && (
              <div className="glass-lite empty-state">
                <span className="empty-state__glyph" aria-hidden="true">
                  {'{ }'}
                </span>
                <p className="m-0">Le JSON structuré apparaîtra ici après le scan.</p>
              </div>
            )}
            {status.phase === 'done' && file && (
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
            )}
          </section>
        </main>

        <footer className="shell footer">
          Aucun serveur file-scan : vos fichiers et vos clés restent dans ce navigateur. Avec Tesseract, l’OCR est local ; avec
          OCR.space, le fichier est envoyé à OCR.space. Le texte extrait n’est envoyé qu’au fournisseur LLM que vous choisissez.
        </footer>
      </div>
    </>
  )
}
