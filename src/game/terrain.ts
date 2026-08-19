import { HALF_W, PADDY_HALF_L } from './config'
import { lerp, smoothstep } from './rng'

/** Height of the raised earth banks that ring the paddy. */
export const LEVEE_TOP = 0.3
/** How far the bank extends outwards from the paddy edge. */
export const LEVEE_OUT = 1.35
export const PADDY_EDGE = 0.35

/** Gentle undulation of a drained paddy floor. Shared by ground, crop and machines. */
export function paddyHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.62 + 1.1) * 0.022 +
    Math.cos(z * 0.48 - 0.4) * 0.026 +
    Math.sin(x * 1.9 + z * 1.3) * 0.012
  )
}

/** Ground height anywhere: paddy floor inside, bank height outside, blended over the slope. */
export function terrainY(x: number, z: number): number {
  const e = Math.max(Math.abs(x) - (HALF_W + PADDY_EDGE), Math.abs(z) - (PADDY_HALF_L + PADDY_EDGE))
  return lerp(paddyHeight(x, z), LEVEE_TOP, smoothstep(0, LEVEE_OUT * 0.75, e))
}
