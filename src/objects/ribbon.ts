import * as THREE from 'three'
import type { Flavor } from '../core/flavors'

/**
 * The thick ribbon of batter falling from the bowl into the pan.
 * Viscous, continuous, and it wobbles — it never reads as water.
 */
export class Ribbon {
  readonly mesh: THREE.Mesh
  private base: Float32Array
  private material: THREE.MeshStandardMaterial
  private from = new THREE.Vector3()
  private to = new THREE.Vector3()
  private ctrl = new THREE.Vector3()
  private right = new THREE.Vector3()
  private fwd = new THREE.Vector3()
  private tmp = new THREE.Vector3()

  constructor(flavor: Flavor) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 26, true)
    this.base = Float32Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)
    this.material = new THREE.MeshStandardMaterial({
      color: flavor.batter,
      roughness: 0.28,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.castShadow = false
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    this.mesh.name = 'batter-ribbon'
  }

  setFlavor(f: Flavor) {
    this.material.color.setHex(f.batter)
  }

  set visible(v: boolean) {
    this.mesh.visible = v
  }
  get visible() {
    return this.mesh.visible
  }

  /** Rebuild the falling strand between two world points. */
  update(from: THREE.Vector3, to: THREE.Vector3, thickness: number, time: number) {
    this.from.copy(from)
    this.to.copy(to)
    this.ctrl.copy(from).lerp(to, 0.45)
    this.ctrl.y = from.y - (from.y - to.y) * 0.18
    this.fwd.set(0, 0, 1)
    this.right.subVectors(to, from).normalize().cross(this.fwd).normalize()
    if (!isFinite(this.right.x)) this.right.set(1, 0, 0)
    this.fwd.crossVectors(this.right, this.tmp.subVectors(to, from).normalize()).normalize()

    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < arr.length; i += 3) {
      const t = this.base[i + 1] + 0.5
      const ang = Math.atan2(this.base[i + 2], this.base[i])
      const taper = (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (1 - t * 0.28)
      const wob = 1 + 0.14 * Math.sin(ang * 3 + t * 9 - time * 7) + 0.07 * Math.sin(t * 21 - time * 11)
      const r = thickness * taper * wob
      const mt = 1 - t
      const cx =
        mt * mt * this.from.x + 2 * mt * t * this.ctrl.x + t * t * this.to.x
      const cy = mt * mt * this.from.y + 2 * mt * t * this.ctrl.y + t * t * this.to.y
      const cz = mt * mt * this.from.z + 2 * mt * t * this.ctrl.z + t * t * this.to.z
      arr[i] = cx + this.right.x * Math.cos(ang) * r + this.fwd.x * Math.sin(ang) * r
      arr[i + 1] = cy + this.right.y * Math.cos(ang) * r + this.fwd.y * Math.sin(ang) * r
      arr[i + 2] = cz + this.right.z * Math.cos(ang) * r + this.fwd.z * Math.sin(ang) * r
    }
    attr.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}
