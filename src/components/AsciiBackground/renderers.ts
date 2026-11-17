/**
 * Renderer ASCII : CellBuffer → pixels. Un caractère par cellule, tiré d'un ATLAS
 * pré-rendu (couleur × caractère). `drawImage` depuis l'atlas est bien plus rapide
 * que `fillText` à chaque frame, et permet de pré-calculer un halo lumineux sans coût.
 */
import type { CellBuffer } from './cells'
import type { AsciiBackgroundConfig } from './config'

export interface View {
  dpr: number
  width: number
  height: number
  /** Bords des colonnes/lignes en pixels physiques (arrondis → cellules nettes même avec un DPR fractionnaire). */
  colEdges: Int32Array
  rowEdges: Int32Array
}

export interface CellRenderer {
  /** Appelé à chaque redimensionnement / changement de DPR. */
  resize(view: View): void
  draw(ctx: CanvasRenderingContext2D, buffer: CellBuffer, view: View): void
}

type RenderOptions = Pick<AsciiBackgroundConfig, 'cellSize' | 'glow' | 'fontScale' | 'fontWeight' | 'fontFamily' | 'maxAlpha'>

export function createAsciiRenderer(colors: readonly string[], glyphs: readonly string[], o: RenderOptions): CellRenderer {
  let atlas: HTMLCanvasElement | null = null
  let atlasGlyphs = 0
  let slot = 0 // taille d'une case de l'atlas (px physiques), marge de halo comprise
  let half = 0
  let lastView: View | null = null

  function build(view: View): void {
    const cellPx = Math.ceil(o.cellSize * view.dpr)
    const pad = Math.ceil(cellPx * o.glow)
    slot = cellPx + pad * 2
    if (slot % 2) slot += 1 // case paire → centre entier → pas de flou de sous-pixel
    half = slot / 2

    // Atlas : une ligne par couleur, une colonne par caractère.
    const canvas = document.createElement('canvas')
    canvas.width = glyphs.length * slot
    canvas.height = colors.length * slot
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.font = `${o.fontWeight} ${Math.round(cellPx * o.fontScale)}px ${o.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    colors.forEach((color, row) => {
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = o.glow > 0 ? cellPx * o.glow : 0
      glyphs.forEach((ch, col) => {
        ctx.fillText(ch, col * slot + half, row * slot + half)
      })
    })
    atlas = canvas
    atlasGlyphs = glyphs.length
  }

  return {
    resize(view) {
      lastView = view
      build(view)
    },

    draw(ctx, buffer, view) {
      ctx.clearRect(0, 0, view.width, view.height)
      // Un caractère a été ajouté depuis la construction de l'atlas : on le reconstruit.
      if (lastView && atlasGlyphs !== glyphs.length) build(lastView)
      if (!atlas) return
      const { colEdges, rowEdges } = view
      const { cols, intensity, color, glyph, touched, count } = buffer

      for (let k = 0; k < count; k++) {
        const i = touched[k]!
        const cy = (i / cols) | 0
        const cx = i - cy * cols
        // Centre de la cellule = centre du caractère (aligné sur les points de la grille CSS).
        const x = ((colEdges[cx]! + colEdges[cx + 1]!) >> 1) - half
        const y = ((rowEdges[cy]! + rowEdges[cy + 1]!) >> 1) - half
        ctx.globalAlpha = intensity[i]! * o.maxAlpha
        ctx.drawImage(atlas, glyph[i]! * slot, color[i]! * slot, slot, slot, x, y, slot, slot)
      }
      ctx.globalAlpha = 1
    },
  }
}
