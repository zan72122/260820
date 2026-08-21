import { PerspectiveCamera, Vector3 } from 'three'
import { clamp, damp, lerp } from '../util/math'

export interface Framing {
  /** World heading the camera looks along, in radians. */
  heading: number
  /** Where the sun sits relative to that heading (positive = screen right). */
  sunOffset: number
  moonOffset: number
  moonElevLow: number
  moonElevHigh: number
}

interface Layout {
  fov: number
  radius: number
  height: number
  azimuth: number
  target: Vector3
  sunOffset: number
  moonOffset: number
  moonElevLow: number
  moonElevHigh: number
}

/**
 * A single, authored three-quarter viewpoint. There is no free camera.
 *
 * Portrait stacks the swing and the clock into the lower half and leaves the
 * upper half to the moon and the sky. Landscape opens out so the eye runs
 * diagonally from the swing, past the clock, down into the town.
 */
const LANDSCAPE: Layout = {
  fov: 48,
  radius: 17,
  height: 4.2,
  azimuth: 0.28,
  target: new Vector3(-1.6, 4.6, -1.8),
  // The afterglow sits screen-left over the bay, the moon climbs on the right,
  // above the clock. Both bearings are authored against the frame, not the world.
  sunOffset: 0.42,
  moonOffset: -0.33,
  moonElevLow: 11,
  moonElevHigh: 21,
}

const PORTRAIT: Layout = {
  fov: 64,
  radius: 13.5,
  height: 5.2,
  azimuth: 0.15,
  target: new Vector3(-1.6, 5.6, -1.6),
  sunOffset: 0.18,
  moonOffset: -0.135,
  moonElevLow: 13,
  moonElevHigh: 26,
}

export class CameraRig {
  readonly camera: PerspectiveCamera

  private layout: Layout = LANDSCAPE
  private cur = {
    fov: LANDSCAPE.fov,
    radius: LANDSCAPE.radius,
    height: LANDSCAPE.height,
    azimuth: LANDSCAPE.azimuth,
    target: LANDSCAPE.target.clone(),
    sunOffset: LANDSCAPE.sunOffset,
    moonOffset: LANDSCAPE.moonOffset,
    moonElevLow: LANDSCAPE.moonElevLow,
    moonElevHigh: LANDSCAPE.moonElevHigh,
  }

  /** Extra distance for the finale pull-back. */
  private pull = 0
  private pullTarget = 0

  /** A gentle lean towards something worth noticing. Never a cut. */
  private lookAt = new Vector3()
  private leanPoint = new Vector3()
  private lean = 0
  private leanTarget = 0
  private leanHold = 0

  private time = 0
  private snapped = false

  constructor() {
    this.camera = new PerspectiveCamera(LANDSCAPE.fov, 1, 0.35, 2600)
    this.lookAt.copy(LANDSCAPE.target)
  }

  setViewport(width: number, height: number): void {
    const portrait = height > width
    this.layout = portrait ? PORTRAIT : LANDSCAPE
    this.camera.aspect = width / height
    // Very wide or very tall panels still need everything in frame.
    const a = this.camera.aspect
    const widen = portrait ? clamp((0.62 - a) * 30, 0, 11) : clamp((1.75 - a) * 18, 0, 10)
    this.camera.fov = this.layout.fov + widen
    this.camera.updateProjectionMatrix()
  }

  /**
   * Lean the framing towards a world point for a few seconds — used when a light
   * a long way off comes on. Slow, additive, and it always returns home.
   */
  glanceAt(p: Vector3, strength = 1, hold = 2.4): void {
    this.leanPoint.copy(p)
    this.leanTarget = clamp(strength)
    this.leanHold = hold
  }

  setPullBack(v: number): void {
    this.pullTarget = v
  }

  framing(): Framing {
    return {
      heading: this.cur.azimuth + Math.PI,
      sunOffset: this.cur.sunOffset,
      moonOffset: this.cur.moonOffset,
      moonElevLow: this.cur.moonElevLow,
      moonElevHigh: this.cur.moonElevHigh,
    }
  }

  update(dt: number, swingAmplitude: number): void {
    this.time += dt
    const L = this.layout
    // Orientation changes ease across rather than cutting.
    const rate = this.snapped ? 2.6 : 1000
    this.cur.fov = damp(this.cur.fov, this.camera.fov, rate, dt)
    this.cur.radius = damp(this.cur.radius, L.radius, rate, dt)
    this.cur.height = damp(this.cur.height, L.height, rate, dt)
    this.cur.azimuth = damp(this.cur.azimuth, L.azimuth, rate, dt)
    this.cur.target.lerp(L.target, this.snapped ? 1 - Math.exp(-2.6 * dt) : 1)
    this.cur.sunOffset = damp(this.cur.sunOffset, L.sunOffset, rate, dt)
    this.cur.moonOffset = damp(this.cur.moonOffset, L.moonOffset, rate, dt)
    this.cur.moonElevLow = damp(this.cur.moonElevLow, L.moonElevLow, rate, dt)
    this.cur.moonElevHigh = damp(this.cur.moonElevHigh, L.moonElevHigh, rate, dt)
    this.snapped = true

    if (this.leanHold > 0) {
      this.leanHold -= dt
      if (this.leanHold <= 0) this.leanTarget = 0
    }
    this.lean = damp(this.lean, this.leanTarget, 0.85, dt)

    this.pull = damp(this.pull, this.pullTarget, 0.32, dt)

    // A whisper of drift so a static viewpoint still feels alive, plus the faintest
    // sympathy with the swing. Both are far too small to read as camera shake.
    const drift = Math.sin(this.time * 0.17) * 0.09
    const sway = Math.sin(this.time * 0.11) * 0.05
    const sympathy = swingAmplitude * 0.06

    const az = this.cur.azimuth + drift * 0.02 + sympathy * 0.012
    const radius = this.cur.radius + this.pull * 9.5
    const height = this.cur.height + this.pull * 3.2 + sway

    this.camera.position.set(
      this.cur.target.x + Math.sin(az) * radius,
      height,
      this.cur.target.z + Math.cos(az) * radius,
    )

    // Where we look: the authored target, gently pulled towards a point of interest.
    this.lookAt.copy(this.cur.target)
    if (this.lean > 0.001) {
      const bias = this.leanPoint.clone().sub(this.cur.target).multiplyScalar(0.11 * this.lean)
      bias.y = clamp(bias.y, -2.4, 3.2)
      this.lookAt.add(bias)
    }
    this.lookAt.y += this.pull * 1.2
    this.camera.lookAt(this.lookAt)

    const targetFov = this.camera.fov + this.pull * 3.0
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = lerp(this.camera.fov, targetFov, 1 - Math.exp(-0.5 * dt))
      this.camera.updateProjectionMatrix()
    }
  }
}
