import { ActorBehavior, ActorKind, ACTOR_PROFILES, ActorProfile } from './TrafficActor';
import { CROSS_LANE_Z } from './DoorSystem';
import { Vec2, v2 } from './types';

/**
 * 五回の試験。各回で変えるのは一つの変数だけ。
 *  1. 方向   — 横切る配送ロボット(導入・調律)
 *  2. 速度   — 入口へゆっくり進む無人車椅子テスト台
 *  3. 高さ   — 背の低い小型台車
 *  4. 停止位置 — 戸口で一度停止してから後退するテスト台
 *  5. 台数   — 二つの経路が同時に近づく
 */
export interface TrialActorDef {
  kind: ActorKind;
  behavior: ActorBehavior;
  /** 既定経路(子どもが描かない場合や演出で使用) */
  defaultPath: Vec2[];
  /** 経路描画の開始ゾーン中心 */
  spawn: Vec2;
}

export interface TrialDef {
  id: number;
  variable: '方向' | '速度' | '高さ' | '停止位置' | '台数';
  title: string;
  actors: TrialActorDef[];
  /** 子どもが経路を描けるか(1回目は脚本演出) */
  drawable: boolean;
}

/** 横切り: 左から右へ、扉線の手前 z=CROSS_LANE_Z を直進 */
export const crossingPath = (z = CROSS_LANE_Z): Vec2[] => [v2(-5.2, z), v2(5.2, z)];

/** 入口へ: 横切り廊下の側から曲がって扉中央へ */
export const enterPath = (): Vec2[] => [v2(-4.6, CROSS_LANE_Z), v2(-1.2, CROSS_LANE_Z), v2(0, 1.4), v2(0, -1.6)];

/** 正面からまっすぐ入口へ */
export const straightInPath = (fromZ = 5): Vec2[] => [v2(0.2, fromZ), v2(0, -1.8)];

/** 戸口まで進んで止まる(そこで behavior が停止/後退を決める) */
export const toThresholdPath = (): Vec2[] => [v2(-0.3, 4.6), v2(0, 0.1), v2(0, -1.6)];

const p = (kind: ActorKind, behavior: ActorBehavior): ActorProfile => ({
  ...ACTOR_PROFILES[kind],
  behavior,
});

export const TRIALS: TrialDef[] = [
  {
    id: 1,
    variable: '方向',
    title: '横切る配送ロボット',
    drawable: false,
    actors: [
      {
        kind: 'deliveryRobot',
        behavior: { type: 'pass' },
        defaultPath: crossingPath(),
        spawn: v2(-5.2, CROSS_LANE_Z),
      },
    ],
  },
  {
    id: 2,
    variable: '速度',
    title: 'ゆっくり進む無人車椅子テスト台',
    drawable: true,
    actors: [
      {
        kind: 'wheelchairRig',
        behavior: { type: 'pass' },
        defaultPath: straightInPath(),
        spawn: v2(0.2, 5),
      },
    ],
  },
  {
    id: 3,
    variable: '高さ',
    title: '背の低い小型台車',
    drawable: true,
    actors: [
      {
        kind: 'lowCart',
        behavior: { type: 'pass' },
        defaultPath: straightInPath(4.8),
        spawn: v2(0.2, 4.8),
      },
    ],
  },
  {
    id: 4,
    variable: '停止位置',
    title: '戸口で止まって戻るテスト台',
    drawable: true,
    actors: [
      {
        kind: 'foamBody',
        behavior: { type: 'stopThenRetreat', stopAt: -1, stopFor: 3.2 },
        defaultPath: toThresholdPath(),
        spawn: v2(-0.3, 4.6),
      },
    ],
  },
  {
    id: 5,
    variable: '台数',
    title: '二つの経路が同時に近づく',
    drawable: true,
    actors: [
      {
        kind: 'deliveryRobot',
        behavior: { type: 'pass' },
        defaultPath: crossingPath(),
        spawn: v2(-5.2, CROSS_LANE_Z),
      },
      {
        kind: 'wheelchairRig',
        behavior: { type: 'pass' },
        defaultPath: straightInPath(),
        spawn: v2(0.2, 5),
      },
    ],
  },
];

export function makeProfile(def: TrialActorDef): ActorProfile {
  return p(def.kind, def.behavior);
}
