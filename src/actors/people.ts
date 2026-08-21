/** 作業員と子ども。作業員は吊荷の下へ入らず、安全な距離から誘導する。 */
import * as THREE from 'three'
import type { Palette } from '../world/materials'
import { chamferBox, mergeInto } from '../build/geometry'
import { damp } from '../core/rng'

function limb(parent: THREE.Object3D, mat: THREE.Material, len: number, r: number) {
  const g = new THREE.Group()
  const m = mergeInto(g, new THREE.CapsuleGeometry(r, len - r * 2, 3, 7), mat)
  m.position.y = -len / 2
  parent.add(g)
  return g
}

export class Worker {
  readonly group = new THREE.Group()
  private torso = new THREE.Group()
  private armL: THREE.Group
  private armR: THREE.Group
  private legL: THREE.Group
  private legR: THREE.Group
  private t = 0
  private walkPhase = 0
  target = new THREE.Vector3()
  facing = new THREE.Vector3(0, 0, 1)
  /** 0=待機 1=合図 2=介錯ロープを持つ 3=点検 */
  mode: 0 | 1 | 2 | 3 = 0

  constructor(pal: Palette, height = 1.72) {
    const s = height / 1.72
    const g = this.group
    const hip = new THREE.Group()
    hip.position.y = 0.9 * s
    g.add(hip)
    hip.add(this.torso)
    const body = mergeInto(this.torso, new THREE.CapsuleGeometry(0.16 * s, 0.34 * s, 4, 10), pal.workwear)
    body.position.y = 0.17 * s
    const vest = mergeInto(this.torso, new THREE.CapsuleGeometry(0.172 * s, 0.24 * s, 4, 10), pal.hiVis)
    vest.position.y = 0.2 * s
    const neck = mergeInto(this.torso, new THREE.CylinderGeometry(0.05 * s, 0.055 * s, 0.07 * s, 8), pal.skin)
    neck.position.y = 0.4 * s
    const head = mergeInto(this.torso, new THREE.SphereGeometry(0.105 * s, 12, 10), pal.skin)
    head.position.y = 0.5 * s
    const helm = mergeInto(this.torso, new THREE.SphereGeometry(0.118 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.helmet)
    helm.position.y = 0.5 * s
    const brim = mergeInto(this.torso, new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.012 * s, 12), pal.helmet)
    brim.position.set(0, 0.5 * s, 0)

    this.armL = limb(this.torso, pal.hiVis, 0.58 * s, 0.045 * s)
    this.armL.position.set(-0.19 * s, 0.36 * s, 0)
    this.armR = limb(this.torso, pal.hiVis, 0.58 * s, 0.045 * s)
    this.armR.position.set(0.19 * s, 0.36 * s, 0)
    this.legL = limb(hip, pal.workwear, 0.88 * s, 0.055 * s)
    this.legL.position.set(-0.08 * s, 0, 0)
    this.legR = limb(hip, pal.workwear, 0.88 * s, 0.055 * s)
    this.legR.position.set(0.08 * s, 0, 0)
    for (const leg of [this.legL, this.legR]) {
      const boot = mergeInto(leg, chamferBox(0.1 * s, 0.09 * s, 0.2 * s, 0.01), pal.rubber)
      boot.position.set(0, -0.86 * s, 0.03 * s)
    }
  }

  update(dt: number, lookAt?: THREE.Vector3) {
    this.t += dt
    const pos = this.group.position
    const d = new THREE.Vector3().subVectors(this.target, pos)
    d.y = 0
    const dist = d.length()
    if (dist > 0.06) {
      const speed = Math.min(1.35, dist * 2.2)
      d.normalize()
      pos.addScaledVector(d, speed * dt)
      this.walkPhase += dt * speed * 6.4
      this.facing.lerp(d, 1 - Math.exp(-8 * dt))
    } else {
      this.walkPhase = damp(this.walkPhase % (Math.PI * 2), 0, 6, dt)
    }
    const face = lookAt ? new THREE.Vector3().subVectors(lookAt, pos).setY(0).normalize() : this.facing
    if (face.lengthSq() > 0.01) this.group.rotation.y = Math.atan2(face.x, face.z)

    const swing = Math.sin(this.walkPhase) * (dist > 0.06 ? 0.55 : 0.05)
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.torso.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.02

    switch (this.mode) {
      case 1: {
        // 合図：片手を上げてゆっくり回す
        this.armR.rotation.x = -2.5
        this.armR.rotation.z = 0.25 + Math.sin(this.t * 3.2) * 0.28
        this.armL.rotation.x = -0.25 + swing * 0.4
        this.armL.rotation.z = 0.1
        break
      }
      case 2: {
        // 介錯ロープを両手で持つ
        this.armR.rotation.x = -1.15 + Math.sin(this.t * 1.6) * 0.06
        this.armL.rotation.x = -1.05 + Math.sin(this.t * 1.6 + 0.4) * 0.06
        this.armR.rotation.z = -0.2
        this.armL.rotation.z = 0.2
        break
      }
      case 3: {
        this.armR.rotation.x = -0.9 + Math.sin(this.t * 1.1) * 0.5
        this.armL.rotation.x = -0.2
        this.armR.rotation.z = 0
        this.armL.rotation.z = 0
        break
      }
      default: {
        this.armR.rotation.x = -swing * 0.7
        this.armL.rotation.x = swing * 0.7
        this.armR.rotation.z = -0.08
        this.armL.rotation.z = 0.08
      }
    }
  }

  /** 介錯ロープを持つ手の位置 */
  handWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.group.position.x, 1.05, this.group.position.z).addScaledVector(this.facing, 0.3)
  }
}

export type ChildPose = 'stand' | 'walk' | 'climb' | 'sit' | 'slide' | 'cheer'

/** 4歳児。工事中は柵の外にいて、完成後にゲートから入って最初に滑る。 */
export class Child {
  readonly group = new THREE.Group()
  private torso = new THREE.Group()
  private hip = new THREE.Group()
  private armL: THREE.Group
  private armR: THREE.Group
  private legL: THREE.Group
  private legR: THREE.Group
  private t = 0
  private walkPhase = 0
  pose: ChildPose = 'stand'
  target = new THREE.Vector3()
  /** 追従移動を使うか（滑走中は外部から位置を与える） */
  autoWalk = true

  constructor(pal: Palette) {
    const s = 1.02 / 1.72
    const g = this.group
    this.hip.position.y = 0.9 * s
    g.add(this.hip)
    this.hip.add(this.torso)
    const body = mergeInto(this.torso, new THREE.CapsuleGeometry(0.15 * s, 0.3 * s, 4, 10), pal.childShirt)
    body.position.y = 0.16 * s
    const head = mergeInto(this.torso, new THREE.SphereGeometry(0.135 * s, 14, 12), pal.skin)
    head.position.y = 0.5 * s
    head.scale.set(1, 1.05, 0.95)
    const hair = mergeInto(this.torso, new THREE.SphereGeometry(0.142 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), pal.rubber)
    hair.position.y = 0.5 * s
    const cap = mergeInto(this.torso, new THREE.SphereGeometry(0.148 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.helmet)
    cap.position.y = 0.5 * s
    cap.material = pal.childShirt
    this.armL = limb(this.torso, pal.skin, 0.46 * s, 0.042 * s)
    this.armL.position.set(-0.17 * s, 0.33 * s, 0)
    this.armR = limb(this.torso, pal.skin, 0.46 * s, 0.042 * s)
    this.armR.position.set(0.17 * s, 0.33 * s, 0)
    this.legL = limb(this.hip, pal.childPants, 0.82 * s, 0.052 * s)
    this.legL.position.set(-0.07 * s, 0, 0)
    this.legR = limb(this.hip, pal.childPants, 0.82 * s, 0.052 * s)
    this.legR.position.set(0.07 * s, 0, 0)
    for (const leg of [this.legL, this.legR]) {
      const shoe = mergeInto(leg, chamferBox(0.09 * s, 0.08 * s, 0.19 * s, 0.01), pal.rubber)
      shoe.position.set(0, -0.8 * s, 0.03 * s)
    }
  }

  update(dt: number, lookAt?: THREE.Vector3) {
    this.t += dt
    let moving = false
    if (this.autoWalk) {
      const d = new THREE.Vector3().subVectors(this.target, this.group.position)
      d.y = 0
      const dist = d.length()
      if (dist > 0.05) {
        moving = true
        d.normalize()
        this.group.position.addScaledVector(d, Math.min(1.1, dist * 2.4) * dt)
        this.walkPhase += dt * 8
        this.group.rotation.y = damp(this.group.rotation.y, Math.atan2(d.x, d.z), 8, dt)
      }
    }
    if (lookAt) {
      const f = new THREE.Vector3().subVectors(lookAt, this.group.position).setY(0)
      if (f.lengthSq() > 0.02) this.group.rotation.y = damp(this.group.rotation.y, Math.atan2(f.x, f.z), 6, dt)
    }
    const swing = Math.sin(this.walkPhase) * (moving ? 0.62 : 0)
    switch (this.pose) {
      case 'sit':
        this.legL.rotation.x = -1.5
        this.legR.rotation.x = -1.5
        this.armL.rotation.x = -0.5
        this.armR.rotation.x = -0.5
        this.hip.position.y = 0.52
        break
      case 'slide':
        this.legL.rotation.x = -1.35
        this.legR.rotation.x = -1.35
        this.armL.rotation.x = -0.9 + Math.sin(this.t * 6) * 0.15
        this.armR.rotation.x = -0.9 - Math.sin(this.t * 6) * 0.15
        this.armL.rotation.z = 0.5
        this.armR.rotation.z = -0.5
        this.hip.position.y = 0.52
        break
      case 'climb':
        this.legL.rotation.x = Math.sin(this.walkPhase) * 0.9 - 0.35
        this.legR.rotation.x = -Math.sin(this.walkPhase) * 0.9 - 0.35
        this.armL.rotation.x = -1.6 + Math.sin(this.walkPhase) * 0.3
        this.armR.rotation.x = -1.6 - Math.sin(this.walkPhase) * 0.3
        this.hip.position.y = 0.535
        break
      case 'cheer':
        this.legL.rotation.x = 0
        this.legR.rotation.x = 0
        this.armL.rotation.x = -2.6
        this.armR.rotation.x = -2.6
        this.armL.rotation.z = 0.35 + Math.sin(this.t * 5) * 0.2
        this.armR.rotation.z = -0.35 - Math.sin(this.t * 5) * 0.2
        this.hip.position.y = 0.535 + Math.abs(Math.sin(this.t * 5)) * 0.05
        break
      default:
        this.legL.rotation.x = swing
        this.legR.rotation.x = -swing
        this.armL.rotation.x = -swing * 0.8
        this.armR.rotation.x = swing * 0.8
        this.armL.rotation.z = 0.12
        this.armR.rotation.z = -0.12
        this.hip.position.y = 0.535
    }
    this.torso.rotation.x = this.pose === 'slide' ? 0.28 : this.pose === 'sit' ? 0.18 : 0
  }
}
