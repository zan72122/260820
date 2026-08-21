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
  private queuedPumps = 0
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
    this.queuedPumps = Math.min(3, this.queuedPumps + strength)
    this.pumpArmed = true
  }

  /** A gust of wind — used for the very first, unprompted swing of the opening. */
  nudge(impulse: number): void {
    this.omega += impulse
  }

  hasQueuedPump(): boolean {
    return this.queuedPumps > 0.001
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

    // --- pump: spend queued energy through the bottom quarter of the arc ---
    if (this.queuedPumps > 0) {
      const nearBottom = Math.abs(this.theta) < Math.max(0.16, this.amplitudeRad * 0.55)
      if (nearBottom && Math.abs(this.omega) > 0.02) {
        const amp = this.amplitude01
        // Big help when the swing is nearly still, gentle top-up when it is already high.
        const assist = 2.35 * (1 - amp * 0.72) * (0.35 + 0.65 * (1 - amp))
        const gain = assist * h * 6
        const spend = Math.min(this.queuedPumps, gain)
        this.omega += Math.sign(this.omega) * spend * 1.15
        this.queuedPumps -= spend
        if (this.queuedPumps <= 0.001) {
          this.queuedPumps = 0
          if (this.pumpArmed) {
            this.pumpArmed = false
            this.listeners.pumped?.({ amplitude: this.amplitude01 })
          }
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
    this.queuedPumps = 0
    this.pumpArmed = false
    this.lastThetaSign = 0
    this.lastOmegaSign = 0
  }
}
