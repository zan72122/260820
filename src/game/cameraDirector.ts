import { PerspectiveCamera, Vector3 } from 'three'
import { springTo, type SpringState } from '../core/math'

/**
 * One camera on one rig. It is never cut: every change of framing is a move,
 * and during the fall and the catch the rig is frozen outright so nothing can
 * interrupt the one shot the game exists for.
 *
 * A shot is described by what must stay in frame, not by a distance, so the
 * same shot works on a 390x844 phone and a 1366x1024 tablet.
 */
export interface Shot {
  name: string
  target: [number, number, number]
  /** Half extents, in metres, that must remain inside the safe area. */
  halfW: number
  halfH: number
  /** 35mm-equivalent focal length. */
  focal: number
  yaw: number
  pitch: number
  /** Seconds for the move to essentially complete. */
  smooth: number
}

export interface SafeInsets {
  top: number
  bottom: number
  left: number
  right: number
}

interface Channel extends SpringState {}

const ch = (v: number): Channel => ({ value: v, velocity: 0 })

export class CameraDirector {
  readonly camera: PerspectiveCamera
  private readonly tx = ch(0)
  private readonly ty = ch(0.8)
  private readonly tz = ch(0)
  private readonly hw = ch(0.5)
  private readonly hh = ch(0.5)
  private readonly fl = ch(55)
  private readonly yaw = ch(0.2)
  private readonly pitch = ch(0.05)
  private smooth = 1.1
  private frozen = false
  private time = 0
  private aspect = 1
  private insets: SafeInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  private viewport = { w: 1, h: 1 }
  private readonly tmp = new Vector3()
  private handheld = 1

  constructor() {
    this.camera = new PerspectiveCamera(40, 1, 0.02, 40)
    this.camera.filmGauge = 35
  }

  setViewport(w: number, h: number, insets: SafeInsets): void {
    this.viewport.w = Math.max(1, w)
    this.viewport.h = Math.max(1, h)
    this.insets = insets
    this.aspect = this.viewport.w / this.viewport.h
    this.camera.aspect = this.aspect
  }

  /** Hold the current framing exactly: used from loosening through the catch. */
  freeze(on: boolean): void {
    this.frozen = on
  }

  setHandheld(amount: number): void {
    this.handheld = amount
  }

  setShot(shot: Shot, immediate = false): void {
    this.smooth = shot.smooth
    const set = (c: Channel, v: number): void => {
      if (immediate) {
        c.value = v
        c.velocity = 0
      }
    }
    this.pending = shot
    set(this.tx, shot.target[0])
    set(this.ty, shot.target[1])
    set(this.tz, shot.target[2])
    set(this.hw, shot.halfW)
    set(this.hh, shot.halfH)
    set(this.fl, shot.focal)
    set(this.yaw, shot.yaw)
    set(this.pitch, shot.pitch)
    if (immediate) this.apply(0)
  }

  private pending: Shot | null = null

  update(dt: number): void {
    this.time += dt
    if (!this.frozen && this.pending) {
      const s = this.pending
      const t = this.smooth
      springTo(this.tx, s.target[0], t, dt)
      springTo(this.ty, s.target[1], t, dt)
      springTo(this.tz, s.target[2], t, dt)
      springTo(this.hw, s.halfW, t, dt)
      springTo(this.hh, s.halfH, t, dt)
      springTo(this.fl, s.focal, t, dt)
      springTo(this.yaw, s.yaw, t, dt)
      springTo(this.pitch, s.pitch, t, dt)
    }
    this.apply(dt)
  }

  /**
   * Fractions of the frame lost to notches and home indicators. The framing is
   * inflated by them, so nothing important can hide under system chrome.
   */
  private safeScale(): { w: number; h: number; ox: number; oy: number } {
    const { w, h } = this.viewport
    const usableW = Math.max(1, w - this.insets.left - this.insets.right)
    const usableH = Math.max(1, h - this.insets.top - this.insets.bottom)
    return {
      w: w / usableW,
      h: h / usableH,
      ox: (this.insets.left - this.insets.right) / w,
      oy: (this.insets.top - this.insets.bottom) / h,
    }
  }

  private apply(dt: number): void {
    void dt
    const focal = Math.max(24, this.fl.value)
    const filmHeight = 35 / Math.max(this.aspect, 1)
    const tanV = filmHeight / 2 / focal
    const tanH = tanV * this.aspect
    this.camera.fov = 2 * Math.atan(tanV) * (180 / Math.PI)

    const safe = this.safeScale()
    const needW = this.hw.value * safe.w
    const needH = this.hh.value * safe.h
    const dist = Math.max(needH / tanV, needW / tanH)

    const yaw = this.yaw.value
    const pitch = this.pitch.value
    // A trace of handheld float: alive, but far too small to read as a move.
    const drift = this.handheld * 0.0045
    const bx = Math.sin(this.time * 0.37) * drift + Math.sin(this.time * 0.91) * drift * 0.4
    const by = Math.sin(this.time * 0.29 + 1.7) * drift + Math.sin(this.time * 1.13) * drift * 0.3

    const cy = Math.cos(pitch)
    this.tmp.set(Math.sin(yaw) * cy, Math.sin(pitch), Math.cos(yaw) * cy)

    // Keep the frame's optical centre on the target even with uneven insets.
    const shiftX = -safe.ox * needW
    const shiftY = safe.oy * needH

    const tX = this.tx.value + shiftX
    const tY = this.ty.value + shiftY
    const tZ = this.tz.value

    this.camera.position.set(
      tX + this.tmp.x * dist + bx,
      tY + this.tmp.y * dist + by,
      tZ + this.tmp.z * dist,
    )
    this.camera.lookAt(tX + bx * 0.35, tY + by * 0.35, tZ)
    this.camera.updateProjectionMatrix()
  }

  /** Current framing, useful for tests and for checking nothing is cropped. */
  debugFraming(): { dist: number; halfW: number; halfH: number; focal: number } {
    const focal = this.fl.value
    const filmHeight = 35 / Math.max(this.aspect, 1)
    const tanV = filmHeight / 2 / focal
    const tanH = tanV * this.aspect
    const safe = this.safeScale()
    const needW = this.hw.value * safe.w
    const needH = this.hh.value * safe.h
    return {
      dist: Math.max(needH / tanV, needW / tanH),
      halfW: needW,
      halfH: needH,
      focal,
    }
  }
}
