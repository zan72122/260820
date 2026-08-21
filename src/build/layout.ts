/**
 * 現場の寸法・接続位置・カメラ・工程をすべて data として持つ。
 * 巨大な汎用建設フレームワークにはせず、この一基の滑り台が成立する値だけを置く。
 * 単位は m。Y が上。
 */

export const SITE = {
  /** 踊り場デッキ上面 */
  deckTop: 1.8,
  deckW: 1.1,
  deckD: 1.0,
  deckSlab: 0.05,
  frameH: 0.11,
  /** デッキ下部フレーム下端＝柱天端 */
  get deckUnder() {
    return this.deckTop - this.deckSlab - this.frameH
  },
  colX: 0.5,
  colZ: -0.3,
  colTubeR: 0.057,
  padTop: 0.1,
  basePlate: { w: 0.24, d: 0.24, t: 0.016, holeR: 0.011, boltDx: 0.075 },
  anchorProjection: 0.095,
  /** 滑走面の上端接続点（デッキ前端） */
  chuteTop: { x: 0, y: 1.8, z: -0.5 },
  chuteRun: 3.4,
  chuteDrop: 1.52,
  chuteHalfWidth: 0.24,
  chuteWall: 0.15,
  chuteThick: 0.022,
  /** 中間支持の位置（滑走面パラメータ s） */
  chuteMidS: 0.529,
  midPadTop: 0.08,
  exitPadTop: 0.1,
  stairBaseZ: 2.2,
  stairTopZ: 0.5,
  railX: 0.5,
  fence: { minX: -4.2, maxX: 2.6, minZ: -5.2, maxZ: 5.6, height: 1.35, gateHalf: 1.1 },
  crane: { x: 5.2, z: 3.4, luffDeg: 36, pivotBack: 0.9, pivotY: 1.9, minRadius: 3.0, maxRadius: 8.4 },
  /** 危険側に寄りすぎないための操作範囲 */
  hookMinY: 0.35,
  hookMaxY: 6.5,
} as const

export type ChuteVariant = 'straight' | 'wave' | 'roller'

export const CHUTE_VARIANTS: Array<{ id: ChuteVariant; name: string; note: string }> = [
  { id: 'straight', name: 'まっすぐ', note: 'なめらかに すーっ' },
  { id: 'wave', name: 'なみなみ', note: 'いちどだけ ふわっ' },
  { id: 'roller', name: 'ローラー', note: 'ころころ はやい' },
]

/**
 * 滑走面中心線。実際の遊具と同じく「入口の傾斜 → 最急部 → 出口の水平な走り出し」で構成する。
 * s=0 が上端接続点、s=1 が出口。最後の区間だけ形が変わり、接続点と出口高さは共通。
 */
const PROFILE_N = 256
const profileCache = new Map<ChuteVariant, Float64Array>()

const smooth01 = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/** 位置 s での勾配（度）。上端で 22 度、中間で 38 度、出口で 0 度。 */
function rawSlopeDeg(s: number): number {
  if (s <= 0.62) return 22 + 16 * smooth01(s / 0.32)
  return 38 * (1 - smooth01((s - 0.62) / 0.38))
}

function buildProfile(variant: ChuteVariant): Float64Array {
  const y = new Float64Array(PROFILE_N + 1)
  const ds = 1 / PROFILE_N
  let acc = 0
  for (let i = 1; i <= PROFILE_N; i++) {
    const sm = (i - 0.5) * ds
    acc += Math.tan((rawSlopeDeg(sm) * Math.PI) / 180) * SITE.chuteRun * ds
    y[i] = -acc
  }
  // 出口の高さは形にかかわらず共通にする（接続法を変えないため）
  const k = SITE.chuteDrop / -y[PROFILE_N]
  for (let i = 0; i <= PROFILE_N; i++) y[i] *= k
  if (variant === 'wave') {
    for (let i = 0; i <= PROFILE_N; i++) {
      const s = i / PROFILE_N
      if (s <= 0.6) continue
      const u = (s - 0.6) / 0.4
      const b = Math.sin(Math.PI * u)
      // 端で値も傾きも 0 に戻る形。ひと山だけ緩く波打つ。
      y[i] += 0.17 * b * b
    }
  }
  return y
}

export function chuteCenter(s: number, variant: ChuteVariant): { y: number; z: number } {
  let table = profileCache.get(variant)
  if (!table) {
    table = buildProfile(variant)
    profileCache.set(variant, table)
  }
  const t = (s < 0 ? 0 : s > 1 ? 1 : s) * PROFILE_N
  const i = Math.min(PROFILE_N - 1, Math.floor(t))
  const f = t - i
  return { y: table[i] + (table[i + 1] - table[i]) * f, z: -SITE.chuteRun * s }
}

/** ローラー区間の開始位置 */
export const ROLLER_START_S = 0.62

export type PartId = 'columnA' | 'columnB' | 'platform' | 'stair' | 'chute' | 'handrailL' | 'handrailR'

/**
 * 部材の状態。未搬入→吊上げ→移動→仮位置→接続→固定→検査済み。
 */
export type PartStatus =
  | 'stored'
  | 'rigged'
  | 'hoisted'
  | 'travelling'
  | 'landed'
  | 'connected'
  | 'fastened'
  | 'inspected'

export interface Vec2 {
  x: number
  z: number
}

export interface PartPlacement {
  /** 仮置き場での部材原点 */
  layDown: { x: number; y: number; z: number; yawDeg: number; pitchDeg: number; rollDeg?: number }
  /** 取り付け位置での部材原点 */
  seat: { x: number; y: number; z: number; yawDeg: number; pitchDeg: number }
  /** 部材原点からフック点までのローカルオフセット（取り付け姿勢基準） */
  hookOffset: { x: number; y: number; z: number }
  /** 吊り上げ時に部材が通過する安全高さ（フック高さ） */
  travelHookY: number
  /** 経路の途中で保つべき部材原点の高さ（既設部材の上を通す） */
  travelClearance: number
  /** 取付位置の直前で降ろせる高さ（アンカーボルト等をかわす） */
  approachClearance: number
  /** 仮置き時のフック点 XZ（クレーン旋回の始点） */
  pickXZ: Vec2
  /** 取り付け時のフック点 XZ（旋回の終点） */
  placeXZ: Vec2
  /** 着座時のフック高さ */
  seatHookY: number
  /** 開始時の向きのずれ（度）。プレイヤーが回転ハンドルで直す */
  yawErrorDeg: number
  /** ボルト配置の対称性。正方形配置なら 90 度ごとに合う */
  yawSymmetryDeg: number
  yawTolDeg: number
  /** 旋回パラメータ u の許容誤差 */
  uTol: number
  /** 二本吊りに spreader beam を使うか（長尺部材） */
  spreader: boolean
  slingPoints: Array<{ x: number; y: number; z: number }>
}

const DECK_UNDER = SITE.deckTop - SITE.deckSlab - SITE.frameH // 1.64

function columnPlacement(side: -1 | 1): PartPlacement {
  const x = SITE.colX * side
  const z = SITE.colZ
  // 仮置き場はクレーンの作業半径内に弧状に並べる（現場でも旋回範囲に材料を置く）
  const lay = side < 0 ? { x: -2.1, z: 1.5 } : { x: -1.55, z: 2.9 }
  return {
    layDown: { x: lay.x, y: 0.14, z: lay.z, yawDeg: 0, pitchDeg: 90 },
    seat: { x, y: SITE.padTop, z, yawDeg: 0, pitchDeg: 0 },
    hookOffset: { x: 0, y: 2.55, z: 0 },
    travelHookY: 4.4,
    travelClearance: 1.85,
    approachClearance: 0.26,
    pickXZ: { x: lay.x, z: lay.z + 0.77 },
    placeXZ: { x, z },
    seatHookY: SITE.padTop + 2.55,
    yawErrorDeg: side < 0 ? 37 : -33,
    yawSymmetryDeg: 90,
    yawTolDeg: 13,
    uTol: 0.055,
    spreader: false,
    slingPoints: [{ x: 0, y: 1.6, z: 0 }],
  }
}

const CHUTE_HOOK_LOCAL = { x: 0, y: 2.15, z: -1.53 }

export const PLACEMENTS: Record<PartId, PartPlacement> = {
  columnA: columnPlacement(-1),
  columnB: columnPlacement(1),
  platform: {
    layDown: { x: -1.05, y: 0.09, z: 5.05, yawDeg: 0, pitchDeg: 0 },
    seat: { x: 0, y: DECK_UNDER, z: 0, yawDeg: 0, pitchDeg: 0 },
    hookOffset: { x: 0, y: 1.8, z: 0 },
    travelHookY: 3.75,
    travelClearance: 1.95,
    approachClearance: 1.8,
    pickXZ: { x: -1.05, z: 5.05 },
    placeXZ: { x: 0, z: 0 },
    seatHookY: DECK_UNDER + 1.8,
    yawErrorDeg: 24,
    yawSymmetryDeg: 180,
    yawTolDeg: 12,
    uTol: 0.055,
    spreader: false,
    slingPoints: [
      { x: -0.46, y: 0.16, z: -0.4 },
      { x: 0.46, y: 0.16, z: -0.4 },
      { x: -0.46, y: 0.16, z: 0.4 },
      { x: 0.46, y: 0.16, z: 0.4 },
    ],
  },
  stair: {
    layDown: { x: 0.15, y: 0.4, z: 4.55, yawDeg: 0, pitchDeg: 0, rollDeg: -90 },
    seat: { x: 0, y: 0.02, z: SITE.stairBaseZ, yawDeg: 0, pitchDeg: 0 },
    hookOffset: { x: 0, y: 2.9, z: -0.95 },
    travelHookY: 3.4,
    travelClearance: 0.5,
    approachClearance: 0.32,
    pickXZ: { x: 1.04, z: 4.65 },
    placeXZ: { x: 0, z: SITE.stairBaseZ - 0.95 },
    seatHookY: 0.02 + 2.9,
    yawErrorDeg: -22,
    yawSymmetryDeg: 360,
    yawTolDeg: 14,
    uTol: 0.06,
    spreader: false,
    slingPoints: [
      { x: -0.34, y: 1.28, z: -1.62 },
      { x: 0.34, y: 1.28, z: -1.62 },
      { x: -0.34, y: 0.16, z: -0.16 },
      { x: 0.34, y: 0.16, z: -0.16 },
    ],
  },
  chute: {
    layDown: { x: -1.25, y: 0.32, z: 0.33, yawDeg: 0, pitchDeg: 0, rollDeg: -90 },
    seat: { x: SITE.chuteTop.x, y: SITE.chuteTop.y, z: SITE.chuteTop.z, yawDeg: 0, pitchDeg: 0 },
    hookOffset: CHUTE_HOOK_LOCAL,
    travelHookY: 6.0,
    travelClearance: 3.85,
    approachClearance: 2.05,
    pickXZ: { x: -1.25, z: -1.2 },
    placeXZ: { x: 0, z: SITE.chuteTop.z + CHUTE_HOOK_LOCAL.z },
    seatHookY: SITE.chuteTop.y + CHUTE_HOOK_LOCAL.y,
    yawErrorDeg: 52,
    yawSymmetryDeg: 360,
    yawTolDeg: 12,
    uTol: 0.05,
    spreader: true,
    slingPoints: [
      { x: -0.28, y: -0.02, z: -0.612 },
      { x: 0.28, y: -0.02, z: -0.612 },
      { x: -0.28, y: -1.15, z: -2.448 },
      { x: 0.28, y: -1.15, z: -2.448 },
    ],
  },
  handrailL: {
    layDown: { x: -1.4, y: 0.05, z: 1.3, yawDeg: 0, pitchDeg: 0, rollDeg: -90 },
    seat: { x: -SITE.railX, y: 0, z: 0, yawDeg: 0, pitchDeg: 0 },
    hookOffset: { x: 0, y: 3.9, z: 0.1 },
    travelHookY: 4.52,
    travelClearance: 0.62,
    approachClearance: 0.4,
    pickXZ: { x: 0.77, z: 1.3 },
    placeXZ: { x: -SITE.railX, z: 0.1 },
    seatHookY: 3.9,
    yawErrorDeg: 26,
    yawSymmetryDeg: 360,
    yawTolDeg: 16,
    uTol: 0.07,
    spreader: false,
    slingPoints: [
      { x: 0, y: 2.52, z: 0.42 },
      { x: 0, y: 2.55, z: -0.3 },
    ],
  },
  handrailR: {
    layDown: { x: -1.4, y: 0.05, z: 2.25, yawDeg: 0, pitchDeg: 0, rollDeg: -90 },
    seat: { x: SITE.railX, y: 0, z: 0, yawDeg: 0, pitchDeg: 0 },
    hookOffset: { x: 0, y: 3.9, z: 0.1 },
    travelHookY: 4.52,
    travelClearance: 0.62,
    approachClearance: 0.4,
    pickXZ: { x: 0.77, z: 2.25 },
    placeXZ: { x: SITE.railX, z: 0.1 },
    seatHookY: 3.9,
    yawErrorDeg: -24,
    yawSymmetryDeg: 360,
    yawTolDeg: 16,
    uTol: 0.07,
    spreader: false,
    slingPoints: [
      { x: 0, y: 2.52, z: 0.42 },
      { x: 0, y: 2.55, z: -0.3 },
    ],
  },
}

/** 基礎（コンクリート＋アンカーボルト） */
export const FOUNDATIONS = [
  { id: 'padA', x: -SITE.colX, z: SITE.colZ, w: 0.5, d: 0.5, top: SITE.padTop, anchors: 4, spread: 0.075 },
  { id: 'padB', x: SITE.colX, z: SITE.colZ, w: 0.5, d: 0.5, top: SITE.padTop, anchors: 4, spread: 0.075 },
  { id: 'padMid', x: 0, z: -2.3, w: 0.42, d: 0.42, top: SITE.midPadTop, anchors: 2, spread: 0.09 },
  { id: 'padExit', x: 0, z: -3.9, w: 0.78, d: 0.5, top: SITE.exitPadTop, anchors: 2, spread: 0.24 },
  { id: 'padStair', x: 0, z: SITE.stairBaseZ, w: 0.78, d: 0.42, top: 0.02, anchors: 2, spread: 0.26 },
] as const

export type FastenerId = 'pinA' | 'pinB' | 'boltTop' | 'boltMid' | 'boltExit'

export const FASTENERS: Record<FastenerId, { pos: [number, number, number]; axis: 'y' | 'x'; label: string; camera: string }> = {
  pinA: { pos: [-SITE.colX, DECK_UNDER + 0.03, SITE.colZ], axis: 'x', label: 'ピン', camera: 'pinA' },
  pinB: { pos: [SITE.colX, DECK_UNDER + 0.03, SITE.colZ], axis: 'x', label: 'ピン', camera: 'pinB' },
  boltTop: { pos: [0.36, 1.738, -0.48], axis: 'y', label: 'ボルト', camera: 'boltTop' },
  boltMid: { pos: [0.14, SITE.midPadTop, -2.3], axis: 'y', label: 'ボルト', camera: 'boltMid' },
  boltExit: { pos: [0.22, SITE.exitPadTop, -3.9], axis: 'y', label: 'ボルト', camera: 'boltExit' },
}

// ---------------------------------------------------------------- カメラ

export interface Framing {
  az: number
  elev: number
  fitW: number
  fitH: number
}

export interface CameraPreset {
  target: [number, number, number]
  land: Framing
  port?: Framing
}

export const CAMERAS: Record<string, CameraPreset> = {
  overview: {
    target: [0, 0.9, 0.1],
    land: { az: -70, elev: 20, fitW: 4.5, fitH: 2.5 },
    port: { az: -74, elev: 25, fitW: 3.5, fitH: 3.3 },
  },
  foundationA: {
    target: [-0.5, 0.78, -0.3],
    land: { az: -122, elev: 19, fitW: 1.45, fitH: 1.15 },
    port: { az: -122, elev: 22, fitW: 1.05, fitH: 1.5 },
  },
  foundationB: {
    target: [0.5, 0.78, -0.3],
    land: { az: -56, elev: 19, fitW: 1.45, fitH: 1.15 },
    port: { az: -56, elev: 22, fitW: 1.05, fitH: 1.5 },
  },
  platformSet: {
    target: [0, 1.28, -0.16],
    land: { az: -96, elev: 14, fitW: 2.0, fitH: 1.4 },
    port: { az: -96, elev: 17, fitW: 1.5, fitH: 1.95 },
  },
  pins: {
    target: [0, 1.55, -0.3],
    land: { az: -104, elev: 7, fitW: 1.7, fitH: 1.0 },
    port: { az: -104, elev: 9, fitW: 1.4, fitH: 1.3 },
  },
  pinA: {
    target: [-0.5, 1.62, -0.3],
    land: { az: -132, elev: 20, fitW: 0.9, fitH: 0.72 },
    port: { az: -132, elev: 22, fitW: 0.68, fitH: 0.9 },
  },
  pinB: {
    target: [0.5, 1.62, -0.3],
    land: { az: -48, elev: 20, fitW: 0.9, fitH: 0.72 },
    port: { az: -48, elev: 22, fitW: 0.68, fitH: 0.9 },
  },
  stairSet: {
    target: [0, 1.05, 1.25],
    land: { az: 52, elev: 18, fitW: 2.3, fitH: 1.75 },
    port: { az: 52, elev: 21, fitW: 1.75, fitH: 2.3 },
  },
  climb: {
    target: [0.1, 1.15, 1.4],
    land: { az: 96, elev: 12, fitW: 2.0, fitH: 1.6 },
    port: { az: 96, elev: 15, fitW: 1.5, fitH: 2.0 },
  },
  chuteLift: {
    target: [0, 1.75, -1.2],
    land: { az: -162, elev: 13, fitW: 4.6, fitH: 3.2 },
    port: { az: -138, elev: 28, fitW: 3.7, fitH: 4.6 },
  },
  alignTop: {
    target: [0, 1.7, -0.66],
    land: { az: -148, elev: 10, fitW: 1.7, fitH: 1.2 },
    port: { az: -148, elev: 13, fitW: 1.3, fitH: 1.6 },
  },
  alignBottom: {
    target: [0, 0.42, -3.72],
    land: { az: -150, elev: 10, fitW: 1.7, fitH: 1.2 },
    port: { az: -150, elev: 13, fitW: 1.3, fitH: 1.6 },
  },
  boltTop: {
    target: [0.33, 1.76, -0.46],
    land: { az: -112, elev: 34, fitW: 0.95, fitH: 0.8 },
    port: { az: -112, elev: 36, fitW: 0.72, fitH: 0.95 },
  },
  boltMid: {
    target: [0.1, 0.4, -2.3],
    land: { az: -130, elev: 28, fitW: 1.05, fitH: 0.85 },
    port: { az: -130, elev: 30, fitW: 0.78, fitH: 1.05 },
  },
  boltExit: {
    target: [0.18, 0.3, -3.86],
    land: { az: -146, elev: 26, fitW: 1.05, fitH: 0.85 },
    port: { az: -146, elev: 28, fitW: 0.78, fitH: 1.05 },
  },
  handrail: {
    target: [0, 1.55, 0.85],
    land: { az: 26, elev: 18, fitW: 2.2, fitH: 1.7 },
    port: { az: 26, elev: 21, fitW: 1.65, fitH: 2.2 },
  },
  inspect: {
    target: [0, 1.05, -1.3],
    land: { az: -168, elev: 12, fitW: 4.6, fitH: 3.1 },
    port: { az: -150, elev: 22, fitW: 3.6, fitH: 4.4 },
  },
  ride: {
    target: [0, 0.95, -1.9],
    land: { az: 176, elev: 10, fitW: 2.4, fitH: 1.7 },
    port: { az: 162, elev: 15, fitW: 1.75, fitH: 2.3 },
  },
  gate: {
    target: [0, 1.0, -4.9],
    land: { az: -101, elev: 11, fitW: 3.0, fitH: 2.1 },
    port: { az: -101, elev: 14, fitW: 2.3, fitH: 3.0 },
  },
}

// ---------------------------------------------------------------- 工程

export type StepKind = 'beat' | 'lift' | 'fasten' | 'inspect' | 'ball' | 'ride' | 'choose' | 'auto'

export interface StepDef {
  id: string
  kind: StepKind
  /** 画面に出す短い指示。完成形の説明はしない。 */
  title: string
  hint: string
  camera: string
  part?: PartId
  fasteners?: FastenerId[]
  fastenMode?: 'pin' | 'bolt'
  /** beat / auto 用の待ち時間（秒） */
  duration?: number
  autoInstall?: PartId[]
}

/** 一回目の建設。工程 1〜13。 */
export const ROUND1: StepDef[] = [
  { id: 'r1-site', kind: 'beat', title: 'げんばを　みてみよう', hint: 'タップですすむ', camera: 'overview', duration: 4.5 },
  { id: 'r1-colA', kind: 'lift', title: 'はしらを　きそに　おろそう', hint: 'レバーで　あげさげ／よこスワイプで　まわす', camera: 'foundationA', part: 'columnA' },
  { id: 'r1-colB', kind: 'lift', title: 'にほんめの　はしら', hint: 'あなと　ボルトを　あわせる', camera: 'foundationB', part: 'columnB' },
  { id: 'r1-platform', kind: 'lift', title: 'たいらな　ぶひんを　はしらへ', hint: 'ゆっくり　のせよう', camera: 'platformSet', part: 'platform' },
  { id: 'r1-pins', kind: 'fasten', title: 'ピンを　さしこむ', hint: 'ピンを　ゆびで　おしこむ', camera: 'pins', fasteners: ['pinA', 'pinB'], fastenMode: 'pin' },
  { id: 'r1-stair', kind: 'lift', title: 'かいだんを　つなげる', hint: 'デッキの　うしろへ', camera: 'stairSet', part: 'stair' },
  { id: 'r1-chute', kind: 'lift', title: 'ながい　ぶひんを　つりあげよう', hint: 'たかく　あげてから　よこへ', camera: 'chuteLift', part: 'chute' },
  { id: 'r1-bolts', kind: 'fasten', title: 'おおきな　ボルトを　しめる', hint: 'ボルトの　うえで　ゆびを　まわす', camera: 'boltTop', fasteners: ['boltTop', 'boltMid', 'boltExit'], fastenMode: 'bolt' },
  { id: 'r1-railL', kind: 'lift', title: 'てすりを　つける', hint: 'ひだりがわ', camera: 'handrail', part: 'handrailL' },
  { id: 'r1-railR', kind: 'lift', title: 'もういっぽんの　てすり', hint: 'みぎがわ', camera: 'handrail', part: 'handrailR' },
  { id: 'r1-inspect', kind: 'inspect', title: 'てんけん', hint: 'さぎょういんが　みてまわる', camera: 'inspect', duration: 5.5 },
  { id: 'r1-done', kind: 'beat', title: 'できあがった　かたちを　みる', hint: 'タップですすむ', camera: 'overview', duration: 4.5 },
  { id: 'r1-ball', kind: 'ball', title: 'ボールで　ためしすべり', hint: 'ボールを　まえへ　スワイプ', camera: 'ride' },
  { id: 'r1-ride', kind: 'ride', title: 'さくを　あけて　はじめての　すべり', hint: 'こどもを　まえへ　スワイプ', camera: 'ride' },
]

/** 二回目以降。最後の滑走区間だけを選び、短く組み直す。 */
export const ROUND2: StepDef[] = [
  { id: 'r2-choose', kind: 'choose', title: 'さいごの　すべるところを　えらぶ', hint: 'みっつから　ひとつ', camera: 'overview' },
  { id: 'r2-colA', kind: 'lift', title: 'はしらを　きそに　おろそう', hint: 'レバーで　あげさげ', camera: 'foundationA', part: 'columnA' },
  { id: 'r2-colB', kind: 'lift', title: 'にほんめの　はしら', hint: 'あなと　ボルトを　あわせる', camera: 'foundationB', part: 'columnB' },
  { id: 'r2-platform', kind: 'lift', title: 'たいらな　ぶひんを　のせる', hint: 'ゆっくり　のせよう', camera: 'platformSet', part: 'platform' },
  { id: 'r2-pin', kind: 'fasten', title: 'ピンを　さしこむ', hint: 'ピンを　ゆびで　おしこむ', camera: 'pins', fasteners: ['pinA'], fastenMode: 'pin' },
  { id: 'r2-chute', kind: 'lift', title: 'えらんだ　すべりめんを　つりあげる', hint: 'たかく　あげてから　よこへ', camera: 'chuteLift', part: 'chute' },
  { id: 'r2-bolts', kind: 'fasten', title: 'ボルトを　しめる', hint: 'ボルトの　うえで　ゆびを　まわす', camera: 'boltTop', fasteners: ['boltTop', 'boltExit'], fastenMode: 'bolt' },
  { id: 'r2-auto', kind: 'auto', title: 'かいだんと　てすりを　とりつけ', hint: 'さぎょういんが　しあげる', camera: 'stairSet', duration: 3.6, autoInstall: ['stair', 'handrailL', 'handrailR'] },
  { id: 'r2-ball', kind: 'ball', title: 'ボールで　ためしすべり', hint: 'ボールを　まえへ　スワイプ', camera: 'ride' },
  { id: 'r2-ride', kind: 'ride', title: 'あたらしい　すべりを　ためす', hint: 'こどもを　まえへ　スワイプ', camera: 'ride' },
]
