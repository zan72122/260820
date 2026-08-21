import { clamp } from '../util/math'

export interface PendulumEvents {
  /** Fired every time the seat crosses the lowest point. dir = +1 when travelling away from camera-left. */
  bottomPass: { dir: 1 | -1; speed: number; amplitude: number }
  /** Fired at each turning point (apex) of the arc. */
  apex: { amplitude: number; side: 1 | -1 }
  /** Fired when a queued pump is actually spent. */
  pumped: { amplitude: number }
}

const G = 9.81

/**
 * Rigid-rod pendulum with damping and phase-locked energy injection.
 *
 * The child never has to time anything: a swipe queues one pump, and the pump is
 * spent automatically at the phase where it does the most good. The *size* of the
 * assist scales down as the amplitude grows, so the arc still has to be built up
 * over several swings instead of snapping to maximum on the first input.
 */
export class Pendulum {
  /** Rope length in metres. */
  readonly length = 3.05
  /** Hard ceiling on the arc (radians). ~63 degrees — high, but never over the bar. */
  readonly maxAngle = 1.1

  /** Angle from vertical, positive = swinging towards the town side (screen right / away). */
  theta = 0
  /** Angular velocity (rad/s). */
  omega = 0

  private damping = 0.055
  /** Swipes waiting to be spent, in arbitrary strength units. */
  private queuedStrength = 0
  /** Velocity increase still owed to the current pump, in rad/s. */
  private pumpBudget = 0
  private pumpDir = 1
  private pumpArmed = false
  private lastThetaSign = 0
  private lastOmegaSign = 0

  constructor(private readonly listeners: {
    bottomPass?: (e: PendulumEvents['bottomPass']) => void
    apex?: (e: PendulumEvents['apex']) => void
    pumped?: (e: PendulumEvents['pumped']) => void
  } = {}) {}

  /** Continuous 0..1 amplitude derived from total energy — no min/max bookkeeping, no jitter. */
  get amplitude01(): number {
    return clamp(this.amplitudeRad / this.maxAngle)
  }

  /** Amplitude of the current arc in radians, from the conserved energy of the swing. */
  get amplitudeRad(): number {
    const k = 0.5 * this.omega * this.omega * (this.length / G)
    const cosAmp = Math.cos(this.theta) - k
    if (cosAmp <= -1) return Math.PI
    if (cosAmp >= 1) return 0
    return Math.acos(cosAmp)
  }

  /** Normalised phase 0..1 through the full back-and-forth cycle, used for audio timing. */
  get phase01(): number {
    const amp = Math.max(0.001, this.amplitudeRad)
    const s = clamp(this.theta / amp, -1, 1)
    const base = Math.asin(s) / (Math.PI * 2)
    return this.omega >= 0 ? (base + 1) % 1 : (0.5 - base + 1) % 1
  }

  /** Height of the seat above its lowest point, in metres. */
  get riseMetres(): number {
    return this.length * (1 - Math.cos(this.theta))
  }

  queuePump(strength = 1): void {
    // Extra swipes stack a little but saturate, so mashing cannot skip the climb.
    this.queuedStrength = Math.min(1.6, this.queuedStrength + strength * 0.65)
    this.pumpArmed = true
  }

  /** A gust of wind — used for the very first, unprompted swing of the opening. */
  nudge(impulse: number): void {
    this.omega += impulse
  }

  hasQueuedPump(): boolean {
    return this.queuedStrength > 0.001 || this.pumpBudget > 0.001
  }

  step(dt: number): void {
    // Fixed sub-stepping keeps the arc identical at 60 Hz and 120 Hz.
    const sub = 4
    const h = dt / sub
    for (let i = 0; i < sub; i++) this.integrate(h)
  }

  private integrate(h: number): void {
    const prevTheta = this.theta
    const prevOmega = this.omega

    const alpha = -(G / this.length) * Math.sin(this.theta) - this.damping * this.omega
    this.omega += alpha * h
    this.theta += this.omega * h

    // --- pump: one bounded velocity boost, spent through the bottom of the arc ---
    // The boost shrinks as the arc grows, so the swing climbs over several pushes
    // instead of snapping to its limit on the first one — and there is no timing
    // window to miss: the boost simply waits for the next pass if it has to.
    const window = Math.max(0.18, this.amplitudeRad * 0.6)
    const nearBottom = Math.abs(this.theta) < window
    if (this.queuedStrength > 0 && this.pumpBudget <= 0 && nearBottom && Math.abs(this.omega) > 0.02) {
      this.pumpBudget = 0.4 * (1 - 0.5 * this.amplitude01) * this.queuedStrength
      this.pumpDir = this.omega >= 0 ? 1 : -1
      this.queuedStrength = 0
    }
    if (this.pumpBudget > 0 && nearBottom) {
      const d = Math.min(this.pumpBudget, 3.2 * h)
      this.omega += this.pumpDir * d
      this.pumpBudget -= d
      if (this.pumpBudget <= 0.0005) {
        this.pumpBudget = 0
        if (this.pumpArmed) {
          this.pumpArmed = false
          this.listeners.pumped?.({ amplitude: this.amplitude01 })
        }
      }
    }

    // Never let the arc exceed the physical limit of the frame.
    const maxOmega = Math.sqrt((2 * G / this.length) * (1 - Math.cos(this.maxAngle)))
    if (Math.abs(this.omega) > maxOmega) this.omega = Math.sign(this.omega) * maxOmega
    if (Math.abs(this.theta) > this.maxAngle) {
      this.theta = Math.sign(this.theta) * this.maxAngle
      this.omega *= 0.5
    }

    // --- phase events ---
    const sign = Math.sign(this.theta)
    if (sign !== 0 && this.lastThetaSign !== 0 && sign !== this.lastThetaSign) {
      // Interpolate the exact crossing so the click never lands a frame late.
      const speed = Math.abs(prevOmega + (this.omega - prevOmega) * 0.5)
      if (speed > 0.06) {
        this.listeners.bottomPass?.({
          dir: this.omega >= 0 ? 1 : -1,
          speed,
          amplitude: this.amplitude01,
        })
      }
    }
    if (sign !== 0) this.lastThetaSign = sign

    const oSign = Math.sign(this.omega)
    if (oSign !== 0 && this.lastOmegaSign !== 0 && oSign !== this.lastOmegaSign) {
      this.listeners.apex?.({ amplitude: this.amplitude01, side: prevTheta >= 0 ? 1 : -1 })
    }
    if (oSign !== 0) this.lastOmegaSign = oSign
  }

  reset(): void {
    this.theta = 0
    this.omega = 0
    this.queuedStrength = 0
    this.pumpBudget = 0
    this.pumpArmed = false
    this.lastThetaSign = 0
    this.lastOmegaSign = 0
  }
}
