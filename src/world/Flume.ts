import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  Vector3,
} from 'three'
import { FLUME, THETA_MAX, WATERLINE_V, nodeDistance } from '../config'
import { bakeBambooInner, bakeBambooOuter } from '../gfx/textures'

/** How much the culm swells at a node, 0..1. */
export function nodeBump(z: number): number {
  const d = nodeDistance(z)
  return Math.exp(-((d / 0.0128) ** 2))
}

export function innerRadius(z: number): number {
  return FLUME.rInner * (1 - 0.021 * nodeBump(z))
}

export function outerRadius(z: number): number {
  return FLUME.rOuter * (1 + 0.075 * nodeBump(z))
}

/** Centre of the culm's circular section at z. */
export function sectionCentre(z: number, out = new Vector2()): Vector2 {
  return out.set(FLUME.xAt(z), FLUME.yAt(z) + FLUME.rInner)
}

/** Build the z sampling: dense through the play zone, very dense at nodes. */
function sampleZ(): number[] {
  const zs: number[] = []
  for (let z = FLUME.zStart; z < -4.6; z += 0.10) zs.push(z)
  for (let z = -4.6; z <= FLUME.zEnd; z += 0.028) zs.push(z)
  const extras = [0.004, 0.008, 0.0125, 0.018, 0.025, 0.034]
  const n0 = Math.ceil((-4.6 - FLUME.nodePhase) / FLUME.nodeSpacing)
  const n1 = Math.floor((FLUME.zEnd - FLUME.nodePhase) / FLUME.nodeSpacing)
  for (let n = n0; n <= n1; n++) {
    const c = FLUME.nodePhase + n * FLUME.nodeSpacing
    zs.push(c)
    for (const e of extras) {
      zs.push(c - e)
      zs.push(c + e)
    }
  }
  zs.push(FLUME.zEnd)
  zs.sort((a, b) => a - b)
  // Drop duplicates that would create degenerate rings.
  const out: number[] = []
  for (const z of zs) if (out.length === 0 || z - out[out.length - 1] > 1e-4) out.push(z)
  return out
}

const UV_PERIOD = FLUME.nodeSpacing * 2

interface Skin {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

function pushRingStrip(
  skin: Skin,
  rings: number,
  cols: number,
  ringIndex: number,
): void {
  if (ringIndex === 0) return
  const base = (ringIndex - 1) * cols
  for (let c = 0; c < cols - 1; c++) {
    const a = base + c
    const b = base + c + 1
    const d = base + cols + c
    const e = base + cols + c + 1
    skin.indices.push(a, d, b, b, d, e)
  }
  void rings
}

export class Flume {
  readonly group = new Group()
  readonly innerMaterial: MeshStandardMaterial
  readonly outerMaterial: MeshStandardMaterial
  readonly rimMaterial: MeshStandardMaterial
  readonly zs: number[]

  constructor() {
    const outerMaps = bakeBambooOuter()
    const innerMaps = bakeBambooInner(WATERLINE_V[0], WATERLINE_V[1])

    this.outerMaterial = new MeshStandardMaterial({
      map: outerMaps.map,
      roughnessMap: outerMaps.roughnessMap,
      normalMap: outerMaps.normalMap,
      normalScale: new Vector2(0.85, 0.85),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.9,
    })
    this.innerMaterial = new MeshStandardMaterial({
      map: innerMaps.map,
      roughnessMap: innerMaps.roughnessMap,
      normalMap: innerMaps.normalMap,
      normalScale: new Vector2(0.6, 0.6),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.6,
    })
    this.rimMaterial = new MeshStandardMaterial({
      color: 0xb5a680,
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.9,
    })

    this.zs = sampleZ()
    this.group.add(this.buildTrough())
    this.group.add(this.buildSupports())
  }

  private buildTrough(): Mesh {
    const zs = this.zs
    const rings = zs.length
    const IN_COLS = 21
    const OUT_COLS = 15

    const skin: Skin = { positions: [], normals: [], uvs: [], indices: [] }
    const groups: { start: number; count: number; material: number }[] = []

    // ---- inner skin -------------------------------------------------------
    let idxStart = 0
    for (let i = 0; i < rings; i++) {
      const z = zs[i]
      const cx = FLUME.xAt(z)
      const cy = FLUME.yAt(z) + FLUME.rInner
      const r = innerRadius(z)
      for (let c = 0; c < IN_COLS; c++) {
        const t = c / (IN_COLS - 1)
        const th = -THETA_MAX + t * 2 * THETA_MAX
        skin.positions.push(cx + Math.sin(th) * r, cy - Math.cos(th) * r, z)
        skin.normals.push(-Math.sin(th), Math.cos(th), 0)
        skin.uvs.push((z - FLUME.nodePhase) / UV_PERIOD, t)
      }
      pushRingStrip(skin, rings, IN_COLS, i)
    }
    groups.push({ start: idxStart, count: skin.indices.length - idxStart, material: 0 })

    // ---- outer skin -------------------------------------------------------
    idxStart = skin.indices.length
    const outerBase = rings * IN_COLS
    for (let i = 0; i < rings; i++) {
      const z = zs[i]
      const cx = FLUME.xAt(z)
      const cy = FLUME.yAt(z) + FLUME.rInner
      const r = outerRadius(z)
      for (let c = 0; c < OUT_COLS; c++) {
        const t = c / (OUT_COLS - 1)
        const th = THETA_MAX - t * 2 * THETA_MAX // reversed so winding faces out
        skin.positions.push(cx + Math.sin(th) * r, cy - Math.cos(th) * r, z)
        skin.normals.push(Math.sin(th), -Math.cos(th), 0)
        skin.uvs.push((z - FLUME.nodePhase) / UV_PERIOD, 1 - t)
      }
      if (i > 0) {
        const base = outerBase + (i - 1) * OUT_COLS
        for (let c = 0; c < OUT_COLS - 1; c++) {
          const a = base + c
          const b = base + c + 1
          const d = base + OUT_COLS + c
          const e = base + OUT_COLS + c + 1
          skin.indices.push(a, d, b, b, d, e)
        }
      }
    }
    groups.push({ start: idxStart, count: skin.indices.length - idxStart, material: 1 })

    // ---- the two cut rims -------------------------------------------------
    idxStart = skin.indices.length
    const rimBase = outerBase + rings * OUT_COLS
    for (let side = 0; side < 2; side++) {
      const th = side === 0 ? -THETA_MAX : THETA_MAX
      const sign = side === 0 ? -1 : 1
      const start = rimBase + side * rings * 2
      for (let i = 0; i < rings; i++) {
        const z = zs[i]
        const cx = FLUME.xAt(z)
        const cy = FLUME.yAt(z) + FLUME.rInner
        const ri = innerRadius(z)
        const ro = outerRadius(z)
        const nx = Math.sin(th) * 0.4
        const ny = Math.cos(th) * 0.9 * -1 + 0.8
        const nl = Math.hypot(nx, ny)
        skin.positions.push(cx + Math.sin(th) * ri, cy - Math.cos(th) * ri, z)
        skin.normals.push((nx / nl) * sign, ny / nl, 0)
        skin.uvs.push((z - FLUME.nodePhase) / UV_PERIOD, 0)
        skin.positions.push(cx + Math.sin(th) * ro, cy - Math.cos(th) * ro, z)
        skin.normals.push((nx / nl) * sign, ny / nl, 0)
        skin.uvs.push((z - FLUME.nodePhase) / UV_PERIOD, 1)
        if (i > 0) {
          const a = start + (i - 1) * 2
          const b = a + 1
          const d = a + 2
          const e = a + 3
          if (side === 0) skin.indices.push(a, b, d, b, e, d)
          else skin.indices.push(a, d, b, b, d, e)
        }
      }
    }
    groups.push({ start: idxStart, count: skin.indices.length - idxStart, material: 2 })

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(skin.positions), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(skin.normals), 3))
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(skin.uvs), 2))
    geo.setIndex(skin.indices)
    for (const g of groups) geo.addGroup(g.start, g.count, g.material)
    geo.computeVertexNormals()
    geo.computeBoundingSphere()

    const mesh = new Mesh(geo, [this.innerMaterial, this.outerMaterial, this.rimMaterial])
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'flume'
    return mesh
  }

  /** Crossed bamboo legs holding the trough up, thinning into the distance. */
  private buildSupports(): Object3D {
    const g = new Group()
    const legGeo = new CylinderGeometry(0.019, 0.024, 1, 7, 1, true)
    const tieGeo = new CylinderGeometry(0.013, 0.013, 1, 6, 1, true)
    const positions = [-8.1, -6.6, -5.1, -3.7, -2.35, -1.05, 0.25, 1.6, 3.0]
    for (const z of positions) {
      const y = FLUME.yAt(z)
      const cx = FLUME.xAt(z)
      const splay = 0.20 + y * 0.10
      for (const s of [-1, 1]) {
        const top = new Vector3(cx + s * 0.035, y + 0.012, z)
        const foot = new Vector3(cx - s * splay, 0, z + s * 0.05)
        const leg = new Mesh(legGeo, this.outerMaterial)
        const dir = new Vector3().subVectors(foot, top)
        const len = dir.length()
        leg.position.copy(top).addScaledVector(dir, 0.5)
        leg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize())
        leg.scale.set(1, len, 1)
        leg.castShadow = z > -6
        g.add(leg)
      }
      const tie = new Mesh(tieGeo, this.outerMaterial)
      tie.position.set(cx, y * 0.42, z + 0.01)
      tie.rotation.z = Math.PI / 2
      tie.scale.set(1, splay * 1.5, 1)
      g.add(tie)
    }
    return g
  }
}
