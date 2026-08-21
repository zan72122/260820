/**
 * Seeded deterministic RNG. All world generation flows through this so the
 * same seed rebuilds a byte-identical garden (verified by unit tests).
 */
export type Rng = () => number

/** mulberry32 — small, fast, good-enough distribution for scatter/jitter. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit hash, for deriving stable sub-seeds from labels. */
export function hashLabel(label: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Derive an independent stream for a named subsystem, so adding RNG calls in
 * one builder never reshuffles another builder's output.
 */
export function deriveRng(seed: number, label: string): Rng {
  return mulberry32((seed ^ hashLabel(label)) >>> 0)
}

export function rngRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}

export function rngInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1))
}

export function rngPick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('rngPick: empty array')
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T
}

/** Symmetric jitter in [-amount, +amount]. */
export function rngJitter(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount
}
