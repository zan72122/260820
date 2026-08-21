import type { GameState } from '../sim/GameState'
import type { Action } from '../sim/actions'
import type { Flags } from './flags'

/**
 * window.__game — installed only with ?test=1 or ?e2efast=1. Playwright
 * drives the real simulate() through this instead of relying on flaky
 * synthetic-input timing, per the CLAUDE.md deterministic-state policy.
 */
export interface TestSeam {
  isReady: boolean
  seed: number
  flags: Flags
  getState(): GameState
  dispatch(action: Action): void
  /** Advance n logical ticks synchronously, then render once. */
  step(n: number): void
  /** Texture families that fell back to procedural generation. */
  usedFallbackTextures(): string[]
  /** Live camera position, for camera-containment assertions. */
  getCameraPos(): { x: number; y: number; z: number }
}

declare global {
  interface Window {
    __game?: TestSeam
  }
}

export function installTestSeam(seam: TestSeam): void {
  window.__game = seam
}
