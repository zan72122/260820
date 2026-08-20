import * as THREE from 'three'
import { clamp, easeInOutSine, easeOutCubic } from './util'

/**
 * カメラ演出。プレイヤーに視点を探させず、
 * ゲーム側が「見せたい絵」へ連れていく。
 * ショットは 2 つの姿勢（始点・終点）を持ち、ゆっくり移動しながら見せる。
 */

export type Pose = {
  pos: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

export const pose = (
  px: number, py: number, pz: number,
  tx: number, ty: number, tz: number,
  fov = 46,
): Pose => ({
  pos: new THREE.Vector3(px, py, pz),
  target: new THREE.Vector3(tx, ty, tz),
  fov,
})

type Segment = {
  from: Pose
  to: Pose
  dur: number
  ease: (t: number) => number
  t: number
}

const clonePose = (p: Pose): Pose => ({
  pos: p.pos.clone(),
  target: p.target.clone(),
  fov: p.fov,
})

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera
  private current: Pose
  private queue: Segment[] = []
  private clock = 0
  /** 手持ちカメラのような微細な揺れ */
  handheld = 1
  private baseAspect = 1

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.4, 5200)
    this.current = pose(0, 10, 200, 0, 8, 0)
    this.apply()
  }

  get pose() {
    return this.current
  }

  cut(p: Pose) {
    this.queue.length = 0
    this.current = clonePose(p)
    this.apply()
  }

  /** 現在位置から a へ寄り、その後 a → b をゆっくり移動する。 */
  play(a: Pose, b: Pose, blend = 2.4, travel = 16, ease = easeInOutSine) {
    this.queue.length = 0
    if (blend > 0.01) {
      this.queue.push({ from: clonePose(this.current), to: clonePose(a), dur: blend, ease: easeOutCubic, t: 0 })
    } else {
      this.current = clonePose(a)
    }
    this.queue.push({ from: clonePose(a), to: clonePose(b), dur: travel, ease, t: 0 })
  }

  get busy() {
    return this.queue.length > 0
  }

  update(dt: number, aspect: number) {
    this.clock += dt
    this.baseAspect = aspect
    if (this.queue.length) {
      const s = this.queue[0]
      s.t += dt
      const k = s.ease(clamp(s.t / s.dur, 0, 1))
      this.current.pos.copy(s.from.pos).lerp(s.to.pos, k)
      this.current.target.copy(s.from.target).lerp(s.to.target, k)
      this.current.fov = s.from.fov + (s.to.fov - s.from.fov) * k
      if (s.t >= s.dur) {
        this.current = clonePose(s.to)
        this.queue.shift()
      }
    }
    this.apply()
  }

  private apply() {
    const c = this.camera
    const t = this.clock
    const amp = this.handheld
    const sway = new THREE.Vector3(
      (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.91 + 1.3) * 0.32) * 0.055 * amp,
      (Math.sin(t * 0.53 + 2.1) * 0.5 + Math.sin(t * 1.21) * 0.24) * 0.042 * amp,
      (Math.sin(t * 0.44 + 0.7) * 0.5) * 0.05 * amp,
    )
    c.position.copy(this.current.pos).add(sway)
    const look = this.current.target.clone()
    look.x += Math.sin(t * 0.29 + 0.4) * 0.09 * amp
    look.y += Math.sin(t * 0.41 + 1.9) * 0.07 * amp
    c.lookAt(look)

    // 縦持ちでも会場が入るよう、縦長画面では画角を広げる
    const a = this.baseAspect
    let fov = this.current.fov
    if (a < 1) fov = fov / clamp(a * 1.05, 0.52, 1)
    c.fov = clamp(fov, 30, 92)
    c.aspect = a
    c.updateProjectionMatrix()
  }
}
