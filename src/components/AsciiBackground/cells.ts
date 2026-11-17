/**
 * Grille de cellules partagée entre la scène (qui écrit) et le renderer (qui dessine).
 * Chaque cellule allumée porte : une intensité, une couleur (index) et un caractère (index).
 */

/** Nuances de la palette (index 0, 1, 2 de `config.colors`). */
export const SHADES = 3

/**
 * Caractères pré-rendus dans l'atlas. `glyph()` ajoute à la volée un caractère
 * inconnu (ex. un caractère personnalisé passé en config) : l'atlas est alors reconstruit.
 */
export const GLYPHS: string[] = [
  '.', ',', "'", '`', ':', ';', '-', '~', '_', '=', '+', '*', '!', '|', '/', '\\',
  '(', ')', '<', '>', '^', 'v', '°', 'o', 'O', '@', '#', '%', '░', '▒', '▓', '"',
]

const GLYPH_INDEX = new Map<string, number>(GLYPHS.map((g, i) => [g, i]))

/** Index d'un caractère dans GLYPHS (ajouté s'il manque). */
export function glyph(ch: string): number {
  let index = GLYPH_INDEX.get(ch)
  if (index === undefined) {
    index = GLYPHS.push(ch) - 1
    GLYPH_INDEX.set(ch, index)
  }
  return index
}

/**
 * Buffer d'une frame. Seules les cellules touchées sont listées (`touched`) :
 * le renderer ne parcourt que ce qui est allumé. Le « stamp » évite de vider
 * tout le buffer à chaque frame.
 */
export class CellBuffer {
  cols = 0
  rows = 0
  intensity = new Float32Array(0)
  color = new Uint8Array(0)
  glyph = new Uint8Array(0)
  touched = new Int32Array(0)
  count = 0
  private stamp = new Uint32Array(0)
  private frame = 0

  resize(cols: number, rows: number): void {
    const size = cols * rows
    this.cols = cols
    this.rows = rows
    this.intensity = new Float32Array(size)
    this.color = new Uint8Array(size)
    this.glyph = new Uint8Array(size)
    this.touched = new Int32Array(size)
    this.stamp = new Uint32Array(size)
    this.frame = 0
    this.count = 0
  }

  begin(): void {
    this.count = 0
    this.frame = (this.frame + 1) >>> 0 || 1
  }

  /**
   * Ajoute une contribution. Plusieurs contributions sur la même cellule se
   * combinent en « screen » ; la plus forte impose son caractère et sa couleur.
   */
  write(index: number, value: number, color: number, g: number): void {
    if (this.stamp[index] !== this.frame) {
      this.stamp[index] = this.frame
      this.intensity[index] = value
      this.color[index] = color
      this.glyph[index] = g
      this.touched[this.count++] = index
      return
    }
    const prev = this.intensity[index]!
    if (value > prev) {
      this.color[index] = color
      this.glyph[index] = g
    }
    this.intensity[index] = prev + value * (1 - prev)
  }
}

/**
 * Pinceau donné à la scène : elle ne manipule que des nuances 0..2,
 * des intensités 0..1 et des index de caractères.
 */
export class Painter {
  private readonly buffer: CellBuffer

  constructor(buffer: CellBuffer) {
    this.buffer = buffer
  }

  get cols(): number {
    return this.buffer.cols
  }

  get rows(): number {
    return this.buffer.rows
  }

  /** Allume la cellule (cx, cy) — coordonnées entières. */
  plot(cx: number, cy: number, value: number, shade: number, g: number): void {
    const { cols, rows } = this.buffer
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return
    if (value < 0.012) return
    this.buffer.write(cy * cols + cx, value > 1 ? 1 : value, shade, g)
  }

  /** SNAP SUR LA GRILLE : une position flottante allume la cellule qui la contient. */
  at(x: number, y: number, value: number, shade: number, g: number): void {
    this.plot(Math.floor(x), Math.floor(y), value, shade, g)
  }
}
