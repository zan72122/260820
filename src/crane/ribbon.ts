/** 繊維スリング／介錯ロープ用の帯メッシュ。緩むと自重で垂れ、張ると直線になる。 */
import * as THREE from 'three'

export class Ribbon {
  readonly mesh: THREE.Mesh
  private readonly segs: number
  private readonly positions: THREE.Float32BufferAttribute
  private readonly half: number

  constructor(material: THREE.Material, width: number, segs = 10) {
    this.segs = segs
    this.half = width / 2
    const geo = new THREE.BufferGeometry()
    const count = (segs + 1) * 2
    this.positions = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3)
    this.positions.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', this.positions)
    const uvs: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= segs; i++) {
      uvs.push(0, i / segs, 1, i / segs)
      if (i < segs) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(idx)
    const normals = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3)
    geo.setAttribute('normal', normals)
    this.mesh = new THREE.Mesh(geo, material)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
  }

  /** slack: 0 で張力方向に直線、1 に近いほど垂れる */
  update(a: THREE.Vector3, b: THREE.Vector3, slack: number) {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-5) return
    dir.divideScalar(len)
    let side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0))
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0)
    side.normalize().multiplyScalar(this.half)
    const arr = this.positions.array as Float32Array
    const sag = Math.max(0, slack) * len * 0.5
    const p = new THREE.Vector3()
    const nrm = this.mesh.geometry.getAttribute('normal').array as Float32Array
    const n = new THREE.Vector3().crossVectors(side, dir).normalize()
    for (let i = 0; i <= this.segs; i++) {
      const t = i / this.segs
      p.copy(a).addScaledVector(dir, len * t)
      p.y -= sag * Math.sin(Math.PI * t)
      const o = i * 6
      arr[o] = p.x - side.x
      arr[o + 1] = p.y - side.y
      arr[o + 2] = p.z - side.z
      arr[o + 3] = p.x + side.x
      arr[o + 4] = p.y + side.y
      arr[o + 5] = p.z + side.z
      nrm[o] = nrm[o + 3] = n.x
      nrm[o + 1] = nrm[o + 4] = n.y
      nrm[o + 2] = nrm[o + 5] = n.z
    }
    this.positions.needsUpdate = true
    this.mesh.geometry.getAttribute('normal').needsUpdate = true
  }

  set visible(v: boolean) {
    this.mesh.visible = v
  }
}
