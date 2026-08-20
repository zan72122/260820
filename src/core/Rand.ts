/** Deterministic, seedable PRNG (mulberry32). Every visual/gameplay roll goes
 *  through this so `?seed=` reproduces a run exactly for tests and debugging. */
export class Rand {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  /** [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  /** Pick one entry, respecting optional weights (same length as items). */
  pick<T>(items: readonly T[], weights?: readonly number[]): T {
    if (!weights) return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Signed [-1,1) */
  signed(): number {
    return this.next() * 2 - 1;
  }
}

export function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
