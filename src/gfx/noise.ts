/** Tiny deterministic value-noise helpers used by the procedural texture bakery. */

export function hash2(x: number, y: number, seed = 0): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Value noise that tiles exactly on the given period. */
export function tileNoise(x: number, y: number, px: number, py: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const x0 = ((xi % px) + px) % px
  const y0 = ((yi % py) + py) % py
  const x1 = (x0 + 1) % px
  const y1 = (y0 + 1) % py
  const u = fade(xf)
  const v = fade(yf)
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v
}

export function tileFbm(
  x: number,
  y: number,
  px: number,
  py: number,
  octaves: number,
  seed = 0,
  gain = 0.5,
): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let sx = px
  let sy = py
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(x * (sx / px), y * (sy / py), sx, sy, seed + i * 71) * amp
    norm += amp
    amp *= gain
    sx *= 2
    sy *= 2
  }
  return sum / norm
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Cheap seeded PRNG so every run of the game looks identical. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967295
  }
}
