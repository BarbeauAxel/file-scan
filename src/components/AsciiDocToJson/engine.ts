/**
 * Moteur du fond « document → JSON ».
 *
 * Boucle : APPEAR (le document s'écrit) → SCAN (une ligne descend, les caractères
 * dépassés tremblent) → TRANSFORM (chaque caractère glisse vers sa case du JSON)
 * → HOLD (le JSON reste affiché) → DISSOLVE (il se dissout en bruit) → GAP → modèle suivant.
 *
 * Tout est exprimé en CELLULES d'une grille monospace fixe ; une cellule = un caractère,
 * dessiné centré (les glyphes plus larges que la police, comme ▬, restent alignés).
 */
import type { DocTemplate } from './asciiTemplates'
import type { DocToJsonConfig } from './config'

type Kind = 'frame' | 'text' | 'key' | 'value' | 'punct'
type Phase = 'appear' | 'scan' | 'transform' | 'hold' | 'dissolve' | 'gap'
const PHASES: Phase[] = ['appear', 'scan', 'transform', 'hold', 'dissolve', 'gap']

interface Glyph {
  x: number
  y: number
  ch: string
  kind: Kind
}

interface Block {
  cells: Glyph[]
  width: number
  height: number
}

interface Particle {
  sx: number
  sy: number
  tx: number
  ty: number
  from: string
  to: string
  /** Style à l'arrivée (celui de la cible). */
  kind: Kind
  /** Style au départ (celui de la source). */
  srcKind: Kind
  /** move = source → cible ; out = source en trop, s'estompe ; in = cible sans source, apparaît en fondu. */
  mode: 'move' | 'out' | 'in'
  /** Début et durée du trajet, en fraction de la phase. */
  delay: number
  dur: number
  /** Hauteur de l'arc du trajet (cellules). */
  arc: number
  /** Valeur pseudo-aléatoire fixe par particule (0..1). */
  seed: number
}

export interface DocToJsonHandle {
  destroy(): void
  setBusy(busy: boolean): void
}

/* ------------------------------------------------------------------ */
/* Modèles → cellules                                                  */
/* ------------------------------------------------------------------ */

const BOX = /[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰·]/

function lines(src: string): string[] {
  const out = src.replace(/\r/g, '').split('\n')
  while (out.length && !out[0]!.trim()) out.shift()
  while (out.length && !out[out.length - 1]!.trim()) out.pop()
  return out
}

function parseDoc(src: string): Block {
  const rows = lines(src)
  const cells: Glyph[] = []
  let width = 0
  rows.forEach((row, y) => {
    const chars = Array.from(row)
    width = Math.max(width, chars.length)
    chars.forEach((ch, x) => {
      if (ch !== ' ') cells.push({ x, y, ch, kind: BOX.test(ch) ? 'frame' : 'text' })
    })
  })
  return { cells, width, height: rows.length }
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g

function parseJson(src: string): Block {
  const rows = lines(src)
  const cells: Glyph[] = []
  let width = 0
  rows.forEach((row, y) => {
    const chars = Array.from(row)
    width = Math.max(width, chars.length)
    // Type de chaque caractère (par index de code point).
    const kinds: Kind[] = chars.map(() => 'punct')
    const offsets: number[] = [] // index UTF-16 → index de code point
    let cp = 0
    for (let i = 0; i < row.length; i++) {
      offsets[i] = cp
      const code = row.charCodeAt(i)
      if (code < 0xd800 || code > 0xdbff) cp++
    }
    offsets[row.length] = cp
    for (const m of row.matchAll(JSON_TOKEN)) {
      const start = offsets[m.index!]!
      const end = offsets[m.index! + (m[1] ?? m[0]).length]!
      const kind: Kind = m[1] !== undefined && m[2] ? 'key' : 'value'
      for (let k = start; k < end; k++) kinds[k] = kind
    }
    chars.forEach((ch, x) => {
      if (ch !== ' ') cells.push({ x, y, ch, kind: kinds[x]! })
    })
  })
  return { cells, width, height: rows.length }
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Hash entier → [0, 1) : bruit déterministe (même caractère tant que le « tick » ne change pas). */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

function resolveColor(value: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim())
  if (!m) return value
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || '#b794ff'
}

/* ------------------------------------------------------------------ */
/* Moteur                                                              */
/* ------------------------------------------------------------------ */

export function startDocToJson(canvas: HTMLCanvasElement, cfg: DocToJsonConfig): DocToJsonHandle {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) return { destroy() {}, setBusy() {} }
  const ctx = maybeCtx

  const templates = cfg.templates.map((t: DocTemplate) => ({ doc: parseDoc(t.doc), json: parseJson(t.json) }))
  const maxDocW = Math.max(...templates.map((t) => t.doc.width))
  const maxJsonW = Math.max(...templates.map((t) => t.json.width))
  const maxW = Math.max(maxDocW, maxJsonW)
  const maxH = Math.max(...templates.flatMap((t) => [t.doc.height, t.json.height]))
  const noise = Array.from(cfg.noiseGlyphs)
  const colors = { text: '', key: '', scan: '' }

  // Grille
  let cssW = 0
  let cssH = 0
  let cw = 8 // largeur d'une cellule (px CSS)
  let ch = 16 // hauteur d'une cellule
  let split = false

  // Cycle
  let index = 0
  let phase: Phase = 'appear'
  let phaseTime = 0
  let clock = 0 // temps continu (bruit)
  let busy = false
  let docOrigin = { x: 0, y: 0 }
  let jsonOrigin = { x: 0, y: 0 }
  let particles: Particle[] = []

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motionQuery.matches
  let raf = 0
  let last = 0

  /* --- Mise en page --- */

  function measure(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Rapport largeur/hauteur d'un caractère de la police monospace.
    ctx.font = `500 100px ${cfg.fontFamily}`
    const ratio = ctx.measureText('M').width / 100 || 0.6

    // Côte à côte si la place le permet, sinon superposés (mobile) avec une police réduite.
    const splitCols = maxDocW + maxJsonW + 12
    split = cfg.layout === 'split' || (cfg.layout === 'auto' && cssW / (cfg.fontSize * ratio) >= splitCols)
    const needCols = split ? splitCols : maxW + 4
    const fitW = cssW / (needCols * ratio)
    const fitH = cssH / ((maxH + 4) * cfg.lineHeight)
    const maxFont = cssW < cfg.mobileBreakpoint ? Math.min(cfg.fontSize, cfg.mobileFontSize) : cfg.fontSize
    const font = Math.max(cfg.minFontSize, Math.min(maxFont, fitW, fitH))
    cw = font * ratio
    ch = font * cfg.lineHeight
    ctx.font = `500 ${font}px ${cfg.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    colors.text = resolveColor(cfg.colors.text)
    colors.key = resolveColor(cfg.colors.key)
    colors.scan = resolveColor(cfg.colors.scan)
  }

  /** Place le modèle courant et crée les particules source → cible. */
  function build(): void {
    const { doc, json } = templates[index]!
    const cols = cssW / cw
    const rows = cssH / ch
    const cy = rows * 0.5
    if (split) {
      const docX = Math.max(2, Math.round(cols * 0.27 - doc.width / 2))
      const jsonX = Math.max(docX + doc.width + 6, Math.round(cols * 0.73 - json.width / 2))
      docOrigin = { x: docX, y: Math.round(cy - doc.height / 2) }
      jsonOrigin = { x: jsonX, y: Math.round(cy - json.height / 2) }
    } else {
      docOrigin = { x: Math.round(cols / 2 - doc.width / 2), y: Math.round(cy - doc.height / 2) }
      jsonOrigin = { x: Math.round(cols / 2 - json.width / 2), y: Math.round(cy - json.height / 2) }
    }

    const src = doc.cells
    const dst = json.cells
    const n = src.length
    const m = dst.length
    particles = []
    const make = (s: Glyph | null, t: Glyph | null, mode: Particle['mode'], i: number): Particle => {
      const seed = hash(i, index * 7919 + 13)
      const sx = s ? docOrigin.x + s.x : jsonOrigin.x + t!.x
      const sy = s ? docOrigin.y + s.y : jsonOrigin.y + t!.y
      const tx = t ? jsonOrigin.x + t.x : sx
      const ty = t ? jsonOrigin.y + t.y : sy
      // Départ échelonné de haut en bas du document, avec un peu de hasard.
      const rel = s ? s.y / Math.max(1, doc.height - 1) : 0.5
      return {
        sx, sy, tx, ty,
        from: s?.ch ?? ' ',
        to: t?.ch ?? ' ',
        kind: t?.kind ?? 'text',
        srcKind: s?.kind ?? 'text',
        mode,
        delay: rel * 0.38 + seed * 0.14,
        dur: 0.4 + seed * 0.08,
        arc: (hash(i, 31) - 0.5) * (split ? 6 : 3),
        seed,
      }
    }
    if (n >= m) {
      // Chaque cible reçoit une source (réparties uniformément) ; le surplus s'estompe.
      const used = new Uint8Array(n)
      for (let j = 0; j < m; j++) {
        const i = Math.floor((j * n) / m)
        used[i] = 1
        particles.push(make(src[i]!, dst[j]!, 'move', i))
      }
      for (let i = 0; i < n; i++) if (!used[i]) particles.push(make(src[i]!, null, 'out', i))
    } else {
      // Chaque source va vers une cible ; les cibles restantes apparaissent en fondu.
      const used = new Uint8Array(m)
      for (let i = 0; i < n; i++) {
        const j = Math.floor((i * m) / n)
        used[j] = 1
        particles.push(make(src[i]!, dst[j]!, 'move', i))
      }
      for (let j = 0; j < m; j++) if (!used[j]) particles.push(make(null, dst[j]!, 'in', n + j))
    }
  }

  /* --- Dessin --- */

  function style(kind: Kind): { color: string; alpha: number } {
    if (kind === 'key') return { color: colors.key, alpha: cfg.alpha.key }
    if (kind === 'frame' || kind === 'punct') return { color: colors.text, alpha: cfg.alpha.frame }
    return { color: colors.text, alpha: cfg.alpha.text }
  }

  function put(x: number, y: number, glyph: string, color: string, alpha: number): void {
    if (alpha <= 0.01) return
    ctx.globalAlpha = alpha > 1 ? 1 : alpha
    ctx.fillStyle = color
    ctx.fillText(glyph, (x + 0.5) * cw, (y + 0.5) * ch)
  }

  /** Glyphe de bruit qui change ~14 fois par seconde (tremblement). */
  function noisy(seedA: number, rate = 14): string {
    return noise[Math.floor(hash(seedA, Math.floor(clock * rate)) * noise.length)] ?? '#'
  }

  function drawDocument(alphaOf: (p: Particle, i: number) => number, glyphOf: (p: Particle, i: number) => string): void {
    particles.forEach((p, i) => {
      if (p.mode === 'in') return
      const s = style(p.srcKind)
      put(p.sx, p.sy, glyphOf(p, i), s.color, s.alpha * alphaOf(p, i))
    })
  }

  function drawJson(alphaOf: (p: Particle, i: number) => number = () => 1, glyphOf: (p: Particle) => string = (p) => p.to): void {
    particles.forEach((p, i) => {
      if (p.mode === 'out') return
      const s = style(p.kind)
      put(p.tx, p.ty, glyphOf(p), s.color, s.alpha * alphaOf(p, i))
    })
  }

  function drawScanLine(y: number): void {
    const { doc } = templates[index]!
    const x0 = (docOrigin.x - 2) * cw
    const x1 = (docOrigin.x + doc.width + 2) * cw
    const py = y * ch
    // Traînée lumineuse au-dessus de la ligne.
    const trail = ctx.createLinearGradient(0, py - ch * 3, 0, py)
    trail.addColorStop(0, 'rgba(0,0,0,0)')
    trail.addColorStop(1, colors.scan)
    ctx.globalAlpha = 0.12
    ctx.fillStyle = trail
    ctx.fillRect(x0, py - ch * 3, x1 - x0, ch * 3)
    // Ligne avec lueur.
    ctx.globalAlpha = 0.95
    ctx.shadowColor = colors.scan
    ctx.shadowBlur = 14
    ctx.fillStyle = colors.scan
    ctx.fillRect(x0, py - 1, x1 - x0, 2)
    ctx.shadowBlur = 0
  }

  function render(): void {
    ctx.clearRect(0, 0, cssW, cssH)
    const d = cfg.phases[phase] || 1
    const t = clamp01(phaseTime / d)
    const { doc } = templates[index]!

    switch (phase) {
      case 'appear':
        // Le document s'écrit de haut en bas : bref bruit avant le vrai caractère.
        drawDocument(
          (p) => clamp01((t - reveal(p)) / 0.1),
          (p, i) => (t - reveal(p) < 0.06 ? noisy(i) : p.from),
        )
        break
      case 'scan': {
        const scanY = docOrigin.y - 1 + t * (doc.height + 2)
        drawDocument(
          (p) => (scanY - p.sy > 0 && scanY - p.sy < 1.6 ? 1.6 : 1),
          (p, i) => (p.sy + 0.5 < scanY ? noisy(i) : p.from),
        )
        drawScanLine(scanY)
        break
      }
      case 'transform':
        particles.forEach((p, i) => {
          if (p.mode === 'in') {
            const s = style(p.kind)
            put(p.tx, p.ty, p.to, s.color, s.alpha * clamp01((t - 0.55) / 0.4))
            return
          }
          if (p.mode === 'out') {
            const s = style(p.srcKind)
            put(p.sx, p.sy - t * 2 * p.seed, noisy(i), s.color, s.alpha * (1 - clamp01(t / 0.45)))
            return
          }
          const k = clamp01((t - p.delay) / p.dur)
          const e = easeInOutCubic(k)
          const x = lerp(p.sx, p.tx, e)
          const y = lerp(p.sy, p.ty, e) - Math.sin(Math.PI * e) * p.arc
          const arrived = k >= 0.97
          const s = arrived ? style(p.kind) : style('text')
          put(x, y, arrived ? p.to : noisy(i, k > 0 ? 18 : 14), s.color, s.alpha * (k > 0 && !arrived ? 1.25 : 1))
        })
        break
      case 'hold':
        drawJson()
        break
      case 'dissolve':
        // Chaque caractère passe au bruit à son propre moment, puis s'éteint.
        drawJson(
          (p) => 1 - clamp01((t - p.seed * 0.6) / 0.4),
          (p) => (t > p.seed * 0.6 ? noisy(Math.floor(p.seed * 1e5), 20) : p.to),
        )
        break
      case 'gap':
        break
    }
    ctx.globalAlpha = 1
  }

  /** Moment (0..1 de la phase « appear ») où un caractère apparaît. */
  function reveal(p: Particle): number {
    const { doc } = templates[index]!
    return ((p.sy - docOrigin.y) / Math.max(1, doc.height)) * 0.7 + p.seed * 0.18
  }

  /** Image fixe (prefers-reduced-motion) : document et JSON côte à côte, ou JSON seul. */
  function renderStatic(): void {
    ctx.clearRect(0, 0, cssW, cssH)
    if (split) drawDocument(() => 1, (p) => p.from)
    drawJson()
    ctx.globalAlpha = 1
  }

  /* --- Boucle --- */

  function advance(dt: number): void {
    let step = dt * cfg.speed
    if (phase === 'scan' && busy) step *= cfg.busyScanSpeed
    clock += dt
    phaseTime += step
    while (phaseTime >= cfg.phases[phase]) {
      phaseTime -= cfg.phases[phase]
      const next = PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]!
      if (next === 'appear') {
        index = (index + 1) % templates.length
        build()
      }
      phase = next
      if (!(cfg.phases[phase] > 0)) break
    }
  }

  function frame(now: number): void {
    raf = 0
    const dt = Math.min((now - last) / 1000, 0.05) // pas de saut après un ralentissement
    last = now
    advance(dt)
    render()
    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    if (reduced) {
      renderStatic()
      return
    }
    if (raf || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  /* --- Événements --- */

  let resizeQueued = false
  const onResize = () => {
    if (resizeQueued) return
    resizeQueued = true
    requestAnimationFrame(() => {
      resizeQueued = false
      measure()
      build()
      if (reduced) renderStatic()
    })
  }
  const onVisibility = () => (document.hidden ? stop() : start())
  const onMotion = (e: MediaQueryListEvent) => {
    reduced = e.matches
    stop()
    start()
  }

  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  motionQuery.addEventListener('change', onMotion)

  measure()
  build()
  start()
  // La police web peut arriver après le premier rendu : on remesure une fois chargée.
  let destroyed = false
  void document.fonts?.ready.then(() => {
    if (destroyed) return
    measure()
    build()
    if (reduced) renderStatic()
  })

  return {
    destroy() {
      destroyed = true
      stop()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery.removeEventListener('change', onMotion)
    },
    setBusy(value) {
      busy = value
    },
  }
}
