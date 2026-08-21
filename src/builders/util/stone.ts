import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry } from 'three'
import type { Rng } from '../../core/rng'
import { sunDirection } from '../../scene/layout'

export interface StoneOpts {
  /** 平均半径（xz） */
  radius: number
  /** 全高 */
  height: number
  /** 形の不整度 0..~0.4 */
  irregularity?: number
  /** 天端をどれだけ平らに均すか 0..1（飛石=高い、景石=低い） */
  topFlatten?: number
  /** 基部の土汚れリングの高さ（m）。0で無効 */
  soilRingH?: number
  /** 苔の付き方 0..1（日陰側の下部にだけ乗る） */
  mossiness?: number
  baseColor?: string
}

/**
 * 据えた石: 不整形な塊。実際の石の観察に基づく規則で頂点色を焼く —
 * 苔は太陽の当たらない面の低い所だけ、基部には土の接触リング。
 * どの角度から見ても「置いた石」ではなく「据わった石」に見えることが目標。
 */
export function makeStone(rng: Rng, opts: StoneOpts): BufferGeometry {
  const {
    radius,
    height,
    irregularity = 0.22,
    topFlatten = 0.75,
    soilRingH = 0.03,
    mossiness = 0.4,
    baseColor = '#8b867c',
  } = opts

  const geo = new IcosahedronGeometry(1, 2).toNonIndexed()
  const pos = geo.getAttribute('position')

  // 頂点単位の再現可能な変形: 方向から決まる擬似ノイズ（シードは rng から）
  const s1 = rng() * 10 + 1
  const s2 = rng() * 10 + 1
  const s3 = rng() * Math.PI * 2
  const bump = (x: number, y: number, z: number) =>
    Math.sin(x * s1 + s3) * 0.5 + Math.sin(y * s2 + z * s1 * 0.7 + s3 * 1.7) * 0.5

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const r = 1 + irregularity * bump(x, y, z)
    x *= r
    z *= r
    y *= 1 + irregularity * 0.5 * bump(z, x, y)
    // 天端を均す（沓脱石・飛石は歩くための面を持つ）
    if (y > 0) y *= 1 - topFlatten * 0.55
    // 底は据わり良く平らに
    if (y < -0.55) y = -0.55 - (y + 0.55) * 0.25
    pos.setXYZ(i, x * radius, (y + 0.55) * (height / 1.1), z * radius)
  }
  geo.computeVertexNormals()

  // UV: 平面投影（xz）+ 側面は円筒近似で十分（石のスケールでは破綻しない）
  const uvArr = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uvArr[i * 2] = pos.getX(i)
    uvArr[i * 2 + 1] = pos.getZ(i) + pos.getY(i) * 0.7
  }
  geo.setAttribute('uv', new BufferAttribute(uvArr, 2))

  // 頂点色: ベース → 苔（日陰・下部） → 土リング（接地際）
  const sun = sunDirection()
  const normal = geo.getAttribute('normal')
  const colors = new Float32Array(pos.count * 3)
  const base = new Color(baseColor)
  const moss = new Color('#5d6b3c')
  const soil = new Color('#6b5844')
  const tmp = new Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const nx = normal.getX(i)
    const ny = normal.getY(i)
    const nz = normal.getZ(i)
    tmp.copy(base)
    // 個体内の色ムラ
    const mottle = 0.92 + 0.16 * ((bump(pos.getX(i) * 3, y * 3, pos.getZ(i) * 3) + 1) / 2)
    tmp.multiplyScalar(mottle)
    // 苔: 陰面（太陽と逆向きの法線）かつ低所
    const shadeFacing = Math.max(0, -(nx * sun.x + ny * sun.y + nz * sun.z))
    const lowness = Math.max(0, 1 - y / Math.max(height * 0.7, 1e-3))
    const mossAmt = Math.min(1, mossiness * shadeFacing * lowness * 1.6)
    tmp.lerp(moss, mossAmt)
    // 土の接触リング
    if (soilRingH > 0 && y < soilRingH) {
      tmp.lerp(soil, 0.65 * (1 - y / soilRingH))
    }
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return geo
}
