/**
 * Réglages du fond animé « document → JSON ».
 * Toutes les valeurs sont surchargeables via les props de <AsciiDocToJson />.
 * Les couleurs acceptent une valeur CSS ou une variable du design system (« var(--accent) »).
 */
import { DOC_TEMPLATES, type DocTemplate } from './asciiTemplates'

export interface DocToJsonConfig {
  colors: {
    /** Texte du document et valeurs du JSON (violet atténué). */
    text: string
    /** Clés du JSON (violet vif). */
    key: string
    /** Ligne de scan (violet vif, avec lueur). */
    scan: string
  }
  /** Opacité de chaque famille de caractères (0..1), avant l'opacité globale. */
  alpha: { frame: number; text: number; key: number }
  /** Opacité globale du canvas : c'est un arrière-plan, rester bas. */
  opacity: number
  /** Taille de police max (px CSS) ; réduite automatiquement si l'écran est trop petit. */
  fontSize: number
  minFontSize: number
  /** Sur écran étroit (< mobileBreakpoint px), taille de police max réduite : animation plus discrète. */
  mobileFontSize: number
  mobileBreakpoint: number
  /** Hauteur d'une ligne, en multiple de la taille de police. */
  lineHeight: number
  fontFamily: string
  /** Multiplicateur global de vitesse (1 = normal, 0.5 = deux fois plus lent). */
  speed: number
  /** Accélération de la phase de scan quand `busy` (un fichier est en cours d'analyse). */
  busyScanSpeed: number
  /** Durée de chaque phase, en secondes. */
  phases: {
    appear: number
    scan: number
    transform: number
    hold: number
    dissolve: number
    /** Écran vide entre deux cycles. */
    gap: number
  }
  /** Glyphes du « bruit » (caractères qui tremblent, trajet, dissolution). */
  noiseGlyphs: string
  /** 'auto' = document à gauche et JSON à droite si la place le permet, sinon superposés au centre. */
  layout: 'auto' | 'split' | 'center'
  /** Grille de points du design system en fond ('none' pour la masquer). */
  grid: 'dots' | 'none'
  gridOpacity: number
  /** Paires document / JSON (voir asciiTemplates.ts). */
  templates: DocTemplate[]
}

export const DOC_TO_JSON: DocToJsonConfig = {
  colors: { text: 'var(--accent)', key: 'var(--accent)', scan: '#d4c2ff' },
  alpha: { frame: 0.32, text: 0.5, key: 1 },
  opacity: 0.7,
  fontSize: 26,
  minFontSize: 7,
  mobileFontSize: 12,
  mobileBreakpoint: 640,
  lineHeight: 1.4,
  fontFamily: 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", Menlo, monospace',
  speed: 1,
  busyScanSpeed: 3,
  phases: { appear: 1.4, scan: 2.6, transform: 2.8, hold: 3.5, dissolve: 1.4, gap: 0.6 },
  noiseGlyphs: '#%&@$*+=',
  layout: 'auto',
  grid: 'dots',
  gridOpacity: 0.06,
  templates: DOC_TEMPLATES,
}

export type DocToJsonOptions = Partial<Omit<DocToJsonConfig, 'colors' | 'alpha' | 'phases'>> & {
  colors?: Partial<DocToJsonConfig['colors']>
  alpha?: Partial<DocToJsonConfig['alpha']>
  phases?: Partial<DocToJsonConfig['phases']>
}

export function resolveConfig(o: DocToJsonOptions = {}): DocToJsonConfig {
  return {
    ...DOC_TO_JSON,
    ...o,
    colors: { ...DOC_TO_JSON.colors, ...o.colors },
    alpha: { ...DOC_TO_JSON.alpha, ...o.alpha },
    phases: { ...DOC_TO_JSON.phases, ...o.phases },
    templates: o.templates?.length ? o.templates : DOC_TO_JSON.templates,
  }
}
