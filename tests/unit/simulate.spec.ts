import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/sim/GameState'
import type { Action } from '../../src/sim/actions'
import { DT, PLAYER_RADIUS, simulate, WALK_SPEED, type SimWorld } from '../../src/sim/simulate'
import { COLLIDERS, ENGAWA_FRONT_Z, WALKABLE } from '../../src/scene/layout'

const world: SimWorld = { colliders: COLLIDERS, bounds: WALKABLE }

describe('simulate', () => {
  it('advances the tick counter', () => {
    let s = createInitialState(42)
    s = simulate(s, [], world)
    expect(s.tick).toBe(1)
  })

  it('does not mutate the previous state', () => {
    const s0 = createInitialState(42)
    const snapshot = JSON.stringify(s0)
    simulate(s0, [{ type: 'move', dirX: 1, dirZ: 0 }], world)
    expect(JSON.stringify(s0)).toBe(snapshot)
  })

  it('move walks at WALK_SPEED and sets heading', () => {
    let s = createInitialState(42)
    const x0 = s.player.x
    s = simulate(s, [{ type: 'move', dirX: 1, dirZ: 0 }], world)
    expect(s.player.x - x0).toBeCloseTo(WALK_SPEED * DT, 6)
    // Facing east: heading = atan2(-1, 0) = -PI/2
    expect(s.player.heading).toBeCloseTo(-Math.PI / 2, 6)
    expect(s.player.speed).toBe(WALK_SPEED)
  })

  it('teleport moves the player directly', () => {
    let s = createInitialState(42)
    s = simulate(s, [{ type: 'teleport', x: 2, z: 3 }], world)
    expect(s.player.x).toBe(2)
    expect(s.player.z).toBe(3)
  })

  it('is deterministic: same action script → identical final state', () => {
    const script: Action[][] = Array.from({ length: 300 }, (_, i) => [
      { type: 'move', dirX: Math.sin(i / 10), dirZ: Math.cos(i / 10) },
    ])
    const run = () => {
      let s = createInitialState(42)
      for (const actions of script) s = simulate(s, actions, world)
      return JSON.stringify(s)
    }
    expect(run()).toBe(run())
  })

  it('collision keeps the player out of the engawa/house box', () => {
    let s = createInitialState(42)
    // Try to walk straight north into the house for 10 seconds.
    for (let i = 0; i < 600; i++) {
      s = simulate(s, [{ type: 'move', dirX: 0, dirZ: -1 }], world)
    }
    expect(s.player.z).toBeGreaterThanOrEqual(ENGAWA_FRONT_Z + PLAYER_RADIUS - 1e-6)
  })

  it('bounds clamp the player inside the walkable area', () => {
    let s = createInitialState(42)
    for (let i = 0; i < 1200; i++) {
      s = simulate(s, [{ type: 'move', dirX: 1, dirZ: 1 }], world)
    }
    expect(s.player.x).toBeLessThanOrEqual(WALKABLE.maxX - PLAYER_RADIUS + 1e-6)
    expect(s.player.z).toBeLessThanOrEqual(WALKABLE.maxZ - PLAYER_RADIUS + 1e-6)
  })

  it('soil moisture evaporates monotonically', () => {
    let s = createInitialState(42)
    const m0 = s.beds['bedA']!.moisture
    for (let i = 0; i < 600; i++) s = simulate(s, [], world)
    const m1 = s.beds['bedA']!.moisture
    expect(m1).toBeLessThan(m0)
    expect(m1).toBeGreaterThanOrEqual(0)
  })
})
