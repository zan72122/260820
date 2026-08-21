/** 試験ボールと子どもの滑走。滑走区間の形の違いが「滑り方」に出るようにする。 */
import * as THREE from 'three'
import { SITE, type ChuteVariant } from '../build/layout'
import { chuteSamples } from '../build/parts'
import { clamp } from '../core/rng'

export interface PathNode {
  pos: THREE.Vector3
  tangent: THREE.Vector3
  up: THREE.Vector3
  dist: number
  s: number
}

/** 取り付け済みの滑走面に沿った、世界座標の走行ライン */
export function buildSlidePath(variant: ChuteVariant, surfaceOffset = SITE.chuteThick): PathNode[] {
  const samples = chuteSamples(variant, 120)
  const nodes: PathNode[] = []
  let dist = 0
  for (let i = 0; i < samples.length; i++) {
    const smp = samples[i]
    const pos = new THREE.Vector3(
      SITE.chuteTop.x + smp.pos.x,
      SITE.chuteTop.y + smp.pos.y,
      SITE.chuteTop.z + smp.pos.z,
    ).addScaledVector(smp.up, surfaceOffset)
    if (i > 0) dist += pos.distanceTo(nodes[i - 1].pos)
    nodes.push({ pos, tangent: smp.tangent.clone(), up: smp.up.clone(), dist, s: smp.s })
  }
  return nodes
}

export function sampleAt(path: PathNode[], d: number): PathNode {
  const total = path[path.length - 1].dist
  if (d <= 0) return path[0]
  if (d >= total) return path[path.length - 1]
  let lo = 0
  let hi = path.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (path[mid].dist <= d) lo = mid
    else hi = mid
  }
  const a = path[lo]
  const b = path[hi]
  const t = (d - a.dist) / Math.max(1e-6, b.dist - a.dist)
  return {
    pos: a.pos.clone().lerp(b.pos, t),
    tangent: a.tangent.clone().lerp(b.tangent, t).normalize(),
    up: a.up.clone().lerp(b.up, t).normalize(),
    dist: d,
    s: a.s + (b.s - a.s) * t,
  }
}

export type RiderKind = 'ball' | 'child'

/** 動摩擦係数。ローラー区間は転がりなので明確に小さくする。 */
const FRICTION: Record<ChuteVariant, { ball: number; child: number }> = {
  straight: { ball: 0.10, child: 0.2 },
  wave: { ball: 0.10, child: 0.2 },
  roller: { ball: 0.035, child: 0.09 },
}

export class Rider {
  dist = 0
  speed = 0
  running = false
  finished = false
  /** 滑走面を出たあとの走り出し距離 */
  runOut = 0
  rattle = 0
  spin = 0

  constructor(
    private path: PathNode[],
    private variant: ChuteVariant,
    private kind: RiderKind,
  ) {}

  setPath(path: PathNode[], variant: ChuteVariant) {
    this.path = path
    this.variant = variant
  }

  start() {
    this.dist = 0.06
    this.speed = 0.35
    this.running = true
    this.finished = false
    this.runOut = 0
    this.spin = 0
  }

  reset() {
    this.dist = 0
    this.speed = 0
    this.running = false
    this.finished = false
    this.runOut = 0
    this.rattle = 0
    this.spin = 0
  }

  get total(): number {
    return this.path[this.path.length - 1].dist
  }

  update(dt: number): PathNode {
    const mu = FRICTION[this.variant][this.kind]
    if (this.running) {
      const node = sampleAt(this.path, this.dist)
      const g = 9.81
      const sinSlope = -node.tangent.y
      const cosSlope = Math.sqrt(Math.max(0, 1 - node.tangent.y * node.tangent.y))
      let a = g * sinSlope - mu * g * cosSlope * Math.sign(this.speed || 1)
      a -= 0.06 * this.speed * this.speed
      this.speed = Math.max(0, this.speed + a * dt)
      this.dist += this.speed * dt
      const onRollers = this.variant === 'roller' && node.s > 0.62
      this.rattle = onRollers ? Math.sin(this.dist * 92) * 0.0055 * clamp(this.speed, 0, 3) : this.rattle * 0.85
      this.spin += (this.speed / 0.085) * dt
      if (this.dist >= this.total) {
        this.dist = this.total
        this.runOut += this.speed * dt
        this.speed = Math.max(0, this.speed - (this.kind === 'ball' ? 1.6 : 4.2) * dt)
        if (this.speed < 0.05) {
          this.running = false
          this.finished = true
        }
      }
    }
    const node = sampleAt(this.path, this.dist)
    if (this.runOut > 0) {
      node.pos.addScaledVector(new THREE.Vector3(node.tangent.x, 0, node.tangent.z).normalize(), this.runOut)
      node.pos.y = SITE.exitPadTop + 0.12
    }
    node.pos.y += this.rattle
    return node
  }
}
