import { Rng } from '../core/rng'

/**
 * Seeded 3D simplex-style gradient noise. Small, dependency free, and stable
 * across devices so every generated texture is byte-identical everywhere.
 */
export class Noise3 {
  private readonly perm = new Uint8Array(512)
  private readonly permMod12 = new Uint8Array(512)

  private static readonly GRAD: ReadonlyArray<readonly [number, number, number]> = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ]

  constructor(seed: number) {
    const rng = new Rng(seed)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      const t = p[i]
      p[i] = p[j]
      p[j] = t
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]
      this.permMod12[i] = this.perm[i] % 12
    }
  }

  noise(xin: number, yin: number, zin: number): number {
    const F3 = 1 / 3
    const G3 = 1 / 6
    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const z0 = zin - (k - t)

    let i1: number, j1: number, k1: number
    let i2: number, j2: number, k2: number
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3

    const ii = i & 255, jj = j & 255, kk = k & 255
    let n = 0
    n += this.corner(x0, y0, z0, this.permMod12[ii + this.perm[jj + this.perm[kk]]])
    n += this.corner(x1, y1, z1, this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]])
    n += this.corner(x2, y2, z2, this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]])
    n += this.corner(x3, y3, z3, this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]])
    return 32 * n
  }

  private corner(x: number, y: number, z: number, gi: number): number {
    let t = 0.6 - x * x - y * y - z * z
    if (t < 0) return 0
    t *= t
    const g = Noise3.GRAD[gi]
    return t * t * (g[0] * x + g[1] * y + g[2] * z)
  }

  /** Fractal Brownian motion in [-1, 1]. */
  fbm(x: number, y: number, z: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let amp = 1
    let freq = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq, z * freq)
      norm += amp
      amp *= gain
      freq *= lacunarity
    }
    return sum / norm
  }

  /** Ridged/billowy variant, good for bark and leaf veins. */
  ridged(x: number, y: number, z: number, octaves = 4): number {
    let amp = 1
    let freq = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += amp * (1 - Math.abs(this.noise(x * freq, y * freq, z * freq)))
      norm += amp
      amp *= 0.5
      freq *= 2.05
    }
    return sum / norm
  }
}

