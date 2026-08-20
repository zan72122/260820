import { clamp, fbmOpen, lerp, smoothstep } from '../core/util'

/**
 * 会場のレイアウト（単位: メートル）。
 *  X 軸 = 信濃川の流れる向き（画面奥へ伸びる）
 *  Z 軸 = 川を横切る向き。+Z が手前岸（プレイヤー側の河川敷）、-Z が対岸
 *  Y 軸 = 上。水面が y = 0
 */
export const L = {
  water: { halfWidth: 95, longHalf: 900 },

  /** 手前岸 */
  near: {
    shore: 95, // 水際
    slopeTop: 112, // 護岸の上端
    terraceY: 2.6, // 河川敷の高さ
    terraceEnd: 190, // 堤防の法尻
    leveeTop: 214, // 堤防天端の手前端
    leveeBack: 242, // 堤防天端の奥端（橋の取り付けまで続く）
    leveeY: 8.6,
    townY: 4.4,
  },
  /** 対岸 */
  far: {
    shore: -95,
    slopeTop: -111,
    terraceY: 2.4,
    terraceEnd: -176,
    leveeTop: -196,
    leveeBack: -208,
    leveeY: 8.2,
    townY: 4.0,
  },

  /** 長生橋を思わせるトラス橋。X=0 の位置で川を渡る。 */
  bridge: {
    x: 0,
    deckY: 15.2,
    deckHalfWidth: 5.2,
    zStart: -235, // 対岸側の取り付け
    zEnd: 244, // 手前側の取り付け
    spanCount: 9,
    spanLength: 46,
    archRise: 7.4,
    pierZ: [-138, -92, -46, 0, 46, 92, 138],
    gateZ: 232, // 通行止めバリケードの位置
  },

  /** 手前岸の遊歩道（案内灯が並ぶ） */
  path: { z: 150, xMin: -120, xMax: 150, halfWidth: 2.4 },

  /** 本部テント（最後の大きな操作） */
  hq: { x: 118, z: 176 },
} as const

/**
 * カメラが立つ／通る場所。ここに木や設備を置くと画面をふさぐので避ける。
 * [x, z, 半径]
 */
export const CAMERA_ZONES: [number, number, number][] = [
  [254, 252, 20], [236, 240, 20], [196, 214, 24],
  [1.6, 253, 22], [0.5, 244, 22],
  [124, 214, 16], [125.5, 199, 16],
  [112.6, 187, 13], [113.9, 183, 13],
  [186, 216, 20], [238, 256, 20],
]

export function inCameraZone(x: number, z: number, extra = 0) {
  for (const [cx, cz, r] of CAMERA_ZONES) {
    const rr = r + extra
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < rr * rr) return true
  }
  return false
}

/** 手前岸・対岸の断面高さ。z から標高を返す。 */
export function bankProfile(z: number): number {
  const n = L.near
  const f = L.far
  if (z >= 0) {
    if (z < n.shore) return -1.6 // 川底側（水面下）
    if (z < n.slopeTop) return lerp(-0.35, n.terraceY, smoothstep(n.shore, n.slopeTop, z))
    if (z < n.terraceEnd) return n.terraceY
    if (z < n.leveeTop) return lerp(n.terraceY, n.leveeY, smoothstep(n.terraceEnd, n.leveeTop, z))
    if (z < n.leveeBack) return n.leveeY
    return lerp(n.leveeY, n.townY, smoothstep(n.leveeBack, n.leveeBack + 26, z))
  }
  if (z > f.shore) return -1.6
  if (z > f.slopeTop) return lerp(-0.35, f.terraceY, smoothstep(f.shore, f.slopeTop, z))
  if (z > f.terraceEnd) return f.terraceY
  if (z > f.leveeTop) return lerp(f.terraceY, f.leveeY, smoothstep(f.terraceEnd, f.leveeTop, z))
  if (z > f.leveeBack) return f.leveeY
  return lerp(f.leveeY, f.townY, smoothstep(f.leveeBack, f.leveeBack - 26, z))
}

/** 遊歩道の中心からの距離（手前岸のみ）。 */
export function pathDistance(x: number, z: number): number {
  const p = L.path
  if (z < 0) return 999
  const cx = clamp(x, p.xMin, p.xMax)
  // 道はまっすぐではなく、ゆるく蛇行している
  const wob = Math.sin(cx * 0.017) * 3.4 + Math.sin(cx * 0.041 + 1.7) * 1.5
  const dz = z - (p.z + wob)
  const dx = x < p.xMin ? p.xMin - x : x > p.xMax ? x - p.xMax : 0
  return Math.hypot(dx, dz)
}

/** 水際へ降りる踏み跡（何本か）。 */
const SPURS = [-72, -18, 34, 96]
export function spurDistance(x: number, z: number): number {
  if (z < 0) return 999
  let best = 999
  for (const sx of SPURS) {
    if (z > L.path.z + 2 || z < L.near.slopeTop - 6) continue
    const wob = Math.sin(z * 0.09) * 2.2
    best = Math.min(best, Math.abs(x - (sx + wob)))
  }
  return best
}

/**
 * 「使用感」の量。0 = 草が元気、1 = 踏み固められて土が出ている。
 * 遊歩道・踏み跡・観覧エリア・堤防天端まわりで高くなる。
 */
export function wearAmount(x: number, z: number): number {
  let w = 0
  const dp = pathDistance(x, z)
  w = Math.max(w, smoothstep(L.path.halfWidth + 1.6, L.path.halfWidth - 0.9, dp))
  const ds = spurDistance(x, z)
  w = Math.max(w, smoothstep(2.6, 0.7, ds) * 0.85)

  // 観覧エリア（毎年たくさんの人が座る帯）
  if (z > 0) {
    const band = smoothstep(120, 128, z) * (1 - smoothstep(142, 150, z))
    w = Math.max(w, band * 0.5 * (0.55 + fbmOpen(x * 0.035, z * 0.035, 3, 17) * 0.9))
  }
  // 堤防の法面は刈られていて色が違う
  if (z > L.near.terraceEnd - 4) w = Math.max(w, 0.16)
  // 水際は湿って土が出る
  w = Math.max(w, smoothstep(L.near.slopeTop - 2, L.near.shore + 1, z) * 0.85)
  if (z < 0) w = Math.max(w, smoothstep(L.far.slopeTop - 4, L.far.shore - 1, z) * 0.9)

  // 斑（車輪の轍や、雨だまりの跡）
  const mottle = fbmOpen(x * 0.06, z * 0.06, 4, 251)
  w = clamp(w + smoothstep(0.74, 0.98, mottle) * 0.24, 0, 1)
  return w
}

/** 微細な起伏（不陸）。 */
export function undulation(x: number, z: number): number {
  const big = (fbmOpen(x * 0.012, z * 0.012, 3, 5) - 0.5) * 1.05
  const small = (fbmOpen(x * 0.075, z * 0.075, 3, 91) - 0.5) * 0.22
  return big + small
}

/** 最終的な地面の高さ。 */
export function groundHeight(x: number, z: number): number {
  const base = bankProfile(z)
  if (base <= -1.0) return base
  const flatness = smoothstep(0, 1, clamp((base + 0.35) / 1.2, 0, 1))
  let h = base + undulation(x, z) * flatness
  // 遊歩道はわずかに掘れている
  const dp = pathDistance(x, z)
  h -= smoothstep(L.path.halfWidth + 1.2, 0, dp) * 0.1
  return h
}
