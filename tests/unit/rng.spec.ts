import { describe, expect, it } from 'vitest'
import { deriveRng, hashLabel, mulberry32, rngInt, rngPick, rngRange } from '../../src/core/rng'

describe('mulberry32', () => {
  it('is deterministic: same seed → identical sequence', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b())
  })

  it('different seeds → different sequences', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const same = Array.from({ length: 100 }, () => a() === b()).filter(Boolean)
    expect(same.length).toBeLessThan(3)
  })

  it('outputs stay in [0, 1) with a sane mean', () => {
    const rng = mulberry32(7)
    let sum = 0
    for (let i = 0; i < 10_000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    expect(sum / 10_000).toBeGreaterThan(0.48)
    expect(sum / 10_000).toBeLessThan(0.52)
  })
})

describe('deriveRng', () => {
  it('label streams are stable and independent', () => {
    const a1 = deriveRng(42, 'engawa')
    const a2 = deriveRng(42, 'engawa')
    const b = deriveRng(42, 'fence')
    expect(a1()).toBe(a2())
    // Practically independent: first values differ.
    expect(deriveRng(42, 'engawa')()).not.toBe(b())
  })

  it('hashLabel is stable', () => {
    expect(hashLabel('engawa')).toBe(hashLabel('engawa'))
    expect(hashLabel('engawa')).not.toBe(hashLabel('fence'))
  })
})

describe('helpers', () => {
  it('rngRange stays inside the range', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 1000; i++) {
      const v = rngRange(rng, 2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThan(5)
    }
  })

  it('rngInt covers the inclusive range', () => {
    const rng = mulberry32(4)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(rng, 1, 3)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    expect(seen).toEqual(new Set([1, 2, 3]))
  })

  it('rngPick returns elements of the array', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 100; i++) {
      expect(['a', 'b', 'c']).toContain(rngPick(rng, ['a', 'b', 'c']))
    }
  })
})
