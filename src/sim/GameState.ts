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

export type CropKind = 'daikon' | 'negi' | 'tomato' | 'kaki'

export interface CropState {
  kind: CropKind
  ripe: boolean
  harvested: boolean
}

export type ToolId = 'wateringCan' | 'hoe' | 'broom'
/** rack=定位置 / held=手の中 / out=出しっぱなし（初期の如雨露） */
export type ToolPlace = 'rack' | 'held' | 'out'

export interface GameState {
  seed: number
  /** Logical 60 Hz tick counter. */
  tick: number
  player: PlayerState
  /** Watering can fill 0..1 (refill at the tsukubai basin). */
  canFill: number
  /** 進行中の注水（移動でキャンセル）。 */
  pouring: { bedId: string; ticksLeft: number } | null
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
    // 昼の水やりで使いさし、菜園の縁に出しっぱなし — という夕方の状況
    canFill: 0.35,
    pouring: null,
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
      kaki1: { kind: 'kaki', ripe: true, harvested: false },
      kaki2: { kind: 'kaki', ripe: true, harvested: false },
    },
    tools: { wateringCan: 'out', hoe: 'rack', broom: 'rack' },
    chores: { watered: false, harvested: 0, toolsTidy: false },
  }
}
