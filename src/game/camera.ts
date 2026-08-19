import * as THREE from 'three'
import { CAM } from './config'
import { damp } from './rng'
import { terrainY } from './terrain'

/* ------------------------------------------------------------------ *
 * The camera is directed, never flown by the player.  Each shot knows
 * where to stand and what to look at so that whatever the player is
 * doing right now is legible.
 * ------------------------------------------------------------------ */

export type ShotName =
  | 'establish'
  | 'harvest'
  | 'header'
  | 'cutaway'
  | 'tank'
  | 'unload'
  | 'turn'
  | 'finish'

export interface ShotCtx {
  pos: THREE.Vector3
  heading: number
  intake: THREE.Vector3
  spout: THREE.Vector3
  truck: THREE.Vector3
  augerSide: number
  time: number
}

interface Placement {
  /** machine-relative: right / up / forward */
  r: number
  u: number
  f: number
  lookR: number
  lookU: number
  lookF: number
  lambda: number
}

const SHOTS: Record<ShotName, (c: ShotCtx) => Placement> = {
  establish: (c) => ({
    r: -5.2 + Math.sin(c.time * 0.22) * 1.4,
    u: 6.4,
    f: -9.4,
    lookR: 0,
    lookU: 1.0,
    lookF: 7.5,
    lambda: 1.6,
  }),
  harvest: () => ({ r: 3.9, u: 3.55, f: -7.4, lookR: 0.2, lookU: 0.95, lookF: 4.6, lambda: 2.6 }),
  header: () => ({ r: 4.4, u: 1.85, f: 1.9, lookR: 0.1, lookU: 0.85, lookF: 3.0, lambda: 2.4 }),
  cutaway: () => ({ r: 7.2, u: 2.35, f: -0.3, lookR: 0, lookU: 1.55, lookF: 0.2, lambda: 3.2 }),
  tank: () => ({ r: -3.6, u: 4.7, f: -4.2, lookR: 0.1, lookU: 2.25, lookF: -0.3, lambda: 2.6 }),
  unload: (c) => ({
    r: c.augerSide * 8.6,
    u: 5.0,
    f: -5.8,
    lookR: c.augerSide * 2.7,
    lookU: 1.7,
    lookF: -0.4,
    lambda: 2.0,
  }),
  turn: () => ({ r: 0.6, u: 7.6, f: -8.6, lookR: 0, lookU: 0.9, lookF: 1.4, lambda: 2.2 }),
  finish: (c) => ({
    r: Math.sin(c.time * 0.2) * 20,
    u: 12,
    f: Math.cos(c.time * 0.2) * 20,
    lookR: 0,
    lookU: 0.5,
    lookF: 0,
    lambda: 1.1,
  }),
}

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera
  shot: ShotName = 'establish'
  private pos = new THREE.Vector3(0, 8, -14)
  private look = new THREE.Vector3()
  private wantPos = new THREE.Vector3()
  private wantLook = new THREE.Vector3()
  private right = new THREE.Vector3()
  private fwd = new THREE.Vector3()
  private distScale = 1
  private shake = 0

  constructor() {
    this.camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far)
  }

  resize(w: number, h: number) {
    const a = w / h
    this.camera.aspect = a
    if (a < 1) {
      // portrait: a taller frame plus a step back keeps the machine whole
      this.camera.fov = 63
      this.distScale = 1.2
    } else if (a > 2) {
      this.camera.fov = 47
      this.distScale = 1.0
    } else {
      this.camera.fov = 53
      this.distScale = 1.0
    }
    this.camera.updateProjectionMatrix()
  }

  setShot(name: ShotName, hardCut = false) {
    if (this.shot === name) return
    this.shot = name
    if (hardCut) this.snapNext = true
  }
  private snapNext = false

  kick(amount: number) {
    this.shake = Math.min(1, this.shake + amount)
  }

  update(dt: number, c: ShotCtx) {
    const p = SHOTS[this.shot](c)
    const s = this.shot === 'finish' ? 1 : this.distScale
    this.fwd.set(Math.sin(c.heading), 0, Math.cos(c.heading))
    this.right.set(Math.cos(c.heading), 0, -Math.sin(c.heading))

    if (this.shot === 'finish') {
      this.wantPos.set(p.r, p.u, p.f)
      this.wantLook.set(0, p.lookU, 0)
    } else {
      this.wantPos
        .copy(c.pos)
        .addScaledVector(this.right, p.r * s)
        .addScaledVector(this.fwd, p.f * s)
      this.wantPos.y = c.pos.y + p.u * (0.55 + 0.45 * s)
      this.wantLook
        .copy(c.pos)
        .addScaledVector(this.right, p.lookR)
        .addScaledVector(this.fwd, p.lookF)
      this.wantLook.y = c.pos.y + p.lookU
    }

    // never let the lens dip below the mud
    const floor = terrainY(this.wantPos.x, this.wantPos.z) + 0.9
    if (this.wantPos.y < floor) this.wantPos.y = floor

    if (this.snapNext) {
      this.snapNext = false
      this.pos.copy(this.wantPos)
      this.look.copy(this.wantLook)
    } else {
      const l = p.lambda
      this.pos.x = damp(this.pos.x, this.wantPos.x, l, dt)
      this.pos.y = damp(this.pos.y, this.wantPos.y, l, dt)
      this.pos.z = damp(this.pos.z, this.wantPos.z, l, dt)
      this.look.x = damp(this.look.x, this.wantLook.x, l * 1.25, dt)
      this.look.y = damp(this.look.y, this.wantLook.y, l * 1.25, dt)
      this.look.z = damp(this.look.z, this.wantLook.z, l * 1.25, dt)
    }

    this.camera.position.copy(this.pos)
    if (this.shake > 0.001) {
      const k = this.shake * 0.09
      this.camera.position.x += Math.sin(c.time * 47) * k
      this.camera.position.y += Math.sin(c.time * 61 + 1.3) * k
      this.shake = damp(this.shake, 0, 3.2, dt)
    }
    this.camera.lookAt(this.look)
  }

  teleport(c: ShotCtx) {
    this.snapNext = true
    this.update(1 / 60, c)
  }
}
