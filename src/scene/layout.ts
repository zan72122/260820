/**
 * 寸法と配置の単一情報源。
 *
 * すべて実在の日本建築・作庭の標準寸法に基づく（単位: m）。ビルダーと
 * ユニットテストが同じ定数を参照することで「実物資料と照合できる寸法」を
 * 機械的に保証する。座標系: +X=東, +Z=南, y=0=庭の地盤面(GL)。
 * 家は北辺にあり南向きの庭。夕陽は西北西から低く差す。
 */

import type { Bounds, Collider } from '../sim/collision'

// ---------------------------------------------------------------------------
// 基本モジュール（尺貫法）
// ---------------------------------------------------------------------------
/** 1尺 = 303mm */
export const SHAKU = 0.303
/** 1寸 = 30.3mm */
export const SUN = SHAKU / 10
/** 1間 = 6尺 = 1820mm（京間ではなく関東間） */
export const KEN = 1.82

// ---------------------------------------------------------------------------
// 家・縁側（在来木造の標準部材寸法）
// ---------------------------------------------------------------------------
/** 柱: 105mm角（3.5寸角、在来工法の管柱標準） */
export const PILLAR_SQ = 0.105
/** 縁側の床高: GL+450mm（腰掛けられる高さ、床下換気を確保） */
export const ENGAWA_FLOOR_H = 0.45
/** 縁側の奥行: 3尺 = 910mm */
export const ENGAWA_DEPTH = 0.91
/** 縁側の長さ: 2間 = 3640mm */
export const ENGAWA_LENGTH = 2 * KEN
/** 縁甲板: 幅135mm・厚30mm・目地3mm */
export const ENGAWA_BOARD_W = 0.135
export const ENGAWA_BOARD_T = 0.03
export const ENGAWA_BOARD_GAP = 0.003
/** 縁框・床束まわり */
export const ENGAWA_KAMACHI_SQ = PILLAR_SQ
/** 束石: 天端がGL+60mm程度の切石 */
export const FOUNDATION_STONE_H = 0.06
export const FOUNDATION_STONE_SQ = 0.2

/** 腰板の高さ（それより上は漆喰壁） */
export const WAINSCOT_H = 0.8
/** 障子: 幅3尺 × 内法高5尺8寸（1757mm）、組子ピッチ約210mm */
export const SHOJI_W = 0.91
export const SHOJI_H = 1.757
export const SHOJI_KUMIKO_PITCH = 0.21
/** 軒高（桁下端）: GL+2600mm 程度の平屋 */
export const EAVE_WALL_H = 2.6
/** 屋根勾配: 4寸勾配 = atan(4/10) ≈ 21.8° */
export const ROOF_PITCH = Math.atan(4 / 10)
/** 軒の出: 4尺=1212mm。3尺の縁側を雨から守るには縁側より深い庇が要る
 *  （雨落ちの線は縁側の外に落ちるという雨仕舞の必然） */
export const EAVE_OVERHANG = 4 * SHAKU
/** 桟瓦: 53判の働き寸法 約265×235mm */
export const KAWARA_WORKING_W = 0.265
export const KAWARA_WORKING_L = 0.235

/** 家ファサードの壁面ライン（z）と横幅 */
export const HOUSE_WALL_Z = -4.5
export const HOUSE_WEST_X = -5.46 // 3間分
export const HOUSE_EAST_X = 3.64 // 2間分（東側は物置き的な続き）
/** 縁側の占める区間（x） */
export const ENGAWA_WEST_X = -3.64
export const ENGAWA_EAST_X = ENGAWA_WEST_X + ENGAWA_LENGTH // = 0
/** 縁側前端 z */
export const ENGAWA_FRONT_Z = HOUSE_WALL_Z + ENGAWA_DEPTH // = -3.59
/** 軒先ライン z（壁から軒の出だけ南） */
export const EAVE_LINE_Z = HOUSE_WALL_Z + EAVE_OVERHANG // = -3.75
/** 雨落ちの砂利帯: 軒先直下、幅200mm */
export const RAIN_GRAVEL_W = 0.2

// ---------------------------------------------------------------------------
// 庭の外構
// ---------------------------------------------------------------------------
/** 板塀: 高さ1800、柱90角＠1間、貫45×90、板180×12、笠木45×120 */
export const FENCE_H = 1.8
export const FENCE_POST_SQ = 0.09
export const FENCE_POST_PITCH = KEN
export const FENCE_BOARD_W = 0.18
export const FENCE_BOARD_T = 0.012
export const FENCE_KASAGI_W = 0.12
export const FENCE_KASAGI_T = 0.045
/** 木戸の幅 */
export const GATE_W = 0.9

/** 四つ目垣: 高さ750、竹φ40 */
export const TAKEGAKI_H = 0.75
export const TAKEGAKI_BAMBOO_D = 0.04

/** 塀のライン: 東=x+5.2（高塀・隣家との境）、南=z+5.6（高塀＋木戸）、
 *  西=x-5.2（四つ目垣: 低くして西日を庭に入れる=夕景の必然） */
export const FENCE_EAST_X = 5.2
export const FENCE_SOUTH_Z = 5.6
export const FENCE_WEST_X = -5.2
/** 木戸の中心 x（南塀） */
export const GATE_CENTER_X = 3.2

// ---------------------------------------------------------------------------
// 飛石・沓脱石
// ---------------------------------------------------------------------------
/** 沓脱石: 600×400×露出200（縁側の半分の高さ=昇降の実用寸法）。
 *  雨落ちの砂利帯のすぐ外に据える。 */
export const KUTSUNUGI = { x: -1.82, z: -3.1, w: 0.6, d: 0.4, h: 0.2 }
/** 飛石: 径350〜450、露出30〜60mm、歩幅ピッチ約450mm */
export const TOBIISHI_D_MIN = 0.35
export const TOBIISHI_D_MAX = 0.45
export const TOBIISHI_EXPOSED_MIN = 0.03
export const TOBIISHI_EXPOSED_MAX = 0.06
/** 沓脱石から木戸へ、千鳥に振った制御点列 */
export const TOBIISHI_PATH: ReadonlyArray<{ x: number; z: number }> = [
  { x: -1.6, z: -2.75 },
  { x: -1.15, z: -2.2 },
  { x: -0.85, z: -1.55 },
  { x: -0.35, z: -1.05 },
  { x: 0.15, z: -0.5 },
  { x: 0.55, z: 0.2 },
  { x: 1.05, z: 0.8 },
  { x: 1.45, z: 1.5 },
  { x: 2.0, z: 2.1 },
  { x: 2.4, z: 2.85 },
  { x: 2.9, z: 3.6 },
  { x: 3.1, z: 4.4 },
  { x: 3.2, z: 5.1 },
]

// ---------------------------------------------------------------------------
// 菜園（西側=西日が最後まで当たる位置、農事の必然）
// ---------------------------------------------------------------------------
/** 畝: 幅900 × 長1800 × 高180、南北方向 */
export const BED_W = 0.9
export const BED_L = 1.8
export const BED_H = 0.18
export const BEDS: ReadonlyArray<{ id: string; x: number; z: number }> = [
  { id: 'bedA', x: -3.6, z: 2.2 },
  { id: 'bedB', x: -2.4, z: 2.2 },
]
/** 菜園と園路を仕切る四つ目垣のライン */
export const TAKEGAKI_X = -1.5
export const TAKEGAKI_Z_FROM = 0.6
export const TAKEGAKI_Z_TO = 5.6

/** 作物の植え付け位置（GameState.crops のidと1:1） */
export const CROPS: ReadonlyArray<{
  id: string
  kind: 'daikon' | 'negi' | 'tomato'
  x: number
  z: number
}> = [
  { id: 'daikon1', kind: 'daikon', x: -3.6, z: 1.65 },
  { id: 'daikon2', kind: 'daikon', x: -3.6, z: 2.2 },
  { id: 'daikon3', kind: 'daikon', x: -3.6, z: 2.75 },
  { id: 'negi1', kind: 'negi', x: -2.4, z: 1.75 },
  { id: 'tomato1', kind: 'tomato', x: -2.4, z: 2.75 },
]

// ---------------------------------------------------------------------------
// 点景（それぞれ役割を持つ）
// ---------------------------------------------------------------------------
/** 蹲踞: 手水鉢φ450×H300。縁側の東寄り、露地の作法通り家の近く */
export const TSUKUBAI = { x: 0.9, z: -2.5, d: 0.45, h: 0.3 }
/** 織部灯籠: 蹲を照らす定石の組合せ。竿120角、全高1200 */
export const LANTERN = { x: 1.35, z: -3.05, shaftSq: 0.12, h: 1.2 }
/** 柿の木: 幹φ180、樹高3.5m。西側=長い影を庭へ落とす */
export const KAKI_TREE = { x: -4.3, z: -0.9, trunkD: 0.18, height: 3.5 }
/** 道具ラック: 縁側の東、壁際 */
export const TOOL_RACK = { x: 1.6, z: -4.25 }
/** 如雨露の定位置（ラック脇）と、出しっぱなしの初期位置（菜園の縁） */
export const CAN_HOME = { x: TOOL_RACK.x - 0.75, z: TOOL_RACK.z + 0.45 }
export const CAN_OUT = { x: -1.95, z: 3.0 }
/** 柿の低枝の実へ手が届く立ち位置 */
export const KAKI_PICK = { x: -3.1, z: -0.4 }
/** 薪積み: 軒下（雨に濡れない=置き場の必然） */
export const FIREWOOD = { x: -4.7, z: -4.15, w: 1.2, d: 0.4, h: 0.9 }
/** 物干し: 東側、竿高1700 */
export const CLOTHES_POLE = { x1: 2.6, x2: 4.4, z: -2.2, h: 1.7 }
/** 盥: 蹲の脇 */
export const TARAI = { x: 0.35, z: -2.1, d: 0.45 }

// ---------------------------------------------------------------------------
// 歩行可能域とコライダー
// ---------------------------------------------------------------------------
export const WALKABLE: Bounds = {
  minX: FENCE_WEST_X + 0.15,
  maxX: FENCE_EAST_X - 0.15,
  minZ: ENGAWA_FRONT_Z + 0.05,
  maxZ: FENCE_SOUTH_Z - 0.15,
}

/** 静的コライダー（プレイヤー円 vs これら）。 */
export const COLLIDERS: readonly Collider[] = [
  // 縁側（含む家側全部）
  {
    kind: 'box',
    minX: HOUSE_WEST_X,
    maxX: HOUSE_EAST_X,
    minZ: -100,
    maxZ: ENGAWA_FRONT_Z,
  },
  // 沓脱石
  {
    kind: 'box',
    minX: KUTSUNUGI.x - KUTSUNUGI.w / 2,
    maxX: KUTSUNUGI.x + KUTSUNUGI.w / 2,
    minZ: KUTSUNUGI.z - KUTSUNUGI.d / 2,
    maxZ: KUTSUNUGI.z + KUTSUNUGI.d / 2,
  },
  // 畝
  ...BEDS.map(
    (b): Collider => ({
      kind: 'box',
      minX: b.x - BED_W / 2,
      maxX: b.x + BED_W / 2,
      minZ: b.z - BED_L / 2,
      maxZ: b.z + BED_L / 2,
    }),
  ),
  // 四つ目垣（線状: 薄い箱）
  {
    kind: 'box',
    minX: TAKEGAKI_X - 0.05,
    maxX: TAKEGAKI_X + 0.05,
    minZ: TAKEGAKI_Z_FROM,
    maxZ: TAKEGAKI_Z_TO,
  },
  // 蹲踞・灯籠・柿の木・盥
  { kind: 'circle', x: TSUKUBAI.x, z: TSUKUBAI.z, r: TSUKUBAI.d / 2 + 0.08 },
  { kind: 'circle', x: LANTERN.x, z: LANTERN.z, r: 0.22 },
  { kind: 'circle', x: KAKI_TREE.x, z: KAKI_TREE.z, r: KAKI_TREE.trunkD / 2 + 0.06 },
  { kind: 'circle', x: TARAI.x, z: TARAI.z, r: TARAI.d / 2 + 0.03 },
  // 薪積み
  {
    kind: 'box',
    minX: FIREWOOD.x - FIREWOOD.w / 2,
    maxX: FIREWOOD.x + FIREWOOD.w / 2,
    minZ: FIREWOOD.z - FIREWOOD.d / 2,
    maxZ: FIREWOOD.z + FIREWOOD.d / 2,
  },
  // 物干しの支柱2本
  { kind: 'circle', x: CLOTHES_POLE.x1, z: CLOTHES_POLE.z, r: 0.12 },
  { kind: 'circle', x: CLOTHES_POLE.x2, z: CLOTHES_POLE.z, r: 0.12 },
]

// ---------------------------------------------------------------------------
// 太陽（夕方の斜光に固定）
// ---------------------------------------------------------------------------
/** 太陽高度: 12°（長い影と暖色のレーキング光） */
export const SUN_ELEVATION = (12 * Math.PI) / 180
/** 太陽方位: 248°（西南西）。方位は北=0、時計回り。
 *  北緯35°の晩秋、高度12°の夕日の実際の方位（日没方位は約254°）。 */
export const SUN_AZIMUTH = (248 * Math.PI) / 180

/** 太陽の方向ベクトル（シーン→太陽へ向く単位ベクトル）。
 *  +X=東, +Z=南, 方位azは北(-Z)から時計回り。 */
export function sunDirection(): { x: number; y: number; z: number } {
  const cosEl = Math.cos(SUN_ELEVATION)
  return {
    x: Math.sin(SUN_AZIMUTH) * cosEl,
    y: Math.sin(SUN_ELEVATION),
    z: -Math.cos(SUN_AZIMUTH) * cosEl,
  }
}
