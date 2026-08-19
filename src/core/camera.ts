import * as THREE from 'three'
import { smootherstep } from './math'

export interface Pose {
  pos: [number, number, number]
  target: [number, number, number]
  fov: number
}
export interface PoseSet {
  portrait: Pose
  landscape: Pose
}

/**
 * Directed camera only — no orbit control anywhere in the game.
 * Portrait and landscape carry their own framing (not a crop of one another).
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  private pos = new THREE.Vector3()
  private target = new THREE.Vector3()
  private fov = 40
  private fromPos = new THREE.Vector3()
  private fromTarget = new THREE.Vector3()
  private fromFov = 40
  private goal: PoseSet | null = null
  private t = 1
  private dur = 1
  portrait = true
  /** Live offset a stage can drive, e.g. to ride the pan through the flip. */
  followOffset = new THREE.Vector3()
  followTarget = new THREE.Vector3()
  private shake = 0
  private clock = 0

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 30)
    this.camera.position.set(0, 0.4, 0.6)
  }

  private pick(set: PoseSet): Pose {
    return this.portrait ? set.portrait : set.landscape
  }

  goTo(set: PoseSet, duration = 1.1) {
    this.goal = set
    this.fromPos.copy(this.pos)
    this.fromTarget.copy(this.target)
    this.fromFov = this.fov
    this.t = 0
    this.dur = Math.max(0.001, duration)
  }

  snapTo(set: PoseSet) {
    this.goal = set
    const p = this.pick(set)
    this.pos.set(p.pos[0], p.pos[1], p.pos[2])
    this.target.set(p.target[0], p.target[1], p.target[2])
    this.fov = p.fov
    this.t = 1
    this.dur = 1
    this.apply()
  }

  setOrientation(portrait: boolean) {
    if (portrait === this.portrait) return
    this.portrait = portrait
    if (this.goal) {
      // Re-frame for the new orientation without losing the stage we are in.
      this.fromPos.copy(this.pos)
      this.fromTarget.copy(this.target)
      this.fromFov = this.fov
      this.t = 0
      this.dur = 0.55
    }
  }

  bump(amount = 1) {
    this.shake = Math.min(1.2, this.shake + amount)
  }

  update(dt: number) {
    this.clock += dt
    if (!this.goal) return
    const g = this.pick(this.goal)
    this.t = Math.min(1, this.t + dt / this.dur)
    const k = smootherstep(this.t)
    this.pos.set(
      this.fromPos.x + (g.pos[0] - this.fromPos.x) * k,
      this.fromPos.y + (g.pos[1] - this.fromPos.y) * k,
      this.fromPos.z + (g.pos[2] - this.fromPos.z) * k,
    )
    this.target.set(
      this.fromTarget.x + (g.target[0] - this.fromTarget.x) * k,
      this.fromTarget.y + (g.target[1] - this.fromTarget.y) * k,
      this.fromTarget.z + (g.target[2] - this.fromTarget.z) * k,
    )
    this.fov = this.fromFov + (g.fov - this.fromFov) * k
    this.shake = Math.max(0, this.shake - dt * 2.4)
    this.apply()
  }

  private apply() {
    const breathe = Math.sin(this.clock * 0.55) * 0.0018
    const sh = this.shake * this.shake * 0.006
    this.camera.position.set(
      this.pos.x + this.followOffset.x + Math.sin(this.clock * 7.3) * sh,
      this.pos.y + this.followOffset.y + breathe + Math.cos(this.clock * 8.1) * sh,
      this.pos.z + this.followOffset.z,
    )
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(
      this.target.x + this.followTarget.x,
      this.target.y + this.followTarget.y,
      this.target.z + this.followTarget.z,
    )
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h
    this.setOrientation(h >= w)
    this.camera.updateProjectionMatrix()
  }
}
