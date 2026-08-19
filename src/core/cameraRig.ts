import * as THREE from 'three'
import { damp, clamp } from './rng'
import type { Viewport } from './renderer'

export interface Shot {
  /** point the camera looks at, in cake space */
  target: THREE.Vector3
  /** unit direction from target towards the camera */
  dir: THREE.Vector3
  /** authored distance in cm */
  dist: number
  /** half-size of the subject to keep in frame (cm) */
  fit: number
  /** seconds to ease into this shot */
  ease?: number
}

const v = new THREE.Vector3()
const v2 = new THREE.Vector3()

function shot(
  target: [number, number, number],
  from: [number, number, number],
  fit: number,
  ease = 1.1,
): Shot {
  const t = new THREE.Vector3(...target)
  const f = new THREE.Vector3(...from)
  const dir = f.clone().sub(t)
  const dist = dir.length()
  dir.normalize()
  return { target: t, dir, dist, fit, ease }
}

/**
 * Hand-authored shots, one per beat of the loop. Never a free camera: the child
 * only ever swipes the cake, so framing is our job.
 */
export const SHOTS = {
  /** stacking: high 3/4 so layer thickness and the hole read at once */
  stack: shot([0, 5.2, 3.0], [3, 21, 30], 13.5),
  /** pouring: nearly top-down 3/4 — bowl, fall line, cavity, pile in one frame */
  pour: shot([0, 8.0, 2.0], [2, 30, 20], 12.0),
  /** coating: side 3/4 so the turntable spin and the changing flank read */
  coat: shot([0, 6.0, 0], [21, 13, 24], 11.5),
  /** cutting: low, and open enough to the first cut plane that the blade reads */
  cut: shot([0, 6.2, 1.5], [1, 12, 27], 12.5),
  /**
   * reveal / finish: aimed down the notch. The slice leaves along the far edge of
   * the opening and the candy is biased towards the near edge, so the two do not
   * pile into the same corner of the frame and nothing important is hidden.
   */
  reveal: shot([1.5, 4.0, 4.5], [12.0, 11.0, 23], 13.8),
  /** finish: cross-section + cavity + spilled candy + remaining cake together */
  done: shot([2.0, 2.6, 4.5], [13.5, 9.8, 20.5], 13.5),
} as const

export type ShotName = keyof typeof SHOTS

export class CameraRig {
  private pos = new THREE.Vector3(3, 24, 30)
  private look = new THREE.Vector3(0, 6.5, 0)
  private goalPos = new THREE.Vector3()
  private goalLook = new THREE.Vector3()
  private current: Shot = SHOTS.stack
  private followTarget: THREE.Object3D | null = null
  private followWeight = 0
  private followTimer = 0
  private ease = 1.1

  constructor(private camera: THREE.PerspectiveCamera) {}

  /**
   * A phone held upright has almost no horizontal field to spare. Rather than
   * backing the camera off to a telephoto distance (which flattens the cake and
   * throws away the kitchen), the vertical FOV opens up so the *horizontal* one
   * stays around 28-44 degrees: wide enough to hold an 18cm cake, never so wide
   * that its proportions bend.
   */
  private fitFov(vp: Viewport) {
    const targetH = THREE.MathUtils.degToRad(33)
    const fovY = 2 * Math.atan(Math.tan(targetH / 2) / Math.max(0.35, vp.aspect))
    const deg = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(fovY), 34, 56)
    if (Math.abs(deg - this.camera.fov) > 0.01) {
      this.camera.fov = deg
      this.camera.updateProjectionMatrix()
    }
  }

  /** Distance needed for a sphere of radius `fit` to sit inside the frame. */
  private frameDistance(fit: number, vp: Viewport) {
    const fovY = THREE.MathUtils.degToRad(this.camera.fov)
    const dV = fit / Math.tan(fovY / 2)
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * vp.aspect)
    const dH = fit / Math.tan(fovX / 2)
    return Math.max(dV, dH)
  }

  set(name: ShotName, vp: Viewport, immediate = false) {
    this.current = SHOTS[name]
    this.ease = this.current.ease ?? 1.1
    this.followTarget = null
    this.followWeight = 0
    this.recompute(vp)
    if (immediate) {
      this.pos.copy(this.goalPos)
      this.look.copy(this.goalLook)
      this.apply()
    }
  }

  /** Briefly track a moving object (used while the wedge slides out). */
  follow(obj: THREE.Object3D, seconds: number) {
    this.followTarget = obj
    this.followTimer = seconds
    this.followWeight = 0
  }

  recompute(vp: Viewport) {
    this.fitFov(vp)
    const s = this.current
    // portrait keeps the cake high on screen so the tools below stay reachable
    const drop = vp.portrait ? s.fit * 0.26 : s.fit * 0.04
    const dist = Math.max(s.dist * 0.8, this.frameDistance(s.fit * 1.1, vp))
    this.goalLook.copy(s.target).setY(s.target.y - drop)
    this.goalPos.copy(this.goalLook).addScaledVector(s.dir, dist)
  }

  update(dt: number, vp: Viewport) {
    this.recompute(vp)
    if (this.followTarget) {
      this.followTimer -= dt
      const want = this.followTimer > 0 ? 1 : 0
      this.followWeight += (want - this.followWeight) * damp(dt, 0.5)
      if (this.followWeight < 0.01 && want === 0) this.followTarget = null
      else {
        this.followTarget.getWorldPosition(v)
        v2.copy(this.goalLook).lerp(v, clamp(this.followWeight * 0.45, 0, 0.45))
        this.goalLook.copy(v2)
      }
    }
    const k = damp(dt, this.ease * 0.42)
    this.pos.lerp(this.goalPos, k)
    this.look.lerp(this.goalLook, k)
    this.apply()
  }

  private apply() {
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
  }

  get lookAt() {
    return this.look
  }
}
