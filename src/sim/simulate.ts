import type { GameState } from './GameState'
import type { Action } from './actions'
import { resolveCollisions, type Bounds, type Collider } from './collision'
import {
  findInteractable,
  POUR_DRAIN_PER_TICK,
  POUR_MOISTURE_PER_TICK,
} from './interactables'

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
    pouring: state.pouring ? { ...state.pouring } : null,
    beds: Object.fromEntries(
      Object.entries(state.beds).map(([k, v]) => [k, { ...v }]),
    ),
    crops: Object.fromEntries(
      Object.entries(state.crops).map(([k, v]) => [k, { ...v }]),
    ),
    tools: { ...state.tools },
    chores: { ...state.chores },
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
          next.pouring = null // 歩き出したら注水は止める
        }
        break
      }
      case 'teleport': {
        next.player.x = a.x
        next.player.z = a.z
        next.pouring = null
        break
      }
      case 'interact': {
        const hit = findInteractable(next)
        if (hit) hit.item.apply(next)
        break
      }
    }
  }

  // 注水の進行: 土が湿り、如雨露が減る
  if (next.pouring) {
    const bed = next.beds[next.pouring.bedId]
    if (bed && next.canFill > 0) {
      bed.moisture = Math.min(1, bed.moisture + POUR_MOISTURE_PER_TICK)
      next.canFill = Math.max(0, next.canFill - POUR_DRAIN_PER_TICK)
      next.pouring.ticksLeft -= 1
      if (next.pouring.ticksLeft <= 0 || next.canFill <= 0 || bed.moisture >= 1) {
        next.pouring = null
      }
    } else {
      next.pouring = null
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
      bed.moisture = Math.max(0, bed.moisture - EVAPORATION_PER_TICK)
    }
  }

  // 夕方の仕事の達成状況
  if (
    Object.values(next.beds).every((b) => b.moisture > 0.65) &&
    !next.chores.watered
  ) {
    next.chores.watered = true
  }
  next.chores.toolsTidy = Object.values(next.tools).every((p) => p === 'rack')

  return next
}
