import * as THREE from 'three'
import { L } from './layout'
import { box, merge, strut, sweep } from './geom'
import type { MaterialLib } from './materials'
import { clamp, lerp, makeRng, rand, smoothstep } from '../core/util'

/**
 * 長生橋を思わせる、連続トラスの鉄橋。
 * 川を渡り、両岸の堤防天端の道につながる。
 */

const FLAT_HALF = 138 // トラスが架かっている範囲
const RAMP_END = 236 // 取り付け（堤防天端）

/** 橋面の高さ。 */
export function deckY(z: number): number {
  const a = Math.abs(z)
  if (a <= FLAT_HALF) return L.bridge.deckY
  const t = smoothstep(FLAT_HALF, RAMP_END, a)
  return lerp(L.bridge.deckY, L.near.leveeY + 0.35, t)
}

export type BridgeBuild = {
  group: THREE.Group
  lampAnchors: THREE.Vector3[]
  /** 手前側の取り付け（バリケードを置く所） */
  gate: { z: number; y: number }
  steelMat: THREE.MeshStandardMaterial
  walkway: (t: number) => THREE.Vector3 // 0..1 で橋を渡る道筋
}

export function buildBridge(lib: MaterialLib): BridgeBuild {
  const group = new THREE.Group()
  group.name = 'bridge'
  const steelMat = lib.steel
  const concreteMat = lib.concrete
  const asphaltMat = lib.asphalt

  const zStart = -RAMP_END
  const zEnd = RAMP_END
  const zs: number[] = []
  for (let z = zStart; z <= zEnd + 0.001; z += 2) zs.push(z)

  // --- 橋桁（下面と側面） ---
  const HW = L.bridge.deckHalfWidth
  const girder = sweep(
    zs,
    [
      [-HW, 0],
      [HW, 0],
      [HW, -1.55],
      [HW - 0.5, -2.05],
      [-HW + 0.5, -2.05],
      [-HW, -1.55],
    ],
    deckY,
    0.22,
  )
  const girderMesh = new THREE.Mesh(girder, steelMat)
  girderMesh.castShadow = true
  girderMesh.receiveShadow = true
  group.add(girderMesh)

  // --- 路面（アスファルト） ---
  const road = sweep(
    zs,
    [
      [-HW + 0.9, 0.04],
      [HW - 0.9, 0.04],
      [HW - 0.9, 0.0],
      [-HW + 0.9, 0.0],
    ],
    deckY,
    0.3,
  )
  const roadMesh = new THREE.Mesh(road, asphaltMat)
  roadMesh.receiveShadow = true
  group.add(roadMesh)

  // --- 歩道（両端、少し高い） ---
  const walkParts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    walkParts.push(
      sweep(
        zs,
        [
          [side * (HW - 0.9), 0.22],
          [side * HW, 0.22],
          [side * HW, 0.0],
          [side * (HW - 0.9), 0.0],
        ],
        deckY,
        0.2,
      ),
    )
  }
  const walkMesh = new THREE.Mesh(merge(walkParts), concreteMat)
  walkMesh.receiveShadow = true
  group.add(walkMesh)

  // --- トラス（アーチ上路の連続トラス） ---
  const steelParts: (THREE.BufferGeometry | null)[] = []
  const spanCount = Math.round((FLAT_HALF * 2) / L.bridge.spanLength)
  const spanLen = (FLAT_HALF * 2) / spanCount
  const rise = L.bridge.archRise
  const panels = 6
  const topY = (zLocal: number, half: number) => {
    // アーチ形の上弦材
    const u = clamp(zLocal / half, -1, 1)
    return L.bridge.deckY + 1.6 + rise * (1 - u * u)
  }

  for (let s = 0; s < spanCount; s++) {
    const z0 = -FLAT_HALF + s * spanLen
    const zc = z0 + spanLen / 2
    const half = spanLen / 2
    for (const side of [-1, 1]) {
      const px = side * (HW - 0.25)
      const nodes: THREE.Vector3[] = []
      for (let i = 0; i <= panels; i++) {
        const z = z0 + (spanLen * i) / panels
        nodes.push(new THREE.Vector3(px, topY(z - zc, half), z))
      }
      // 上弦材
      for (let i = 0; i < panels; i++) steelParts.push(strut(nodes[i], nodes[i + 1], 0.42, 0.5))
      // 鉛直材
      for (let i = 0; i <= panels; i++) {
        const z = z0 + (spanLen * i) / panels
        const bottom = new THREE.Vector3(px, deckY(z) + 0.25, z)
        steelParts.push(strut(nodes[i], bottom, 0.26, 0.26))
      }
      // 斜材
      for (let i = 0; i < panels; i++) {
        const za = z0 + (spanLen * i) / panels
        const zb = z0 + (spanLen * (i + 1)) / panels
        const a = new THREE.Vector3(px, deckY(za) + 0.3, za)
        const b = nodes[i + 1].clone()
        const c = new THREE.Vector3(px, deckY(zb) + 0.3, zb)
        const d = nodes[i].clone()
        steelParts.push(strut(i < panels / 2 ? a : d, i < panels / 2 ? b : c, 0.2, 0.2))
      }
      // 下弦材（桁に沿う補剛）
      steelParts.push(
        strut(
          new THREE.Vector3(px, deckY(z0) + 0.25, z0),
          new THREE.Vector3(px, deckY(z0 + spanLen) + 0.25, z0 + spanLen),
          0.3,
          0.34,
        ),
      )
    }
    // 上部の横つなぎ（Xブレース）
    for (let i = 1; i < panels; i++) {
      const za = z0 + (spanLen * i) / panels
      const zb = z0 + (spanLen * (i + 1)) / panels
      if (i === panels - 1) continue
      const ya = topY(za - zc, half)
      const yb = topY(zb - zc, half)
      steelParts.push(
        strut(
          new THREE.Vector3(-(HW - 0.25), ya, za),
          new THREE.Vector3(HW - 0.25, ya, za),
          0.18,
          0.18,
        ),
      )
      steelParts.push(
        strut(
          new THREE.Vector3(-(HW - 0.25), ya, za),
          new THREE.Vector3(HW - 0.25, yb, zb),
          0.13,
          0.13,
        ),
      )
      steelParts.push(
        strut(
          new THREE.Vector3(HW - 0.25, ya, za),
          new THREE.Vector3(-(HW - 0.25), yb, zb),
          0.13,
          0.13,
        ),
      )
    }
  }

  // --- 高欄（欄干） ---
  for (const side of [-1, 1]) {
    const px = side * (HW - 0.12)
    for (let z = zStart; z <= zEnd - 3; z += 3) {
      const y = deckY(z)
      steelParts.push(
        strut(
          new THREE.Vector3(px, y + 0.22, z),
          new THREE.Vector3(px, y + 1.28, z),
          0.11,
          0.11,
        ),
      )
      const y2 = deckY(z + 3)
      steelParts.push(
        strut(
          new THREE.Vector3(px, y + 1.24, z),
          new THREE.Vector3(px, y2 + 1.24, z + 3),
          0.09,
          0.09,
        ),
      )
      steelParts.push(
        strut(
          new THREE.Vector3(px, y + 0.72, z),
          new THREE.Vector3(px, y2 + 0.72, z + 3),
          0.06,
          0.06,
        ),
      )
    }
  }

  const steelMesh = new THREE.Mesh(merge(steelParts), steelMat)
  steelMesh.castShadow = true
  steelMesh.receiveShadow = true
  group.add(steelMesh)

  // --- 橋脚 ---
  const pierParts: THREE.BufferGeometry[] = []
  for (const pz of L.bridge.pierZ) {
    const top = deckY(pz) - 2.05
    const baseY = pz > L.near.shore || pz < L.far.shore ? 1.2 : -3.2
    const h = top - baseY
    pierParts.push(box(8.6, h, 5.0, 0, baseY + h / 2, pz, 0.16))
    // 水切り（船首形）
    const cut = new THREE.CylinderGeometry(2.5, 2.5, h, 12, 1)
    cut.translate(0, baseY + h / 2, 0)
    const c1 = cut.clone()
    c1.translate(0, 0, pz + 2.5)
    const c2 = cut.clone()
    c2.translate(0, 0, pz - 2.5)
    cut.dispose()
    pierParts.push(c1, c2)
    // 天端の帽子
    pierParts.push(box(9.6, 0.7, 6.2, 0, top - 0.35, pz, 0.16))
  }
  const pierMesh = new THREE.Mesh(merge(pierParts), concreteMat)
  pierMesh.castShadow = true
  pierMesh.receiveShadow = true
  group.add(pierMesh)

  // --- 街灯（橋の照明。柱だけ立てて、灯りは LampSystem 側で点ける） ---
  const lampAnchors: THREE.Vector3[] = []
  const poleParts: (THREE.BufferGeometry | null)[] = []
  const rng = makeRng(7788)
  for (let z = -FLAT_HALF + 12; z <= RAMP_END - 14; z += 26) {
    const side = z % 52 < 26 ? 1 : -1
    const px = side * (HW - 0.35)
    const y = deckY(z) + 0.22
    const topH = y + 4.6
    poleParts.push(
      strut(new THREE.Vector3(px, y, z), new THREE.Vector3(px, topH, z), 0.16, 0.16),
    )
    poleParts.push(
      strut(
        new THREE.Vector3(px, topH, z),
        new THREE.Vector3(px - side * 1.5, topH + 0.35, z),
        0.12,
        0.12,
      ),
    )
    lampAnchors.push(new THREE.Vector3(px - side * 1.5, topH + 0.3, z + rand(rng, -0.1, 0.1)))
  }
  const poleMesh = new THREE.Mesh(merge(poleParts), steelMat)
  poleMesh.castShadow = true
  group.add(poleMesh)

  const gate = { z: L.bridge.gateZ, y: deckY(L.bridge.gateZ) }

  const walkway = (t: number) => {
    const z = lerp(RAMP_END - 6, -FLAT_HALF, clamp(t, 0, 1))
    return new THREE.Vector3(0, deckY(z) + 0.26, z)
  }

  return { group, lampAnchors, gate, steelMat, walkway }
}
