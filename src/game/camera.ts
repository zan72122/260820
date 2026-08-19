import * as THREE from 'three'
import { CAM, HALF_W, PADDY_HALF_L } from './config'
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
  /** +1/-1 along the machine's local X, pointing at the already-cut ground */
  cutSide: number
  /** +1/-1 along the machine's local X, pointing where there is most room */
  roomSide: number
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
  // the machine small in frame, the standing crop laid out beyond it
  establish: (c) => ({
    r: c.cutSide * (6.2 + Math.sin(c.time * 0.22) * 1.2),
    u: 7.6,
    f: -12.5,
    lookR: c.cutSide * -2.6,
    lookU: 0.6,
    lookF: 8.0,
    lambda: 1.5,
  }),
  // over the cut ground, looking across the header at what is still standing
  // behind and a little over the opened ground: the cut swath runs into
  // the bottom of frame, the machine sits in the middle, the standing
  // crop fills the top
  harvest: (c) => ({
    r: c.cutSide * 2.8,
    u: 4.4,
    f: -8.8,
    lookR: c.cutSide * -0.7,
    lookU: 0.75,
    lookF: 5.0,
    lambda: 2.4,
  }),
  header: (c) => ({ r: c.cutSide * 4.6, u: 2.3, f: 1.4, lookR: 0, lookU: 0.7, lookF: 3.1, lambda: 2.3 }),
  cutaway: (c) => ({ r: c.cutSide * 6.8, u: 2.5, f: -0.35, lookR: 0, lookU: 1.45, lookF: 0.15, lambda: 3.2 }),
  tank: (c) => ({ r: c.cutSide * 5.0, u: 5.0, f: -5.6, lookR: 0, lookU: 2.2, lookF: -0.3, lambda: 2.4 }),
  // auger arc, receiver and falling grain all inside one frame
  unload: (c) => ({
    r: c.augerSide * 8.2,
    u: 5.4,
    f: -6.6,
    lookR: c.augerSide * 2.4,
    lookU: 1.8,
    lookF: -0.9,
    lambda: 1.9,
  }),
  turn: (c) => ({ r: c.roomSide * 3.4, u: 9.0, f: -10.0, lookR: 0, lookU: 0.6, lookF: 2.4, lambda: 2.1 }),
  // slow orbit of the finished paddy, high enough to take the whole thing in
  finish: (c) => ({
    r: Math.sin(c.time * 0.16) * 30,
    u: 19,
    f: Math.cos(c.time * 0.16) * 30,
    lookR: 0,
    lookU: 0.5,
    lookF: 0,
    lambda: 1.0,
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
    // the machine's local +X axis; `r` in a placement is measured along it
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

    // never let the lens dip below the mud, and never let it wander so far
    // off the paddy that the bank cuts the machine in half
    const floor = terrainY(this.wantPos.x, this.wantPos.z) + 0.9
    if (this.wantPos.y < floor) this.wantPos.y = floor
    if (this.shot !== 'finish') {
      const bx = HALF_W + 4.6
      const bz = PADDY_HALF_L + 7
      this.wantPos.x = Math.max(-bx, Math.min(bx, this.wantPos.x))
      this.wantPos.z = Math.max(-bz, Math.min(bz, this.wantPos.z))
    }

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
