import * as THREE from 'three'

/**
 * A tube whose topology is fixed and whose vertices are rewritten in place.
 * Used for the hose so a spline can move every frame without allocating.
 */
export class TubeMesh {
  geometry: THREE.BufferGeometry
  private pos: THREE.Float32BufferAttribute
  private nrm: THREE.Float32BufferAttribute
  private tmpUp = new THREE.Vector3(0, 1, 0)
  private prevN = new THREE.Vector3(0, 1, 0)

  constructor(private tubular: number, private radial: number, private radius: number | ((t: number) => number)) {
    const vcount = (tubular + 1) * radial
    this.pos = new THREE.Float32BufferAttribute(new Float32Array(vcount * 3), 3)
    this.nrm = new THREE.Float32BufferAttribute(new Float32Array(vcount * 3), 3)
    const uv = new Float32Array(vcount * 2)
    const idx: number[] = []
    for (let i = 0; i <= tubular; i++) {
      for (let k = 0; k < radial; k++) {
        const v = i * radial + k
        uv[v * 2] = k / radial
        uv[v * 2 + 1] = i / tubular
      }
    }
    for (let i = 0; i < tubular; i++) {
      for (let k = 0; k < radial; k++) {
        const k2 = (k + 1) % radial
        const a = i * radial + k
        const b = (i + 1) * radial + k
        const c = i * radial + k2
        const d = (i + 1) * radial + k2
        idx.push(a, b, c, c, b, d)
      }
    }
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', this.pos)
    this.geometry.setAttribute('normal', this.nrm)
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geometry.setIndex(idx)
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30)
  }

  update(curve: THREE.Curve<THREE.Vector3>) {
    const p = new THREE.Vector3()
    const t = new THREE.Vector3()
    const n = new THREE.Vector3()
    const b = new THREE.Vector3()
    const dir = new THREE.Vector3()
    this.prevN.set(0, 1, 0)
    for (let i = 0; i <= this.tubular; i++) {
      const u = i / this.tubular
      curve.getPointAt(u, p)
      curve.getTangentAt(u, t).normalize()
      // parallel transport keeps the tube from twisting
      n.copy(this.prevN)
      n.addScaledVector(t, -n.dot(t))
      if (n.lengthSq() < 1e-6) {
        n.copy(this.tmpUp).addScaledVector(t, -this.tmpUp.dot(t))
        if (n.lengthSq() < 1e-6) n.set(1, 0, 0)
      }
      n.normalize()
      this.prevN.copy(n)
      b.crossVectors(t, n).normalize()
      const r = typeof this.radius === 'function' ? this.radius(u) : this.radius
      for (let k = 0; k < this.radial; k++) {
        const a = (k / this.radial) * Math.PI * 2
        dir.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a))
        const v = i * this.radial + k
        this.pos.setXYZ(v, p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r)
        this.nrm.setXYZ(v, dir.x, dir.y, dir.z)
      }
    }
    this.pos.needsUpdate = true
    this.nrm.needsUpdate = true
  }
}
