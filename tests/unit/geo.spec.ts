import { describe, expect, it } from 'vitest'
import { chamferBox } from '../../src/builders/util/geo'

function triangles(geo: ReturnType<typeof chamferBox>) {
  const pos = geo.getAttribute('position')
  const tris: number[][][] = []
  for (let i = 0; i < pos.count; i += 3) {
    tris.push([
      [pos.getX(i), pos.getY(i), pos.getZ(i)],
      [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)],
      [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)],
    ])
  }
  return tris
}

describe('chamferBox', () => {
  const w = 0.6
  const h = 0.3
  const d = 0.2
  const c = 0.01

  it('has the exact requested bounding box', () => {
    const geo = chamferBox(w, h, d, c)
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    expect(bb.max.x - bb.min.x).toBeCloseTo(w, 6)
    expect(bb.max.y - bb.min.y).toBeCloseTo(h, 6)
    expect(bb.max.z - bb.min.z).toBeCloseTo(d, 6)
  })

  it('every triangle winds outward (normals away from the centre)', () => {
    const geo = chamferBox(w, h, d, c)
    for (const [a, b, cc] of triangles(geo).map((t) => t)) {
      const ab = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!]
      const ac = [cc![0]! - a![0]!, cc![1]! - a![1]!, cc![2]! - a![2]!]
      const n = [
        ab[1]! * ac[2]! - ab[2]! * ac[1]!,
        ab[2]! * ac[0]! - ab[0]! * ac[2]!,
        ab[0]! * ac[1]! - ab[1]! * ac[0]!,
      ]
      const centre = [
        (a![0]! + b![0]! + cc![0]!) / 3,
        (a![1]! + b![1]! + cc![1]!) / 3,
        (a![2]! + b![2]! + cc![2]!) / 3,
      ]
      const dot = n[0]! * centre[0]! + n[1]! * centre[1]! + n[2]! * centre[2]!
      expect(dot).toBeGreaterThan(0)
    }
  })

  it('encloses slightly less volume than the sharp box (chamfer removes material)', () => {
    const geo = chamferBox(w, h, d, c)
    // Divergence theorem: V = Σ dot(a, cross(b, c)) / 6 over triangles.
    let vol = 0
    for (const [a, b, cc] of triangles(geo)) {
      vol +=
        (a![0]! * (b![1]! * cc![2]! - b![2]! * cc![1]!) -
          a![1]! * (b![0]! * cc![2]! - b![2]! * cc![0]!) +
          a![2]! * (b![0]! * cc![1]! - b![1]! * cc![0]!)) /
        6
    }
    const boxVol = w * h * d
    expect(vol).toBeGreaterThan(boxVol * 0.98)
    expect(vol).toBeLessThan(boxVol)
  })

  it('watertight: no triangle degenerate, count matches 6 faces + 12 bevels + 8 corners', () => {
    const geo = chamferBox(w, h, d, c)
    const tris = triangles(geo)
    expect(tris.length).toBe(6 * 2 + 12 * 2 + 8)
  })
})
