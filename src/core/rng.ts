/** Deterministic small-state PRNG (mulberry32). Seeded per attempt so that the
 *  same experiment repeated gives the same-looking result, with only the tiny
 *  amount of variation we deliberately dial in. */
export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  reseed(seed: number): void {
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

  /** Symmetric jitter in [-m, m]. */
  jitter(m: number): number {
    return (this.next() * 2 - 1) * m;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
  }
}

/** Cheap 32-bit string hash, used to derive stable seeds from experiment keys. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
