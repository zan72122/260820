import * as THREE from 'three'
import { MeshBuilder, put } from './geom'
import { clamp } from './rng'
import { terrainY } from './terrain'

/* ------------------------------------------------------------------ *
 * Loose material: the grain pouring out of the spout, the straw thrown
 * out of the back, and the chaff dust the machine kicks up.
 * Every system is a single InstancedMesh with a swap-remove free list.
 * ------------------------------------------------------------------ */

const GRAV = -9.81

class Pool {
  n = 0
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  life: Float32Array
  age: Float32Array
  seed: Float32Array

  constructor(readonly cap: number) {
    this.px = new Float32Array(cap)
    this.py = new Float32Array(cap)
    this.pz = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.vz = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.age = new Float32Array(cap)
    this.seed = new Float32Array(cap)
  }

  spawn(): number {
    if (this.n >= this.cap) return -1
    return this.n++
  }

  kill(i: number) {
    const last = --this.n
    if (i !== last) {
      this.px[i] = this.px[last]
      this.py[i] = this.py[last]
      this.pz[i] = this.pz[last]
      this.vx[i] = this.vx[last]
      this.vy[i] = this.vy[last]
      this.vz[i] = this.vz[last]
      this.life[i] = this.life[last]
      this.age[i] = this.age[last]
      this.seed[i] = this.seed[last]
    }
  }
}

/* --------------------------- grain -------------------------------- */

export class GrainStream {
  readonly mesh: THREE.InstancedMesh
  private pool: Pool
  private emitCarry = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3()
  /** landings since the last read — drives the pile growing in the trailer */
  landed = 0

  constructor(cap: number) {
    const g = new THREE.IcosahedronGeometry(1, 0)
    g.scale(0.017, 0.014, 0.032)
    const mat = new THREE.MeshLambertMaterial({ color: 0xe3c063 })
    this.mesh = new THREE.InstancedMesh(g, mat, cap)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.pool = new Pool(cap)
  }

  emit(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    perSecond: number,
    dt: number,
    spread = 0.5,
  ) {
    this.emitCarry += perSecond * dt
    const p = this.pool
    while (this.emitCarry >= 1) {
      this.emitCarry -= 1
      const i = p.spawn()
      if (i < 0) {
        this.emitCarry = 0
        break
      }
      p.px[i] = origin.x + (Math.random() - 0.5) * 0.12
      p.py[i] = origin.y - 0.08 - Math.random() * 0.06
      p.pz[i] = origin.z + (Math.random() - 0.5) * 0.12
      const sp = speed * (0.75 + Math.random() * 0.5)
      p.vx[i] = dir.x * sp + (Math.random() - 0.5) * spread
      p.vy[i] = dir.y * sp + (Math.random() - 0.5) * spread * 0.4
      p.vz[i] = dir.z * sp + (Math.random() - 0.5) * spread
      p.life[i] = 3
      p.age[i] = 0
      p.seed[i] = Math.random() * 100
    }
  }

  /** grains vanish when they reach `floorY`, or the terrain if that is higher */
  update(dt: number, floorY: number) {
    const p = this.pool
    this.landed = 0
    for (let i = 0; i < p.n; ) {
      p.age[i] += dt
      p.vy[i] += GRAV * dt
      p.px[i] += p.vx[i] * dt
      p.py[i] += p.vy[i] * dt
      p.pz[i] += p.vz[i] * dt
      const ground = Math.max(floorY, terrainY(p.px[i], p.pz[i]))
      if (p.py[i] <= ground || p.age[i] > p.life[i]) {
        this.landed++
        p.kill(i)
        continue
      }
      i++
    }
    this.s.setScalar(1)
    for (let i = 0; i < p.n; i++) {
      const t = p.age[i] * 12 + p.seed[i]
      this.e.set(t, t * 0.7, t * 1.3)
      this.q.setFromEuler(this.e)
      this.v.set(p.px[i], p.py[i], p.pz[i])
      this.m.compose(this.v, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.count = p.n
    this.mesh.instanceMatrix.needsUpdate = true
  }

  get active() {
    return this.pool.n
  }

  clear() {
    this.pool.n = 0
    this.mesh.count = 0
  }
}

/* -------------------------- pour column ---------------------------- */

/** The solid-looking body of the stream, so the pour reads as bulk, not confetti. */
export class PourColumn {
  readonly mesh: THREE.Mesh
  private tex: THREE.Texture

  constructor(grainTex: THREE.Texture) {
    this.tex = grainTex.clone()
    this.tex.needsUpdate = true
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping
    this.tex.repeat.set(1.4, 2.6)
    const g = new THREE.CylinderGeometry(0.09, 0.17, 1, 14, 1, true)
    g.translate(0, -0.5, 0)
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        map: this.tex,
        color: 0xf0d896,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.mesh.visible = false
    this.mesh.frustumCulled = false
  }

  /** Spans the spout down to the impact point. */
  set(from: THREE.Vector3, to: THREE.Vector3, strength: number, dt: number) {
    const on = strength > 0.02
    this.mesh.visible = on
    if (!on) return
    const len = Math.max(0.2, from.distanceTo(to))
    this.mesh.position.copy(from)
    const dir = to.clone().sub(from).normalize()
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    this.mesh.scale.set(clamp(strength, 0.2, 1), len, clamp(strength, 0.2, 1))
    this.tex.offset.y -= dt * 3.4
    const m = this.mesh.material as THREE.MeshStandardMaterial
    m.opacity = 0.9 * clamp(strength, 0, 1)
  }
}

/* --------------------------- straw --------------------------------- */

export class StrawSpray {
  readonly mesh: THREE.InstancedMesh
  private pool: Pool
  private landedY: Float32Array
  private carry = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3(1, 1, 1)

  constructor(cap: number) {
    const b = new MeshBuilder()
    const pale = new THREE.Color(0xd9c68d)
    const dark = new THREE.Color(0xb59f66)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI + 0.3
      put(
        b,
        new THREE.BoxGeometry(0.012, 0.012, 0.3),
        i % 2 ? pale : dark,
        [Math.cos(a) * 0.02, Math.sin(a) * 0.015, (i - 1.5) * 0.02],
        [0, (i - 1.5) * 0.12, 0],
      )
    }
    this.mesh = new THREE.InstancedMesh(
      b.build(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      cap,
    )
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.pool = new Pool(cap)
    this.landedY = new Float32Array(cap)
  }

  emit(origin: THREE.Vector3, back: THREE.Vector3, perSecond: number, dt: number) {
    this.carry += perSecond * dt
    const p = this.pool
    while (this.carry >= 1) {
      this.carry -= 1
      let i = p.spawn()
      if (i < 0) {
        // recycle the oldest wisp so the windrow keeps trailing behind
        p.kill(0)
        i = p.spawn()
        if (i < 0) break
      }
      p.px[i] = origin.x + (Math.random() - 0.5) * 1.1
      p.py[i] = origin.y + (Math.random() - 0.5) * 0.2
      p.pz[i] = origin.z + (Math.random() - 0.5) * 0.3
      const sp = 1.6 + Math.random() * 1.4
      p.vx[i] = back.x * sp + (Math.random() - 0.5) * 1.5
      p.vy[i] = 0.6 + Math.random() * 0.9
      p.vz[i] = back.z * sp + (Math.random() - 0.5) * 1.5
      p.life[i] = 1e9
      p.age[i] = 0
      p.seed[i] = Math.random() * 100
      this.landedY[i] = -1
    }
  }

  update(dt: number) {
    const p = this.pool
    for (let i = 0; i < p.n; i++) {
      p.age[i] += dt
      if (this.landedY[i] < 0) {
        p.vy[i] += GRAV * 0.55 * dt // straw is light, it flutters
        p.vx[i] *= 1 - 1.6 * dt
        p.vz[i] *= 1 - 1.6 * dt
        p.px[i] += p.vx[i] * dt
        p.py[i] += p.vy[i] * dt
        p.pz[i] += p.vz[i] * dt
        const g = terrainY(p.px[i], p.pz[i]) + 0.035
        if (p.py[i] <= g) {
          p.py[i] = g
          this.landedY[i] = g
        }
      }
      const t = p.age[i]
      if (this.landedY[i] < 0) this.e.set(t * 3.4 + p.seed[i], t * 1.7, t * 2.6)
      else this.e.set(Math.PI / 2, p.seed[i], 0)
      this.q.setFromEuler(this.e)
      this.v.set(p.px[i], p.py[i], p.pz[i])
      this.m.compose(this.v, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.count = p.n
    this.mesh.instanceMatrix.needsUpdate = true
  }

  clear() {
    this.pool.n = 0
    this.mesh.count = 0
  }
}

/* ---------------------------- dust --------------------------------- */

export class PuffField {
  readonly mesh: THREE.InstancedMesh
  private pool: Pool
  private alpha: THREE.InstancedBufferAttribute
  private size: Float32Array
  private carry = 0
  private m = new THREE.Matrix4()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3()

  constructor(cap: number, tex: THREE.Texture, color: number, private alphaScale = 0.55) {
    const g = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)
    alphaAttr.setUsage(THREE.DynamicDrawUsage)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = aAlpha;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace(
          '#include <opaque_fragment>',
          'diffuseColor.a *= vAlpha;\n#include <opaque_fragment>',
        )
    }
    mat.customProgramCacheKey = () => 'puff-alpha'
    this.mesh = new THREE.InstancedMesh(g, mat, cap)
    this.mesh.geometry.setAttribute('aAlpha', alphaAttr)
    this.alpha = alphaAttr
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.renderOrder = 5
    this.pool = new Pool(cap)
    this.size = new Float32Array(cap)
  }

  burst(x: number, y: number, z: number, n: number, size: number, vel = 0.5) {
    const p = this.pool
    for (let k = 0; k < n; k++) {
      const i = p.spawn()
      if (i < 0) return
      p.px[i] = x + (Math.random() - 0.5) * 0.3
      p.py[i] = y + (Math.random() - 0.5) * 0.2
      p.pz[i] = z + (Math.random() - 0.5) * 0.3
      p.vx[i] = (Math.random() - 0.5) * vel
      p.vy[i] = 0.25 + Math.random() * vel
      p.vz[i] = (Math.random() - 0.5) * vel
      p.life[i] = 0.8 + Math.random() * 0.8
      p.age[i] = 0
      this.size[i] = size * (0.7 + Math.random() * 0.7)
    }
  }

  stream(x: number, y: number, z: number, perSecond: number, dt: number, size: number, vel = 0.5) {
    this.carry += perSecond * dt
    while (this.carry >= 1) {
      this.carry -= 1
      this.burst(x, y, z, 1, size, vel)
    }
  }

  update(dt: number, camQuat: THREE.Quaternion) {
    const p = this.pool
    for (let i = 0; i < p.n; ) {
      p.age[i] += dt
      if (p.age[i] >= p.life[i]) {
        this.size[i] = this.size[p.n - 1]
        p.kill(i)
        continue
      }
      p.vy[i] += 0.35 * dt
      p.vx[i] *= 1 - 1.2 * dt
      p.vz[i] *= 1 - 1.2 * dt
      p.px[i] += p.vx[i] * dt
      p.py[i] += p.vy[i] * dt
      p.pz[i] += p.vz[i] * dt
      i++
    }
    for (let i = 0; i < p.n; i++) {
      const t = p.age[i] / p.life[i]
      const sc = this.size[i] * (0.45 + t * 1.5)
      this.v.set(p.px[i], p.py[i], p.pz[i])
      this.s.set(sc, sc, sc)
      this.m.compose(this.v, camQuat, this.s)
      this.mesh.setMatrixAt(i, this.m)
      this.alpha.array[i] = Math.sin(Math.min(1, t) * Math.PI) * this.alphaScale
    }
    this.mesh.count = p.n
    this.mesh.instanceMatrix.needsUpdate = true
    this.alpha.needsUpdate = true
  }

  clear() {
    this.pool.n = 0
    this.mesh.count = 0
  }
}
