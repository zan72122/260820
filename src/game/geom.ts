import * as THREE from 'three'

/** Accumulates raw triangles so several small parts can be merged into one buffer. */
export class MeshBuilder {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  idx: number[] = []

  private get vertexCount() {
    return this.pos.length / 3
  }

  /**
   * Sweeps a ring of `sides` vertices along a polyline.  Used for rice stems,
   * panicles, pipes, hydraulic rams, hand rails — anything tubular.
   */
  strand(
    pts: THREE.Vector3[],
    radii: number[],
    cols: THREE.Color[],
    sides = 3,
    twist = 0,
  ): void {
    const n = pts.length
    const base = this.vertexCount
    const t = new THREE.Vector3()
    const ref = new THREE.Vector3()
    const n1 = new THREE.Vector3()
    const n2 = new THREE.Vector3()
    const dir = new THREE.Vector3()

    for (let i = 0; i < n; i++) {
      if (i === 0) t.subVectors(pts[1], pts[0])
      else if (i === n - 1) t.subVectors(pts[n - 1], pts[n - 2])
      else t.subVectors(pts[i + 1], pts[i - 1])
      if (t.lengthSq() < 1e-12) t.set(0, 1, 0)
      t.normalize()
      ref.set(Math.abs(t.y) > 0.9 ? 1 : 0, Math.abs(t.y) > 0.9 ? 0 : 1, 0)
      n1.crossVectors(t, ref).normalize()
      n2.crossVectors(t, n1).normalize()
      const c = cols[Math.min(i, cols.length - 1)]
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + twist * i
        dir.copy(n1).multiplyScalar(Math.cos(a)).addScaledVector(n2, Math.sin(a))
        this.pos.push(
          pts[i].x + dir.x * radii[i],
          pts[i].y + dir.y * radii[i],
          pts[i].z + dir.z * radii[i],
        )
        this.nor.push(dir.x, dir.y, dir.z)
        this.col.push(c.r, c.g, c.b)
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = base + i * sides + s
        const b = base + i * sides + ((s + 1) % sides)
        const c = base + (i + 1) * sides + s
        const d = base + (i + 1) * sides + ((s + 1) % sides)
        this.idx.push(a, b, c, b, d, c)
      }
    }
  }

  /** Flat tapered ribbon (rice leaf, straw fragment). Both faces are emitted. */
  ribbon(pts: THREE.Vector3[], widths: number[], cols: THREE.Color[], up = new THREE.Vector3(0, 1, 0)): void {
    const n = pts.length
    const base = this.vertexCount
    const t = new THREE.Vector3()
    const side = new THREE.Vector3()
    const nrm = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      if (i === 0) t.subVectors(pts[1], pts[0])
      else if (i === n - 1) t.subVectors(pts[n - 1], pts[n - 2])
      else t.subVectors(pts[i + 1], pts[i - 1])
      t.normalize()
      side.crossVectors(t, up).normalize()
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
      nrm.crossVectors(side, t).normalize()
      const c = cols[Math.min(i, cols.length - 1)]
      const w = widths[i]
      for (const sgn of [-1, 1]) {
        this.pos.push(pts[i].x + side.x * w * sgn, pts[i].y + side.y * w * sgn, pts[i].z + side.z * w * sgn)
        this.nor.push(nrm.x, nrm.y, nrm.z)
        this.col.push(c.r, c.g, c.b)
      }
    }
    // duplicate with flipped normals so the blade reads from both sides
    const back = this.vertexCount
    for (let i = 0; i < n * 2; i++) {
      const p = base + i
      this.pos.push(this.pos[p * 3], this.pos[p * 3 + 1], this.pos[p * 3 + 2])
      this.nor.push(-this.nor[p * 3], -this.nor[p * 3 + 1], -this.nor[p * 3 + 2])
      this.col.push(this.col[p * 3], this.col[p * 3 + 1], this.col[p * 3 + 2])
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2
      this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      const b = back + i * 2
      this.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }

  /** Adds an existing geometry, transformed. */
  add(geo: THREE.BufferGeometry, mat: THREE.Matrix4, color: THREE.Color): void {
    const g = geo.index ? geo.toNonIndexed() : geo
    const p = g.getAttribute('position')
    const nAttr = g.getAttribute('normal')
    const base = this.vertexCount
    const nm = new THREE.Matrix3().getNormalMatrix(mat)
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mat)
      this.pos.push(v.x, v.y, v.z)
      if (nAttr) {
        v.fromBufferAttribute(nAttr, i).applyMatrix3(nm).normalize()
        this.nor.push(v.x, v.y, v.z)
      } else this.nor.push(0, 1, 0)
      this.col.push(color.r, color.g, color.b)
    }
    for (let i = 0; i < p.count; i++) this.idx.push(base + i)
    if (g !== geo) g.dispose()
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

/** Convenience: box/cylinder/etc. baked straight into a builder. */
export function put(
  b: MeshBuilder,
  geo: THREE.BufferGeometry,
  color: number | THREE.Color,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): void {
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  )
  b.add(geo, m, color instanceof THREE.Color ? color : new THREE.Color(color))
}
