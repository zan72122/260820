import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  EAVE_LINE_Z,
  EAVE_OVERHANG,
  EAVE_WALL_H,
  HOUSE_EAST_X,
  HOUSE_WALL_Z,
  HOUSE_WEST_X,
  KAWARA_WORKING_L,
  KAWARA_WORKING_W,
  ROOF_PITCH,
} from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'

/** けらば（妻側）の出 */
const GABLE_OVERHANG = 0.3
/** 桟瓦の山の高さ */
const TILE_WAVE = 0.028
/** 軒先の段差（瓦の厚み分の影のライン） */
const TILE_LIP = 0.014
/** 南斜面の水平の奥行き（棟まで） */
const SLOPE_RUN = 3.0

export const EAVE_EDGE_Y = EAVE_WALL_H - EAVE_OVERHANG * Math.tan(ROOF_PITCH)
export const RIDGE_Z = EAVE_LINE_Z - SLOPE_RUN
export const RIDGE_Y = EAVE_EDGE_Y + (SLOPE_RUN / Math.cos(ROOF_PITCH)) * Math.sin(ROOF_PITCH)

/**
 * 桟瓦葺きの屋根（4寸勾配・軒の出750）。瓦は1枚ずつ置かず、実寸の
 * 波断面（働き幅265）を持つ帯を段々に重ねる — 遠目に本物の瓦目地が
 * 出て、SwiftShaderでも軽い。焼きムラは頂点色で1枚単位に散らす。
 */
export function buildKawaraRoof(kit: MatKit, rng: Rng): Group {
  const group = new Group()
  group.name = 'roof'

  const xMin = HOUSE_WEST_X - GABLE_OVERHANG
  const xMax = HOUSE_EAST_X + GABLE_OVERHANG
  const width = xMax - xMin
  const cosP = Math.cos(ROOF_PITCH)
  const sinP = Math.sin(ROOF_PITCH)
  const slopeLen = SLOPE_RUN / cosP
  const nRows = Math.ceil(slopeLen / KAWARA_WORKING_L)
  const nTiles = Math.ceil(width / KAWARA_WORKING_W)
  const segPerTile = 6

  // 斜面上の位置: s=斜面距離, lift=法線方向の持ち上げ
  const onSlope = (x: number, s: number, lift: number): [number, number, number] => [
    x,
    EAVE_EDGE_Y + s * sinP + lift * cosP,
    EAVE_LINE_Z - s * cosP + lift * sinP,
  ]

  // --- 瓦の斜面 -----------------------------------------------------------
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const nX = nTiles * segPerTile + 1

  // 焼きムラ: 1枚単位（列r × 桁t）で銀鼠を散らす。桟瓦は水の通り道が
  // まっすぐ下りるよう縦の谷筋が全列で揃う（千鳥にはならない）。
  const tileTint: Color[][] = []
  for (let r = 0; r < nRows; r++) {
    const row: Color[] = []
    for (let t = 0; t <= nTiles; t++) row.push(tintJitter(rng, '#565b63', 0.055))
    tileTint.push(row)
  }

  let vi = 0
  for (let r = 0; r < nRows; r++) {
    const s0 = r * KAWARA_WORKING_L
    const s1 = Math.min((r + 1) * KAWARA_WORKING_L, slopeLen)
    for (const [edge, s] of [
      [0, s0],
      [1, s1],
    ] as const) {
      for (let i = 0; i < nX; i++) {
        const x = xMin + (i / (nX - 1)) * width
        const t = (i / segPerTile) % 1
        const wave = TILE_WAVE * Math.sin(Math.PI * t) ** 2
        const lift = wave + (edge === 0 ? TILE_LIP : 0)
        const [px, py, pz] = onSlope(x, s, lift)
        positions.push(px, py, pz)
        uvs.push(x, s)
        const tint = tileTint[r]![Math.min(nTiles, Math.floor(i / segPerTile))] as Color
        colors.push(tint.r, tint.g, tint.b)
      }
    }
    for (let i = 0; i < nX - 1; i++) {
      const a = vi + i
      const b = a + 1
      const c = vi + nX + i
      const d = c + 1
      indices.push(a, b, c, b, d, c)
    }
    vi += nX * 2
  }
  const slopeGeo = new BufferGeometry()
  slopeGeo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  slopeGeo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  slopeGeo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  slopeGeo.setIndex(indices)
  slopeGeo.computeVertexNormals()
  const slope = new Mesh(slopeGeo, kit.kawara)
  slope.castShadow = true
  slope.receiveShadow = true
  group.add(slope)

  // 野地: 瓦の段差の奥を閉じる下地の斜面（段の影がここに落ちる）
  const under = new PlaneGeometry(width, slopeLen + 0.1)
  under.rotateX(ROOF_PITCH - Math.PI / 2)
  setVertexColor(under, new Color('#2e3136'))
  {
    const mid = onSlope((xMin + xMax) / 2, slopeLen / 2, -0.006)
    under.translate(mid[0], mid[1], mid[2])
  }
  const underMesh = new Mesh(under, kit.kawara)
  underMesh.receiveShadow = true
  group.add(underMesh)

  // --- 軒瓦（万十: 山の端の丸い小口） -------------------------------------
  const caps = []
  for (let t = 0; t < nTiles; t++) {
    const x = xMin + (t + 0.5) * KAWARA_WORKING_W
    if (x > xMax) break
    const cap = new CylinderGeometry(0.052, 0.052, 0.02, 12)
    // 円盤面を軒先の下り方向（南下がり）へ向ける
    cap.rotateX(Math.PI / 2 + ROOF_PITCH)
    const [px, py, pz] = onSlope(x, 0.01, TILE_WAVE * 0.55)
    cap.translate(px, py - 0.01, pz + 0.012)
    setVertexColor(cap, tintJitter(rng, '#50555d', 0.05))
    offsetUvs(cap, rng(), rng())
    caps.push(cap)
  }
  const capMesh = new Mesh(mergeParts(caps), kit.kawara)
  capMesh.castShadow = true
  group.add(capMesh)

  // --- 棟（のし瓦の段＋丸瓦） ---------------------------------------------
  const ridgeParts = []
  const noshi = chamferBox(width, 0.14, 0.24, 0.004)
  setVertexColor(noshi, tintJitter(rng, '#4c5158', 0.03))
  offsetUvs(noshi, rng(), rng())
  moveGeo(noshi, (xMin + xMax) / 2, RIDGE_Y + 0.05, RIDGE_Z)
  ridgeParts.push(noshi)
  const maru = new CylinderGeometry(0.09, 0.09, width, 10, 1, false, 0, Math.PI)
  maru.rotateZ(Math.PI / 2)
  maru.rotateX(-Math.PI / 2)
  maru.translate((xMin + xMax) / 2, RIDGE_Y + 0.12, RIDGE_Z)
  setVertexColor(maru, tintJitter(rng, '#50555d', 0.03))
  offsetUvs(maru, rng(), rng())
  ridgeParts.push(maru)
  const ridge = new Mesh(mergeParts(ridgeParts), kit.kawara)
  ridge.castShadow = true
  group.add(ridge)

  // --- 垂木＋軒裏（野地板） -----------------------------------------------
  // chamferBox の z 軸は rotateX(+勾配) で「北上がりの斜面方向」に載る。
  const raftParts = []
  const raftLen = (EAVE_OVERHANG + 0.2) / cosP
  const nRafts = Math.floor((HOUSE_EAST_X - HOUSE_WEST_X) / 0.455)
  for (let i = 0; i <= nRafts; i++) {
    const x = HOUSE_WEST_X + i * 0.455
    const raft = chamferBox(0.045, 0.06, raftLen, 0.002)
    raft.rotateX(ROOF_PITCH)
    const [px, py, pz] = onSlope(x, raftLen / 2 - 0.02, -0.035)
    raft.translate(px, py, pz)
    setVertexColor(raft, tintJitter(rng, '#5a4c3c', 0.05))
    offsetUvs(raft, rng(), rng())
    raftParts.push(raft)
  }
  const rafters = new Mesh(mergeParts(raftParts), kit.woodDark)
  rafters.castShadow = true
  rafters.receiveShadow = true
  group.add(rafters)

  // 野地板の軒裏: 屋根と平行な下向き面（法線 (0,-cosP,-sinP)）
  const soffitLen = (EAVE_OVERHANG + 0.16) / cosP
  const soffit = new PlaneGeometry(HOUSE_EAST_X - HOUSE_WEST_X + GABLE_OVERHANG * 2, soffitLen)
  soffit.rotateX(Math.PI / 2 + ROOF_PITCH)
  {
    const mid = onSlope((HOUSE_WEST_X + HOUSE_EAST_X) / 2, soffitLen / 2 - 0.02, -0.068)
    soffit.translate(mid[0], mid[1], mid[2])
  }
  const soffitMesh = new Mesh(soffit, kit.shadowWood)
  group.add(soffitMesh)

  // --- 破風板（けらばの化粧板） -------------------------------------------
  const gableParts = []
  for (const gx of [xMin + 0.015, xMax - 0.015]) {
    const hafu = chamferBox(0.03, 0.26, slopeLen, 0.003)
    hafu.rotateX(ROOF_PITCH)
    const mid = onSlope(gx, slopeLen / 2, -0.09)
    hafu.translate(mid[0], mid[1], mid[2])
    setVertexColor(hafu, tintJitter(rng, '#4a3e30', 0.04))
    offsetUvs(hafu, rng(), rng())
    gableParts.push(hafu)
  }
  const gables = new Mesh(mergeParts(gableParts), kit.woodDark)
  gables.castShadow = true
  group.add(gables)

  // --- 北斜面（庭からは見えないが輪郭の破綻を防ぐ） -----------------------
  const north = new PlaneGeometry(width, slopeLen)
  north.rotateX((3 * Math.PI) / 2 - ROOF_PITCH)
  {
    const midY = (RIDGE_Y + EAVE_EDGE_Y) / 2
    north.translate((xMin + xMax) / 2, midY, RIDGE_Z - SLOPE_RUN / 2)
  }
  const northMesh = new Mesh(north, kit.shadowWood)
  group.add(northMesh)

  return group
}

/** ファサード上端と軒裏の間を閉じる小壁の高さ検算に使う。 */
export function eaveGeometry(): { eaveY: number; ridgeY: number; ridgeZ: number } {
  return { eaveY: EAVE_EDGE_Y, ridgeY: RIDGE_Y, ridgeZ: RIDGE_Z }
}

void HOUSE_WALL_Z
