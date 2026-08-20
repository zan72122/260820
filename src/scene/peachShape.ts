/**
 * The fruit's silhouette. Deliberately not a sphere: a suture cleft, a stem
 * well, a slightly off tip and two unequal cheeks. The same function feeds the
 * render mesh, the fuzz shells and the blush simulation, so the colour map and
 * the geometry can never drift apart.
 */
import { fbm2, makeRng } from '../sim/noise'
import type { V3 } from '../sim/lightMath'

export interface PeachShape {
  seed: number
  radius: number
  /** azimuth of the suture groove, radians */
  sutureA: number
  sutureDepth: number
  /** azimuth of the fuller cheek */
  cheekA: number
  cheekAmount: number
  stemDepth: number
  tipOffset: number
  squash: number
  wobble: number
}

export function makePeachShape(seed: number, round: number): PeachShape {
  const rng = makeRng((seed * 2654435761) | 0)
  return {
    seed,
    radius: 0.062 + rng() * 0.014 + round * 0.002,
    sutureA: rng() * Math.PI * 2,
    sutureDepth: 0.075 + rng() * 0.035,
    cheekA: rng() * Math.PI * 2,
    cheekAmount: 0.04 + rng() * 0.025,
    stemDepth: 0.16 + rng() * 0.06,
    tipOffset: (rng() - 0.5) * 0.05,
    squash: 0.93 + rng() * 0.1,
    wobble: 0.016 + rng() * 0.012,
  }
}

const angDiff = (a: number, b: number) => {
  let d = ((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
  return Math.abs(d)
}

/**
 * u: azimuth 0..1, v: 0 at the stem end, 1 at the blossom tip.
 * Returns object-space position in metres.
 */
export function peachPoint(u: number, v: number, s: PeachShape, out?: V3): V3 {
  const phi = u * Math.PI * 2
  const theta = v * Math.PI
  const st = Math.sin(theta)
  const ct = Math.cos(theta)

  // Fruit profile: shoulders a little above the equator, gentle taper below.
  let r = 1 + 0.055 * Math.sin(theta) * Math.cos(theta * 0.9) - 0.05 * Math.pow(v, 2.4)

  // Stem well.
  r -= s.stemDepth * Math.exp(-Math.pow(v / 0.19, 2))

  // Suture: a crease from stem to tip, deepest around the equator.
  const sd = angDiff(phi, s.sutureA)
  r -= s.sutureDepth * Math.exp(-Math.pow(sd / 0.26, 2)) * Math.pow(st, 0.6)

  // One cheek fuller than the other.
  r += s.cheekAmount * Math.cos(phi - s.cheekA) * st

  // Organic low-frequency wobble.
  r += (fbm2(Math.cos(phi) * 1.7 + 3, Math.sin(phi) * 1.7 + v * 2.3, 3, s.seed) - 0.5) * s.wobble * 2

  const R = s.radius * r
  const x = R * st * Math.cos(phi)
  const z = R * st * Math.sin(phi)
  let y = R * ct * s.squash

  // Blossom tip drifts off axis.
  y -= s.tipOffset * s.radius * Math.pow(v, 3)
  const tipShift = s.tipOffset * s.radius * Math.pow(v, 3) * 0.8

  const p = out ?? { x: 0, y: 0, z: 0 }
  p.x = x + tipShift
  p.y = y
  p.z = z
  return p
}

/** Surface normal by central difference on the parametric surface. */
export function peachNormal(u: number, v: number, s: PeachShape, out?: V3): V3 {
  const e = 0.0035
  v = Math.min(0.9965, Math.max(0.0035, v))
  const a = peachPoint(u + e, v, s)
  const b = peachPoint(u - e, v, s)
  const c = peachPoint(u, Math.min(1, v + e), s)
  const d = peachPoint(u, Math.max(0, v - e), s)
  const du = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const dv = { x: c.x - d.x, y: c.y - d.y, z: c.z - d.z }
  // du x dv points outward for this parameterisation.
  const nx = du.y * dv.z - du.z * dv.y
  const ny = du.z * dv.x - du.x * dv.z
  const nz = du.x * dv.y - du.y * dv.x
  const l = Math.hypot(nx, ny, nz) || 1
  const p = out ?? { x: 0, y: 0, z: 0 }
  p.x = nx / l
  p.y = ny / l
  p.z = nz / l
  return p
}
