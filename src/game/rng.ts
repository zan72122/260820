/** Small deterministic RNG so every field layout is reproducible from a seed. */
export class Rng {
  private s: number

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1
  }

  /** mulberry32 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }

  int(n: number): number {
    return Math.floor(this.next() * n) % n
  }

  /** roughly normal, mean 0, sd ~0.4 */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)]
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
/** shortest signed angle from a to b */
export const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
/** frame-rate independent exponential approach */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt))
