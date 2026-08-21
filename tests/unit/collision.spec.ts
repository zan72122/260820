import { describe, expect, it } from 'vitest'
import { resolveCollisions, type Bounds, type Collider } from '../../src/sim/collision'

const bounds: Bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }

function distToBox(x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }): number {
  const dx = Math.max(b.minX - x, 0, x - b.maxX)
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ)
  return Math.hypot(dx, dz)
}

describe('resolveCollisions', () => {
  const box: Collider = { kind: 'box', minX: -1, maxX: 1, minZ: -1, maxZ: 1 }
  const circle: Collider = { kind: 'circle', x: 3, z: 3, r: 0.5 }

  it('pushes a circle out of a box overlap', () => {
    const r = 0.25
    const p = resolveCollisions(0.9, 0, r, [box], bounds)
    expect(distToBox(p.x, p.z, box)).toBeGreaterThanOrEqual(r - 1e-9)
  })

  it('resolves a centre fully inside the box via nearest face', () => {
    const r = 0.25
    const p = resolveCollisions(0.2, 0.1, r, [box], bounds)
    expect(distToBox(p.x, p.z, box)).toBeGreaterThanOrEqual(r - 1e-9)
  })

  it('pushes out of circle colliders', () => {
    const r = 0.25
    const p = resolveCollisions(3.1, 3.1, r, [circle], bounds)
    expect(Math.hypot(p.x - 3, p.z - 3)).toBeGreaterThanOrEqual(0.5 + r - 1e-9)
  })

  it('leaves non-overlapping positions untouched', () => {
    const p = resolveCollisions(5, -5, 0.25, [box, circle], bounds)
    expect(p).toEqual({ x: 5, z: -5 })
  })

  it('clamps to bounds', () => {
    const p = resolveCollisions(50, -50, 0.25, [], bounds)
    expect(p.x).toBe(bounds.maxX - 0.25)
    expect(p.z).toBe(bounds.minZ + 0.25)
  })

  it('resolves overlapping multiple colliders without ending inside any', () => {
    const boxes: Collider[] = [
      { kind: 'box', minX: -1, maxX: 0, minZ: -1, maxZ: 1 },
      { kind: 'box', minX: 0, maxX: 1, minZ: -1, maxZ: 1 },
    ]
    const r = 0.3
    const p = resolveCollisions(0, 0.5, r, boxes, bounds)
    for (const b of boxes) {
      if (b.kind === 'box') {
        expect(distToBox(p.x, p.z, b)).toBeGreaterThanOrEqual(r - 1e-6)
      }
    }
  })
})
