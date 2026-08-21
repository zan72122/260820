import type { RigJoints } from './PlayerRig'
import { HIPS_H, SHIN_LEN, THIGH_LEN } from './PlayerRig'

/** 歩幅（1歩）。ケイデンスはここから導出され、足滑りを防ぐ。 */
export const STRIDE = 0.45
/** 1サイクル（2歩）で進む距離 */
export const CYCLE_LEN = STRIDE * 2

/** 最大振りで支持脚の足裏が接地するために必要な腰の沈み量（脚長から導出） */
const LEG_LEN = THIGH_LEN + SHIN_LEN
const MAX_SWING = 0.49
const BOB = LEG_LEN * (1 - Math.cos(MAX_SWING))

/**
 * 歩行ポーズ（純関数）: phase は 0..2π で1サイクル（2歩）。
 * - 股関節 ±28°の正弦、遊脚は膝を畳んで足先を地面から抜く
 * - 接地脚の膝は伸び、体は倍周波数で 25mm 上下
 * - 腕は逆位相 ±20°、速度に応じて僅かに前傾
 * すべて回転と腰の上下のみで、足が地面を割らないことはテストで保証。
 */
export function applyWalkPose(
  j: RigJoints,
  phase: number,
  speed: number,
  accelLean = 0,
): void {
  const walk = Math.min(1, speed / 1.4)

  const legSwing = MAX_SWING * walk // ±28°
  const sinP = Math.sin(phase)

  j.thighL.rotation.x = sinP * legSwing
  j.thighR.rotation.x = -sinP * legSwing

  // 膝: 遊脚だけ畳み、ミッドスイング（腿が体の真下を通る時）に最大。
  // 支持脚は伸びたまま体重を受ける。離地の瞬間につま先が土を掠るのは
  // 実際の歩行の toe-off と同じ。
  const swingProgL = ((phase - Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / Math.PI
  const flexL = swingProgL < 1 ? Math.sin(swingProgL * Math.PI) * walk : 0
  const swingProgR = ((phase + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / Math.PI
  const flexR = swingProgR < 1 ? Math.sin(swingProgR * Math.PI) * walk : 0
  j.kneeL.rotation.x = -flexL * 1.15
  j.kneeR.rotation.x = -flexR * 1.15
  // 足首: 接地はフラット、遊脚はつま先を僅かに上げる
  j.footL.rotation.x = flexL * 0.45
  j.footR.rotation.x = flexR * 0.45

  // 腰の上下（倍周波数）: 開脚の瞬間が最も低い。振り幅は脚長から
  // 導出しているので、支持脚の足裏は常に接地する。
  j.hips.position.y =
    HIPS_H - BOB * walk * (1 - Math.abs(Math.cos(phase)) * Math.abs(Math.cos(phase)))
  j.hips.rotation.z = Math.sin(phase) * 0.035 * walk

  // 腕: 脚と逆位相
  const armSwing = 0.35 * walk
  j.shoulderL.rotation.x = -sinP * armSwing
  j.shoulderR.rotation.x = sinP * armSwing
  j.elbowL.rotation.x = -Math.max(0, -sinP) * 0.35 * walk
  j.elbowR.rotation.x = -Math.max(0, sinP) * 0.35 * walk

  // 前傾＋歩行の肩の振り
  j.spine.rotation.x = 0.06 * walk + accelLean
  j.spine.rotation.y = -Math.sin(phase) * 0.06 * walk
  // 帽子ごと頭は水平を保とうとする（体の前傾を打ち消す）
  j.head.rotation.x = -0.05 * walk - accelLean * 0.6
}

/** 静止時の佇まい: 呼吸のゆらぎ。 */
export function applyIdlePose(j: RigJoints, timeSec: number): void {
  const b = Math.sin(timeSec * 1.9)
  j.hips.position.y = HIPS_H
  j.hips.rotation.z = 0
  j.spine.rotation.x = 0.02 + b * 0.008
  j.spine.rotation.y = 0
  j.head.rotation.x = -0.01
  j.thighL.rotation.x = 0
  j.thighR.rotation.x = 0
  j.kneeL.rotation.x = 0
  j.kneeR.rotation.x = 0
  j.footL.rotation.x = 0
  j.footR.rotation.x = 0
  j.shoulderL.rotation.x = 0.04 + b * 0.006
  j.shoulderR.rotation.x = 0.04 + b * 0.006
  j.shoulderL.rotation.z = 0.06
  j.shoulderR.rotation.z = -0.06
  j.elbowL.rotation.x = -0.12
  j.elbowR.rotation.x = -0.12
}
