/**
 * Réglages du fond ASCII animé (aurore boréale violette, reprise du portfolio).
 * Toutes les valeurs « à tourner » sont ici ; chacune peut aussi être surchargée
 * via les props du composant <AsciiBackground />.
 *
 * Unités : positions/distances en CELLULES, vitesses en cellules / seconde,
 * durées en secondes (sauf mention contraire).
 */

export type Range = readonly [number, number]

export interface AsciiBackgroundConfig {
  /**
   * Trois nuances de l'aurore :
   * 0 = bord inférieur (le plus lumineux), 1 = milieu, 2 = haut (et étoiles, montagnes).
   */
  colors: readonly [string, string, string]
  /** Caractères des rideaux, du plus dense au plus léger. Un caractère par entrée. */
  chars: { dense: string; mid: string; light: string; faint: string }
  /** Multiplicateur global de vitesse (1 = vitesse du portfolio, 0 = image figée). */
  speed: number
  /** Taille d'une cellule en px CSS (partagée par la grille de points et le canvas). */
  cellSize: number
  /** Grille de points en fond ('none' pour la masquer) et son opacité. */
  grid: 'dots' | 'lines' | 'none'
  gridOpacity: number
  /** Opacité max d'un caractère. */
  maxAlpha: number
  /** Halo lumineux autour des caractères (fraction de cellule, 0 = aucun). Précalculé : coût nul. */
  glow: number
  fontScale: number
  fontWeight: number
  fontFamily: string
  /** Rayon d'influence du curseur (cellules). */
  cursorRadius: number
  /** Survol = l'aurore s'illumine ; clic sur le fond = éruption. */
  interactive: boolean
  /** prefers-reduced-motion : 'freeze' = image figée, 'slow' = mouvement très ralenti. */
  reducedMotion: 'freeze' | 'slow'
  reducedMotionSpeed: number
  /** Secondes simulées au démarrage, pour que la scène démarre « déjà vivante ». */
  warmupSeconds: number
  aurora: {
    /** 'curtains' = rideaux d'aurore ; 'nebula' = nuages en ░▒▓. */
    style: 'curtains' | 'nebula'
    /** Haut et bas de la zone d'aurore (fraction de la hauteur d'écran). */
    top: number
    bottom: number
    /** Luminosité générale. */
    intensity: number
    starDensity: number
    bigStars: number
    shootingStarEvery: Range
    /** Ligne de montagnes au bas de l'écran. */
    ridge: boolean
  }
}

export const ASCII_BACKGROUND: AsciiBackgroundConfig = {
  colors: ['#b794ff', '#e35cd8', '#7d60ff'],
  chars: { dense: '|', mid: '!', light: ':', faint: '.' },
  speed: 1,
  cellSize: 12,
  grid: 'dots',
  gridOpacity: 0.06,
  maxAlpha: 0.85,
  glow: 0.45,
  fontScale: 1,
  fontWeight: 500,
  fontFamily: 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", Menlo, monospace',
  cursorRadius: 10,
  interactive: true,
  reducedMotion: 'freeze',
  reducedMotionSpeed: 0.1,
  warmupSeconds: 4,
  aurora: {
    style: 'curtains',
    top: 0.06,
    bottom: 0.62,
    intensity: 1.9,
    starDensity: 1 / 200,
    bigStars: 5,
    shootingStarEvery: [5, 12],
    ridge: true,
  },
}

export type AsciiBackgroundOptions = Partial<Omit<AsciiBackgroundConfig, 'aurora' | 'chars'>> & {
  aurora?: Partial<AsciiBackgroundConfig['aurora']>
  chars?: Partial<AsciiBackgroundConfig['chars']>
}

export function resolveConfig(options: AsciiBackgroundOptions = {}): AsciiBackgroundConfig {
  return {
    ...ASCII_BACKGROUND,
    ...options,
    chars: { ...ASCII_BACKGROUND.chars, ...options.chars },
    aurora: { ...ASCII_BACKGROUND.aurora, ...options.aurora },
  }
}
