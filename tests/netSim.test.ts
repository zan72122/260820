import { describe, expect, it } from 'vitest'
import { NetSim } from '../src/sim/netSim'
import {
  BENCH,
  FRUIT,
  FRUIT_HANG_Y,
  HOOK_XS,
  NET_GEOMETRY,
  buildHooks,
  tautnessForSpan,
} from '../src/game/layout'

const CTX = { gravity: 9.81, wind: 0, windPhase: 0, collider: null }

function hungNet(leftX: number, rightX: number): NetSim {
  const hooks = buildHooks()
  const L = hooks.find((h) => Math.abs(h.x + leftX) < 1e-6 && h.side === -1)!
  const R = hooks.find((h) => Math.abs(h.x - rightX) < 1e-6 && h.side === 1)!
  const net = new NetSim(NET_GEOMETRY)
  net.setNode(net.handleLeft, L.x, L.y, L.z)
  net.setNode(net.handleRight, R.x, R.y, R.z)
  net.setPinned(net.handleLeft, true)
  net.setPinned(net.handleRight, true)
  net.settle(3.5, CTX)
  return net
}

describe('net rig', () => {
  it('hangs into a cradle between the fruit and the bench for every hook pair', () => {
    const low = { x: 0, y: 0, z: 0 }
    for (const lx of HOOK_XS) {
      for (const rx of HOOK_XS) {
        const net = hungNet(lx, rx)
        net.lowestPanelPoint(low)
        const surface = net.surfaceHeightAt(0, 0, 0.07)
        const fall = FRUIT_HANG_Y - FRUIT.radius - surface
        // The fruit always has a readable gap to fall through...
        expect(fall).toBeGreaterThan(0.14)
        expect(fall).toBeLessThan(0.34)
        // ...and the deepest cradle never reaches the bench, even fully loaded.
        expect(low.y - 0.13).toBeGreaterThan(BENCH.top)
      }
    }
  })

  it('hangs deeper when the hooks are close together', () => {
    const narrow = hungNet(HOOK_XS[0], HOOK_XS[0]).surfaceHeightAt(0, 0, 0.07)
    const wide = hungNet(HOOK_XS[3], HOOK_XS[3]).surfaceHeightAt(0, 0, 0.07)
    expect(narrow).toBeLessThan(wide - 0.015)
  })

  it('maps hook spacing onto a 0..1 tautness', () => {
    expect(tautnessForSpan(HOOK_XS[0] * 2)).toBe(0)
    expect(tautnessForSpan(HOOK_XS[3] * 2)).toBe(1)
    expect(tautnessForSpan(HOOK_XS[1] * 2)).toBeGreaterThan(0)
    expect(tautnessForSpan(HOOK_XS[1] * 2)).toBeLessThan(1)
  })

  it('never lets a cord knot end up inside the fruit', () => {
    const net = hungNet(HOOK_XS[1], HOOK_XS[1])
    const surface = net.surfaceHeightAt(0, 0, 0.07)
    const sphere = { x: 0, y: surface + FRUIT.radius - 0.09, z: 0, r: FRUIT.radius }
    net.settle(1.2, { ...CTX, collider: sphere })
    let worst = Infinity
    for (let i = 0; i < net.nodeCount; i++) {
      const d = Math.hypot(net.getX(i) - sphere.x, net.getY(i) - sphere.y, net.getZ(i) - sphere.z)
      worst = Math.min(worst, d)
    }
    expect(worst).toBeGreaterThan(FRUIT.radius - 1e-3)
  })

  it('holds the contact patch exactly on the fruit surface once gripped', () => {
    const net = hungNet(HOOK_XS[1], HOOK_XS[2])
    const surface = net.surfaceHeightAt(0, 0, 0.07)
    const sphere = { x: 0, y: surface + FRUIT.radius, z: 0, r: FRUIT.radius }
    net.beginGrip(sphere)
    expect(net.gripCount).toBeGreaterThan(6)
    net.setGripAmount(1)
    // Fruit rises during the rebound: the net must come with it, not lag behind.
    for (let i = 0; i < 60; i++) {
      sphere.y += 0.001
      net.setGripSphere(sphere)
      net.settle(1 / 240, { ...CTX, collider: sphere })
    }
    // The sheet directly under the fruit tracks the fruit's underside exactly.
    const under = net.surfaceHeightAt(sphere.x, sphere.z, 0.03)
    expect(Math.abs(under - (sphere.y - FRUIT.radius))).toBeLessThan(0.012)
  })

  it('is deterministic for a fixed timestep', () => {
    const a = hungNet(HOOK_XS[2], HOOK_XS[1])
    const b = hungNet(HOOK_XS[2], HOOK_XS[1])
    for (let i = 0; i < a.nodeCount * 3; i++) {
      expect(a.pos[i]).toBeCloseTo(b.pos[i], 10)
    }
  })
})
