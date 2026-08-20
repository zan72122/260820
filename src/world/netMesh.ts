import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { NetSim } from '../sim/netSim'
import type { TextureBundle } from '../gfx/textureLab'
import type { QualitySettings } from '../core/quality'
import { CORD_RADIUS } from '../game/layout'

/**
 * The net is drawn as real cordage, not a translucent card: every structural
 * cord is a tube with thickness, every crossing has a knot, and the fine mesh
 * between the cords is a deforming sheet carrying an alpha and normal map.
 * Nothing here is simulated - it all follows the knot positions the solver
 * produced, which is what keeps thousands of threads affordable.
 */

const UP = new Vector3(0, 1, 0)
const SIDE = new Vector3(1, 0, 0)

export class NetView {
  readonly group = new Group()
  readonly ropeMesh: Mesh
  readonly knots: InstancedMesh
  readonly fine: Mesh | null
  readonly rings: Mesh[] = []

  private readonly sim: NetSim
  private readonly sides: number
  private readonly ropeGeo: BufferGeometry
  private readonly ropePos: Float32Array
  private readonly ropeNrm: Float32Array
  private readonly fineGeo: BufferGeometry | null = null
  private readonly finePos: Float32Array | null = null
  private readonly fineSub: number
  private readonly cordMaterial: MeshPhysicalMaterial
  private readonly mat = new Matrix4()
  private readonly quat = new Quaternion()
  private readonly scaleVec = new Vector3()
  private readonly tmpA = new Vector3()
  private readonly tmpB = new Vector3()
  private readonly tmpC = new Vector3()
  private readonly tmpD = new Vector3()

  constructor(sim: NetSim, tex: TextureBundle, q: QualitySettings) {
    this.sim = sim
    this.sides = q.ropeSides
    this.fineSub = q.fineMeshSub

    const cordNormal = tex.cordNormal.clone()
    cordNormal.wrapS = RepeatWrapping
    cordNormal.wrapT = RepeatWrapping
    cordNormal.needsUpdate = true

    this.cordMaterial = new MeshPhysicalMaterial({
      color: new Color(0.86, 0.865, 0.845),
      roughness: 0.74,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.85,
      sheenColor: new Color(0.95, 0.95, 0.92),
      normalMap: cordNormal,
      envMapIntensity: 0.6,
    })
    this.cordMaterial.normalScale.set(1.15, 1.15)

    // ---- rope tubes ------------------------------------------------------
    const edges = sim.ropeEdgeCount
    const vPerEdge = this.sides * 2
    const vcount = edges * vPerEdge
    this.ropePos = new Float32Array(vcount * 3)
    this.ropeNrm = new Float32Array(vcount * 3)
    const ropeUv = new Float32Array(vcount * 2)
    const index: number[] = []
    // A cord's rest length sets how often the fibre twist repeats along it,
    // so the ply reads at the same scale on every part of the net.
    const twistPitch = 0.013
    for (let e = 0; e < edges; e++) {
      const base = e * vPerEdge
      const i0 = sim.ropeEdges[e * 2]
      const i1 = sim.ropeEdges[e * 2 + 1]
      const len = Math.hypot(
        sim.getX(i1) - sim.getX(i0),
        sim.getY(i1) - sim.getY(i0),
        sim.getZ(i1) - sim.getZ(i0),
      )
      const vEnd = Math.max(1, Math.round(len / twistPitch))
      for (let k = 0; k < this.sides; k++) {
        const k2 = (k + 1) % this.sides
        index.push(base + k, base + this.sides + k, base + this.sides + k2)
        index.push(base + k, base + this.sides + k2, base + k2)
        ropeUv[(base + k) * 2] = k / this.sides
        ropeUv[(base + k) * 2 + 1] = 0
        ropeUv[(base + this.sides + k) * 2] = k / this.sides
        ropeUv[(base + this.sides + k) * 2 + 1] = vEnd
      }
    }
    this.ropeGeo = new BufferGeometry()
    const posAttr = new BufferAttribute(this.ropePos, 3)
    posAttr.setUsage(DynamicDrawUsage)
    const nrmAttr = new BufferAttribute(this.ropeNrm, 3)
    nrmAttr.setUsage(DynamicDrawUsage)
    this.ropeGeo.setAttribute('position', posAttr)
    this.ropeGeo.setAttribute('normal', nrmAttr)
    this.ropeGeo.setAttribute('uv', new BufferAttribute(ropeUv, 2))
    this.ropeGeo.setIndex(index)
    this.ropeMesh = new Mesh(this.ropeGeo, this.cordMaterial)
    this.ropeMesh.castShadow = true
    this.ropeMesh.receiveShadow = true
    this.ropeMesh.frustumCulled = false
    this.group.add(this.ropeMesh)

    // ---- knots -----------------------------------------------------------
    // A crossing, not a bead: two cords pressed together and slightly flattened.
    const knotGeo = new SphereGeometry(CORD_RADIUS * 1.28, 8, 6)
    knotGeo.scale(1, 0.72, 1.12)
    const knotCount = sim.cfg.cols * sim.cfg.rows + 2
    this.knots = new InstancedMesh(knotGeo, this.cordMaterial, knotCount)
    this.knots.castShadow = false
    this.knots.receiveShadow = true
    this.knots.frustumCulled = false
    this.group.add(this.knots)

    // ---- fine netting sheet ---------------------------------------------
    if (q.fineMesh) {
      const nx = (sim.cfg.cols - 1) * this.fineSub + 1
      const nz = (sim.cfg.rows - 1) * this.fineSub + 1
      this.finePos = new Float32Array(nx * nz * 3)
      const fineUv = new Float32Array(nx * nz * 2)
      const fineIdx: number[] = []
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const o = (j * nx + i) * 2
          fineUv[o] = (i / (nx - 1)) * 6.5
          fineUv[o + 1] = (j / (nz - 1)) * 3.8
          if (i + 1 < nx && j + 1 < nz) {
            const a = j * nx + i
            fineIdx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1)
          }
        }
      }
      this.fineGeo = new BufferGeometry()
      const fp = new BufferAttribute(this.finePos, 3)
      fp.setUsage(DynamicDrawUsage)
      this.fineGeo.setAttribute('position', fp)
      this.fineGeo.setAttribute('uv', new BufferAttribute(fineUv, 2))
      this.fineGeo.setIndex(fineIdx)
      const fineNormal = tex.fineNormal.clone()
      fineNormal.wrapS = RepeatWrapping
      fineNormal.wrapT = RepeatWrapping
      fineNormal.needsUpdate = true
      const fineAlpha = tex.fineAlpha.clone()
      fineAlpha.wrapS = RepeatWrapping
      fineAlpha.wrapT = RepeatWrapping
      fineAlpha.needsUpdate = true
      const fineMat = new MeshPhysicalMaterial({
        color: new Color(0.9, 0.895, 0.86),
        roughness: 0.86,
        metalness: 0,
        alphaMap: fineAlpha,
        normalMap: fineNormal,
        transparent: true,
        alphaTest: 0.5,
        depthWrite: true,
        side: DoubleSide,
        sheen: 0.5,
        sheenRoughness: 0.9,
        envMapIntensity: 0.5,
      })
      this.fine = new Mesh(this.fineGeo, fineMat)
      this.fine.receiveShadow = true
      this.fine.castShadow = false
      this.fine.frustumCulled = false
      this.group.add(this.fine)
    } else {
      this.fine = null
    }

    // ---- end rings -------------------------------------------------------
    const ringGeo = new TorusGeometry(0.014, 0.0028, 6, 14)
    const ringMat = new MeshPhysicalMaterial({
      color: new Color(0.52, 0.44, 0.26),
      roughness: 0.38,
      metalness: 0.85,
      envMapIntensity: 1.1,
    })
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(ringGeo, ringMat)
      m.castShadow = true
      m.frustumCulled = false
      this.rings.push(m)
      this.group.add(m)
    }

    this.update()
  }

  /** Rebuild every vertex from the current knot positions. */
  update(): void {
    this.updateRopes()
    this.updateKnots()
    this.updateFine()
    this.updateRings()
  }

  private updateRopes(): void {
    const sim = this.sim
    const edges = sim.ropeEdgeCount
    const sides = this.sides
    const pos = this.ropePos
    const nrm = this.ropeNrm
    const a = this.tmpA
    const b = this.tmpB
    const dir = this.tmpC
    const ref = this.tmpD
    const u = new Vector3()
    const v = new Vector3()

    for (let e = 0; e < edges; e++) {
      const i0 = sim.ropeEdges[e * 2]
      const i1 = sim.ropeEdges[e * 2 + 1]
      a.set(sim.getX(i0), sim.getY(i0), sim.getZ(i0))
      b.set(sim.getX(i1), sim.getY(i1), sim.getZ(i1))
      dir.subVectors(b, a)
      const len = dir.length() || 1e-6
      dir.multiplyScalar(1 / len)
      ref.copy(Math.abs(dir.y) > 0.92 ? SIDE : UP)
      u.crossVectors(dir, ref).normalize()
      v.crossVectors(dir, u)

      const base = e * sides * 2
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2
        const cx = Math.cos(ang)
        const cz = Math.sin(ang)
        const nx = u.x * cx + v.x * cz
        const ny = u.y * cx + v.y * cz
        const nz = u.z * cx + v.z * cz
        let o = (base + k) * 3
        pos[o] = a.x + nx * CORD_RADIUS
        pos[o + 1] = a.y + ny * CORD_RADIUS
        pos[o + 2] = a.z + nz * CORD_RADIUS
        nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz
        o = (base + sides + k) * 3
        pos[o] = b.x + nx * CORD_RADIUS
        pos[o + 1] = b.y + ny * CORD_RADIUS
        pos[o + 2] = b.z + nz * CORD_RADIUS
        nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz
      }
    }
    this.ropeGeo.attributes.position.needsUpdate = true
    this.ropeGeo.attributes.normal.needsUpdate = true
  }

  private updateKnots(): void {
    const sim = this.sim
    const { cols, rows } = sim.cfg
    let n = 0
    const dxTmp = new Vector3()
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = sim.panel(c, r)
        // Align each knot with the cord running through it, and squash it
        // slightly where the mesh is pulled tight.
        const cn = sim.panel(Math.min(cols - 1, c + 1), r)
        const cp = sim.panel(Math.max(0, c - 1), r)
        dxTmp.set(
          sim.getX(cn) - sim.getX(cp),
          sim.getY(cn) - sim.getY(cp),
          sim.getZ(cn) - sim.getZ(cp),
        )
        const stretch = dxTmp.length()
        dxTmp.normalize()
        this.quat.setFromUnitVectors(UP, dxTmp)
        const squash = 1 - Math.min(0.3, Math.max(0, (stretch - 0.06) * 1.6))
        this.scaleVec.set(1, squash, 1)
        this.mat.compose(
          this.tmpA.set(sim.getX(i), sim.getY(i), sim.getZ(i)),
          this.quat,
          this.scaleVec,
        )
        this.knots.setMatrixAt(n++, this.mat)
      }
    }
    for (const ring of [sim.ringLeft, sim.ringRight]) {
      this.quat.identity()
      this.scaleVec.set(1.25, 1.25, 1.25)
      this.mat.compose(
        this.tmpA.set(sim.getX(ring), sim.getY(ring), sim.getZ(ring)),
        this.quat,
        this.scaleVec,
      )
      this.knots.setMatrixAt(n++, this.mat)
    }
    this.knots.count = n
    this.knots.instanceMatrix.needsUpdate = true
  }

  /** Catmull-Rom sample of the knot grid, so the fine sheet curves smoothly. */
  private samplePanel(cf: number, rf: number, out: Vector3): void {
    const sim = this.sim
    const { cols, rows } = sim.cfg
    const c0 = Math.floor(cf)
    const r0 = Math.floor(rf)
    const tc = cf - c0
    const tr = rf - r0
    const cl = (v: number, hi: number): number => (v < 0 ? 0 : v > hi ? hi : v)
    let x = 0, y = 0, z = 0
    for (let j = -1; j <= 2; j++) {
      const wr = catmull(tr, j)
      if (wr === 0) continue
      for (let i = -1; i <= 2; i++) {
        const wc = catmull(tc, i)
        if (wc === 0) continue
        const idx = sim.panel(cl(c0 + i, cols - 1), cl(r0 + j, rows - 1))
        const w = wr * wc
        x += sim.getX(idx) * w
        y += sim.getY(idx) * w
        z += sim.getZ(idx) * w
      }
    }
    out.set(x, y, z)
  }

  private updateFine(): void {
    if (!this.fineGeo || !this.finePos) return
    const sim = this.sim
    const nx = (sim.cfg.cols - 1) * this.fineSub + 1
    const nz = (sim.cfg.rows - 1) * this.fineSub + 1
    const out = this.tmpA
    for (let j = 0; j < nz; j++) {
      const rf = j / this.fineSub
      for (let i = 0; i < nx; i++) {
        const cf = i / this.fineSub
        this.samplePanel(cf, rf, out)
        const o = (j * nx + i) * 3
        this.finePos[o] = out.x
        this.finePos[o + 1] = out.y
        this.finePos[o + 2] = out.z
      }
    }
    this.fineGeo.attributes.position.needsUpdate = true
    this.fineGeo.computeVertexNormals()
    this.fineGeo.computeBoundingSphere()
  }

  private updateRings(): void {
    const sim = this.sim
    const targets = [
      { node: sim.ringLeft, towards: sim.panel(0, Math.floor(sim.cfg.rows / 2)) },
      { node: sim.ringRight, towards: sim.panel(sim.cfg.cols - 1, Math.floor(sim.cfg.rows / 2)) },
      { node: sim.handleLeft, towards: sim.cordLeft[sim.cordLeft.length - 2] },
      { node: sim.handleRight, towards: sim.cordRight[sim.cordRight.length - 2] },
    ]
    for (let i = 0; i < targets.length; i++) {
      const { node, towards } = targets[i]
      const m = this.rings[i]
      m.position.set(sim.getX(node), sim.getY(node), sim.getZ(node))
      this.tmpA.set(
        sim.getX(towards) - sim.getX(node),
        sim.getY(towards) - sim.getY(node),
        sim.getZ(towards) - sim.getZ(node),
      )
      if (this.tmpA.lengthSq() > 1e-9) {
        this.tmpA.normalize()
        m.quaternion.setFromUnitVectors(UP, this.tmpA)
      }
      m.scale.setScalar(i < 2 ? 1 : 1.22)
    }
  }

  dispose(): void {
    this.ropeGeo.dispose()
    this.knots.geometry.dispose()
    this.knots.dispose()
    this.cordMaterial.dispose()
    this.fineGeo?.dispose()
    if (this.fine) (this.fine.material as MeshPhysicalMaterial).dispose()
    for (const r of this.rings) {
      r.geometry.dispose()
    }
  }
}

/** Catmull-Rom basis weight for control point `i` at local parameter `t`. */
function catmull(t: number, i: number): number {
  const t2 = t * t
  const t3 = t2 * t
  switch (i) {
    case -1: return 0.5 * (-t3 + 2 * t2 - t)
    case 0: return 0.5 * (3 * t3 - 5 * t2 + 2)
    case 1: return 0.5 * (-3 * t3 + 4 * t2 + t)
    case 2: return 0.5 * (t3 - t2)
    default: return 0
  }
}
