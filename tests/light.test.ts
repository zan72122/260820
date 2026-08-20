import { describe, expect, it } from 'vitest'
import { bounceIrradiance, clipToTangentPlane, polygonFormFactor, type SheetLightState, type V3 } from '../src/sim/lightMath'
import { growthRate } from '../src/sim/blush'
import { peachNormal, peachPoint, makePeachShape } from '../src/scene/peachShape'

const quad = (halfX: number, halfZ: number, y = 0, cx = 0, cz = 0): [V3, V3, V3, V3] => [
  { x: cx - halfX, y, z: cz - halfZ },
  { x: cx + halfX, y, z: cz - halfZ },
  { x: cx + halfX, y, z: cz + halfZ },
  { x: cx - halfX, y, z: cz + halfZ },
]

describe('polygon form factor', () => {
  it('is zero for a surface facing away from the source', () => {
    const p = { x: 0, y: 1, z: 0 }
    const up = { x: 0, y: 1, z: 0 }
    expect(polygonFormFactor(p, up, quad(1, 1))).toBeCloseTo(0, 6)
  })

  it('fills the hemisphere for a point just above a very large sheet', () => {
    const p = { x: 0, y: 0.02, z: 0 }
    const down = { x: 0, y: -1, z: 0 }
    const ff = polygonFormFactor(p, down, quad(60, 60))
    expect(ff).toBeGreaterThan(0.99)
    expect(ff).toBeLessThanOrEqual(1.0001)
  })

  it('is a quarter of the hemisphere for a point on the corner of a large sheet', () => {
    const down = { x: 0, y: -1, z: 0 }
    const ff = polygonFormFactor({ x: 0, y: 0.02, z: 0 }, down, quad(60, 60, 0, 60, 60))
    expect(ff).toBeGreaterThan(0.24)
    expect(ff).toBeLessThan(0.26)
  })

  it('falls off as the surface is lifted away', () => {
    const down = { x: 0, y: -1, z: 0 }
    const near = polygonFormFactor({ x: 0, y: 0.3, z: 0 }, down, quad(0.4, 0.8))
    const far = polygonFormFactor({ x: 0, y: 1.2, z: 0 }, down, quad(0.4, 0.8))
    expect(near).toBeGreaterThan(far * 2)
  })

  it('is larger directly over the sheet than off to one side', () => {
    const down = { x: 0, y: -1, z: 0 }
    const over = polygonFormFactor({ x: 0, y: 0.7, z: 0 }, down, quad(0.3, 0.75))
    const aside = polygonFormFactor({ x: 1.1, y: 0.7, z: 0 }, down, quad(0.3, 0.75))
    expect(over).toBeGreaterThan(aside * 3)
  })

  it('grows with the area of the sheet', () => {
    const down = { x: 0, y: -1, z: 0 }
    const small = polygonFormFactor({ x: 0, y: 0.7, z: 0 }, down, quad(0.2, 0.4))
    const big = polygonFormFactor({ x: 0, y: 0.7, z: 0 }, down, quad(0.4, 0.9))
    expect(big).toBeGreaterThan(small)
  })

  it('clips a polygon that straddles the tangent plane instead of going negative', () => {
    const p = { x: 0, y: 0, z: 0 }
    const n = { x: 0, y: 1, z: 0 }
    const straddling: V3[] = [
      { x: -1, y: -1, z: -1 },
      { x: 1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
      { x: -1, y: 1, z: 1 },
    ]
    const clipped = clipToTangentPlane(straddling, p, n)
    for (const c of clipped) expect(c.y).toBeGreaterThanOrEqual(-1e-9)
    expect(polygonFormFactor(p, n, straddling)).toBeGreaterThanOrEqual(0)
  })
})

describe('bounce irradiance', () => {
  const sheet = (deployed: number, half = 0.3, cx = 0): SheetLightState => ({
    quad: quad(half, 0.75, 0.01, cx),
    normal: { x: 0, y: 1, z: 0 },
    albedo: 0.74,
    deployed,
  })
  const sun = { x: -0.5, y: 0.83, z: -0.24 }
  const under = { x: 0, y: 0.95, z: 0 }
  const down = { x: 0, y: -1, z: 0 }

  it('is exactly nothing while the sheet is still rolled up', () => {
    expect(bounceIrradiance(under, down, sheet(0), sun, 1)).toBe(0)
  })

  it('appears as soon as the sheet is spread', () => {
    expect(bounceIrradiance(under, down, sheet(1), sun, 1)).toBeGreaterThan(0.01)
  })

  it('is nothing at night, however the sheet is placed', () => {
    expect(bounceIrradiance(under, down, sheet(1), { x: 0, y: -1, z: 0 }, 1)).toBe(0)
  })

  it('moves with the sheet: shifting it sideways moves where the light lands', () => {
    const centred = bounceIrradiance(under, down, sheet(1), sun, 1)
    const shifted = bounceIrradiance(under, down, sheet(1, 0.3, 1.0), sun, 1)
    expect(centred).toBeGreaterThan(shifted * 2)
  })

  it('never returns more light than the material reflects', () => {
    const huge = bounceIrradiance(under, down, { ...sheet(1), quad: quad(50, 50, 0.01) }, { x: 0, y: 1, z: 0 }, 1)
    expect(huge).toBeLessThanOrEqual(0.74 + 1e-6)
    expect(huge).toBeGreaterThan(0.7)
  })

  it('reaches the underside far more than the shoulder', () => {
    const s = sheet(1)
    const shoulder = bounceIrradiance({ x: 0, y: 1.06, z: 0 }, { x: 0, y: 1, z: 0 }, s, sun, 1)
    const belly = bounceIrradiance(under, down, s, sun, 1)
    expect(belly).toBeGreaterThan(shoulder)
  })
})

describe('ripening law', () => {
  it('does not advance in the dark', () => {
    expect(growthRate(0, 0, 1, 0)).toBe(0)
  })

  it('weights bounced light more heavily than direct sun, since the underside only gets bounce', () => {
    expect(growthRate(0, 0.2, 1, 0)).toBeGreaterThan(growthRate(0.2, 0, 1, 0))
  })

  it('slows as a patch saturates, so colour eases in rather than snapping', () => {
    expect(growthRate(0.5, 0.2, 1, 0.95)).toBeLessThan(growthRate(0.5, 0.2, 1, 0))
  })

  it('varies from patch to patch, so the blush is never a uniform fade', () => {
    expect(growthRate(0.4, 0.1, 0.4, 0)).not.toBeCloseTo(growthRate(0.4, 0.1, 1.6, 0), 4)
  })
})

describe('fruit shape', () => {
  const shape = makePeachShape(1000, 0)

  it('is not a sphere: the suture and the cheeks break the radius', () => {
    const radii: number[] = []
    for (let i = 0; i < 64; i++) {
      const p = peachPoint(i / 64, 0.5, shape)
      radii.push(Math.hypot(p.x, p.y, p.z))
    }
    const min = Math.min(...radii)
    const max = Math.max(...radii)
    expect((max - min) / max).toBeGreaterThan(0.04)
  })

  it('has a stem well at the top', () => {
    const stem = peachPoint(0.25, 0.02, shape)
    const shoulder = peachPoint(0.25, 0.3, shape)
    expect(stem.y).toBeLessThan(shoulder.y + shape.radius * 0.95)
  })

  it('gives outward normals everywhere, including the poles', () => {
    for (const v of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
      for (let i = 0; i < 8; i++) {
        const u = i / 8
        const p = peachPoint(u, v, shape)
        const n = peachNormal(u, v, shape)
        const l = Math.hypot(n.x, n.y, n.z)
        expect(l).toBeGreaterThan(0.99)
        const dot = p.x * n.x + p.y * n.y + p.z * n.z
        expect(dot).toBeGreaterThan(0)
      }
    }
  })
})
