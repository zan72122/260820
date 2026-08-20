/**
 * Scripted physical animation for the one moment the whole game is about:
 * the fruit letting go, falling, meeting the net, sinking, and returning once.
 *
 * It is a real spring-damper integrated at a fixed timestep (so it responds to
 * the child pushing the net afterwards), but every constant is authored from a
 * target sink depth rather than left to a generic physics engine. That keeps
 * the catch identical on a slow phone and a fast desktop, and guarantees the
 * fruit is always caught safely.
 */

export type FruitPhase =
  | 'attached'
  | 'loosening'
  | 'falling'
  | 'cradling'
  | 'resting'

export interface CatchTuning {
  mass: number
  gravity: number
  radius: number
  /** Peak sink (m) at the deepest point of the cradle. */
  targetSink: number
  /** Damping ratio until the first rebound peak, then after it. */
  zeta0: number
  zeta1: number
  /** Side-to-side sway period (s) and its damping ratio. */
  lateralPeriod: number
  lateralZeta: number
}

export const DEFAULT_TUNING: CatchTuning = {
  mass: 0.42,
  gravity: 9.81,
  radius: 0.056,
  targetSink: 0.11,
  zeta0: 0.26,
  zeta1: 0.82,
  lateralPeriod: 1.15,
  lateralZeta: 0.16,
}

/**
 * Empirical correction: a damped spring reaches a shallower peak than the
 * energy balance predicts. Verified by tests/fruitSim.test.ts.
 */
const DAMP_COMPENSATION = 1.41

const SUBSTEP = 1 / 240

export interface FruitState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  phase: FruitPhase
  phaseTime: number
  /** Height of the unloaded net surface directly under the fruit. */
  restY: number
  /** Horizontal centre the fruit settles over. */
  anchorX: number
  anchorZ: number
  /** Current sink below the unloaded net surface. */
  sink: number
  maxSink: number
  /** Set once the fruit has passed its deepest point. */
  rebounded: boolean
  /** Set on the frame the fruit first touches the net. */
  justTouched: boolean
  /** Impact speed at first contact (m/s), for sound and squash. */
  impactSpeed: number
  contactElapsed: number
  restingFor: number
}

export class FruitSim {
  /** Mutable: the contact radius changes with each fruit's real shape. */
  readonly tuning: CatchTuning
  readonly state: FruitState
  private k = 0
  private c = 0
  private accumulator = 0

  constructor(tuning: Partial<CatchTuning> = {}) {
    this.tuning = { ...DEFAULT_TUNING, ...tuning }
    this.state = {
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      phase: 'attached',
      phaseTime: 0,
      restY: 0,
      anchorX: 0,
      anchorZ: 0,
      sink: 0,
      maxSink: 0,
      rebounded: false,
      justTouched: false,
      impactSpeed: 0,
      contactElapsed: 0,
      restingFor: 0,
    }
  }

  setPosition(x: number, y: number, z: number): void {
    const s = this.state
    s.x = x; s.y = y; s.z = z
    s.vx = 0; s.vy = 0; s.vz = 0
  }

  /** Called when the stem finally lets go. */
  release(restY: number, anchorX: number, anchorZ: number): void {
    const s = this.state
    s.phase = 'falling'
    s.phaseTime = 0
    s.restY = restY
    s.anchorX = anchorX
    s.anchorZ = anchorZ
    s.sink = 0
    s.maxSink = 0
    s.rebounded = false
    s.contactElapsed = 0
    s.restingFor = 0
    s.vy = Math.min(s.vy, 0)
  }

  /** The net can move afterwards (free play); keep the rest height current. */
  setRest(restY: number, anchorX: number, anchorZ: number): void {
    const s = this.state
    s.restY = restY
    s.anchorX = anchorX
    s.anchorZ = anchorZ
  }

  addImpulse(ix: number, iy: number, iz: number): void {
    const s = this.state
    if (s.phase !== 'cradling' && s.phase !== 'resting') return
    s.vx += ix
    s.vy += iy
    s.vz += iz
    s.restingFor = 0
    if (s.phase === 'resting') s.phase = 'cradling'
  }

  /**
   * Derive the spring from the impact so the peak sink matches the authored
   * value regardless of drop height. `tautness` in [0,1] scales the target.
   */
  private armSpring(impactSpeed: number, tautness: number): void {
    const { mass, gravity, targetSink } = this.tuning
    const sink = Math.max(0.02, targetSink * (1 - 0.52 * tautness))
    const wanted = sink * DAMP_COMPENSATION
    this.k = (mass * impactSpeed * impactSpeed + 2 * mass * gravity * wanted) / (wanted * wanted)
    this.setDamping(this.tuning.zeta0)
  }

  private setDamping(zeta: number): void {
    this.c = 2 * zeta * Math.sqrt(Math.max(1e-6, this.k) * this.tuning.mass)
  }

  get stiffness(): number { return this.k }

  update(dt: number, tautness: number): void {
    this.state.justTouched = false
    this.accumulator += Math.min(dt, 0.1)
    let guard = 0
    while (this.accumulator >= SUBSTEP && guard < 32) {
      this.substep(SUBSTEP, tautness)
      this.accumulator -= SUBSTEP
      guard++
    }
    if (guard >= 32) this.accumulator = 0
  }

  private substep(dt: number, tautness: number): void {
    const s = this.state
    const t = this.tuning
    s.phaseTime += dt

    if (s.phase === 'attached' || s.phase === 'loosening') return

    if (s.phase === 'falling') {
      s.vy -= t.gravity * dt
      s.y += s.vy * dt
      s.x += s.vx * dt
      s.z += s.vz * dt
      if (s.y - t.radius <= s.restY) {
        s.y = s.restY + t.radius
        s.impactSpeed = Math.abs(s.vy)
        this.armSpring(s.impactSpeed, tautness)
        s.phase = 'cradling'
        s.phaseTime = 0
        s.contactElapsed = 0
        s.justTouched = true
      }
      return
    }

    // cradling / resting: spring-damper against the net surface.
    s.contactElapsed += dt
    const penetration = s.restY - (s.y - t.radius)
    s.sink = Math.max(0, penetration)
    if (s.sink > s.maxSink) s.maxSink = s.sink

    // Reaction only exists while the net is actually loaded.
    const support = penetration > 0 ? this.k * penetration - this.c * s.vy : 0
    const ay = support / t.mass - t.gravity
    s.vy += ay * dt
    s.y += s.vy * dt

    if (!s.rebounded && s.vy > 0 && s.contactElapsed > 0.02) {
      s.rebounded = true
      this.setDamping(t.zeta1)
    }

    // Lateral cradle: a slow pendulum back to the deepest point of the sheet.
    const wl = (Math.PI * 2) / t.lateralPeriod
    const cl = 2 * t.lateralZeta * wl
    const axl = -wl * wl * (s.x - s.anchorX) - cl * s.vx
    const azl = -wl * wl * (s.z - s.anchorZ) - cl * s.vz
    s.vx += axl * dt
    s.vz += azl * dt
    s.x += s.vx * dt
    s.z += s.vz * dt

    const still =
      Math.abs(s.vy) < 0.012 && Math.abs(s.vx) < 0.012 && Math.abs(s.vz) < 0.012
    s.restingFor = still ? s.restingFor + dt : 0
    if (s.phase === 'cradling' && s.restingFor > 0.28) {
      s.phase = 'resting'
      s.phaseTime = 0
    }
  }
}
