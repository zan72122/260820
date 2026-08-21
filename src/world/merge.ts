import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Collects static geometry per material and emits one merged mesh for each.
 * The park is built from many small parts, so this keeps the draw-call count
 * flat regardless of how much detail the structure carries.
 */
export class MeshMerger {
  private readonly buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  private readonly flags = new Map<THREE.Material, { cast: boolean; receive: boolean }>()

  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrix: THREE.Matrix4,
    opts: { cast?: boolean; receive?: boolean } = {},
  ): void {
    const g = geometry.clone()
    g.applyMatrix4(matrix)
    if (g.attributes.uv2) g.deleteAttribute('uv2')
    const list = this.buckets.get(material)
    if (list) list.push(g)
    else this.buckets.set(material, [g])
    const f = this.flags.get(material) ?? { cast: false, receive: false }
    f.cast = f.cast || (opts.cast ?? false)
    f.receive = f.receive || (opts.receive ?? false)
    this.flags.set(material, f)
  }

  /** Convenience for a part positioned by translation and Euler rotation. */
  addAt(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    opts: { cast?: boolean; receive?: boolean } = {},
  ): void {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    )
    this.add(geometry, material, m, opts)
  }

  build(target: THREE.Object3D, name = 'merged'): void {
    for (const [material, list] of this.buckets) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, material)
      const f = this.flags.get(material)
      mesh.castShadow = f?.cast ?? false
      mesh.receiveShadow = f?.receive ?? false
      mesh.name = name
      target.add(mesh)
      if (list.length > 1) for (const g of list) g.dispose()
    }
    this.buckets.clear()
    this.flags.clear()
  }
}
