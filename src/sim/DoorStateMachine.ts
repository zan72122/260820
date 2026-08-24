/**
 * 自動引戸の状態機械。
 *
 * CLOSED → OPENING → OPEN → (HOLDING) → CLOSING → CLOSED
 * CLOSING 中に戸口保護が働くと OBSTRUCTION → REVERSING → OPEN。
 * CLOSING 中に接近検知が働くと REVERSING → OPEN(再開扉)。
 */
export type DoorState =
  | 'CLOSED'
  | 'OPENING'
  | 'OPEN'
  | 'HOLDING'
  | 'CLOSING'
  | 'OBSTRUCTION'
  | 'REVERSING';

export interface DoorInputs {
  /** 接近検知(作動センサー)が働いているか */
  activation: boolean;
  /** 戸口保護(安全カーテン)が遮られているか */
  curtain: boolean;
}

export interface DoorConfig {
  openSpeed: number; // 開速度 [開度/s]
  closeSpeed: number; // 閉速度 [開度/s]
  holdTime: number; // 全開保持時間 [s]
  obstructionPause: number; // 障害検知後、反転までの停止時間 [s]
}

export const DEFAULT_DOOR_CONFIG: DoorConfig = {
  openSpeed: 1 / 1.1,
  closeSpeed: 1 / 2.4, // 閉は開より遅い(実機の低リスク側閉速度)
  holdTime: 2.2,
  obstructionPause: 0.35,
};

export class DoorStateMachine {
  state: DoorState = 'CLOSED';
  /** 0=全閉, 1=全開 */
  position = 0;
  private holdTimer = 0;
  private pauseTimer = 0;
  private cfg: DoorConfig;
  /** 状態遷移の履歴(試験・演出用) */
  history: DoorState[] = ['CLOSED'];
  /** この試行中に一度でも開いたか */
  openedOnce = false;

  constructor(cfg: DoorConfig = DEFAULT_DOOR_CONFIG) {
    this.cfg = { ...cfg };
  }

  private transition(next: DoorState): void {
    if (this.state === next) return;
    this.state = next;
    this.history.push(next);
    if (this.history.length > 64) this.history.shift();
  }

  update(dt: number, inputs: DoorInputs): void {
    const c = this.cfg;
    switch (this.state) {
      case 'CLOSED':
        if (inputs.activation) this.transition('OPENING');
        break;

      case 'OPENING':
        this.position = Math.min(1, this.position + c.openSpeed * dt);
        this.openedOnce = true;
        if (this.position >= 1) {
          this.holdTimer = c.holdTime;
          this.transition('OPEN');
        }
        break;

      case 'OPEN':
        if (inputs.activation || inputs.curtain) {
          this.transition('HOLDING');
        } else {
          this.holdTimer -= dt;
          if (this.holdTimer <= 0) this.transition('CLOSING');
        }
        break;

      case 'HOLDING':
        if (!inputs.activation && !inputs.curtain) {
          this.holdTimer = c.holdTime;
          this.transition('OPEN');
        }
        break;

      case 'CLOSING':
        if (inputs.curtain) {
          this.pauseTimer = c.obstructionPause;
          this.transition('OBSTRUCTION');
          break;
        }
        if (inputs.activation) {
          this.transition('REVERSING');
          break;
        }
        this.position = Math.max(0, this.position - c.closeSpeed * dt);
        if (this.position <= 0) this.transition('CLOSED');
        break;

      case 'OBSTRUCTION':
        // 減速・停止ののち反転して全開へ
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) this.transition('REVERSING');
        break;

      case 'REVERSING':
        this.position = Math.min(1, this.position + c.openSpeed * dt);
        if (this.position >= 1) {
          this.holdTimer = c.holdTime;
          this.transition(inputs.curtain ? 'HOLDING' : 'OPEN');
        }
        break;
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.position = 0;
    this.holdTimer = 0;
    this.pauseTimer = 0;
    this.history = ['CLOSED'];
    this.openedOnce = false;
  }
}
