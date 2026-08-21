import type { GameState } from './GameState'
import type { Action } from './actions'
import { resolveCollisions, type Bounds, type Collider } from './collision'

export const TICK_HZ = 60
export const DT = 1 / TICK_HZ

/** Walking speed, m/s — a relaxed stroll. */
export const WALK_SPEED = 1.4
/** Player collision radius, m. */
export const PLAYER_RADIUS = 0.25
/** Soil moisture lost per tick (~0.01 per minute). */
const EVAPORATION_PER_TICK = 0.01 / (60 * TICK_HZ)

export interface SimWorld {
  colliders: readonly Collider[]
  bounds: Bounds
}

/** Advance the game by exactly one 60 Hz tick. Pure: returns a new state. */
export function simulate(
  state: GameState,
  actions: readonly Action[],
  world: SimWorld,
): GameState {
  const next: GameState = {
    ...state,
    tick: state.tick + 1,
    player: { ...state.player },
    beds: { ...state.beds },
    crops: state.crops,
    tools: state.tools,
    chores: state.chores,
  }

  next.player.speed = 0
  for (const a of actions) {
    switch (a.type) {
      case 'move': {
        const len = Math.hypot(a.dirX, a.dirZ)
        if (len > 1e-6) {
          const nx = a.dirX / len
          const nz = a.dirZ / len
          next.player.x += nx * WALK_SPEED * DT
          next.player.z += nz * WALK_SPEED * DT
          next.player.heading = Math.atan2(-nx, -nz)
          next.player.speed = WALK_SPEED
        }
        break
      }
      case 'teleport': {
        next.player.x = a.x
        next.player.z = a.z
        break
      }
      case 'interact':
        // Handled by the interactables layer (installed in a later milestone);
        // simulate() stays the single entry point.
        break
    }
  }

  const resolved = resolveCollisions(
    next.player.x,
    next.player.z,
    PLAYER_RADIUS,
    world.colliders,
    world.bounds,
  )
  next.player.x = resolved.x
  next.player.z = resolved.z

  for (const id of Object.keys(next.beds)) {
    const bed = next.beds[id]
    if (bed && bed.moisture > 0) {
      next.beds[id] = {
        ...bed,
        moisture: Math.max(0, bed.moisture - EVAPORATION_PER_TICK),
      }
    }
  }

  return next
}
