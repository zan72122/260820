/** Small deterministic noise kit. Every fruit is seeded, so a peach is
 *  reproducible but no two are the same. */

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

export function valueNoise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = fade(xf)
  const v = fade(yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v
}

export function fbm2(x: number, y: number, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 131)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** fbm on a cylinder so azimuthal textures wrap without a visible seam. */
export function fbmWrapU(u: number, v: number, scale: number, octaves = 4, seed = 0): number {
  const a = u * Math.PI * 2
  const cx = (Math.cos(a) * 0.5 + 0.5) * scale
  const cy = (Math.sin(a) * 0.5 + 0.5) * scale
  return fbm2(cx + v * scale * 0.31, cy + v * scale, octaves, seed)
}

export function ridged(x: number, y: number, octaves = 4, seed = 0): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq, seed + i * 77) * 2 - 1)
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Mulberry32 - a tiny seeded PRNG for per-round variation. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
