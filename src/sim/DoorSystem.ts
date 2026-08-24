import { ActivationField } from './ActivationField';
import { SafetyCurtain } from './SafetyCurtain';
import { DoorStateMachine } from './DoorStateMachine';
import { TrafficActor } from './TrafficActor';
import { v2 } from './types';

/**
 * センサー2系統と扉状態機械を束ねる、この試験施設の1枚の扉。
 *
 * 座標系: 扉線が z=0、通路(手前)が +z。扉中央が x=0。
 * 横切り廊下は z≈2.6 を x 方向に走る。
 */
export const DOOR_CLEAR_WIDTH = 2.0; // 有効開口幅 [m]
export const CROSS_LANE_Z = 2.6;

/** 誤設定: 俯角が浅すぎて領域が横切り廊下(z≈2.6)まで届いている */
export const MISCALIBRATED_DEPTH = 3.4;
/** 適正: 領域は扉手前 約1.9m で止まり、横切り廊下に届かない */
export const CALIBRATED_DEPTH = 1.9;
export const DEPTH_OK_MAX = 2.15;

export class DoorSystem {
  activation: ActivationField;
  curtain: SafetyCurtain;
  door: DoorStateMachine;
  /** 診断表示が有効か(表示のみ。判定には一切影響しない) */
  diagnosticsOn = false;

  constructor() {
    this.activation = new ActivationField({
      origin: v2(0, 0.15),
      depth: MISCALIBRATED_DEPTH,
      farWidth: 3.6,
      nearWidth: 2.2,
      minApproachSpeed: 0.12,
      dwellTime: 0.08,
    });
    this.curtain = new SafetyCurtain({
      center: v2(0, 0),
      width: DOOR_CLEAR_WIDTH,
      rowOffsets: [0.09, 0.3],
      spotsPerRow: 14,
      minHeight: 0.05,
    });
    this.door = new DoorStateMachine();
  }

  get calibrated(): boolean {
    return this.activation.params.depth <= DEPTH_OK_MAX;
  }

  update(dt: number, actors: TrafficActor[]): void {
    const snaps = actors.filter((a) => a.started).map((a) => a.snapshot());
    this.activation.update(dt, snaps);
    this.curtain.update(dt, snaps);
    this.door.update(dt, {
      activation: this.activation.triggered,
      curtain: this.curtain.occupied,
    });
  }

  reset(): void {
    this.activation.reset();
    this.curtain.reset();
    this.door.reset();
  }
}
