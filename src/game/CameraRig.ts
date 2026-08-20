import { PerspectiveCamera, Vector3 } from 'three'
import { BOWL } from '../config'

export type ShotName = 'establish' | 'travel' | 'play' | 'lift' | 'bowl'

interface ShotPreset {
  /** Camera offset, either absolute or relative to the shot's subject. */
  pos: [number, number, number]
  target: [number, number, number]
  fov: number
  /** Seconds of lag. Small = the camera sticks to the subject. */
  tau: number
}

interface ShotDef {
  land: ShotPreset
  port: ShotPreset
  relative: boolean
}

const SHOTS: Record<ShotName, ShotDef> = {
  // A wide, low look down the flume. Nothing is happening yet.
  establish: {
    relative: false,
    land: { pos: [1.62, 1.44, 3.05], target: [-0.05, 0.85, -1.5], fov: 40, tau: 1.5 },
    port: { pos: [1.26, 1.36, 2.55], target: [-0.05, 0.84, -1.7], fov: 58, tau: 1.5 },
  },
  // Running alongside a bundle, close to the surface of the water.
  travel: {
    relative: true,
    land: { pos: [0.44, 0.115, 0.70], target: [0.0, 0.004, -0.42], fov: 36, tau: 0.30 },
    port: { pos: [0.40, 0.135, 0.60], target: [0.0, 0.004, -0.52], fov: 54, tau: 0.30 },
  },
  // The framing the game lives in: chopsticks, water and somen together.
  play: {
    relative: false,
    land: { pos: [0.92, 1.06, 2.20], target: [0.0, 0.795, -0.62], fov: 43, tau: 0.85 },
    port: { pos: [0.86, 1.06, 1.72], target: [-0.02, 0.79, -1.05], fov: 62, tau: 0.85 },
  },
  // Following the catch upwards. Never cut here — the causality must hold.
  lift: {
    relative: true,
    land: { pos: [0.40, 0.10, 0.54], target: [0.0, -0.03, -0.04], fov: 34, tau: 0.26 },
    port: { pos: [0.34, 0.11, 0.44], target: [0.0, -0.03, -0.05], fov: 52, tau: 0.26 },
  },
  bowl: {
    relative: false,
    land: { pos: [BOWL.x + 0.27, BOWL.standY + 0.26, BOWL.z + 0.40], target: [BOWL.x, BOWL.standY + 0.02, BOWL.z], fov: 40, tau: 0.45 },
    port: { pos: [BOWL.x + 0.22, BOWL.standY + 0.24, BOWL.z + 0.32], target: [BOWL.x, BOWL.standY + 0.02, BOWL.z], fov: 58, tau: 0.45 },
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export class CameraRig {
  readonly camera: PerspectiveCamera
  private pos = new Vector3()
  private look = new Vector3()
  private fov = 43
  private shot: ShotName = 'establish'
  private shotAt = 0
  private subject = new Vector3()
  private landscapeMix = 1
  private drift = 0

  constructor() {
    this.camera = new PerspectiveCamera(43, 1, 0.03, 220)
    const p = SHOTS.establish.land
    this.pos.set(p.pos[0], p.pos[1], p.pos[2])
    this.look.set(p.target[0], p.target[1], p.target[2])
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
  }

  setAspect(width: number, height: number): void {
    const aspect = width / height
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    // Recompose rather than just letting the frame crop.
    this.landscapeMix = Math.max(0, Math.min(1, (aspect - 0.62) / (1.35 - 0.62)))
  }

  cut(shot: ShotName, time: number): void {
    if (this.shot === shot) return
    this.shot = shot
    this.shotAt = time
  }

  get current(): ShotName {
    return this.shot
  }

  /** The point a relative shot is built around (a bundle, or the chopsticks). */
  setSubject(p: Vector3): void {
    this.subject.copy(p)
  }

  get focusDistance(): number {
    return this.pos.distanceTo(this.look)
  }

  update(dt: number, time: number): void {
    const def = SHOTS[this.shot]
    const m = this.landscapeMix
    const px: number[] = []
    for (let i = 0; i < 3; i++) px.push(lerp(def.port.pos[i], def.land.pos[i], m))
    const tx: number[] = []
    for (let i = 0; i < 3; i++) tx.push(lerp(def.port.target[i], def.land.target[i], m))
    const fov = lerp(def.port.fov, def.land.fov, m)
    const tau = lerp(def.port.tau, def.land.tau, m)

    let wantX = px[0]
    let wantY = px[1]
    let wantZ = px[2]
    let lookX = tx[0]
    let lookY = tx[1]
    let lookZ = tx[2]
    if (def.relative) {
      wantX += this.subject.x
      wantY += this.subject.y
      wantZ += this.subject.z
      lookX += this.subject.x
      lookY += this.subject.y
      lookZ += this.subject.z
    }

    // Very slow breathing so a static shot is never dead.
    this.drift += dt
    if (this.shot === 'establish' || this.shot === 'play') {
      wantX += Math.sin(this.drift * 0.17) * 0.022
      wantY += Math.sin(this.drift * 0.13 + 1.7) * 0.014
      wantZ += Math.sin(this.drift * 0.11 + 0.4) * 0.018
    }

    // Ease in after a change of shot, then tighten up.
    const since = time - this.shotAt
    const t = tau * (1 + 2.4 * Math.exp(-since * 1.5))
    const k = 1 - Math.exp(-dt / Math.max(0.02, t))

    this.pos.x += (wantX - this.pos.x) * k
    this.pos.y += (wantY - this.pos.y) * k
    this.pos.z += (wantZ - this.pos.z) * k
    this.look.x += (lookX - this.look.x) * k
    this.look.y += (lookY - this.look.y) * k
    this.look.z += (lookZ - this.look.z) * k
    this.fov += (fov - this.fov) * k

    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
