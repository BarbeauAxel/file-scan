/**
 * Briques de la scène : anneau (éruption), champ d'étoiles, comète (étoiles filantes).
 */
import { glyph, type Painter } from './cells'
import type { Range } from './config'
import { TAU, rand, randRange } from './math'

/** Curseur en coordonnées de cellules, avec sa vitesse lissée (cellules/s). */
export interface PointerState {
  x: number
  y: number
  vx: number
  vy: number
}

export interface SceneContext {
  cols: number
  rows: number
  pointer: PointerState | null
}

/* ------------------------------------------------------------------ */
/* Anneaux                                                             */
/* ------------------------------------------------------------------ */

export interface RingStyle {
  top: number
  bottom: number
  left: number
  right: number
  /** Diagonale montante « / » (quarts haut-gauche et bas-droit). */
  rising: number
  /** Diagonale descendante « \ » (quarts haut-droit et bas-gauche). */
  falling: number
}

export const RING_WATER: RingStyle = {
  top: glyph('~'),
  bottom: glyph('-'),
  left: glyph('('),
  right: glyph(')'),
  rising: glyph('/'),
  falling: glyph('\\'),
}

/**
 * Dessine un cercle de rayon r (cellules). Le caractère suit la tangente :
 * « - » en haut/bas, « ( ) » sur les côtés, « / \ » dans les diagonales.
 */
export function drawRing(p: Painter, cx: number, cy: number, r: number, value: number, shade: number, style: RingStyle): void {
  const n = Math.max(8, Math.ceil(TAU * r * 1.6))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const nx = Math.cos(a)
    const ny = Math.sin(a) // y vers le bas
    let g: number
    if (ny < -0.88) g = style.top
    else if (ny > 0.88) g = style.bottom
    else if (nx < -0.88) g = style.left
    else if (nx > 0.88) g = style.right
    else g = nx * ny > 0 ? style.rising : style.falling
    p.at(cx + nx * r, cy + ny * r, value, shade, g)
  }
}

/* ------------------------------------------------------------------ */
/* Champ d'étoiles                                                     */
/* ------------------------------------------------------------------ */

const G_DOT = glyph('.')
const G_PLUS = glyph('+')
const G_SPARK = glyph('*')
const G_HBAR = glyph('-')
const G_VBAR = glyph('|')

interface Star {
  x: number
  y: number
  phase: number
  speed: number
  big: boolean
}

export class StarField {
  private stars: Star[] = []
  /** Grandes étoiles à 4 branches ( -*- ) qui « respirent ». */
  private bright: Star[] = []
  private readonly density: number
  private readonly bigCount: number

  constructor(density: number, bigCount = 0) {
    this.density = density
    this.bigCount = bigCount
  }

  /** `maxY` limite les étoiles au haut de l'écran si besoin. */
  resize(cols: number, rows: number, maxY = rows): void {
    const make = (): Star => ({
      x: Math.floor(rand(0, cols)),
      y: Math.floor(rand(0, maxY)),
      phase: rand(0, TAU),
      speed: rand(0.4, 1.6),
      big: Math.random() < 0.25,
    })
    this.stars = Array.from({ length: Math.round(cols * maxY * this.density) }, make)
    this.bright = Array.from({ length: this.bigCount }, make)
  }

  /** `focus` : le curseur illumine les étoiles proches (rayon `focusRadius`). */
  draw(
    p: Painter,
    time: number,
    dimShade: number,
    brightShade: number,
    strength: number,
    focus: { x: number; y: number } | null,
    focusRadius: number,
  ): void {
    for (const s of this.stars) {
      // Scintillement : la plupart du temps faible, avec de brefs pics (puissance 4).
      const tw = Math.max(0, Math.sin(time * s.speed + s.phase)) ** 4
      let v = (0.08 + 0.34 * tw) * strength
      let bright = s.big && tw > 0.5
      if (focus) {
        const d = Math.hypot(s.x + 0.5 - focus.x, s.y + 0.5 - focus.y)
        if (d < focusRadius) {
          const k = (1 - d / focusRadius) ** 1.5
          v = Math.min(1, v + k * 0.85)
          bright = bright || k > 0.25
        }
      }
      p.plot(s.x, s.y, v, bright ? brightShade : dimShade, bright ? G_PLUS : G_DOT)
    }
    for (const s of this.bright) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.speed * 0.6 + s.phase)
      const v = (0.35 + 0.55 * tw * tw) * strength
      p.plot(s.x, s.y, v, brightShade, G_SPARK)
      // Branches : 1 cellule au repos, 2 au plus brillant.
      const arm = tw > 0.55 ? 2 : 1
      for (let a = 1; a <= arm; a++) {
        const av = v * (a === 1 ? 0.55 : 0.3)
        p.plot(s.x - a, s.y, av, dimShade, G_HBAR)
        p.plot(s.x + a, s.y, av, dimShade, G_HBAR)
        p.plot(s.x, s.y - a, av, dimShade, G_VBAR)
        p.plot(s.x, s.y + a, av, dimShade, G_VBAR)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Comète (étoile filante)                                             */
/* ------------------------------------------------------------------ */

const G_AT = glyph('@')
const G_STAR = glyph('*')
const G_COLON = glyph(':')

/** Espacement des points de la traînée (cellules) : < 1 pour une traînée continue. */
const TRAIL_SPACING = 0.5

export interface CometOptions {
  speed: Range
  /** Longueur de traînée (cellules). */
  trail: Range
  /** Direction moyenne (rad) et variation (rad). */
  angle: number
  angleJitter: number
  /** Courbure max (rad/s). */
  curve: number
  /** Attente avant réapparition. */
  delay: Range
}

export class Comet {
  x = 0
  y = 0
  vx = 0
  vy = 0
  active = false
  private length = 0
  private turn = 0
  private wait = 0
  /** Positions passées, la plus récente en premier : [x0, y0, x1, y1, …]. */
  private trail: number[] = []
  private readonly o: CometOptions

  constructor(o: CometOptions) {
    this.o = o
  }

  /** Fait entrer la comète par un bord. */
  spawn(cols: number, rows: number): void {
    const a = this.o.angle + rand(-1, 1) * this.o.angleJitter
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const speed = randRange(this.o.speed)
    this.length = randRange(this.o.trail)
    this.turn = rand(-1, 1) * this.o.curve
    this.vx = dx * speed
    this.vy = dy * speed

    // Bord d'entrée choisi au prorata de ce que la direction « voit » de chaque bord.
    const fromSide = Math.abs(dx) * rows
    const fromTop = Math.abs(dy) * cols
    if (Math.random() * (fromSide + fromTop) < fromSide) {
      this.x = dx > 0 ? -1 : cols + 1
      this.y = rand(0, rows)
    } else {
      this.y = dy > 0 ? -1 : rows + 1
      this.x = rand(0, cols)
    }
    this.trail = [this.x, this.y]
    this.active = true
  }

  sleep(delay = randRange(this.o.delay)): void {
    this.active = false
    this.wait = delay
    this.trail.length = 0
  }

  step(dt: number, ctx: SceneContext): void {
    if (!this.active) {
      this.wait -= dt
      if (this.wait <= 0) this.spawn(ctx.cols, ctx.rows)
      return
    }

    // Légère courbure : rotation du vecteur vitesse.
    const c = Math.cos(this.turn * dt)
    const s = Math.sin(this.turn * dt)
    const vx = this.vx * c - this.vy * s
    this.vy = this.vx * s + this.vy * c
    this.vx = vx

    this.x += this.vx * dt
    this.y += this.vy * dt
    this.sampleTrail()

    const m = this.length + 2
    if (this.x < -m || this.x > ctx.cols + m || this.y < -m || this.y > ctx.rows + m) this.sleep()
  }

  /** Ajoute des points tous les TRAIL_SPACING (interpolés si la comète a beaucoup avancé). */
  private sampleTrail(): void {
    const lx = this.trail[0] ?? this.x
    const ly = this.trail[1] ?? this.y
    const dx = this.x - lx
    const dy = this.y - ly
    const d = Math.hypot(dx, dy)
    if (d < TRAIL_SPACING) return
    const n = Math.floor(d / TRAIL_SPACING)
    const pts: number[] = []
    for (let k = n; k >= 1; k--) {
      const t = (k * TRAIL_SPACING) / d
      pts.push(lx + dx * t, ly + dy * t)
    }
    this.trail.unshift(...pts)
    const max = Math.ceil(this.length / TRAIL_SPACING) * 2
    if (this.trail.length > max) this.trail.length = max
  }

  /** Tête « @ », puis « * + : . » de plus en plus faibles le long de la traînée. */
  draw(p: Painter, headShade: number, bodyShade: number, tailShade: number, intensity = 1): void {
    if (!this.active) return
    const n = this.trail.length / 2
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1)
      const v = (1 - t) ** 1.6 * intensity
      const g = t < 0.12 ? G_STAR : t < 0.32 ? G_PLUS : t < 0.6 ? G_COLON : G_DOT
      const shade = t < 0.12 ? headShade : t < 0.5 ? bodyShade : tailShade
      p.at(this.trail[i * 2]!, this.trail[i * 2 + 1]!, v, shade, g)
    }
    p.at(this.x, this.y, intensity, headShade, G_AT)
    const hx = Math.floor(this.x)
    const hy = Math.floor(this.y)
    const halo = 0.22 * intensity
    p.plot(hx - 1, hy, halo, bodyShade, G_DOT)
    p.plot(hx + 1, hy, halo, bodyShade, G_DOT)
    p.plot(hx, hy - 1, halo, bodyShade, G_DOT)
    p.plot(hx, hy + 1, halo, bodyShade, G_DOT)
  }
}
