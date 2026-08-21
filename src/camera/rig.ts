/**
 * カメラは工程ごとの preset に固定・自動追従する。プレイヤーの gesture では動かさない。
 * 縦横どちらでも「長い滑走面と接続先」が同時に入るよう、必要な画角から距離を解く。
 */
import * as THREE from 'three'
import { CAMERAS, type Framing } from '../build/layout'
import { clamp, damp } from '../core/rng'

const damp01 = (t: number) => clamp(t, 0, 1)

const DEG = Math.PI / 180

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  private targetPos = new THREE.Vector3()
  private desiredPos = new THREE.Vector3()
  private desiredLook = new THREE.Vector3()
  private currentLook = new THREE.Vector3()
  private framing: Framing = CAMERAS.overview.land
  private base = new THREE.Vector3()
  private offset = new THREE.Vector3()
  private portrait = false
  private wide: { target: THREE.Vector3; fitW: number; fitH: number } | null = null
  private wideT = 1
  private snapNext = true
  private presetKey = 'overview'

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.08, 400)
    this.setPreset('overview', true)
  }

  get key(): string {
    return this.presetKey
  }

  setPreset(key: string, snap = false) {
    const preset = CAMERAS[key] ?? CAMERAS.overview
    this.presetKey = key
    this.base.set(preset.target[0], preset.target[1], preset.target[2])
    this.framing = (this.portrait && preset.port) || preset.land
    this.offset.set(0, 0, 0)
    if (snap) this.snapNext = true
  }

  /**
   * 吊り上げ中の画角。u=0 では仮置きと取付先の両方が入る広い画角、
   * u=1 で工程の preset へ寄る。寄りすぎて吊荷の全体姿勢を見失わせない。
   */
  setLiftBlend(target: THREE.Vector3, fitW: number, fitH: number, t: number) {
    this.wide = { target: target.clone(), fitW, fitH }
    this.wideT = damp01(t)
  }

  clearLiftBlend() {
    this.wide = null
    this.wideT = 1
  }

  /** 滑走追従などで注視点をずらす */
  setOffset(x: number, y: number, z: number) {
    this.offset.set(x, y, z)
  }

  setViewport(width: number, height: number) {
    const portrait = height > width
    const changed = portrait !== this.portrait
    this.portrait = portrait
    this.camera.aspect = width / height
    this.camera.fov = portrait ? 72 : 52
    this.camera.updateProjectionMatrix()
    if (changed) this.setPreset(this.presetKey)
  }

  private solve() {
    const f = this.framing
    const vHalf = (this.camera.fov * DEG) / 2
    const tanV = Math.tan(vHalf)
    const tanH = tanV * this.camera.aspect
    let fitW = f.fitW
    let fitH = f.fitH
    this.targetPos.copy(this.base).add(this.offset)
    if (this.wide) {
      const t = this.wideT
      fitW = this.wide.fitW + (f.fitW - this.wide.fitW) * t
      fitH = this.wide.fitH + (f.fitH - this.wide.fitH) * t
      this.targetPos.lerpVectors(this.wide.target, this.targetPos.clone(), t)
    }
    const dist = Math.max(fitH / tanV, fitW / tanH, 1.1)
    const az = f.az * DEG
    const el = f.elev * DEG
    this.desiredPos.set(
      this.targetPos.x + Math.cos(el) * Math.cos(az) * dist,
      this.targetPos.y + Math.sin(el) * dist,
      this.targetPos.z + Math.cos(el) * Math.sin(az) * dist,
    )
    this.desiredPos.y = Math.max(this.desiredPos.y, 0.35)
    this.desiredLook.copy(this.targetPos)
  }

  update(dt: number) {
    this.solve()
    if (this.snapNext) {
      this.camera.position.copy(this.desiredPos)
      this.currentLook.copy(this.desiredLook)
      this.snapNext = false
    } else {
      const k = 2.6
      this.camera.position.x = damp(this.camera.position.x, this.desiredPos.x, k, dt)
      this.camera.position.y = damp(this.camera.position.y, this.desiredPos.y, k, dt)
      this.camera.position.z = damp(this.camera.position.z, this.desiredPos.z, k, dt)
      this.currentLook.x = damp(this.currentLook.x, this.desiredLook.x, k * 1.3, dt)
      this.currentLook.y = damp(this.currentLook.y, this.desiredLook.y, k * 1.3, dt)
      this.currentLook.z = damp(this.currentLook.z, this.desiredLook.z, k * 1.3, dt)
    }
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(this.currentLook)
  }
}
