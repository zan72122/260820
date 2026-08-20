/**
 * Small deterministic PRNG (mulberry32). Every run of the game is reproducible
 * from a seed, which matters both for automated capture and for making each
 * fruit "its own fruit" without any randomness leaking across devices.
 */
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Symmetric jitter around 0. */
  jitter(amount: number): number {
    return (this.next() * 2 - 1) * amount
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance
  }
}

