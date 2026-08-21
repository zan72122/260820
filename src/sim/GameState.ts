/**
 * Pure game state — plain serializable data, no three.js imports anywhere in
 * src/sim/. The renderer reads this; only simulate() writes it.
 */

export interface PlayerState {
  /** Position on the ground plane, metres, world coordinates. */
  x: number
  z: number
  /** Facing, radians, 0 = -Z (north, toward the house), CCW positive. */
  heading: number
  /** Walk speed the renderer uses for the gait phase, m/s. */
  speed: number
  /** Currently held item, if any. */
  held: HeldItem | null
}

export type HeldItem = 'wateringCan' | 'hoe' | 'broom' | 'daikon'

export interface BedState {
  /** Soil moisture 0 (dry) .. 1 (just watered). Evaporates over time. */
  moisture: number
}

export type CropKind = 'daikon' | 'negi' | 'tomato'

export interface CropState {
  kind: CropKind
  ripe: boolean
  harvested: boolean
}

export type ToolId = 'wateringCan' | 'hoe' | 'broom'
export type ToolPlace = 'rack' | 'held'

export interface GameState {
  seed: number
  /** Logical 60 Hz tick counter. */
  tick: number
  player: PlayerState
  /** Watering can fill 0..1 (refill at the tsukubai basin). */
  canFill: number
  beds: Record<string, BedState>
  crops: Record<string, CropState>
  tools: Record<ToolId, ToolPlace>
  chores: {
    watered: boolean
    harvested: number
    toolsTidy: boolean
  }
}

export function createInitialState(seed: number): GameState {
  return {
    seed,
    tick: 0,
    player: { x: 1.2, z: 2.4, heading: 0, speed: 0, held: null },
    canFill: 0,
    beds: {
      bedA: { moisture: 0.15 },
      bedB: { moisture: 0.15 },
    },
    crops: {
      daikon1: { kind: 'daikon', ripe: true, harvested: false },
      daikon2: { kind: 'daikon', ripe: true, harvested: false },
      daikon3: { kind: 'daikon', ripe: false, harvested: false },
      negi1: { kind: 'negi', ripe: false, harvested: false },
      tomato1: { kind: 'tomato', ripe: true, harvested: false },
    },
    tools: { wateringCan: 'rack', hoe: 'rack', broom: 'rack' },
    chores: { watered: false, harvested: 0, toolsTidy: true },
  }
}
