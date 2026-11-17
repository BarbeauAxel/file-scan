/** Petits utilitaires numériques partagés par le moteur et la scène. */
import type { Range } from './config'

export const TAU = Math.PI * 2

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)
export const clamp01 = (v: number) => clamp(v, 0, 1)

export const rand = (min: number, max: number) => min + Math.random() * (max - min)
export const randRange = (r: Range) => rand(r[0], r[1])

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
