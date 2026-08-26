/**
 * 共有状態。映像・音響はすべてここの値だけを読む。
 * 「コン」と衝突フレームが同じ状態値で駆動されるのはこのため。
 */

export type Phase =
  | 'still' // 静けさ・空
  | 'filling' // ちょろちょろ / コポ
  | 'leaning' // 軸のキュッ（ゆっくり傾く）
  | 'tipping' // ゴクン（重心が支点を越えた）
  | 'dumping' // ザバッ
  | 'returning' // 戻り
  | 'ringing'; // コン → 余韻

export interface SimEvent {
  type:
    | 'gate-scrape' // 木と木の乾いた擦れ（stick-slip 1粒）
    | 'gate-breakaway' // 静止摩擦を越えた
    | 'first-water' // 隙間から最初の一筋
    | 'inlet-drip' // 竹筒入口の滴
    | 'gulp' // 筒内部の「コポ」
    | 'tip-start' // 重心が支点を越えた瞬間
    | 'dump-start' // 排水の立ち上がり
    | 'basin-splash' // 鉢の飛沫
    | 'backstop' // 筒が支持材へ当たる（鈍い）
    | 'impact' // 竹の末端が石へ「コン」
    | 'cycle-complete';
  tube: number;
  /** 事象の強さ（m/s 相当、または 0..1） */
  velocity: number;
  /** 竹の含水 0..1 */
  wetness: number;
  /** 打点の支点からの距離のばらつき -1..1 */
  contact: number;
  /** 秒。オーディオが映像より前に鳴らないよう now 基準で扱う */
  at: number;
}

export interface TubeState {
  index: number;
  active: boolean;
  /** 現れ方（0=無い 1=完全に設置済み） */
  presence: number;
  /** 竹の長さ m。余韻の長さと基音を決める */
  length: number;
  /** 内径 m */
  bore: number;

  waterMass: number; // kg
  capacity: number; // kg
  fillRatio: number; // 0..1（見た目・内部空洞の比率）
  angle: number; // rad
  angularVelocity: number; // rad/s
  pivotLoad: number; // N
  inflow: number; // kg/s（実際に筒へ入っている量）
  dumpRate: number; // kg/s
  impactVelocity: number; // m/s（最後の衝突）
  resonanceDecay: number; // 0..1 余韻の残り
  wetness: number; // 0..1
  cycleCount: number;
  phase: Phase;
  /** 直前の周期の長さ（秒）。予測遊びのために保持 */
  lastCycleTime: number;
  cycleTimer: number;
  sinceImpact: number;
}

export interface GardenState {
  time: number;
  /** 木製水門の開度 0..1 */
  gateOpening: number;
  /** 指と水門のずれ＝木部のたわみ -1..1 */
  gateStrain: number;
  gateSlipping: boolean;
  gateGrabbed: boolean;
  /** 0..1 正規化流量 */
  flowRate: number;
  /** 竹筒Aへ向かう割合 0..1（二本設置後のみ意味を持つ） */
  splitRatio: number;
  splitterPresence: number;
  /** 水路にたまった最初の一滴の震え 0..1 */
  firstDrop: number;
  everOpened: boolean;
  tubes: TubeState[];
  cycleCount: number;
  events: SimEvent[];
  /** 余韻中（新しいUI音を鳴らさない） */
  inAfterglow: boolean;
}

export const FLOW_MAX = 0.62; // kg/s（水門全開）

export function makeTube(index: number, length: number): TubeState {
  return {
    index,
    active: index === 0,
    presence: index === 0 ? 1 : 0,
    length,
    bore: 0.052 - index * 0.004,
    waterMass: 0,
    capacity: 1.28 - index * 0.34,
    fillRatio: 0,
    angle: REST_ANGLE,
    angularVelocity: 0,
    pivotLoad: 0,
    inflow: 0,
    dumpRate: 0,
    impactVelocity: 0,
    resonanceDecay: 0,
    wetness: 0.12,
    cycleCount: 0,
    phase: 'still',
    lastCycleTime: 0,
    cycleTimer: 0,
    sinceImpact: 99,
  };
}

export const REST_ANGLE = -0.185; // 末端が石に載っている角度
export const BACKSTOP_ANGLE = 0.60; // 支持材に当たる角度
export const SPILL_ANGLE = 0.235; // 口から水がこぼれ始める角度

export function createGardenState(): GardenState {
  return {
    time: 0,
    gateOpening: 0,
    gateStrain: 0,
    gateSlipping: false,
    gateGrabbed: false,
    flowRate: 0,
    splitRatio: 0.58,
    splitterPresence: 0,
    firstDrop: 0,
    everOpened: false,
    tubes: [makeTube(0, 0.64), makeTube(1, 0.47)],
    cycleCount: 0,
    events: [],
    inAfterglow: false,
  };
}
