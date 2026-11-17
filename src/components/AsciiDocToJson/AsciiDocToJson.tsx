import { useEffect, useMemo, useRef } from 'react'
import { resolveConfig, type DocToJsonOptions } from './config'
import { startDocToJson, type DocToJsonHandle } from './engine'
import './AsciiDocToJson.css'

interface AsciiDocToJsonProps extends DocToJsonOptions {
  /** true pendant l'analyse d'un fichier : la phase de scan accélère (feedback visuel). */
  busy?: boolean
}

/**
 * Fond animé : un document ASCII est scanné puis se transforme en JSON, en boucle.
 * Purement décoratif : aria-hidden, pointer-events: none, derrière le contenu.
 *
 * Réglages par défaut dans ./config.ts, modèles dans ./asciiTemplates.ts ; tout est
 * surchargeable en props, ex. : <AsciiDocToJson opacity={0.3} speed={0.8} phases={{ hold: 5 }} />
 */
export default function AsciiDocToJson({ busy = false, ...options }: AsciiDocToJsonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<DocToJsonHandle | null>(null)
  const busyRef = useRef(busy)
  // Clé stable : le moteur ne redémarre que si un réglage change réellement.
  const key = JSON.stringify(options)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => resolveConfig(options), [key])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = startDocToJson(canvas, config)
    engine.setBusy(busyRef.current)
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [config])

  useEffect(() => {
    busyRef.current = busy
    engineRef.current?.setBusy(busy)
  }, [busy])

  return (
    <div
      className="doc-json-bg"
      aria-hidden="true"
      style={{ '--cell': '12px', '--grid-opacity': config.gridOpacity, '--canvas-opacity': config.opacity } as React.CSSProperties}
    >
      <div className="doc-json-bg__grid" data-grid={config.grid} />
      <canvas ref={canvasRef} className="doc-json-bg__canvas" />
    </div>
  )
}
