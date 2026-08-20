/** Shared ground height field, so the sheet, the pebbles and the grass all
 *  agree about where the soil actually is. Nothing floats. */
import { fbm2 } from '../sim/noise'

export const GROUND_SEED = 1207

export function groundHeight(x: number, z: number): number {
  const broad = (fbm2(x * 0.55 + 12, z * 0.55 + 4, 3, GROUND_SEED) - 0.5) * 0.05
  const bump = (fbm2(x * 3.1 + 31, z * 3.1 + 7, 3, GROUND_SEED + 11) - 0.5) * 0.018
  const fine = (fbm2(x * 11 + 5, z * 11 + 19, 2, GROUND_SEED + 29) - 0.5) * 0.006
  return broad + bump + fine
}

export function groundNormal(x: number, z: number, out: { x: number; y: number; z: number }): void {
  const e = 0.03
  const hx = groundHeight(x + e, z) - groundHeight(x - e, z)
  const hz = groundHeight(x, z + e) - groundHeight(x, z - e)
  const nx = -hx / (2 * e)
  const nz = -hz / (2 * e)
  const l = Math.hypot(nx, 1, nz)
  out.x = nx / l
  out.y = 1 / l
  out.z = nz / l
}
