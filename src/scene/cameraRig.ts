/**
 * Scripted camera. No free orbit.
 *
 * A phone held upright and a tablet held sideways are genuinely different
 * frames, so every beat carries two compositions: in portrait the camera looks
 * along the sheet, stacking roll -> sheet -> fruit -> sun vertically; in
 * landscape it steps round to a three-quarter view. The rig then fits an
 * explicit metre-sized frame box rather than a sphere, so nothing important
 * ever falls off the short edge.
 */
import * as THREE from 'three'

export interface Framing {
  fov: number
  /** Metres that must fit across the frame. */
  w: number
  /** Metres that must fit down the frame. */
  h: number
  /** Unit direction from the target towards the camera. */
  dir: THREE.Vector3
  /** Look-at is raised by this many metres, tilting the camera up. */
  lift: number
}

export interface Shot {
  target: THREE.Vector3
  landscape: Framing
  portrait: Framing
  /** Extra look-at lift applied at runtime (keeps fingers off the subject). */
  bias?: number
}

const UP = new THREE.Vector3(0, 1, 0)
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

interface Resolved {
  fov: number
  w: number
  h: number
  dir: THREE.Vector3
  lift: number
  target: THREE.Vector3
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  yawOffset = 0
  readonly maxYaw = 0.22

  private from: Resolved
  private goal: Shot
  private cur: Resolved
  private blend = 1
  private blendSpeed = 0.6
  /** Fraction of the viewport that is not under a notch / home indicator. */
  private safeW = 1
  private safeH = 1

  constructor(shot: Shot, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.05, 60)
    this.goal = shot
    this.cur = this.resolve(shot)
    this.from = { ...this.cur, dir: this.cur.dir.clone(), target: this.cur.target.clone() }
    this.apply()
  }

  /** Blend the two compositions by how tall the viewport is. */
  private resolve(shot: Shot): Resolved {
    const p = smoothstep(1.3, 0.72, this.camera.aspect)
    const l = shot.landscape
    const q = shot.portrait
    return {
      fov: THREE.MathUtils.lerp(l.fov, q.fov, p),
      w: THREE.MathUtils.lerp(l.w, q.w, p),
      h: THREE.MathUtils.lerp(l.h, q.h, p),
      lift: THREE.MathUtils.lerp(l.lift, q.lift, p),
      dir: tmpA.copy(l.dir).lerp(q.dir, p).normalize().clone(),
      target: shot.target.clone(),
    }
  }

  /** Insets are given as the safe fraction of each axis, in (0, 1]. */
  setSafeArea(fracW: number, fracH: number): void {
    this.safeW = Math.min(1, Math.max(0.6, fracW))
    this.safeH = Math.min(1, Math.max(0.6, fracH))
    this.apply()
  }

  private fitDistance(r: Resolved): number {
    const vHalf = (r.fov * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect)
    // Fit inside the safe area, not the glass: a notch must never crop the fruit.
    const dv = r.h * 0.5 / this.safeH / Math.max(0.02, Math.tan(vHalf))
    const dh = r.w * 0.5 / this.safeW / Math.max(0.02, Math.tan(hHalf))
    return Math.max(dv, dh)
  }

  cut(shot: Shot): void {
    this.goal = shot
    this.cur = this.resolve(shot)
    this.from = { ...this.cur, dir: this.cur.dir.clone(), target: this.cur.target.clone() }
    this.blend = 1
    this.apply()
  }

  moveTo(shot: Shot, seconds = 1.6): void {
    if (this.goal === shot) return
    this.from = { ...this.cur, dir: this.cur.dir.clone(), target: this.cur.target.clone() }
    this.goal = shot
    this.blend = 0
    this.blendSpeed = 1 / Math.max(0.2, seconds)
  }

  get goalShot(): Shot {
    return this.goal
  }

  update(dt: number): void {
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt * this.blendSpeed)
    const target = this.resolve(this.goal)
    const t = this.blend
    const e = t * t * (3 - 2 * t)
    this.cur.fov = THREE.MathUtils.lerp(this.from.fov, target.fov, e)
    this.cur.w = THREE.MathUtils.lerp(this.from.w, target.w, e)
    this.cur.h = THREE.MathUtils.lerp(this.from.h, target.h, e)
    this.cur.lift = THREE.MathUtils.lerp(this.from.lift, target.lift, e)
    this.cur.dir.copy(this.from.dir).lerp(target.dir, e).normalize()
    this.cur.target.copy(this.from.target).lerp(target.target, e)
    this.apply()
  }

  private apply(): void {
    const cam = this.camera
    const r = this.cur
    cam.fov = r.fov
    const dist = this.fitDistance(r)
    tmpB.copy(r.dir).applyAxisAngle(UP, this.yawOffset)
    cam.position.copy(r.target).addScaledVector(tmpB, dist)
    // Never let the camera drop below the soil it is standing on.
    cam.position.y = Math.max(cam.position.y, 0.09)
    const look = tmpA.copy(r.target)
    look.y += r.lift + (this.goal.bias ?? 0)
    cam.lookAt(look)
    cam.updateProjectionMatrix()
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    // Re-resolve because the composition itself depends on orientation.
    const target = this.resolve(this.goal)
    if (this.blend >= 1) {
      this.cur = target
      this.from = { ...target, dir: target.dir.clone(), target: target.target.clone() }
    }
    this.apply()
  }

  nudgeYaw(delta: number): void {
    this.yawOffset = THREE.MathUtils.clamp(this.yawOffset + delta, -this.maxYaw, this.maxYaw)
    this.apply()
  }
}
