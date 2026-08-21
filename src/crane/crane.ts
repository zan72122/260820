/**
 * 小型移動式クレーン。完全な自由物理ではなく、制約された軌道と軽い二次運動で
 * 重量感を出す。1 つの gesture に 1 つの機械動作を対応させる。
 *   レバー上下  → 巻上げ／巻下げ
 *   横スワイプ  → 旋回（吊荷が安全な範囲で横移動）
 *   回転ハンドル → 吊荷の向き
 */
import * as THREE from 'three'
import type { Palette } from '../world/materials'
import type { QualitySettings } from '../core/env'
import { SITE, type PartPlacement } from '../build/layout'
import { chamferBox, mergeInto } from '../build/geometry'
import { clamp, damp, lerp, wrapAngle } from '../core/rng'
import { Ribbon } from './ribbon'

const DEG = Math.PI / 180

export interface CraneInput {
  /** -1(巻下げ) .. +1(巻上げ) */
  hoist: number
  /** 旋回パラメータ u の増分（画面右方向スワイプを符号込みで渡す） */
  slew: number
  /** 向き微調整（rad） */
  yaw: number
}

const U_SAFE_LOW = 0.1
const U_SAFE_HIGH = 0.9

export const CRANE_RATES = { hoist: 0.62, yawDeg: 62, slewDeg: 14 }

export type LiftPhase = 'idle' | 'rigging' | 'takeLoad' | 'manual' | 'settle' | 'landed'

interface PolarPoint {
  theta: number
  radius: number
}

function toPolar(x: number, z: number): PolarPoint {
  const dx = x - SITE.crane.x
  const dz = z - SITE.crane.z
  return { theta: Math.atan2(dz, dx), radius: Math.hypot(dx, dz) }
}

export class Crane {
  readonly group = new THREE.Group()
  readonly superstructure = new THREE.Group()
  private boomSections: THREE.Mesh[] = []
  private boomPivot = new THREE.Group()
  private ropeMesh!: THREE.Mesh
  private hookBlock = new THREE.Group()
  private spreader = new THREE.Group()
  private slings: Ribbon[] = []
  private tagLine!: Ribbon

  private theta = 0
  private radius = 5
  hookY = 3
  private hookWorld = new THREE.Vector3()
  private prevHookWorld = new THREE.Vector3()
  private hookVel = new THREE.Vector3()
  private swing = new THREE.Vector3()
  private swingVel = new THREE.Vector3()

  phase: LiftPhase = 'idle'
  private phaseT = 0
  private load: THREE.Object3D | null = null
  private placement: PartPlacement | null = null
  private pick: PolarPoint = { theta: 0, radius: 5 }
  private place: PolarPoint = { theta: 0, radius: 5 }
  private clearanceY = 0.3
  /** 旋回パラメータ 0=仮置き上空 1=取付位置上空 */
  u = 0
  yawErr = 0
  private startPose = new THREE.Matrix4()
  private startPos = new THREE.Vector3()
  private startQuat = new THREE.Quaternion()
  private carryQuat = new THREE.Quaternion()
  private seatQuat = new THREE.Quaternion()
  private slackFactor = 1
  private landedCb: (() => void) | null = null
  private speedScale: number
  private secondary: boolean
  /** 危険な入力を弱めるための減速係数 */
  private caution = 1

  constructor(pal: Palette, q: QualitySettings, speedScale: number) {
    this.speedScale = speedScale
    this.secondary = q.secondaryMotion
    this.build(pal, q)
  }

  private build(pal: Palette, q: QualitySettings) {
    const g = this.group
    g.position.set(SITE.crane.x, 0, SITE.crane.z)

    // キャリア（下部走行体）
    const carrier = new THREE.Group()
    const chassis = mergeInto(carrier, chamferBox(6.0, 0.62, 2.35, 0.03), pal.craneBody)
    chassis.position.y = 0.86
    const deckPlate = mergeInto(carrier, chamferBox(6.1, 0.06, 2.45, 0.02), pal.craneBoom)
    deckPlate.position.y = 1.2
    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, q.tier === 'low' ? 10 : 18)
    wheelGeo.rotateX(Math.PI / 2)
    for (const wx of [-2.15, -1.35, 1.35, 2.15]) {
      for (const wz of [-1.16, 1.16]) {
        const w = mergeInto(carrier, wheelGeo, pal.rubber)
        w.position.set(wx, 0.46, wz)
        const hub = mergeInto(carrier, new THREE.CylinderGeometry(0.17, 0.17, 0.36, 8), pal.craneBoom)
        hub.rotation.x = Math.PI / 2
        hub.position.set(wx, 0.46, wz)
      }
    }
    // アウトリガー（張り出して接地）
    for (const ox of [-2.5, 2.5]) {
      for (const oz of [-1, 1]) {
        const beam = mergeInto(carrier, chamferBox(0.34, 0.26, 1.5, 0.015), pal.craneBody)
        beam.position.set(ox, 0.82, oz * 1.35)
        const jack = mergeInto(carrier, new THREE.CylinderGeometry(0.09, 0.09, 0.72, 8), pal.craneBoom)
        jack.position.set(ox, 0.4, oz * 2.0)
        const pad = mergeInto(carrier, new THREE.CylinderGeometry(0.34, 0.36, 0.09, 12), pal.craneBody)
        pad.position.set(ox, 0.045, oz * 2.0)
        const mat = mergeInto(carrier, chamferBox(0.9, 0.05, 0.9, 0.008), pal.timber)
        mat.position.set(ox, 0.012, oz * 2.0)
      }
    }
    // 下部走行体は現場に対して横向き。アウトリガーを張って側方吊りする。
    carrier.rotation.y = Math.PI / 2
    g.add(carrier)

    // 旋回体
    const turntable = mergeInto(this.superstructure, new THREE.CylinderGeometry(1.02, 1.08, 0.28, 18), pal.craneBoom)
    turntable.position.y = 1.34
    const house = mergeInto(this.superstructure, chamferBox(2.1, 0.95, 1.9, 0.03), pal.craneBody)
    house.position.set(-1.0, 1.95, 0)
    const cw = mergeInto(this.superstructure, chamferBox(0.95, 1.0, 2.2, 0.02), pal.rubber)
    cw.position.set(-2.05, 1.95, 0)
    const cab = mergeInto(this.superstructure, chamferBox(1.0, 1.25, 0.95, 0.03), pal.craneBody)
    cab.position.set(-0.15, 2.1, 1.28)
    // ブーム受け（格納時にブームが載る台）
    const rest = mergeInto(this.superstructure, chamferBox(0.3, 0.5, 0.5, 0.01), pal.craneBoom)
    rest.position.set(2.4, 1.55, 0)
    const glass = mergeInto(
      this.superstructure,
      chamferBox(0.9, 0.8, 0.03, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x2b3a44, metalness: 0.5, roughness: 0.18 }),
    )
    glass.position.set(-0.15, 2.3, 1.77)
    // 油圧ホース
    const hosePts = [
      new THREE.Vector3(-0.5, 2.4, 0.7),
      new THREE.Vector3(-0.1, 2.15, 0.85),
      new THREE.Vector3(0.4, 2.3, 0.7),
    ]
    const hose = mergeInto(this.superstructure, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 16, 0.035, 6), pal.hose)
    hose.castShadow = false

    // ブーム（伸縮式）
    this.boomPivot.position.set(-SITE.crane.pivotBack, SITE.crane.pivotY, 0)
    this.boomPivot.rotation.z = SITE.crane.luffDeg * DEG
    this.superstructure.add(this.boomPivot)
    const sizes: Array<[number, number]> = [
      [0.62, 0.66],
      [0.5, 0.54],
      [0.4, 0.44],
    ]
    for (const [h, w] of sizes) {
      // 長さ 1 の箱を X 方向に伸縮させて、伸縮ブームの段を表す
      const geo = chamferBox(1, h, w, 0.012)
      const m = new THREE.Mesh(geo, pal.craneBoom)
      m.castShadow = true
      this.boomSections.push(m)
      this.boomPivot.add(m)
    }
    // 起伏シリンダ
    const cyl = mergeInto(this.superstructure, new THREE.CylinderGeometry(0.13, 0.13, 2.3, 10), pal.craneBoom)
    cyl.position.set(0.05, 2.35, 0)
    cyl.rotation.z = -(90 - SITE.crane.luffDeg + 22) * DEG
    // ブーム先端のシーブ
    const head = mergeInto(this.boomPivot, new THREE.CylinderGeometry(0.17, 0.17, 0.3, 12), pal.craneBoom)
    head.rotation.x = Math.PI / 2
    head.name = 'boomHead'
    g.add(this.superstructure)

    // ワイヤロープ
    this.ropeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0x54585c, metalness: 0.85, roughness: 0.45 }),
    )
    this.ropeMesh.castShadow = false
    g.add(this.ropeMesh)

    // フックブロック
    const block = mergeInto(this.hookBlock, chamferBox(0.24, 0.34, 0.16, 0.012), pal.craneBody)
    block.position.y = -0.17
    const sheave = mergeInto(this.hookBlock, new THREE.CylinderGeometry(0.12, 0.12, 0.09, 12), pal.craneBoom)
    sheave.rotation.x = Math.PI / 2
    sheave.position.y = -0.12
    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.34, 0),
      new THREE.Vector3(0, -0.46, 0),
      new THREE.Vector3(0.02, -0.55, 0.04),
      new THREE.Vector3(0.0, -0.58, 0.1),
      new THREE.Vector3(-0.05, -0.52, 0.09),
    ])
    const hook = mergeInto(this.hookBlock, new THREE.TubeGeometry(hookCurve, 16, 0.026, 7), pal.boltSteel)
    hook.castShadow = true
    this.group.add(this.hookBlock)

    // 天秤（長尺部材用）
    const beam = mergeInto(this.spreader, chamferBox(2.2, 0.14, 0.14, 0.008), pal.galvanized)
    beam.position.y = -0.7
    for (const sx of [-1.05, 1.05]) {
      const lug = mergeInto(this.spreader, chamferBox(0.04, 0.16, 0.1, 0.004), pal.galvanizedDull)
      lug.position.set(sx, -0.78, 0)
    }
    const topSling = new Ribbon(pal.sling, 0.05, 4)
    const topSling2 = new Ribbon(pal.sling, 0.05, 4)
    this.spreaderStraps = [topSling, topSling2]
    this.group.add(topSling.mesh, topSling2.mesh)
    this.spreader.visible = false
    this.group.add(this.spreader)

    for (let i = 0; i < 4; i++) {
      const r = new Ribbon(pal.sling, 0.075, 8)
      r.mesh.visible = false
      this.slings.push(r)
      this.group.add(r.mesh)
    }
    this.tagLine = new Ribbon(pal.tagLine, 0.016, 12)
    this.tagLine.mesh.visible = false
    this.group.add(this.tagLine.mesh)

    this.applyKinematics()
  }

  private spreaderStraps: Ribbon[] = []

  // ------------------------------------------------------------ 幾何

  private tipLocal(radius: number): THREE.Vector3 {
    const luff = SITE.crane.luffDeg * DEG
    const len = (radius + SITE.crane.pivotBack) / Math.cos(luff)
    return new THREE.Vector3(
      -SITE.crane.pivotBack + len * Math.cos(luff),
      SITE.crane.pivotY + len * Math.sin(luff),
      0,
    )
  }

  private boomLength(radius: number): number {
    return (radius + SITE.crane.pivotBack) / Math.cos(SITE.crane.luffDeg * DEG)
  }

  private applyKinematics() {
    const r = clamp(this.radius, SITE.crane.minRadius, SITE.crane.maxRadius)
    this.superstructure.rotation.y = -this.theta
    const len = this.boomLength(r)
    const overlaps: Array<[number, number]> = [
      [0, 0.62],
      [0.19, 0.62],
      [0.38, 0.62],
    ]
    this.boomSections.forEach((m, i) => {
      const [start, frac] = overlaps[i]
      const sl = len * frac
      m.scale.x = sl
      m.position.set(len * start + sl / 2, 0, 0)
    })
    const head = this.boomPivot.getObjectByName('boomHead')
    if (head) head.position.set(len, 0, 0)

    const tip = this.tipLocal(r)
    const tipWorld = new THREE.Vector3(
      SITE.crane.x + tip.x * Math.cos(this.theta),
      tip.y,
      SITE.crane.z + tip.x * Math.sin(this.theta),
    )
    this.hookWorld.set(tipWorld.x + this.swing.x, this.hookY, tipWorld.z + this.swing.z)

    // ロープ
    const local = this.hookWorld.clone().sub(this.group.position)
    const tipLocalWorld = tipWorld.clone().sub(this.group.position)
    const mid = tipLocalWorld.clone().add(local).multiplyScalar(0.5)
    const d = new THREE.Vector3().subVectors(local, tipLocalWorld)
    const l = d.length()
    this.ropeMesh.position.copy(mid)
    this.ropeMesh.scale.y = Math.max(0.02, l)
    this.ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    this.hookBlock.position.copy(local)
  }

  // ------------------------------------------------------------ 吊り作業

  beginLift(load: THREE.Object3D, placement: PartPlacement, onLanded: () => void) {
    this.load = load
    this.placement = placement
    this.clearanceY = placement.approachClearance
    this.landedCb = onLanded
    this.pick = toPolar(placement.pickXZ.x, placement.pickXZ.z)
    this.place = toPolar(placement.placeXZ.x, placement.placeXZ.z)
    if (Math.abs(wrapAngle(this.place.theta - this.pick.theta)) > Math.PI) {
      this.place.theta += Math.sign(this.pick.theta - this.place.theta) * Math.PI * 2
    }
    this.u = 0
    this.yawErr = placement.yawErrorDeg * DEG
    this.theta = this.pick.theta
    this.radius = this.pick.radius
    this.startPos.set(placement.layDown.x, placement.layDown.y, placement.layDown.z)
    this.startQuat.setFromEuler(
      new THREE.Euler(
        placement.layDown.pitchDeg * DEG,
        placement.layDown.yawDeg * DEG,
        (placement.layDown.rollDeg ?? 0) * DEG,
        'YXZ',
      ),
    )
    this.seatQuat.setFromEuler(new THREE.Euler(placement.seat.pitchDeg * DEG, placement.seat.yawDeg * DEG, 0, 'YXZ'))
    this.carryQuat.setFromEuler(
      new THREE.Euler(placement.seat.pitchDeg * DEG, placement.seat.yawDeg * DEG + this.yawErr, 0, 'YXZ'),
    )
    this.startPose.identity()
    this.hookY = placement.layDown.y + placement.hookOffset.y
    this.swing.set(0, 0, 0)
    this.swingVel.set(0, 0, 0)
    this.slackFactor = 1
    this.phase = 'rigging'
    this.phaseT = 0
    load.position.copy(this.startPos)
    load.quaternion.copy(this.startQuat)
    this.spreader.visible = placement.spreader
    this.spreaderStraps.forEach((s) => (s.mesh.visible = placement.spreader))
    this.slings.forEach((s, i) => (s.mesh.visible = i < placement.slingPoints.length))
    this.tagLine.mesh.visible = true
    this.applyKinematics()
  }

  endLift() {
    this.phase = 'idle'
    this.load = null
    this.placement = null
    this.slings.forEach((s) => (s.mesh.visible = false))
    this.spreaderStraps.forEach((s) => (s.mesh.visible = false))
    this.spreader.visible = false
    this.tagLine.mesh.visible = false
  }

  get hookPosition(): THREE.Vector3 {
    return this.hookWorld
  }

  get isAligned(): boolean {
    if (!this.placement) return false
    const du = Math.abs(this.u - 1)
    const sym = this.placement.yawSymmetryDeg * DEG
    const ye = Math.abs(this.reducedYawError(sym))
    return du <= this.placement.uTol && ye <= this.placement.yawTolDeg * DEG
  }

  /** 支援込みの許容範囲。少しずれていてもタグラインで整えて着座させる。 */
  get isWithinAssist(): boolean {
    if (!this.placement) return false
    const du = Math.abs(this.u - 1)
    const sym = this.placement.yawSymmetryDeg * DEG
    const ye = Math.abs(this.reducedYawError(sym))
    return du <= this.placement.uTol * 2.6 && ye <= this.placement.yawTolDeg * DEG * 2.4
  }

  private reducedYawError(sym: number): number {
    let e = this.yawErr % sym
    if (e > sym / 2) e -= sym
    if (e < -sym / 2) e += sym
    return e
  }

  /** 現在の部材原点 Y（フック高さから逆算） */
  private originY(): number {
    if (!this.placement) return 0
    return this.hookY - this.placement.hookOffset.y
  }

  /** 画面右スワイプがどちらの旋回になるかを判定するための接線 */
  pathTangentWorld(out: THREE.Vector3): THREE.Vector3 {
    const eps = 0.01
    const a = this.pathPoint(clamp(this.u - eps, 0, 1))
    const b = this.pathPoint(clamp(this.u + eps, 0, 1))
    return out.set(b.x - a.x, 0, b.z - a.z).normalize()
  }

  private pathPoint(u: number): { x: number; z: number; theta: number; radius: number } {
    const theta = lerp(this.pick.theta, this.place.theta, u)
    const radius = lerp(this.pick.radius, this.place.radius, u)
    return {
      x: SITE.crane.x + Math.cos(theta) * radius,
      z: SITE.crane.z + Math.sin(theta) * radius,
      theta,
      radius,
    }
  }

  /** 経路の総旋回角（rad）。旋回速度を一定にするために使う。 */
  private get sweep(): number {
    return Math.max(0.12, Math.abs(this.place.theta - this.pick.theta))
  }

  update(dt: number, input: CraneInput, hasInput: boolean): void {
    const s = this.speedScale
    switch (this.phase) {
      case 'rigging': {
        this.phaseT += dt
        this.slackFactor = Math.max(0, 1 - this.phaseT / (0.9 / s))
        if (this.phaseT >= 0.9 / s) {
          this.phase = 'takeLoad'
          this.phaseT = 0
        }
        break
      }
      case 'takeLoad': {
        const dur = 1.5 / s
        this.phaseT += dt
        const t = clamp(this.phaseT / dur, 0, 1)
        const e = t * t * (3 - 2 * t)
        this.slackFactor = 0
        // 荷重を受けてから起こす：位置と姿勢を同時に補間する
        const start = this.placement!.layDown.y + this.placement!.hookOffset.y
        this.hookY = lerp(start, start + 0.4, e)
        if (t >= 1) {
          this.phase = 'manual'
          this.phaseT = 0
        }
        break
      }
      case 'manual': {
        this.caution = damp(this.caution, this.dangerScale(), 6, dt)
        const hoistRate = 0.62 * s * this.caution
        const yawRate = 62 * DEG * s
        const slewRate = ((14 * DEG) / this.sweep) * s * this.caution
        this.hookY += input.hoist * hoistRate * dt
        this.yawErr += input.yaw * yawRate * dt
        // 旋回は「経路の途中で必要な高さ」まで上がっていないと通さない。
        // 危険な入力で既設部材へぶつけず、動作を安全側へ戻す。
        const wantU = clamp(this.u + input.slew * slewRate * dt, 0, 1)
        this.u = this.limitU(wantU)
        this.needsHoist = wantU !== this.u
        const minHook = this.minOriginAt(this.u) + this.placement!.hookOffset.y
        const tipCeiling = this.tipLocal(clamp(this.radius, SITE.crane.minRadius, SITE.crane.maxRadius)).y - 0.75
        this.hookY = clamp(this.hookY, minHook, Math.min(SITE.hookMaxY, tipCeiling))
        // 接近位置まで降ろしたのに向きが合っていないときは、作業員がタグラインで
        // ゆっくり姿勢を整える。押しっぱなしでも工程が止まらないようにする。
        this.tagCorrecting = false
        if (!this.isWithinAssist && input.hoist < 0 && this.originY() <= this.clearanceY + 0.05) {
          const sym = this.placement!.yawSymmetryDeg * DEG
          const ye = this.reducedYawError(sym)
          if (Math.abs(ye) > 1e-3) {
            this.yawErr -= Math.sign(ye) * Math.min(Math.abs(ye), 14 * DEG * s * dt)
          }
          const du = 1 - this.u
          if (Math.abs(du) > 1e-3) this.u += Math.sign(du) * Math.min(Math.abs(du), 0.09 * s * dt)
          this.tagCorrecting = true
        }
        if (this.isWithinAssist && this.originY() <= this.clearanceY + 0.06 && input.hoist <= 0) {
          this.phase = 'settle'
          this.phaseT = 0
          this.settleFrom = {
            u: this.u,
            hookY: this.hookY,
            yaw: this.yawErr,
          }
        }
        if (!hasInput) this.idleT += dt
        else this.idleT = 0
        break
      }
      case 'settle': {
        const dur = 1.5 / s
        this.phaseT += dt
        const t = clamp(this.phaseT / dur, 0, 1)
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const sym = this.placement!.yawSymmetryDeg * DEG
        const targetYaw = this.yawErr - this.reducedYawError(sym)
        this.u = lerp(this.settleFrom.u, 1, e)
        this.yawErr = lerp(this.settleFrom.yaw, targetYaw, e)
        this.hookY = lerp(this.settleFrom.hookY, this.placement!.seatHookY, e)
        this.slackFactor = t > 0.86 ? (t - 0.86) / 0.14 : 0
        if (t >= 1) {
          this.phase = 'landed'
          this.phaseT = 0
          this.swingVel.multiplyScalar(0.25)
        }
        break
      }
      case 'landed': {
        this.phaseT += dt
        this.slackFactor = Math.min(1, this.slackFactor + dt * 1.6)
        if (this.phaseT > 0.75 / s && this.landedCb) {
          const cb = this.landedCb
          this.landedCb = null
          cb()
        }
        break
      }
      default:
        break
    }

    // 経路上の位置。作業していないときはフックを上げて待機姿勢へ戻す。
    if (this.phase === 'idle') {
      const rest = toPolar(0.4, 0.4)
      this.theta = damp(this.theta, rest.theta, 1.1, dt)
      this.radius = damp(this.radius, rest.radius, 1.1, dt)
      this.hookY = damp(this.hookY, 5.0, 1.1, dt)
    } else {
      const p = this.pathPoint(this.u)
      this.theta = p.theta
      this.radius = p.radius
    }

    // 二次運動（吊荷のわずかな遅れと慣性。接地後は収束させる）
    this.prevHookWorld.copy(this.hookWorld)
    this.applyKinematics()
    if (dt > 0) this.hookVel.subVectors(this.hookWorld, this.prevHookWorld).divideScalar(dt)
    if (this.secondary && this.phase !== 'idle') {
      const stiff = 16
      const dampC = this.phase === 'landed' || this.phase === 'settle' ? 7.5 : 3.2
      const drive = 0.06
      this.swingVel.x += (-stiff * this.swing.x - dampC * this.swingVel.x - this.hookVel.x * drive * stiff) * dt
      this.swingVel.z += (-stiff * this.swing.z - dampC * this.swingVel.z - this.hookVel.z * drive * stiff) * dt
      this.swing.x = clamp(this.swing.x + this.swingVel.x * dt, -0.16, 0.16)
      this.swing.z = clamp(this.swing.z + this.swingVel.z * dt, -0.16, 0.16)
      if (this.phase === 'landed') {
        this.swing.multiplyScalar(Math.max(0, 1 - dt * 4))
      }
    } else {
      this.swing.set(0, 0, 0)
    }
    this.applyKinematics()
    this.updateLoad(dt)
  }

  /** 高さ不足で旋回が止められている（レバーで上げるよう促す） */
  needsHoist = false
  /** 作業員がタグラインで姿勢を整えている最中 */
  tagCorrecting = false

  /** 経路上の位置 u で保つべき部材原点の高さ */
  private minOriginAt(u: number): number {
    const pl = this.placement!
    const low = pl.layDown.y
    const near = this.isWithinAssist ? pl.seat.y : pl.approachClearance
    if (u <= U_SAFE_LOW) return low
    if (u >= U_SAFE_HIGH) return near
    const ramp = 0.1
    if (u < U_SAFE_LOW + ramp) {
      const t = (u - U_SAFE_LOW) / ramp
      return low + (pl.travelClearance - low) * t
    }
    if (u > U_SAFE_HIGH - ramp) {
      const t = (U_SAFE_HIGH - u) / ramp
      return near + (pl.travelClearance - near) * t
    }
    return pl.travelClearance
  }

  /** 高さが足りないときは、安全な区間の端で止める */
  private limitU(wantU: number): number {
    const originY = this.originY()
    if (this.minOriginAt(wantU) <= originY + 1e-3) return wantU
    let lo = Math.min(this.u, wantU)
    let hi = Math.max(this.u, wantU)
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (this.minOriginAt(mid) <= originY + 1e-3) lo = mid
      else hi = mid
    }
    return wantU > this.u ? Math.max(this.u, lo) : Math.min(this.u, lo)
  }

  private settleFrom = { u: 0, hookY: 0, yaw: 0 }
  private idleT = 0
  /** 何も操作されない時間。子どもが迷ったときの補助に使う。 */
  get idleTime(): number {
    return this.idleT
  }

  resetIdle() {
    this.idleT = 0
  }

  /** 危険側（作業員や柵に寄る、下げ過ぎ）では動作を遅くする */
  private dangerScale(): number {
    const originY = this.originY()
    const nearGround = clamp((originY - this.clearanceY) / 0.5, 0, 1)
    const nearTarget = clamp(Math.abs(this.u - 1) / 0.18, 0, 1)
    return 0.42 + 0.58 * Math.max(nearGround * 0.6 + 0.4, nearTarget * 0.5 + 0.5) * 1.0
  }

  private updateLoad(dt: number) {
    const load = this.load
    const pl = this.placement
    if (!load || !pl) return

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pl.seat.pitchDeg * DEG, pl.seat.yawDeg * DEG + this.yawErr, 0, 'YXZ'),
    )

    if (this.phase === 'rigging') {
      load.position.copy(this.startPos)
      load.quaternion.copy(this.startQuat)
    } else if (this.phase === 'takeLoad') {
      const t = clamp(this.phaseT / (1.5 / this.speedScale), 0, 1)
      const e = t * t * (3 - 2 * t)
      const hookOffset = pl.hookOffset
      const target = new THREE.Vector3(hookOffset.x, hookOffset.y, hookOffset.z).applyQuaternion(quat)
      const carried = this.hookWorld.clone().sub(target)
      load.position.lerpVectors(this.startPos, carried, e)
      load.quaternion.slerpQuaternions(this.startQuat, quat, e)
    } else {
      const hookOffset = new THREE.Vector3(pl.hookOffset.x, pl.hookOffset.y, pl.hookOffset.z).applyQuaternion(quat)
      load.position.copy(this.hookWorld).sub(hookOffset)
      load.quaternion.copy(quat)
      // 吊荷のわずかな傾き（スリング張力方向に沿う）
      if (this.secondary && this.phase !== 'landed') {
        const tilt = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(clamp(this.swing.z, -0.1, 0.1) * 0.35, 0, clamp(-this.swing.x, -0.1, 0.1) * 0.35),
        )
        load.quaternion.premultiply(tilt)
      }
    }
    load.updateMatrixWorld()

    // スリング・天秤・介錯ロープ
    const hookAnchor = this.hookWorld.clone()
    hookAnchor.y -= 0.5
    const g0 = this.group.position
    const localHook = hookAnchor.clone().sub(g0)
    let attachA = hookAnchor.clone()
    let attachB = hookAnchor.clone()
    if (pl.spreader) {
      this.spreader.position.copy(localHook)
      this.spreader.rotation.y = -(pl.seat.yawDeg * DEG + this.yawErr)
      const ex = new THREE.Vector3(1.05, -0.78, 0).applyEuler(new THREE.Euler(0, this.spreader.rotation.y, 0))
      attachA = hookAnchor.clone().add(ex)
      attachB = hookAnchor.clone().sub(ex)
      this.spreaderStraps[0].update(hookAnchor.clone().sub(g0), attachA.clone().sub(g0), this.slackFactor * 0.25)
      this.spreaderStraps[1].update(hookAnchor.clone().sub(g0), attachB.clone().sub(g0), this.slackFactor * 0.25)
    }

    const pts = pl.slingPoints
    for (let i = 0; i < this.slings.length; i++) {
      const r = this.slings[i]
      if (i >= pts.length) continue
      const local = new THREE.Vector3(pts[i].x, pts[i].y, pts[i].z)
      const world = local.clone().applyMatrix4(load.matrixWorld)
      const top = pl.spreader ? (pts[i].z > -1.5 ? attachA : attachB) : hookAnchor
      r.update(top.clone().sub(g0), world.sub(g0), this.slackFactor * 0.55)
    }

    // 介錯ロープ：吊荷の低い側から地上へ。作業員は部材の短辺方向へ離れて立つ。
    const tagLocal = new THREE.Vector3(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z)
    const tagWorld = tagLocal.applyMatrix4(load.matrixWorld)
    this.tagHandPoint.copy(tagWorld)
    this.tagHandPoint.y = 0.95
    // 部材のローカル X 方向（短辺）へ回り込む。カメラ側には立たせない。
    const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(load.quaternion).setY(0).normalize()
    const awayFromView = new THREE.Vector3(tagWorld.x - this.viewPoint.x, 0, tagWorld.z - this.viewPoint.z)
    if (lateral.dot(awayFromView) < 0) lateral.negate()
    this.tagHandPoint.addScaledVector(lateral, 2.3)
    this.tagHandPoint.x = clamp(this.tagHandPoint.x, SITE.fence.minX + 0.6, SITE.fence.maxX - 0.6)
    this.tagHandPoint.z = clamp(this.tagHandPoint.z, SITE.fence.minZ + 0.6, SITE.fence.maxZ - 0.6)
    const taut = this.phase === 'settle' ? 0.06 : 0.34
    this.tagLine.update(tagWorld.clone().sub(g0), this.tagHandPoint.clone().sub(g0), taut)
    void dt
  }

  readonly tagHandPoint = new THREE.Vector3(2, 1, 2)
  /** カメラ位置。作業員を手前に立たせないために使う。 */
  readonly viewPoint = new THREE.Vector3(0, 2, -8)

  /** 自動補助：迷っている時にゆっくり正解方向へ寄せる */
  autoAssistInput(): CraneInput {
    const target = 1
    const du = target - this.u
    const sym = this.placement ? this.placement.yawSymmetryDeg * DEG : Math.PI * 2
    const ye = this.reducedYawError(sym)
    const wantHigh = this.placement ? this.placement.travelHookY : this.hookY
    const atTravel = this.hookY >= wantHigh - 0.06
    let hoist = 0
    if (Math.abs(du) > (this.placement?.uTol ?? 0.05)) hoist = atTravel ? 0 : 1
    else hoist = -1
    return {
      hoist: hoist * 0.85,
      slew: Math.abs(du) > 0.004 && atTravel ? Math.sign(du) * 0.7 : 0,
      yaw: Math.abs(ye) > 0.02 ? -Math.sign(ye) * 0.6 : 0,
    }
  }
}
