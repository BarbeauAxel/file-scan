import { useState } from 'react'
import Dropzone from './components/Dropzone'

export default function App() {
  const [file, setFile] = useState<File | null>(null)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <header>
          <h1 className="text-3xl font-bold">file-scan</h1>
          <p className="mt-2 text-slate-600">Déposez un document, obtenez un JSON structuré.</p>
        </header>
        <Dropzone file={file} onFileChange={setFile} />
      </div>
    </main>
  )
}
