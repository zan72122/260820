export const TAU = Math.PI * 2

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : clamp((v - a) / (b - a)))

export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v)
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent exponential approach. `rate` = how much of the gap closes per second. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt))

/** Deterministic hash-based PRNG so every play session builds the identical park + town. */
export class Rng {
  private s: number
  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    // xorshift32
    let x = this.s
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    this.s = x
    return x / 4294967296
  }
  range(a: number, b: number): number {
    return a + this.next() * (b - a)
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]
  }
}
