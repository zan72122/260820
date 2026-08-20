/** 小さな数学 / 乱数ユーティリティ。全体で決定論的な見た目を保つために種を固定して使う。 */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp(invLerp(a, b, v), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

/** フレームレート非依存の指数追従。 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** 決定論的な擬似乱数（mulberry32）。 */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Rng = () => number
export const rand = (rng: Rng, a: number, b: number) => a + (b - a) * rng()
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length]

/** 2D ハッシュノイズ（テクスチャ生成・地形の起伏用）。 */
export function hash2(x: number, y: number, seed = 0) {
  let h = Math.imul(Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + seed * 2147483647, 1274126177)
  h = (h ^ (h >>> 13)) >>> 0
  return h / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** タイル可能なバリューノイズ。period でラップする。 */
export function valueNoise(x: number, y: number, period: number, seed = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const w = (n: number) => ((n % period) + period) % period
  const x0 = w(xi)
  const x1 = w(xi + 1)
  const y0 = w(yi)
  const y1 = w(yi + 1)
  const n00 = hash2(x0, y0, seed)
  const n10 = hash2(x1, y0, seed)
  const n01 = hash2(x0, y1, seed)
  const n11 = hash2(x1, y1, seed)
  const u = fade(xf)
  const v = fade(yf)
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v)
}

/** タイル可能な fBm。 */
export function fbm(x: number, y: number, basePeriod: number, octaves = 4, seed = 0, gain = 0.5) {
  let amp = 1
  let sum = 0
  let norm = 0
  let p = basePeriod
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, p, seed + o * 977)
    norm += amp
    amp *= gain
    f *= 2
    p *= 2
  }
  return sum / norm
}

/** 非タイルの fBm（地形など無限領域向け）。 */
export function fbmOpen(x: number, y: number, octaves = 4, seed = 0, gain = 0.5) {
  let amp = 1
  let sum = 0
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoiseOpen(x * f, y * f, seed + o * 977)
    norm += amp
    amp *= gain
    f *= 2
  }
  return sum / norm
}

function valueNoiseOpen(x: number, y: number, seed = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const n00 = hash2(xi, yi, seed)
  const n10 = hash2(xi + 1, yi, seed)
  const n01 = hash2(xi, yi + 1, seed)
  const n11 = hash2(xi + 1, yi + 1, seed)
  const u = fade(xf)
  const v = fade(yf)
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v)
}
