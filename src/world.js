/**
 * 信濃川・長生橋のジオメトリ（単位はメートル、実測に寄せた概略値）
 *
 *   座標系: X = 右, Y = 上（水面が Y=0）, Z = 奥
 *   カメラは左岸の河川敷に立ち、対岸へ向かって +Z を見る。
 *   橋は画面を斜めに横切って奥へ抜ける（長生橋を下流側から見た構図）。
 */

export const WATER_Y = 0;

// 長生橋: 全長 約850m / 13連のトラス（三角形が連なる独特のシルエット）
export const BRIDGE = {
  ax: -315, ay: 0, az: 180,      // 手前側の端（画面左・カメラに近い）
  bx: 385, by: 0, bz: 660,       // 奥側の端（画面右・遠い）
  spans: 13,
  deckY: 24.0,                   // 路面の高さ（平水位から・見せ場のため実測よりやや高く）
  girderY: 20.5,                 // 桁下
  trussH: 17.0,                  // 路面からトラス頂点まで
  width: 9.4,                    // 幅員
  pierW: 5.0,
  pierBottom: 1.6,   // 水面ぎわで消す（手前の川面のほうがカメラに近いので、下は描かない）
};

// 軸ベクトル
const dxAxis = BRIDGE.bx - BRIDGE.ax;
const dzAxis = BRIDGE.bz - BRIDGE.az;
export const BRIDGE_LEN = Math.hypot(dxAxis, dzAxis);
export const AXIS = { x: dxAxis / BRIDGE_LEN, z: dzAxis / BRIDGE_LEN };
// 水平面内で軸に垂直（橋の幅方向）
export const NORMAL = { x: AXIS.z, z: -AXIS.x };

/** 橋の中心線上の点。t=0 が手前端、t=1 が奥端。side=-1/0/+1 で幅方向オフセット */
export function bridgePoint(t, y, side, out) {
  const hw = (BRIDGE.width * 0.5) * (side || 0);
  out.x = BRIDGE.ax + dxAxis * t + NORMAL.x * hw;
  out.y = y;
  out.z = BRIDGE.az + dzAxis * t + NORMAL.z * hw;
  return out;
}

/** ナイアガラの火薬筒は上流側（カメラから見て奥側の縁）に吊るされる */
export const NIAGARA_SIDE = -1;

// 正三尺玉の打ち上げ筒（対岸の河川敷、橋の向こう側）
export const LAUNCH = { x: 46, y: 0.5, z: 560 };
export const SHELL = {
  apex: 470,          // 開発高度（実際の正三尺玉は約600m）
  riseTime: 3.55,     // 昇り
  radius: 320,        // 開いた半径（直径 約640m ≒ 正三尺玉。星の速度ばらつきを含む）
};

// 遠景
export const FAR = {
  mountainZ: 5200,    // 東山連峰
  townZ: 1900,        // 対岸の街あかり
  townZ2: 2900,
};

/** カメラが立つ位置の目安（左岸の河川敷） */
export const BANK = { y: 7.5, z: -55 };
