import { describe, expect, it } from 'vitest'
import {
  addValueNoise,
  createField,
  heightToNormalBytes,
  normalizeField,
  worley,
} from '../../src/materials/texgen/noise'
import { FAMILY_NAMES, generateFamily } from '../../src/materials/texgen/families'

describe('texgen noise', () => {
  it('value noise is deterministic and tileable', () => {
    const a = createField(64, 64)
    const b = createField(64, 64)
    addValueNoise(a, 7, 8, 1)
    addValueNoise(b, 7, 8, 1)
    expect(a.data).toEqual(b.data)
    // Tileable: wrap continuity — the jump across the seam stays within the
    // noise's own per-pixel slope budget.
    let maxSeamJump = 0
    let maxNeighbourJump = 0
    for (let y = 0; y < 64; y++) {
      maxSeamJump = Math.max(
        maxSeamJump,
        Math.abs((a.data[y * 64] as number) - (a.data[y * 64 + 63] as number)),
      )
      for (let x = 0; x < 63; x++) {
        maxNeighbourJump = Math.max(
          maxNeighbourJump,
          Math.abs((a.data[y * 64 + x] as number) - (a.data[y * 64 + x + 1] as number)),
        )
      }
    }
    expect(maxSeamJump).toBeLessThanOrEqual(maxNeighbourJump * 1.5 + 1e-6)
  })

  it('worley f1 is zero at feature points and positive elsewhere', () => {
    const f = createField(64, 64)
    worley(f, 3, 20, 'f1')
    let min = Infinity
    let max = -Infinity
    for (const v of f.data) {
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeGreaterThan(min)
  })

  it('normalizeField maps to [0,1]', () => {
    const f = createField(32, 32)
    addValueNoise(f, 5, 4, 3)
    normalizeField(f)
    for (const v of f.data) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('normal maps point mostly outward (+Z blue)', () => {
    const f = createField(32, 32)
    addValueNoise(f, 9, 6, 0.5)
    const bytes = heightToNormalBytes(f, 1.5)
    let blueSum = 0
    for (let i = 2; i < bytes.length; i += 4) blueSum += bytes[i] as number
    expect(blueSum / (bytes.length / 4)).toBeGreaterThan(160)
  })
})

describe('texgen families', () => {
  it('every family generates valid, deterministic PBR bytes', () => {
    for (const family of FAMILY_NAMES) {
      const a = generateFamily(family, 42, 32)
      const b = generateFamily(family, 42, 32)
      expect(a.albedo, family).toEqual(b.albedo)
      expect(a.albedo.length, family).toBe(32 * 32 * 4)
      expect(a.rough.length, family).toBe(32 * 32 * 4)
      expect(a.normal.length, family).toBe(32 * 32 * 4)
      // Alpha fully opaque
      for (let i = 3; i < a.albedo.length; i += 4) {
        if (a.albedo[i] !== 255) throw new Error(`${family}: transparent albedo`)
      }
    }
  })

  it('different world seeds change the output', () => {
    const a = generateFamily('woodWeathered', 42, 32)
    const b = generateFamily('woodWeathered', 43, 32)
    expect(a.albedo).not.toEqual(b.albedo)
  })

  it('roughness stays in a physically sane band per family', () => {
    // No uniform-plastic sheen: wood/soil/stone families must be rough.
    for (const family of ['woodWeathered', 'woodDark', 'soilPacked', 'stone'] as const) {
      const g = generateFamily(family, 42, 32)
      let sum = 0
      for (let i = 0; i < g.rough.length; i += 4) sum += g.rough[i] as number
      const mean = sum / (g.rough.length / 4) / 255
      expect(mean, family).toBeGreaterThan(0.6)
    }
    // いぶし瓦 is semi-matte, never mirror-glazed.
    const kw = generateFamily('kawara', 42, 32)
    let sum = 0
    for (let i = 0; i < kw.rough.length; i += 4) sum += kw.rough[i] as number
    const mean = sum / (kw.rough.length / 4) / 255
    expect(mean).toBeGreaterThan(0.35)
    expect(mean).toBeLessThan(0.7)
  })
})
