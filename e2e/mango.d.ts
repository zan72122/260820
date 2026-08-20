/** The automation surface the game exposes when it is loaded with ?e2e=1. */
export interface DebugState {
  stage: string
  round: number
  harvested: number
  ripeness: number
  timeOfDay: number
  attach: { left: number | null; right: number | null }
  fruit: { x: number; y: number; z: number; phase: string; sink: number; maxSink: number }
  netLow: { x: number; y: number; z: number }
  gripCount: number
  hint: string
  drag: string
  camera: { dist: number; focal: number; halfW: number; halfH: number; pos: number[] }
  timeScale: number
}

export interface MangoDebug {
  ready: boolean
  quality: string
  seed: number
  state: () => DebugState
  attach: (left: number, right: number) => void
  scrub: (amount: number) => void
  closeup: (on: boolean) => void
  poke: (strength?: number) => void
  step: (seconds: number, dt?: number) => void
  pause: (on: boolean) => void
  render: () => void
  size: () => { width: number; height: number }
  handleScreen: (side: 'left' | 'right') => { x: number; y: number }
  hookScreen: (id: number) => { x: number; y: number }
  netScreen: () => { x: number; y: number }
  fingerOffset: number
  dumpMangoChannel: (channel: number) => string
}

declare global {
  interface Window {
    __mango: MangoDebug
  }
}
