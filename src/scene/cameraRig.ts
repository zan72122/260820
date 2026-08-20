/**
 * Scripted camera. No free orbit: each beat has a framing chosen so the thing
 * that explains the causality is visible, and the rig fits its subject to
 * whichever way the device is held.
 */
import * as THREE from 'three'

export interface Shot {
  /** Vertical field of view in degrees. Roughly: 30 ~ 45mm, 19 ~ 72mm, 15 ~ 90mm. */
  fov: number
  /** Point the camera looks at. */
  target: THREE.Vector3
  /** Sphere radius around the target that must stay inside the frame. */
  radius: number
  /** Unit direction from target towards the camera. */
  dir: THREE.Vector3
  /** Extra vertical offset applied to the look-at point. */
  lookLift?: number
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  /** Player's limited left/right look, in radians. */
  yawOffset = 0
  readonly maxYaw = 0.24

  private cur: Shot
  private goal: Shot
  private blend = 1
  private blendSpeed = 0.6
  private curFov: number
  private readonly curTarget = new THREE.Vector3()
  private readonly curDir = new THREE.Vector3()
  private curRadius: number

  constructor(shot: Shot, aspect: number) {
    this.cur = shot
    this.goal = shot
    this.curFov = shot.fov
    this.curTarget.copy(shot.target)
    this.curDir.copy(shot.dir).normalize()
    this.curRadius = shot.radius
    this.camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.05, 60)
    this.apply()
  }

  /** Distance that fits `radius` in the narrower of the two frame axes. */
  private fitDistance(radius: number, fovDeg: number): number {
    const vfov = (fovDeg * Math.PI) / 180
    const aspect = this.camera.aspect
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const half = Math.min(vfov, hfov) / 2
    return radius / Math.max(0.08, Math.sin(half))
  }

  cut(shot: Shot): void {
    this.cur = shot
    this.goal = shot
    this.blend = 1
    this.curFov = shot.fov
    this.curTarget.copy(shot.target)
    this.curDir.copy(shot.dir).normalize()
    this.curRadius = shot.radius
    this.apply()
  }

  moveTo(shot: Shot, seconds = 1.6): void {
    if (this.goal === shot) return
    this.cur = {
      fov: this.curFov,
      target: this.curTarget.clone(),
      radius: this.curRadius,
      dir: this.curDir.clone(),
      lookLift: this.goal.lookLift,
    }
    this.goal = shot
    this.blend = 0
    this.blendSpeed = 1 / Math.max(0.2, seconds)
  }

  get goalShot(): Shot {
    return this.goal
  }

  update(dt: number): void {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * this.blendSpeed)
    }
    const t = this.blend
    const e = t * t * (3 - 2 * t)
    this.curFov = THREE.MathUtils.lerp(this.cur.fov, this.goal.fov, e)
    this.curRadius = THREE.MathUtils.lerp(this.cur.radius, this.goal.radius, e)
    this.curTarget.copy(this.cur.target).lerp(this.goal.target, e)
    tmpA.copy(this.cur.dir).normalize()
    tmpB.copy(this.goal.dir).normalize()
    this.curDir.copy(tmpA).lerp(tmpB, e).normalize()
    this.apply()
  }

  private apply(): void {
    const cam = this.camera
    cam.fov = this.curFov
    const dist = this.fitDistance(this.curRadius, this.curFov)
    tmpA.copy(this.curDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset)
    cam.position.copy(this.curTarget).addScaledVector(tmpA, dist)
    const lift = THREE.MathUtils.lerp(this.cur.lookLift ?? 0, this.goal.lookLift ?? 0, this.blend)
    tmpB.copy(this.curTarget)
    tmpB.y += lift
    cam.lookAt(tmpB)
    cam.updateProjectionMatrix()
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    this.apply()
  }

  nudgeYaw(delta: number): void {
    this.yawOffset = THREE.MathUtils.clamp(this.yawOffset + delta, -this.maxYaw, this.maxYaw)
    this.apply()
  }
}
