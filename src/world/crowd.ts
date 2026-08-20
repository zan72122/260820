import * as THREE from 'three'
import { box, merge } from './geom'
import { groundHeight, inCameraZone, wearAmount, L } from './layout'
import { clamp, makeRng, rand, type Rng } from '../core/util'

/**
 * 人。会場に「もう来ている人」と、
 * 通れるようになってから「渡り始める人」を出す。
 * 遠景のシルエットとして効けばよいので形は簡素に。
 */

const SKIN = ['#c8a084', '#b08868', '#d8b89a', '#8f6c50']
const CLOTH = [
  '#20283a', '#3a4152', '#6a2f34', '#2f4c46', '#5a5560',
  '#8a8474', '#b7b2a6', '#374a63', '#7a3a2e', '#25313f',
]

function standingGeo() {
  return merge([
    box(0.15, 0.82, 0.15, -0.11, 0.41, 0, 1.5),
    box(0.15, 0.82, 0.15, 0.11, 0.41, 0, 1.5),
    box(0.42, 0.58, 0.23, 0, 1.1, 0, 1.5),
    box(0.09, 0.5, 0.09, -0.26, 1.12, 0.01, 1.5),
    box(0.09, 0.5, 0.09, 0.26, 1.12, 0.01, 1.5),
    sphere(0.105, 0, 1.5, 0),
  ])
}

function sittingGeo() {
  return merge([
    box(0.34, 0.15, 0.46, 0, 0.11, 0.22, 1.5),
    box(0.15, 0.14, 0.42, -0.1, 0.08, 0.5, 1.5),
    box(0.15, 0.14, 0.42, 0.1, 0.08, 0.5, 1.5),
    box(0.4, 0.5, 0.22, 0, 0.44, 0, 1.5),
    box(0.08, 0.4, 0.08, -0.24, 0.46, 0.06, 1.5),
    box(0.08, 0.4, 0.08, 0.24, 0.46, 0.06, 1.5),
    sphere(0.1, 0, 0.79, 0),
  ])
}

function sphere(r: number, x: number, y: number, z: number) {
  const g = new THREE.SphereGeometry(r, 7, 5)
  g.translate(x, y, z)
  return g
}

function personMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0, color: 0xffffff })
}

function tint(rng: Rng) {
  const c = new THREE.Color(CLOTH[Math.floor(rng() * CLOTH.length) % CLOTH.length])
  c.offsetHSL(0, rand(rng, -0.05, 0.05), rand(rng, -0.06, 0.06))
  return c
}

export class Crowd {
  readonly group = new THREE.Group()
  private walkers: THREE.InstancedMesh
  private walkerState: {
    t: number
    speed: number
    lane: number
    phase: number
    route: 'bridge' | 'path'
    active: number
  }[] = []
  private bridgeWalk: (t: number) => THREE.Vector3
  private clock = 0
  private matrix = new THREE.Matrix4()
  private quat = new THREE.Quaternion()
  private scaleV = new THREE.Vector3(1, 1, 1)
  private posV = new THREE.Vector3()

  constructor(quality: number, bridgeWalk: (t: number) => THREE.Vector3) {
    this.group.name = 'crowd'
    this.bridgeWalk = bridgeWalk
    const rng = makeRng(555111)

    // すでに座っている人たち
    const seatedCount = quality > 0.6 ? 90 : 50
    const seated = new THREE.InstancedMesh(sittingGeo(), personMaterial(), seatedCount)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    let placed = 0
    let guard = 0
    while (placed < seatedCount && guard < seatedCount * 20) {
      guard++
      const x = rand(rng, -110, 215)
      const z = rand(rng, 124, 150)
      if (wearAmount(x, z) > 0.75) continue
      if (inCameraZone(x, z)) continue
      const y = groundHeight(x, z)
      // だいたい川（-Z 方向）を向いて座っている
      q.setFromEuler(new THREE.Euler(0, Math.PI + rand(rng, -0.7, 0.7), 0))
      s.setScalar(rand(rng, 0.9, 1.08))
      m.compose(new THREE.Vector3(x, y, z), q, s)
      seated.setMatrixAt(placed, m)
      seated.setColorAt(placed, tint(rng))
      placed++
    }
    seated.count = placed
    seated.castShadow = true
    seated.instanceMatrix.needsUpdate = true
    if (seated.instanceColor) seated.instanceColor.needsUpdate = true
    this.group.add(seated)

    // 立っている人（係員・見に来た人）
    const standCount = quality > 0.6 ? 40 : 24
    const standing = new THREE.InstancedMesh(standingGeo(), personMaterial(), standCount)
    let stood = 0
    for (let i = 0, tries = 0; stood < standCount && tries < standCount * 30; tries++) {
      const nearHq = stood < 4
      const x = nearHq ? L.hq.x + rand(rng, -5.5, -2.5) : rand(rng, -130, 235)
      const z = nearHq ? L.hq.z + rand(rng, -4, 3) : rand(rng, 126, 205)
      if (!nearHq && inCameraZone(x, z)) continue
      i = stood
      const y = groundHeight(x, z)
      q.setFromEuler(new THREE.Euler(0, rng() * 6.283, 0))
      s.setScalar(rand(rng, 0.94, 1.06))
      m.compose(new THREE.Vector3(x, y, z), q, s)
      standing.setMatrixAt(i, m)
      standing.setColorAt(i, nearHq ? new THREE.Color('#c8c2b2') : tint(rng))
      stood++
    }
    standing.count = stood
    standing.castShadow = true
    standing.instanceMatrix.needsUpdate = true
    if (standing.instanceColor) standing.instanceColor.needsUpdate = true
    this.group.add(standing)

    // 歩く人（最初は画面外に置いておき、解禁されたら動き出す）
    const walkCount = quality > 0.6 ? 26 : 16
    this.walkers = new THREE.InstancedMesh(standingGeo(), personMaterial(), walkCount)
    for (let i = 0; i < walkCount; i++) {
      const route: 'bridge' | 'path' = i < walkCount * 0.55 ? 'bridge' : 'path'
      this.walkerState.push({
        t: rng(),
        speed: rand(rng, 0.016, 0.028) * (route === 'bridge' ? 1 : 1.6),
        lane: rand(rng, -1, 1),
        phase: rng() * 6.283,
        route,
        active: 0,
      })
      this.walkers.setColorAt(i, tint(rng))
    }
    this.walkers.castShadow = true
    if (this.walkers.instanceColor) this.walkers.instanceColor.needsUpdate = true
    this.group.add(this.walkers)
    void SKIN
  }

  /** 橋が通れるようになった。 */
  releaseBridge() {
    for (const w of this.walkerState) if (w.route === 'bridge') w.active = 1
  }
  /** 橋をまた通行止めに戻す（もう一度あそぶとき）。 */
  holdBridge() {
    for (const w of this.walkerState) if (w.route === 'bridge') w.active = 0
  }

  /** 遊歩道に人が増えていく。 */
  releasePath(amount: number) {
    let i = 0
    const paths = this.walkerState.filter((w) => w.route === 'path')
    for (const w of paths) {
      w.active = i / paths.length < amount ? 1 : 0
      i++
    }
  }

  update(dt: number) {
    this.clock += dt
    for (let i = 0; i < this.walkerState.length; i++) {
      const w = this.walkerState[i]
      if (w.active <= 0) {
        this.matrix.makeScale(0.0001, 0.0001, 0.0001)
        this.matrix.setPosition(0, -500, 0)
        this.walkers.setMatrixAt(i, this.matrix)
        continue
      }
      w.t += w.speed * dt
      if (w.t > 1) w.t -= 1

      let heading = 0
      if (w.route === 'bridge') {
        const p = this.bridgeWalk(w.t)
        const p2 = this.bridgeWalk(clamp(w.t + 0.004, 0, 1))
        this.posV.set(p.x + w.lane * 4.3, p.y, p.z)
        heading = Math.atan2(p2.x - p.x, p2.z - p.z)
      } else {
        const x = L.path.xMin + (L.path.xMax - L.path.xMin) * w.t
        const z = L.path.z + Math.sin(x * 0.017) * 3.4 + Math.sin(x * 0.041 + 1.7) * 1.5 + w.lane * 1.2
        this.posV.set(x, groundHeight(x, z), z)
        heading = Math.PI / 2
      }
      const bob = Math.abs(Math.sin(this.clock * 4.4 + w.phase)) * 0.035
      this.posV.y += bob
      this.quat.setFromEuler(new THREE.Euler(0, heading, Math.sin(this.clock * 4.4 + w.phase) * 0.04))
      this.scaleV.setScalar(1)
      this.matrix.compose(this.posV, this.quat, this.scaleV)
      this.walkers.setMatrixAt(i, this.matrix)
    }
    this.walkers.instanceMatrix.needsUpdate = true
  }
}
