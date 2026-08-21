import { BOARD_COUNT, FT, LANE_WIDTH, OIL_LENGTH } from '../util/units';

/**
 * ハウスショットの摩擦マップ μ(x, z)。
 * 手前〜32ftはオイル厚（中央ほど厚く、外板は薄い）、32〜40ftでテーパー、
 * それ以降のバックエンドはドライで一気に食いつく。
 */
export const MU_OIL_CENTER = 0.022;
export const MU_OIL_EDGE = 0.04;
export const MU_DRY = 0.125;

export function frictionAt(x: number, z: number): number {
  if (z < 0) return 0.2; // アプローチ
  const taperStart = OIL_LENGTH - 8 * FT;
  // 横方向: 板番号に換算し、外側(1-8, 32-39)は薄い
  const board = (x / LANE_WIDTH + 0.5) * BOARD_COUNT; // ボウラーの右端(x=-W/2)=0, 左端=39
  const edgeDist = Math.min(board, BOARD_COUNT - board); // 端からの板数
  const edgeFactor = Math.min(1, Math.max(0, (edgeDist - 5) / 6)); // 板5〜11で0→1
  const muOiled = MU_OIL_EDGE + (MU_OIL_CENTER - MU_OIL_EDGE) * edgeFactor;
  if (z <= taperStart) return muOiled;
  if (z >= OIL_LENGTH) return MU_DRY;
  const t = (z - taperStart) / (OIL_LENGTH - taperStart);
  return muOiled + (MU_DRY - muOiled) * (t * t * (3 - 2 * t));
}
