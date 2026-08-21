// 実寸定数（メートル）。出典: USBC Equipment Specifications。
// 座標系: +Z がファウルラインからピンへ向かう投球方向、+Y が上（右手系）。
// +Z を向くボウラーから見て右は −X（板1側）、左は +X（板39側）。
// 原点 (0,0,0) はファウルライン中央・レーン表面の高さ。

export const IN = 0.0254;
export const FT = 0.3048;

/** レーン幅 41.5 in（39枚板） */
export const LANE_WIDTH = 41.5 * IN;
/** 板の枚数 */
export const BOARD_COUNT = 39;
/** 板1枚の幅 */
export const BOARD_WIDTH = LANE_WIDTH / BOARD_COUNT;
/** ファウルライン → 1番ピン中心 60 ft */
export const LANE_LENGTH = 60 * FT;
/** ピンデッキ後端まで（1番ピンの後ろ 34.19 in） */
export const PIN_DECK_EXTRA = 34.1875 * IN;
/** アプローチ長 15 ft */
export const APPROACH_LENGTH = 15 * FT;
/** ガター幅 9 5/16 in */
export const GUTTER_WIDTH = 9.3125 * IN;
/** ガター深さ（実測 ~1.875 in） */
export const GUTTER_DEPTH = 1.875 * IN;

/** ターゲットアローの先端位置（ファウルラインから、5枚目板基準で約14.5–15.5 ft） */
export const ARROW_Z = 15 * FT;
/** ガイドドット位置（レーン上、約7 ft） */
export const LANE_DOT_Z = 7 * FT;
/** アプローチドット列（ファウルライン手前 12 ft / 15 ft） */
export const APPROACH_DOTS_Z1 = -12 * FT;
export const APPROACH_DOTS_Z2 = -15 * FT + 2 * IN;

/** ボール直径 8.5 in、質量 15 lb */
export const BALL_RADIUS = (8.5 / 2) * IN;
export const BALL_MASS = 6.8;

/** ピン: 高さ15 in、腹の最大径 4.766 in、底面径 2.031 in、質量 3.5 lb、重心高 ~5.6 in */
export const PIN_HEIGHT = 15 * IN;
export const PIN_MAX_RADIUS = (4.766 / 2) * IN;
export const PIN_BASE_RADIUS = (2.031 / 2) * IN;
export const PIN_MASS = 1.58;
/** ピン中心間隔 12 in（正三角形配置） */
export const PIN_SPACING = 12 * IN;
/** ピン列の奥行き間隔 = 12 in × √3/2 */
export const PIN_ROW_DEPTH = PIN_SPACING * (Math.sqrt(3) / 2);

/** オイルパターン（ハウスショット）: 塗布長 ~40 ft、以降ドライ */
export const OIL_LENGTH = 40 * FT;

/**
 * ピン10本のローカル配置（1番ピン中心を z=LANE_LENGTH とする）。
 * 番号:      7 8 9 10
 *             4 5 6
 *              2 3
 *               1
 */
export function pinPositions(): { x: number; z: number }[] {
  const rows: number[][] = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]];
  const out: { x: number; z: number }[] = [];
  rows.forEach((xs, row) => {
    for (const fx of xs) {
      out.push({ x: fx * PIN_SPACING, z: LANE_LENGTH + row * PIN_ROW_DEPTH });
    }
  });
  return out;
}
