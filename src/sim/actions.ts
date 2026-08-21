/** Actions fed into simulate(). The keyboard path and the E2E test seam
 * dispatch through the same union, so tests exercise real game logic. */
export type Action =
  | {
      /** Desired walk direction for this tick (world XZ, normalized or zero). */
      type: 'move'
      dirX: number
      dirZ: number
    }
  | { type: 'interact' }
  /** Test-only helper to position the player without walking there. */
  | { type: 'teleport'; x: number; z: number }
