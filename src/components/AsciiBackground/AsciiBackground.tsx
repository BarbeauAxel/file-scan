import { useEffect, useMemo, useRef } from 'react'
import { resolveConfig, type AsciiBackgroundOptions } from './config'
import { startAsciiBackground } from './engine'
import './AsciiBackground.css'

/**
 * Fond fixe derrière toute la page (repris du portfolio) :
 *   1. dégradé radial (CSS)
 *   2. grille de points (CSS, statique → coût nul par frame)
 *   3. canvas de l'aurore ASCII violette
 * Purement décoratif : aria-hidden, pointer-events: none.
 *
 * Réglages par défaut dans ./config.ts ; chacun peut être surchargé en props, ex. :
 *   <AsciiBackground colors={['#5fd4ec', '#3b7cf0', '#b3f0fb']} speed={0.5} chars={{ dense: '#' }} />
 */
export default function AsciiBackground(props: AsciiBackgroundOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Clé stable : on ne redémarre le moteur que si un réglage change réellement.
  const key = JSON.stringify(props)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => resolveConfig(props), [key])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return startAsciiBackground(canvas, config)
  }, [config])

  return (
    <div
      className="ascii-bg"
      aria-hidden="true"
      style={{ '--cell': `${config.cellSize}px`, '--grid-opacity': config.gridOpacity } as React.CSSProperties}
    >
      <div className="ascii-bg__grid" data-grid={config.grid} />
      <canvas ref={canvasRef} className="ascii-bg__canvas" />
    </div>
  )
}
