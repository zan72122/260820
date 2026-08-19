/** Deterministic surface used by the automated play-throughs in `tests/`. */
export interface ChiffonState {
  stage: string
  flavor: string
  plays: number
  rise: number
  fill: number
  flipDeg: number
  panY: number
  mountedOnBottle: boolean
  cakeDetached: boolean
  press: number
  finishVisible: boolean
}

export interface ChiffonAutomation {
  state: () => ChiffonState
  /** Every stage entered so far, snapshotted the moment it started. */
  history: () => ChiffonState[]
  /** Current gesture's ghost trajectory in client pixels, or null. */
  guidePx: () => { x: number; y: number }[] | null
  gestureKind: () => string | null
  setTimeScale: (s: number) => void
  goto: (id: string) => void
  pickFlavor: (id: string) => void
  /** Advance logical time directly, without waiting for frames. */
  step: (seconds: number, dt?: number) => void
  render: () => void
  progress: () => number | null
  fast: boolean
  running: () => boolean
}

declare global {
  interface Window {
    __chiffon: ChiffonAutomation
  }
}
