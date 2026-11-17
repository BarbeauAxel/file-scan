/**
 * 🌌 Aurore — pas d'entités ici : un CHAMP calculé sur toute la grille.
 *  - 'curtains' : deux rideaux d'aurore boréale superposés qui ondulent ( | ! : . ),
 *                 parcourus par des vagues de lumière et des rayons qui scintillent,
 *  - 'nebula'   : nuages de densité ( ░ ▒ ▓ ),
 * + ciel étoilé, étoiles filantes, et une ligne de montagnes au sol.
 * Survol : le curseur « excite » l'aurore (elle s'illumine et rayonne autour de lui).
 * Clic   : éruption solaire — un anneau de lumière traverse le ciel en illuminant l'aurore.
 * Nuances : 0 = bord inférieur (le plus lumineux), 1 = milieu, 2 = haut.
 */
import { glyph, type Painter } from './cells'
import type { AsciiBackgroundConfig } from './config'
import { rand, randRange, smoothstep } from './math'
import { Comet, RING_WATER, StarField, drawRing, type PointerState, type SceneContext } from './shared'

export interface Scene {
  resize(cols: number, rows: number): void
  step(dt: number, ctx: SceneContext): void
  draw(p: Painter, time: number, ctx: SceneContext): void
  click(x: number, y: number): void
}

interface Flare {
  x: number
  y: number
  age: number
}

const FLARE_SPEED = 45 // cellules / s
const FLARE_LIFE = 1.8 // s

/** Fréquences des deux ondes qui dessinent les plis verticaux des rideaux. */
const F1 = 0.31
const F2 = 0.117

/**
 * Une couche de rideau. `s` : 0 au bord inférieur (le plus lumineux) → 1 en haut.
 * `w1`, `w2` : valeurs (déjà calculées) des deux ondes de plis, dans [-1, 1].
 */
function curtain(s: number, w1: number, w2: number): number {
  if (s < -0.1 || s > 1.2) return 0
  let env = s < 0 ? 1 + s / 0.1 : Math.exp(-s * 2.4) * (1 - smoothstep(0.85, 1.2, s))
  if (s >= 0 && s < 0.08) env += 0.45 * (1 - s / 0.08) // liseré lumineux du bas
  const bands = 0.6 * (0.5 + 0.5 * w1) + 0.4 * (0.5 + 0.5 * w2)
  // Puissance élevée = plis nets : rayons lumineux séparés par du noir (plus de contraste).
  return bands ** 2.6 * env
}

export function createAuroraScene(config: AsciiBackgroundConfig): Scene {
  const cfg = config.aurora
  const cursorRadius = config.cursorRadius
  const G = {
    dense: glyph(config.chars.dense),
    mid: glyph(config.chars.mid),
    light: glyph(config.chars.light),
    faint: glyph(config.chars.faint),
    shade1: glyph('░'),
    shade2: glyph('▒'),
    shade3: glyph('▓'),
    flat: glyph('_'),
    up: glyph('/'),
    down: glyph('\\'),
    peak: glyph('^'),
  }

  const stars = new StarField(cfg.starDensity, cfg.bigStars)
  const shootingStar = new Comet({
    speed: [32, 48],
    trail: [7, 11],
    angle: (28 * Math.PI) / 180,
    angleJitter: (18 * Math.PI) / 180,
    curve: 0,
    delay: cfg.shootingStarEvery,
  })
  shootingStar.sleep(randRange(cfg.shootingStarEvery) * 0.5)
  const flares: Flare[] = []

  // Termes précalculés par colonne / par ligne : on évite de recalculer des sinus par cellule.
  let edge1 = new Float32Array(0)
  let edge2 = new Float32Array(0)
  let light = new Float32Array(0)
  let shift1 = new Float32Array(0)
  let shift2 = new Float32Array(0)
  /** Hauteur du relief (en lignes depuis le bas) par colonne. */
  let ridge = new Float32Array(0)
  let ridgeSeed = [0, 0, 0]
  // sin/cos de x·F1 et x·F2 par colonne (fixes) : sin(x·F + φ) = sin(x·F)·cos φ + cos(x·F)·sin φ,
  // où φ ne dépend que de la ligne → plus aucun sinus dans la boucle par cellule.
  let s1x = new Float32Array(0)
  let c1x = new Float32Array(0)
  let s2x = new Float32Array(0)
  let c2x = new Float32Array(0)

  function ensure(cols: number, rows: number): void {
    if (edge1.length !== cols) {
      edge1 = new Float32Array(cols)
      edge2 = new Float32Array(cols)
      light = new Float32Array(cols)
      ridge = new Float32Array(cols)
      s1x = Float32Array.from({ length: cols }, (_, x) => Math.sin(x * F1))
      c1x = Float32Array.from({ length: cols }, (_, x) => Math.cos(x * F1))
      s2x = Float32Array.from({ length: cols }, (_, x) => Math.sin(x * F2))
      c2x = Float32Array.from({ length: cols }, (_, x) => Math.cos(x * F2))
      for (let x = 0; x < cols; x++) {
        const [a, b, c] = ridgeSeed as [number, number, number]
        ridge[x] = rows * (0.07 + 0.045 * Math.sin(x * 0.035 + a) + 0.025 * Math.sin(x * 0.09 + b) + 0.012 * Math.sin(x * 0.23 + c))
      }
    }
    if (shift1.length !== rows) {
      shift1 = new Float32Array(rows)
      shift2 = new Float32Array(rows)
    }
  }

  /** Résultat de excitation() (variables réutilisées : aucune allocation par cellule). */
  let excMul = 1
  let excAdd = 0

  /** Excitation par le curseur et les éruptions : multiplicateur + lueur ajoutée. */
  function excitation(x: number, y: number, pointer: PointerState | null): void {
    let mul = 1
    let add = 0
    if (pointer) {
      const d = Math.hypot(x - pointer.x, (y - pointer.y) * 1.3)
      const R = cursorRadius * 1.8
      if (d < R) {
        const k = (1 - d / R) ** 1.6
        mul += 1.6 * k
        add += 0.32 * k
      }
    }
    for (const f of flares) {
      const r = f.age * FLARE_SPEED
      const d = Math.hypot(x - f.x, y - f.y)
      if (Math.abs(d - r) > 7) continue // loin de l'anneau : contribution négligeable
      const fade = 1 - f.age / FLARE_LIFE
      const ring = Math.exp(-(((d - r) / 2.5) ** 2)) * fade
      mul += 2.2 * ring
      add += 0.25 * ring
    }
    excMul = mul
    excAdd = add
  }

  function drawCurtains(p: Painter, t: number, pointer: PointerState | null): void {
    const { cols, rows } = p
    ensure(cols, rows)
    const top = rows * cfg.top
    const base = rows * cfg.bottom
    const h1 = base - top
    const h2 = h1 * 0.7

    for (let x = 0; x < cols; x++) {
      edge1[x] = base + rows * 0.06 * Math.sin(x * 0.045 + t * 0.21) + rows * 0.03 * Math.sin(x * 0.11 - t * 0.37)
      edge2[x] = base - rows * 0.2 + rows * 0.05 * Math.sin(x * 0.03 - t * 0.17 + 2) + rows * 0.025 * Math.sin(x * 0.13 + t * 0.29)
      // Vagues de lumière qui parcourent l'aurore × rayons qui scintillent colonne par colonne.
      const wave = 1 + 0.3 * Math.sin(x * 0.045 - t * 0.8) + 0.12 * Math.sin(x * 0.13 + t * 1.3)
      const rays = 0.9 + 0.22 * Math.sin(x * 1.9 + t * 2.7) * Math.sin(x * 0.7 - t * 1.1)
      light[x] = wave * rays * cfg.intensity
    }
    for (let y = 0; y < rows; y++) {
      shift1[y] = Math.sin(y * 0.09 + t * 0.33) * 3 + Math.sin(y * 0.035 - t * 0.19) * 7
      shift2[y] = Math.sin(y * 0.07 - t * 0.27 + 1) * 4 + Math.sin(y * 0.05 + t * 0.15) * 5
    }

    const yEnd = Math.min(rows, Math.ceil(base + rows * 0.12))
    const excited = pointer !== null || flares.length > 0
    const t2 = t * 1.15
    for (let y = Math.max(0, Math.floor(top - 2)); y < yEnd; y++) {
      // Phases des ondes pour cette ligne (rideau 1, puis rideau 2 décalé de 40 colonnes).
      const pa = shift1[y]! * F1 + t * 0.5
      const pb = shift1[y]! * F2 - t * 0.27 + 1.3
      const pc = (shift2[y]! + 40) * F1 + t2 * 0.5
      const pd = (shift2[y]! + 40) * F2 - t2 * 0.27 + 1.3
      const ca = Math.cos(pa), sa = Math.sin(pa)
      const cb = Math.cos(pb), sb = Math.sin(pb)
      const cc = Math.cos(pc), sc = Math.sin(pc)
      const cd = Math.cos(pd), sd = Math.sin(pd)
      for (let x = 0; x < cols; x++) {
        const s1 = (edge1[x]! - y) / h1
        const s2 = (edge2[x]! - y) / h2
        if ((s1 < -0.1 || s1 > 1.2) && (s2 < -0.1 || s2 > 1.2) && !excited) continue
        const sx1 = s1x[x]!, cx1 = c1x[x]!, sx2 = s2x[x]!, cx2 = c2x[x]!
        const v1 = curtain(s1, sx1 * ca + cx1 * sa, sx2 * cb + cx2 * sb)
        const v2 = curtain(s2, sx1 * cc + cx1 * sc, sx2 * cd + cx2 * sd) * 0.75
        let v = (1 - (1 - v1) * (1 - v2)) * light[x]!

        if (excited) {
          excitation(x, y, pointer)
          // La lueur ajoutée suit les plis du rideau (pas un voile uniforme).
          v = v * excMul + excAdd * Math.min(1, (v1 + v2) * 3)
        }
        if (v < 0.13) continue
        if (v > 1) v = 1

        const g = v > 0.55 ? G.dense : v > 0.36 ? G.mid : v > 0.22 ? G.light : G.faint
        const s = v2 > v1 ? Math.min(s1, 0.5 + s2 * 0.5) : s1
        const shade = s < 0.22 ? 0 : s < 0.6 ? 1 : 2
        p.plot(x, y, v, shade, g)
      }
    }
  }

  function drawNebula(p: Painter, t: number, pointer: PointerState | null): void {
    const { cols, rows } = p
    const cx = cols * 0.5
    const cy = rows * 0.4
    for (let y = 0; y < rows; y++) {
      const ry = Math.sin(y * 0.085 - t * 0.04)
      for (let x = 0; x < cols; x++) {
        const n =
          (Math.sin(x * 0.06 + t * 0.05) +
            ry +
            Math.sin((x * 0.7 + y) * 0.045 + t * 0.03 + 1.7) +
            Math.sin(Math.hypot(x - cx, y - cy) * 0.09 - t * 0.06)) /
          4
        excMul = 1
        excAdd = 0
        if (pointer || flares.length) excitation(x, y, pointer)
        const v = smoothstep(0.1, 0.85, n) * cfg.intensity * excMul + excAdd * 0.5
        if (v < 0.08) continue
        const g = v > 0.7 ? G.shade3 : v > 0.45 ? G.shade2 : v > 0.2 ? G.shade1 : G.faint
        const m = Math.sin(x * 0.03 - t * 0.02 + y * 0.02)
        p.plot(x, y, v * 0.55, m > 0.3 ? 1 : m < -0.3 ? 2 : 0, g)
      }
    }
  }

  /** Ligne de crêtes au sol : _ / \ ^ selon la pente. */
  function drawRidge(p: Painter): void {
    const { cols, rows } = p
    ensure(cols, rows)
    const yAt = (x: number) => rows - 1 - ridge[Math.min(cols - 1, Math.max(0, x))]!
    for (let x = 0; x < cols; x++) {
      const y = yAt(x)
      const dy = yAt(x + 1) - y
      const prev = yAt(x - 1) - y
      const isPeak = prev > 0.3 && dy > 0.3
      const g = isPeak ? G.peak : dy < -0.35 ? G.up : dy > 0.35 ? G.down : G.flat
      p.plot(x, Math.round(y), 0.4, 2, g)
      // Pentes raides : on comble la verticale pour garder un trait continu.
      const steps = Math.floor(Math.abs(dy))
      for (let k = 1; k <= steps; k++) p.plot(x, Math.round(y + Math.sign(dy) * k), 0.35, 2, dy < 0 ? G.up : G.down)
    }
  }

  return {
    resize(cols, rows) {
      ridgeSeed = [rand(0, 100), rand(0, 100), rand(0, 100)]
      edge1 = new Float32Array(0) // force le recalcul du relief
      ensure(cols, rows)
      // Étoiles seulement dans le ciel, au-dessus des montagnes.
      stars.resize(cols, rows, Math.ceil(rows * 0.78))
    },

    step(dt, ctx) {
      shootingStar.step(dt, ctx)
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i]!
        f.age += dt
        if (f.age > FLARE_LIFE) flares.splice(i, 1)
      }
    },

    click(x, y) {
      flares.push({ x, y, age: 0 })
    },

    draw(p, time, ctx) {
      stars.draw(p, time, 2, 0, 1.2, ctx.pointer, cursorRadius * 1.6)
      if (cfg.style === 'nebula') drawNebula(p, time, ctx.pointer)
      else drawCurtains(p, time, ctx.pointer)
      // Anneau visible de l'éruption, même hors de l'aurore.
      for (const f of flares) {
        const fade = 1 - f.age / FLARE_LIFE
        drawRing(p, f.x, f.y, f.age * FLARE_SPEED, 0.55 * fade, 0, RING_WATER)
      }
      shootingStar.draw(p, 2, 0, 1, 0.9)
      if (cfg.ridge) drawRidge(p)
    },
  }
}
