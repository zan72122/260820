/** Tiny deterministic PRNG + value noise helpers (shared by geometry and textures). */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic hash-based 2D value noise in [-1, 1]. */
export function noise2(x: number, y: number, seed = 1): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0
    n = (n ^ (n >>> 13)) * 1274126177
    return (((n ^ (n >>> 16)) >>> 0) / 4294967296) * 2 - 1
  }
  const a = h(xi, yi)
  const b = h(xi + 1, yi)
  const c = h(xi, yi + 1)
  const d = h(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm2(x: number, y: number, octaves = 3, seed = 1): number {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, y * f, seed + i * 37) * amp
    f *= 2.03
    amp *= 0.5
  }
  return sum
}

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Frame-rate independent exponential smoothing factor. */
export const damp = (dt: number, halfLife: number) =>
  1 - Math.pow(2, -dt / Math.max(1e-4, halfLife))

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const TAU = Math.PI * 2

/** Shortest signed difference between two angles. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** Normalise an angle into [0, TAU). */
export function norm(a: number): number {
  const m = a % TAU
  return m < 0 ? m + TAU : m
}
