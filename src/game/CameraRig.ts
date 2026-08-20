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
  // A low, quiet look along the flume. Nothing is happening yet.
  establish: {
    relative: false,
    land: { pos: [0.30, 1.45, 0.14], target: [0.0, 0.840, -1.30], fov: 46, tau: 1.5 },
    port: { pos: [0.30, 1.40, 0.18], target: [0.08, 0.848, -1.40], fov: 60, tau: 1.5 },
  },
  // Running alongside a bundle, right down at the surface of the water.
  travel: {
    relative: true,
    land: { pos: [0.26, 0.215, 0.26], target: [-0.04, -0.035, -0.12], fov: 36, tau: 0.16 },
    port: { pos: [0.23, 0.200, 0.23], target: [-0.04, -0.035, -0.11], fov: 52, tau: 0.16 },
  },
  // The framing the game lives in: chopsticks, water and somen together.
  play: {
    relative: false,
    land: { pos: [0.30, 1.18, -0.04], target: [0.0, 0.840, -1.10], fov: 43, tau: 0.85 },
    port: { pos: [0.29, 1.19, -0.02], target: [0.10, 0.848, -1.28], fov: 59, tau: 0.85 },
  },
  // Following the catch upwards. Never cut here — the causality must hold.
  lift: {
    relative: true,
    land: { pos: [0.30, 0.215, 0.34], target: [-0.02, -0.055, -0.08], fov: 34, tau: 0.18 },
    port: { pos: [0.27, 0.205, 0.30], target: [-0.02, -0.055, -0.08], fov: 48, tau: 0.18 },
  },
  bowl: {
    relative: false,
    land: {
      pos: [BOWL.x + 0.20, BOWL.standY + 0.245, BOWL.z + 0.30],
      target: [BOWL.x, BOWL.standY + 0.03, BOWL.z],
      fov: 38,
      tau: 0.45,
    },
    port: {
      pos: [BOWL.x + 0.16, BOWL.standY + 0.225, BOWL.z + 0.24],
      target: [BOWL.x, BOWL.standY + 0.03, BOWL.z],
      fov: 52,
      tau: 0.45,
    },
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export class CameraRig {
  readonly camera: PerspectiveCamera
  private pos = new Vector3()
  private look = new Vector3()
  private fov = 36
  private shot: ShotName = 'establish'
  private shotAt = 0
  private subject = new Vector3()
  private landscapeMix = 1
  private drift = 0
  private overridden = false
  private tmpLook = new Vector3()

  constructor() {
    this.camera = new PerspectiveCamera(36, 1, 0.03, 160)
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
    // Poses are stored in the active shot's own frame — world space for a
    // fixed shot, subject space for a tracking one — so that a tracking shot
    // never lags behind what it is following. Convert on the way in.
    const wasRelative = SHOTS[this.shot].relative
    const nowRelative = SHOTS[shot].relative
    if (wasRelative !== nowRelative) {
      const sign = nowRelative ? -1 : 1
      this.pos.addScaledVector(this.subject, sign)
      this.look.addScaledVector(this.subject, sign)
    }
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
    return this.camera.position.distanceTo(this.tmpLook)
  }

  /** Debug only: pin the camera so a detail can be inspected in a browser. */
  override(pos: number[], target: number[], fov: number): void {
    this.overridden = true
    this.pos.set(pos[0], pos[1], pos[2])
    this.look.set(target[0], target[1], target[2])
    this.fov = fov
    this.tmpLook.set(target[0], target[1], target[2])
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
  }

  clearOverride(): void {
    this.overridden = false
  }

  update(dt: number, time: number): void {
    if (this.overridden) return
    const def = SHOTS[this.shot]
    const m = this.landscapeMix
    const px: number[] = []
    for (let i = 0; i < 3; i++) px.push(lerp(def.port.pos[i], def.land.pos[i], m))
    const tx: number[] = []
    for (let i = 0; i < 3; i++) tx.push(lerp(def.port.target[i], def.land.target[i], m))
    const fov = lerp(def.port.fov, def.land.fov, m)
    const tau = lerp(def.port.tau, def.land.tau, m)

    const wantX = px[0]
    const wantY = px[1]
    const wantZ = px[2]
    let lookX = tx[0]
    let lookY = tx[1]
    let lookZ = tx[2]

    // Very slow breathing so a static shot is never dead.
    this.drift += dt
    const breathe = this.shot === 'establish' || this.shot === 'play' ? 1 : 0
    const bx = Math.sin(this.drift * 0.17) * 0.022 * breathe
    const by = Math.sin(this.drift * 0.13 + 1.7) * 0.014 * breathe
    const bz = Math.sin(this.drift * 0.11 + 0.4) * 0.018 * breathe

    // Ease in after a change of shot, then tighten up.
    const since = time - this.shotAt
    const t = tau * (1 + 2.4 * Math.exp(-since * 1.5))
    const k = 1 - Math.exp(-dt / Math.max(0.02, t))

    this.pos.x += (wantX + bx - this.pos.x) * k
    this.pos.y += (wantY + by - this.pos.y) * k
    this.pos.z += (wantZ + bz - this.pos.z) * k
    this.look.x += (lookX - this.look.x) * k
    this.look.y += (lookY - this.look.y) * k
    this.look.z += (lookZ - this.look.z) * k
    this.fov += (fov - this.fov) * k

    if (def.relative) {
      this.camera.position.addVectors(this.pos, this.subject)
      this.tmpLook.addVectors(this.look, this.subject)
    } else {
      this.camera.position.copy(this.pos)
      this.tmpLook.copy(this.look)
    }
    this.camera.lookAt(this.tmpLook)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
