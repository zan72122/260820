import * as THREE from 'three'
import { mulberry32 } from '../core/rng'
import { FAST } from '../core/flags'

const G = 981

/**
 * A handful of sponge crumbs kicked loose by the knife. Purely cosmetic, capped
 * at a couple of dozen pieces, and fully asleep the moment they settle.
 */
export class Crumbs {
  readonly mesh: THREE.InstancedMesh
  private n: number
  private p: Float32Array
  private v: Float32Array
  private life: Float32Array
  private q: THREE.Quaternion[] = []
  private m4 = new THREE.Matrix4()
  private tmp = new THREE.Vector3()
  private scale = new THREE.Vector3()
  private active = 0

  constructor(color = 0xe7cf9d, count = FAST ? 8 : 26) {
    this.n = count
    const geo = new THREE.DodecahedronGeometry(0.19, 0)
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.p = new Float32Array(count * 3)
    this.v = new Float32Array(count * 3)
    this.life = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.q.push(new THREE.Quaternion())
      this.hide(i)
    }
  }

  private hide(i: number) {
    this.m4.makeScale(0, 0, 0)
    this.mesh.setMatrixAt(i, this.m4)
  }

  burst(x: number, y: number, z: number, amount = 8, seed = 1) {
    const rng = mulberry32(seed)
    for (let k = 0; k < amount; k++) {
      const i = this.active % this.n
      this.active++
      this.p[i * 3] = x + (rng() - 0.5) * 1.2
      this.p[i * 3 + 1] = y + rng() * 0.6
      this.p[i * 3 + 2] = z + (rng() - 0.5) * 1.2
      this.v[i * 3] = (rng() - 0.5) * 34
      this.v[i * 3 + 1] = 20 + rng() * 46
      this.v[i * 3 + 2] = (rng() - 0.5) * 34
      this.life[i] = 2.6 + rng()
      this.q[i].setFromEuler(new THREE.Euler(rng() * 6, rng() * 6, rng() * 6))
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  update(dt: number, floorY: number) {
    let any = false
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue
      any = true
      this.life[i] -= dt
      this.v[i * 3 + 1] -= G * dt
      this.p[i * 3] += this.v[i * 3] * dt
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt
      if (this.p[i * 3 + 1] < floorY + 0.19) {
        this.p[i * 3 + 1] = floorY + 0.19
        this.v[i * 3 + 1] *= -0.25
        this.v[i * 3] *= 0.6
        this.v[i * 3 + 2] *= 0.6
      }
      const s = Math.min(1, this.life[i])
      this.tmp.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2])
      this.m4.compose(this.tmp, this.q[i], this.scale.set(s, s, s))
      this.mesh.setMatrixAt(i, this.m4)
      if (this.life[i] <= 0) this.hide(i)
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true
  }

  reset() {
    for (let i = 0; i < this.n; i++) {
      this.life[i] = 0
      this.hide(i)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
