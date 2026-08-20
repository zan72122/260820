export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export const clamp01 = (v: number): number => clamp(v, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a))

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x)
  return t * t * (3 - 2 * t)
}

export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3)
export const easeInOutCubic = (t: number): number => {
  const c = clamp01(t)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  const c = clamp01(t)
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2)
}

/**
 * Frame-rate independent exponential approach. `rate` is roughly
 * "how many e-folds per second"; the result is stable at any dt.
 */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  target + (current - target) * Math.exp(-rate * dt)

/**
 * Critically damped spring (Game Programming Gems 4 style). Returns the new
 * value and writes the new velocity into `state`. Deterministic for a fixed dt.
 */
export interface SpringState {
  value: number
  velocity: number
}

export function springTo(
  state: SpringState,
  target: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): number {
  const omega = 2 / Math.max(1e-4, smoothTime)
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let change = state.value - target
  const maxChange = maxSpeed * smoothTime
  change = clamp(change, -maxChange, maxChange)
  const temp = (state.velocity + omega * change) * dt
  state.velocity = (state.velocity - omega * temp) * exp
  state.value = target + (change + temp) * exp
  return state.value
}

/** Damped harmonic oscillator step used for the branch bend and stem tremor. */
export function oscillatorStep(
  state: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): number {
  const accel = (target - state.value) * stiffness - state.velocity * damping
  state.velocity += accel * dt
  state.value += state.velocity * dt
  return state.value
}

export const TAU = Math.PI * 2
