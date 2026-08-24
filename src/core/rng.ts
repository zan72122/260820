/** Deterministic RNG (mulberry32). One instance per play seeds all variation. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
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
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
}

/** Play-count based seed: each replay shifts crack/dirt layout, same causal rules. */
export function sessionSeed(): number {
  const url = new URL(window.location.href);
  const forced = url.searchParams.get('seed');
  if (forced !== null) return Number(forced) >>> 0 || 1;
  let plays = 0;
  try {
    plays = Number(localStorage.getItem('uha-plays') ?? '0') || 0;
    localStorage.setItem('uha-plays', String(plays + 1));
  } catch {
    plays = Math.floor(Math.random() * 1000);
  }
  return (plays * 2654435761 + 97) >>> 0;
}
