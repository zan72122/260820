import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { Rng } from '../core/math'
import type { QualitySettings } from '../core/quality'

/** Centreline of the main walk, running away from the slide run-out. */
export const PATH_CURVE = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(0.15, 0, 2.6),
    new THREE.Vector3(0.55, 0, 4.9),
    new THREE.Vector3(1.0, 0, 7.4),
    new THREE.Vector3(1.55, 0, 10.1),
    new THREE.Vector3(2.35, 0, 13.4),
    new THREE.Vector3(3.4, 0, 17.0),
  ],
  false,
  'catmullrom',
  0.4,
)

/** Branch that leads across to the pavilion. */
export const PAVILION_PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(0.4, 0, 4.4),
    new THREE.Vector3(-2.0, 0, 5.2),
    new THREE.Vector3(-4.8, 0, 6.2),
    new THREE.Vector3(-7.3, 0, 7.0),
  ],
  false,
  'catmullrom',
  0.4,
)

function ribbon(curve: THREE.Curve<THREE.Vector3>, halfWidth: number, segments: number): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    curve.getPoint(s, p)
    curve.getTangent(s, t)
    const nx = -t.z
    const nz = t.x
    const len = Math.hypot(nx, nz) || 1
    // Feather the far end so the walk fades into the ground instead of stopping.
    const w = halfWidth * (i > segments - 3 ? (segments - i) / 3 : 1)
    pos.push(p.x + (nx / len) * w, 0.014, p.z + (nz / len) * w)
    pos.push(p.x - (nx / len) * w, 0.014, p.z - (nz / len) * w)
    uv.push(0, s * 6, 1, s * 6)
    if (i < segments) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

export interface GroundBuild {
  root: THREE.Group
  /** Height of the walkable surface; the park is flat, but props read the value. */
  surfaceY: number
}

export function buildGround(quality: QualitySettings): GroundBuild {
  const m = buildMaterials()
  const root = new THREE.Group()
  root.name = 'ground'

  // Turf: the default surface of the park.
  const turfGeo = new THREE.CircleGeometry(230, 56)
  turfGeo.rotateX(-Math.PI / 2)
  const turf = new THREE.Mesh(turfGeo, m.grass)
  turf.receiveShadow = true
  root.add(turf)

  // Compacted decomposed granite where people actually walk.
  const walk = new THREE.Mesh(ribbon(PATH_CURVE, 0.95, 48), m.ground)
  walk.receiveShadow = true
  root.add(walk)

  const branch = new THREE.Mesh(ribbon(PAVILION_PATH, 0.8, 32), m.ground)
  branch.receiveShadow = true
  root.add(branch)

  // The worn apron around the slide, where grass never survives.
  const apronGeo = new THREE.CircleGeometry(4.4, 28)
  apronGeo.rotateX(-Math.PI / 2)
  apronGeo.scale(1, 1, 1.7)
  const apron = new THREE.Mesh(apronGeo, m.ground)
  apron.position.set(0, 0.008, -5.0)
  apron.receiveShadow = true
  root.add(apron)

  const exitApron = new THREE.CircleGeometry(2.9, 24)
  exitApron.rotateX(-Math.PI / 2)
  const exitPatch = new THREE.Mesh(exitApron, m.ground)
  exitPatch.position.set(0, 0.01, 2.4)
  exitPatch.receiveShadow = true
  root.add(exitPatch)

  // Fallen leaves, thickest along the walk and under the trees.
  const rng = new Rng(9001)
  const leafGeo = new THREE.PlaneGeometry(0.13, 0.16)
  leafGeo.rotateX(-Math.PI / 2)
  const leafMat = new THREE.MeshStandardMaterial({
    map: m.tex.leaf,
    transparent: true,
    alphaTest: 0.45,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    color: 0xffffff,
  })
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, quality.leafCount)
  const mtx = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const pos = new THREE.Vector3()
  for (let i = 0; i < quality.leafCount; i++) {
    const along = rng.next()
    PATH_CURVE.getPoint(along * 0.55, pos)
    pos.x += rng.range(-2.6, 2.6)
    pos.z += rng.range(-3.4, 2.2)
    pos.y = 0.018
    q.setFromEuler(new THREE.Euler(rng.range(-0.12, 0.12), rng.range(0, Math.PI * 2), 0))
    const s = rng.range(0.8, 1.35)
    scl.set(s, s, s)
    mtx.compose(pos, q, scl)
    leaves.setMatrixAt(i, mtx)
  }
  leaves.instanceMatrix.needsUpdate = true
  leaves.castShadow = false
  leaves.receiveShadow = false
  root.add(leaves)

  return { root, surfaceY: 0 }
}

/**
 * A few moths orbiting whichever lamps are lit. They are the only particles in
 * the scene, and they exist so the light has something to prove it is real.
 */
export class Moths {
  readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly phase: Float32Array
  private readonly targets: THREE.Vector3[] = []
  private readonly count: number
  private time = 0

  constructor(count: number) {
    this.count = count
    this.positions = new Float32Array(Math.max(1, count) * 3)
    this.phase = new Float32Array(Math.max(1, count))
    const rng = new Rng(3141)
    for (let i = 0; i < count; i++) this.phase[i] = rng.range(0, Math.PI * 2)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    const m = buildMaterials()
    const mat = new THREE.PointsMaterial({
      map: m.tex.glow,
      color: 0xf6e2bd,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
      fog: true,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.visible = count > 0
  }

  /** `anchors` are the lit fittings the moths are allowed to circle. */
  setAnchors(anchors: THREE.Vector3[]): void {
    this.targets.length = 0
    for (const a of anchors) this.targets.push(a)
  }

  update(dt: number): void {
    if (this.count === 0 || this.targets.length === 0) {
      this.points.visible = false
      return
    }
    this.points.visible = true
    this.time += dt
    for (let i = 0; i < this.count; i++) {
      const anchor = this.targets[i % this.targets.length]
      const ph = this.phase[i]
      const t = this.time * (0.7 + (i % 5) * 0.12) + ph
      const r = 0.22 + 0.16 * Math.sin(t * 0.7 + ph)
      this.positions[i * 3] = anchor.x + Math.cos(t) * r
      this.positions[i * 3 + 1] = anchor.y + Math.sin(t * 1.7 + ph) * 0.12
      this.positions[i * 3 + 2] = anchor.z + Math.sin(t) * r
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }
}
