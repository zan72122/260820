export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a))

export const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = invLerp(edge0, edge1, v)
  return t * t * (3 - 2 * t)
}

export const smootherstep = (edge0: number, edge1: number, v: number): number => {
  const t = invLerp(edge0, edge1, v)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const easeInOut = (t: number): number => smootherstep(0, 1, t)

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3)

export const easeInCubic = (t: number): number => Math.pow(clamp01(t), 3)

/** Frame-rate independent exponential approach. `rate` = fraction remaining after 1 second. */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  target + (current - target) * Math.pow(rate, dt)

/** Frame-rate independent approach expressed as a time constant in seconds. */
export const approach = (current: number, target: number, tau: number, dt: number): number =>
  tau <= 0 ? target : target + (current - target) * Math.exp(-dt / tau)

/** Deterministic hash-based PRNG so the park looks identical on every device and every run. */
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9
  }

  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]
  }
}
