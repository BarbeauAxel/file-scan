import { useEffect, useRef, useState } from 'react'
import Dropzone from './components/Dropzone'
import ProgressBar from './components/ProgressBar'
import Results from './components/Results'
import Settings from './components/Settings'
import { isAbortError, toUserMessage } from './lib/errors'
import type { OcrProgress } from './ocr'
import { runScan, type ScanResult } from './pipeline'
import { loadSettings, saveSettings, type Settings as SettingsValue } from './storage/settings'

type Status =
  | { phase: 'idle' }
  | { phase: 'running'; step: 'ocr' | 'llm'; progress: OcrProgress | null }
  | { phase: 'done'; result: ScanResult }
  | { phase: 'error'; message: string }

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [settings, setSettings] = useState<SettingsValue>(loadSettings)
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => () => abortRef.current?.abort(), [])

  const running = status.phase === 'running'

  async function scan() {
    if (!file) return
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ phase: 'running', step: 'ocr', progress: null })
    try {
      const result = await runScan(
        file,
        settings,
        { onProgress: (step, progress) => setStatus({ phase: 'running', step, progress }) },
        controller.signal,
      )
      setStatus({ phase: 'done', result })
    } catch (err) {
      if (isAbortError(err)) setStatus({ phase: 'idle' })
      else setStatus({ phase: 'error', message: toUserMessage(err) })
    } finally {
      abortRef.current = null
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <header>
          <h1 className="text-3xl font-bold">file-scan</h1>
          <p className="mt-2 text-slate-600">Déposez un document, obtenez un JSON structuré.</p>
        </header>

        <Dropzone
          file={file}
          onFileChange={(f) => {
            setFile(f)
            setStatus({ phase: 'idle' })
          }}
          disabled={running}
        />
        <Settings settings={settings} onChange={setSettings} disabled={running} />

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
          <Results pages={status.result.pages} json={status.result.json} fileName={file.name} notice={status.result.notice} />
        )}
      </div>
    </main>
  )
}
