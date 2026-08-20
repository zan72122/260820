import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  Vector3,
  type Material,
} from 'three'

const UP = new Vector3(0, 1, 0)
const SIDE = new Vector3(1, 0, 0)

/**
 * A tube whose centreline can change every frame: used for the peduncle, which
 * has to follow the fruit as it sways and thin out as the fruit ripens.
 */
export class DynamicTube {
  readonly mesh: Mesh
  private readonly geo: BufferGeometry
  private readonly pos: Float32Array
  private readonly nrm: Float32Array
  private readonly rings: number
  private readonly sides: number
  private readonly tmp = {
    dir: new Vector3(),
    u: new Vector3(),
    v: new Vector3(),
    ref: new Vector3(),
  }

  constructor(rings: number, sides: number, material: Material) {
    this.rings = rings
    this.sides = sides
    const vcount = rings * sides
    this.pos = new Float32Array(vcount * 3)
    this.nrm = new Float32Array(vcount * 3)
    const uv = new Float32Array(vcount * 2)
    const index: number[] = []
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < sides; k++) {
        uv[(r * sides + k) * 2] = k / sides
        uv[(r * sides + k) * 2 + 1] = r / (rings - 1)
        if (r + 1 < rings) {
          const k2 = (k + 1) % sides
          const a = r * sides + k
          const b = r * sides + k2
          const c = (r + 1) * sides + k
          const d = (r + 1) * sides + k2
          index.push(a, c, d, a, d, b)
        }
      }
    }
    this.geo = new BufferGeometry()
    const pa = new BufferAttribute(this.pos, 3)
    pa.setUsage(DynamicDrawUsage)
    const na = new BufferAttribute(this.nrm, 3)
    na.setUsage(DynamicDrawUsage)
    this.geo.setAttribute('position', pa)
    this.geo.setAttribute('normal', na)
    this.geo.setAttribute('uv', new BufferAttribute(uv, 2))
    this.geo.setIndex(index)
    this.mesh = new Mesh(this.geo, material)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
  }

  /** Rebuild from a centreline; `radiusAt(t)` gives the radius per ring. */
  update(points: Vector3[], radiusAt: (t: number) => number): void {
    const { dir, u, v, ref } = this.tmp
    for (let r = 0; r < this.rings; r++) {
      const p = points[r]
      const a = points[Math.max(0, r - 1)]
      const b = points[Math.min(this.rings - 1, r + 1)]
      dir.subVectors(b, a)
      if (dir.lengthSq() < 1e-12) dir.set(0, -1, 0)
      dir.normalize()
      ref.copy(Math.abs(dir.y) > 0.92 ? SIDE : UP)
      u.crossVectors(dir, ref).normalize()
      v.crossVectors(dir, u)
      const rad = radiusAt(r / (this.rings - 1))
      for (let k = 0; k < this.sides; k++) {
        const ang = (k / this.sides) * Math.PI * 2
        const c = Math.cos(ang)
        const s = Math.sin(ang)
        const nx = u.x * c + v.x * s
        const ny = u.y * c + v.y * s
        const nz = u.z * c + v.z * s
        const o = (r * this.sides + k) * 3
        this.pos[o] = p.x + nx * rad
        this.pos[o + 1] = p.y + ny * rad
        this.pos[o + 2] = p.z + nz * rad
        this.nrm[o] = nx
        this.nrm[o + 1] = ny
        this.nrm[o + 2] = nz
      }
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.normal.needsUpdate = true
    this.geo.computeBoundingSphere()
  }

  dispose(): void {
    this.geo.dispose()
  }
}
