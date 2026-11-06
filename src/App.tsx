import { useEffect, useRef, useState } from 'react'
import { completeOpenRouterLogin, startOpenRouterLogin } from './auth/openrouterOAuth'
import Dropzone from './components/Dropzone'
import ProgressBar from './components/ProgressBar'
import Results from './components/Results'
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <header>
          <h1 className="text-3xl font-bold">file-scan</h1>
          <p className="mt-2 text-slate-600">
            Déposez un document (facture, CV, formulaire, ticket, courrier…), obtenez un JSON structuré. Tout se passe dans
            votre navigateur.
          </p>
        </header>

        {banner && (
          <div
            role={banner.tone === 'error' ? 'alert' : 'status'}
            data-testid="banner"
            className={[
              'flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm',
              banner.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800',
            ].join(' ')}
          >
            <span>{banner.message}</span>
            <button type="button" onClick={() => setBanner(null)} aria-label="Fermer" className="opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        <Dropzone
          file={file}
          onFileChange={(f) => {
            setFile(f)
            setStatus({ phase: 'idle' })
          }}
          disabled={running}
        />
        <Settings
          settings={settings}
          onChange={setSettings}
          keyStore={keyStore}
          onOpenRouterLogin={openRouterLogin}
          disabled={running}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={scan}
            disabled={!file || running}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Analyse en cours…' : 'Scanner'}
          </button>
          {running && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-200"
            >
              Annuler
            </button>
          )}
          {!file && <span className="text-sm text-slate-500">Déposez d’abord un fichier.</span>}
        </div>

        {status.phase === 'running' && (
          <ProgressBar
            value={status.step === 'ocr' ? (status.progress?.progress ?? null) : null}
            label={status.progress?.status ?? (status.step === 'ocr' ? 'Préparation…' : 'Structuration par le LLM…')}
          />
        )}
        {status.phase === 'error' && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {status.message}
          </p>
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

        <footer className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
          Aucun serveur file-scan : vos fichiers et vos clés restent dans ce navigateur. Avec Tesseract, l’OCR est local ; avec
          OCR.space, le fichier est envoyé à OCR.space. Le texte extrait n’est envoyé qu’au fournisseur LLM que vous choisissez.
        </footer>
      </div>
    </main>
  )
}
