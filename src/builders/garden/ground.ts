import { BufferAttribute, BufferGeometry } from 'three'
import { deriveRng } from '../../core/rng'
import { addFbm, createField, type Field } from '../../materials/texgen/noise'

/** 近景の地面が覆う範囲（庭＋塀の外周まで）。 */
export const GROUND_SIZE = 16
export const GROUND_CENTER = { x: 0, z: 0.55 }

interface Zone {
  x: number
  z: number
  r: number
  strength: number
}

/**
 * 庭の地面: なだらかな起伏のハイトフィールド。
 *
 * - `heightAt` は他のビルダーが物を「地面の上に」置くための照会点
 * - `addDepression` は重量物の設置痕（石・束石は土に僅かに沈む=接地の根拠）
 * - `addMoss`/`addWear`/`addShade` は頂点属性となり、シェーダで
 *   苔・踏み分け・湿り汚れを非対称にブレンドする
 */
export class GroundBuilder {
  private readonly base: Field
  private readonly stamps: Array<Zone & { depth: number }> = []
  private readonly moss: Zone[] = []
  private readonly wear: Zone[] = []
  private readonly shade: Zone[] = []

  constructor(seed: number) {
    this.base = createField(96, 96)
    const rng = deriveRng(seed, 'ground')
    addFbm(this.base, Math.floor(rng() * 2 ** 31), 4, 3, 1, 0.5)
    // ±3cm の起伏に正規化
    let min = Infinity
    let max = -Infinity
    for (const v of this.base.data) {
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    const span = max - min || 1
    for (let i = 0; i < this.base.data.length; i++) {
      this.base.data[i] = (((this.base.data[i] as number) - min) / span - 0.5) * 0.06
    }
  }

  private baseAt(x: number, z: number): number {
    // フィールドをタイル境界なしでバイリニア補間（範囲外はラップ）
    const { w, h, data } = this.base
    const u = (((x - GROUND_CENTER.x) / GROUND_SIZE + 0.5) % 1 + 1) % 1
    const v = (((z - GROUND_CENTER.z) / GROUND_SIZE + 0.5) % 1 + 1) % 1
    const fx = u * w
    const fz = v * h
    const x0 = Math.floor(fx)
    const z0 = Math.floor(fz)
    const tx = fx - x0
    const tz = fz - z0
    const at = (ix: number, iz: number) =>
      data[(iz % h) * w + (ix % w)] as number
    const a = at(x0, z0)
    const b = at(x0 + 1, z0)
    const c = at(x0, z0 + 1)
    const d = at(x0 + 1, z0 + 1)
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz
  }

  heightAt(x: number, z: number): number {
    let y = this.baseAt(x, z)
    for (const s of this.stamps) {
      const d = Math.hypot(x - s.x, z - s.z)
      if (d < s.r) {
        const t = 1 - d / s.r
        y -= s.depth * t * t * (3 - 2 * t)
      }
    }
    return y
  }

  addDepression(x: number, z: number, r: number, depth: number): void {
    this.stamps.push({ x, z, r, depth, strength: 1 })
  }

  addMoss(x: number, z: number, r: number, strength: number): void {
    this.moss.push({ x, z, r, strength })
  }

  addWear(x: number, z: number, r: number, strength: number): void {
    this.wear.push({ x, z, r, strength })
  }

  addShade(x: number, z: number, r: number, strength: number): void {
    this.shade.push({ x, z, r, strength })
  }

  private zoneAt(zones: Zone[], x: number, z: number): number {
    let v = 0
    for (const s of zones) {
      const d = Math.hypot(x - s.x, z - s.z)
      if (d < s.r) {
        const t = 1 - d / s.r
        v += s.strength * t * t * (3 - 2 * t)
      }
    }
    return Math.min(1, v)
  }

  /** 平面 xz、y=高さ。uv はメートル単位、aMoss/aWear/aShade 付き。 */
  buildGeometry(segments = 120): BufferGeometry {
    const n = segments + 1
    const positions = new Float32Array(n * n * 3)
    const uvs = new Float32Array(n * n * 2)
    const aMoss = new Float32Array(n * n)
    const aWear = new Float32Array(n * n)
    const aShade = new Float32Array(n * n)
    const indices: number[] = []

    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix
        const x = GROUND_CENTER.x + (ix / segments - 0.5) * GROUND_SIZE
        const z = GROUND_CENTER.z + (iz / segments - 0.5) * GROUND_SIZE
        positions[i * 3] = x
        positions[i * 3 + 1] = this.heightAt(x, z)
        positions[i * 3 + 2] = z
        uvs[i * 2] = x
        uvs[i * 2 + 1] = z
        aMoss[i] = this.zoneAt(this.moss, x, z)
        aWear[i] = this.zoneAt(this.wear, x, z)
        aShade[i] = this.zoneAt(this.shade, x, z)
      }
    }
    for (let iz = 0; iz < segments; iz++) {
      for (let ix = 0; ix < segments; ix++) {
        const a = iz * n + ix
        const b = a + 1
        const c = a + n
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('uv', new BufferAttribute(uvs, 2))
    geo.setAttribute('aMoss', new BufferAttribute(aMoss, 1))
    geo.setAttribute('aWear', new BufferAttribute(aWear, 1))
    geo.setAttribute('aShade', new BufferAttribute(aShade, 1))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }
}
