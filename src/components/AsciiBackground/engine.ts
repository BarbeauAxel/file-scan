/**
 * Moteur du fond animé (version mono-scène du moteur du portfolio).
 *
 * Pipeline par frame :
 *   1. SIMULATION  scene.step()    la scène avance (unités = cellules)
 *   2. GRILLE      scene.draw()    elle écrit intensité + nuance + caractère dans un CellBuffer
 *   3. RENDU       renderer.draw() CellBuffer → pixels (ASCII via atlas)
 *
 * Coût maîtrisé : boucle arrêtée quand l'onglet est caché, image figée (0 CPU au repos)
 * si prefers-reduced-motion, DPR plafonné à 2.
 */
import { createAuroraScene } from './aurora'
import { CellBuffer, GLYPHS, Painter } from './cells'
import type { AsciiBackgroundConfig } from './config'
import { createAsciiRenderer, type View } from './renderers'
import type { PointerState, SceneContext } from './shared'

/** Clic sur le FOND uniquement : pas sur un bouton, un lien, un champ ou une carte. */
const INTERFACE = 'a, button, input, textarea, select, label, summary, [role="button"], [role="tab"], .glass, .glass-lite, [data-ui]'

/** Démarre le fond animé sur un canvas. Renvoie une fonction de nettoyage. */
export function startAsciiBackground(canvas: HTMLCanvasElement, cfg: AsciiBackgroundConfig): () => void {
  const ctx2d = canvas.getContext('2d', { alpha: true })
  if (!ctx2d) return () => {}
  const g = ctx2d
  const cell = cfg.cellSize

  const buffer = new CellBuffer()
  const painter = new Painter(buffer)
  const scene = createAuroraScene(cfg)
  const renderer = createAsciiRenderer(cfg.colors, GLYPHS, cfg)
  const view: View = { dpr: 1, width: 0, height: 0, colEdges: new Int32Array(0), rowEdges: new Int32Array(0) }
  const sceneCtx: SceneContext = { cols: 0, rows: 0, pointer: null }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = motionQuery.matches
  let raf = 0
  let lastTime = 0
  let simTime = 0

  /* --- Curseur (position + vitesse lissée, en cellules) --- */
  let pointer: PointerState | null = null
  let lastPointerTime = 0

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) // au-delà de 2 : coût sans gain visible
    const cssW = canvas.clientWidth || window.innerWidth
    const cssH = canvas.clientHeight || window.innerHeight
    view.dpr = dpr
    view.width = canvas.width = Math.round(cssW * dpr)
    view.height = canvas.height = Math.round(cssH * dpr)

    const cols = Math.ceil(cssW / cell)
    const rows = Math.ceil(cssH / cell)
    view.colEdges = Int32Array.from({ length: cols + 1 }, (_, c) => Math.round(c * cell * dpr))
    view.rowEdges = Int32Array.from({ length: rows + 1 }, (_, r) => Math.round(r * cell * dpr))
    renderer.resize(view)

    if (cols !== buffer.cols || rows !== buffer.rows) {
      buffer.resize(cols, rows)
      scene.resize(cols, rows)
    }
    sceneCtx.cols = cols
    sceneCtx.rows = rows
  }

  function speedFactor(): number {
    if (!reducedMotion) return cfg.speed
    return cfg.reducedMotion === 'slow' ? cfg.speed * cfg.reducedMotionSpeed : 0
  }

  /** dt plafonné à 50 ms (pas de saut après un ralentissement). En mode figé, une seule frame. */
  function frame(now: number): void {
    raf = 0
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    // La vitesse du curseur retombe quand il ne bouge plus.
    if (pointer) {
      const decay = Math.exp(-dt * 6)
      pointer.vx *= decay
      pointer.vy *= decay
    }
    sceneCtx.pointer = pointer

    const factor = speedFactor()
    if (factor > 0) {
      const simDt = dt * factor
      simTime += simDt
      scene.step(simDt, sceneCtx)
    }

    buffer.begin()
    scene.draw(painter, simTime, sceneCtx)
    renderer.draw(g, buffer, view)

    if (factor > 0) raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (raf || document.hidden) return
    lastTime = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  /* --- Événements (tous passifs, sur window : le canvas lui-même ne reçoit aucun clic) --- */

  let resizeQueued = false
  const onResize = () => {
    if (resizeQueued) return
    resizeQueued = true
    requestAnimationFrame(() => {
      resizeQueued = false
      resize()
      start() // redessine même en mode figé
    })
  }

  const onVisibility = () => (document.hidden ? stop() : start())

  const onMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches
    start()
  }

  const onPointerMove = (e: PointerEvent) => {
    const x = e.clientX / cell
    const y = e.clientY / cell
    const t = e.timeStamp
    if (pointer && t > lastPointerTime) {
      const dt = Math.max((t - lastPointerTime) / 1000, 0.008)
      // Vitesse lissée, bornée pour éviter les à-coups.
      const vx = Math.max(-80, Math.min(80, (x - pointer.x) / dt))
      const vy = Math.max(-80, Math.min(80, (y - pointer.y) / dt))
      pointer.vx += (vx - pointer.vx) * 0.3
      pointer.vy += (vy - pointer.vy) * 0.3
      pointer.x = x
      pointer.y = y
    } else {
      pointer = { x, y, vx: 0, vy: 0 }
    }
    lastPointerTime = t
  }
  const clearPointer = () => {
    pointer = null
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || speedFactor() === 0) return
    const target = e.target as Element | null
    if (target?.closest?.(INTERFACE)) return
    scene.click(e.clientX / cell, e.clientY / cell)
    start()
  }
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer = null // au doigt, pas de « survol » persistant
  }

  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  motionQuery.addEventListener('change', onMotionChange)
  if (cfg.interactive) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('blur', clearPointer)
    document.documentElement.addEventListener('pointerleave', clearPointer)
  }

  resize()
  // Pré-simulation : la scène démarre « déjà vivante » (étoile filante lancée…).
  const warmStep = 1 / 30
  const warmCtx: SceneContext = { cols: sceneCtx.cols, rows: sceneCtx.rows, pointer: null }
  for (let i = 0, n = Math.round(cfg.warmupSeconds / warmStep); i < n; i++) scene.step(warmStep, warmCtx)
  simTime = cfg.warmupSeconds
  start()

  return () => {
    stop()
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    motionQuery.removeEventListener('change', onMotionChange)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('blur', clearPointer)
    document.documentElement.removeEventListener('pointerleave', clearPointer)
  }
}
