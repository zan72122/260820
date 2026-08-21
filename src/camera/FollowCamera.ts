import type { PerspectiveCamera } from 'three'
import {
  ENGAWA_FRONT_Z,
  FENCE_EAST_X,
  FENCE_SOUTH_Z,
  FENCE_WEST_X,
  KAKI_TREE,
} from '../scene/layout'

/**
 * 三人称追従カメラ。
 * - プレイヤーの向きへ臨界減衰スプリングでヨーが追従
 * - ドラッグでオービット（2秒で自動復帰）、ホイールでズーム
 * - 庭の「空気の体積」（塀の内・軒より下）へ常にクランプ:
 *   どんな操作でも塀や屋根を突き抜けない構造的保証
 */
export class FollowCamera {
  /** 入力の「前」方向を決めるヨー（プレイヤー操作が参照） */
  yaw = 0

  private yawVel = 0
  private orbitYawOffset = 0
  private orbitPitchOffset = 0
  private lastInteract = -10
  private distance = 3.1
  private dragging = false
  private lastX = 0
  private lastY = 0
  private time = 0

  constructor(private readonly camera: PerspectiveCamera, dom: HTMLElement) {
    dom.addEventListener('pointerdown', (e) => {
      this.dragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
    })
    window.addEventListener('pointerup', () => {
      this.dragging = false
    })
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      this.orbitYawOffset -= (e.clientX - this.lastX) * 0.005
      this.orbitPitchOffset = Math.max(
        -0.25,
        Math.min(0.35, this.orbitPitchOffset + (e.clientY - this.lastY) * 0.003),
      )
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.lastInteract = this.time
    })
    dom.addEventListener(
      'wheel',
      (e) => {
        this.distance = Math.max(2.0, Math.min(4.4, this.distance + e.deltaY * 0.002))
        e.preventDefault()
      },
      { passive: false },
    )
  }

  update(
    dt: number,
    target: { x: number; y: number; z: number; heading: number },
  ): void {
    this.time += dt

    // 自動復帰: 操作の2秒後からオフセットが緩やかに 0 へ
    if (this.time - this.lastInteract > 2 && !this.dragging) {
      this.orbitYawOffset *= Math.exp(-dt * 1.6)
      this.orbitPitchOffset *= Math.exp(-dt * 0.8)
    }

    // ヨーの臨界減衰スプリング（最短角度差で追従）
    const desired = target.heading
    let diff = desired - this.yaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    const omega = 4.2
    this.yawVel += (diff * omega * omega - 2 * omega * this.yawVel) * dt
    this.yaw += this.yawVel * dt

    const yaw = this.yaw + this.orbitYawOffset
    const pitch = 0.34 + this.orbitPitchOffset // 水平から下向き約19.5°

    const lookX = target.x
    const lookY = target.y + 1.02
    const lookZ = target.z

    let cx = lookX + Math.sin(yaw) * Math.cos(pitch) * this.distance
    let cy = lookY + Math.sin(pitch) * this.distance
    let cz = lookZ + Math.cos(yaw) * Math.cos(pitch) * this.distance

    // 柿の幹をカメラが貫通しない（軸間距離で横に逃がす）
    {
      const dx = cx - KAKI_TREE.x
      const dz = cz - KAKI_TREE.z
      const d = Math.hypot(dx, dz)
      const minD = KAKI_TREE.trunkD / 2 + 0.25
      if (d < minD && d > 1e-4) {
        cx = KAKI_TREE.x + (dx / d) * minD
        cz = KAKI_TREE.z + (dz / d) * minD
      }
    }

    // 庭の空気の体積へクランプ
    cx = Math.max(FENCE_WEST_X + 0.35, Math.min(FENCE_EAST_X - 0.35, cx))
    cz = Math.max(ENGAWA_FRONT_Z + 0.25, Math.min(FENCE_SOUTH_Z - 0.3, cz))
    cy = Math.max(0.4, Math.min(2.15, cy))

    this.camera.position.set(cx, cy, cz)
    this.camera.lookAt(lookX, lookY, lookZ)
  }
}
