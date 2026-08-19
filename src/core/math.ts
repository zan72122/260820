export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a))
export const smoothstep = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}
export const smootherstep = (t: number) => {
  const x = clamp(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3)
export const easeInOutCubic = (t: number) => {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
export const easeOutBack = (t: number, s = 1.3) => {
  const x = clamp(t) - 1
  return 1 + (s + 1) * x * x * x + s * x * x
}
export const easeOutElastic = (t: number, amp = 1, period = 0.36) => {
  const x = clamp(t)
  if (x === 0 || x === 1) return x
  return amp * Math.pow(2, -9 * x) * Math.sin((x - period / 4) * ((2 * Math.PI) / period)) + 1
}

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Critically damped spring, gives weight + a touch of overshoot control. */
export class Spring {
  value: number
  velocity = 0
  constructor(value = 0, public stiffness = 90, public damping = 16) {
    this.value = value
  }
  step(target: number, dt: number) {
    const h = Math.min(dt, 1 / 30)
    const a = (target - this.value) * this.stiffness - this.velocity * this.damping
    this.velocity += a * h
    this.value += this.velocity * h
    return this.value
  }
  set(v: number) {
    this.value = v
    this.velocity = 0
  }
}

/** Deterministic PRNG so bakes look identical across runs / tests. */
export class Rng {
  private s: number
  constructor(seed = 20260819) {
    this.s = seed >>> 0 || 1
  }
  next() {
    this.s ^= this.s << 13
    this.s ^= this.s >>> 17
    this.s ^= this.s << 5
    this.s >>>= 0
    return this.s / 4294967296
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next()
  }
}

/** Cheap value noise on a ring parameter (periodic in theta). */
export function ringNoise(theta: number, octaves: number[], seedPhase: number[]): number {
  let v = 0
  for (let i = 0; i < octaves.length; i++) {
    v += Math.sin(theta * octaves[i] + seedPhase[i]) / (i + 1)
  }
  return v / octaves.length
}
