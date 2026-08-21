/** 10フレーム制ボウリングの正規スコアリング（純ロジック） */

export interface FrameView {
  /** このフレームの投球（倒したピン数） */
  rolls: number[];
  /** 確定した累計スコア。未確定は null */
  cumulative: number | null;
}

export function isStrike(rolls: number[], i: number): boolean {
  return rolls[i] === 10;
}

/** 投球列から各フレームの表示情報を計算 */
export function computeFrames(rolls: number[]): FrameView[] {
  const frames: FrameView[] = [];
  let i = 0;
  let cum = 0;
  let pending = false;
  for (let f = 0; f < 10; f++) {
    if (f < 9) {
      if (rolls[i] === undefined) {
        frames.push({ rolls: [], cumulative: null });
        pending = true;
        i += 0;
        continue;
      }
      if (isStrike(rolls, i)) {
        const bonus1 = rolls[i + 1];
        const bonus2 = rolls[i + 2];
        const frameRolls = [10];
        if (!pending && bonus1 !== undefined && bonus2 !== undefined) {
          cum += 10 + bonus1 + bonus2;
          frames.push({ rolls: frameRolls, cumulative: cum });
        } else {
          frames.push({ rolls: frameRolls, cumulative: null });
          pending = true;
        }
        i += 1;
      } else {
        const r1 = rolls[i]!;
        const r2 = rolls[i + 1];
        if (r2 === undefined) {
          frames.push({ rolls: [r1], cumulative: null });
          pending = true;
          i += 1;
          continue;
        }
        if (r1 + r2 === 10) {
          const bonus = rolls[i + 2];
          if (!pending && bonus !== undefined) {
            cum += 10 + bonus;
            frames.push({ rolls: [r1, r2], cumulative: cum });
          } else {
            frames.push({ rolls: [r1, r2], cumulative: null });
            pending = true;
          }
        } else if (!pending) {
          cum += r1 + r2;
          frames.push({ rolls: [r1, r2], cumulative: cum });
        } else {
          frames.push({ rolls: [r1, r2], cumulative: null });
        }
        i += 2;
      }
    } else {
      // 10フレーム目: 最大3投
      const fr = rolls.slice(i, i + 3);
      const done =
        fr.length === 3 || (fr.length === 2 && fr[0]! !== 10 && fr[0]! + fr[1]! < 10);
      if (!pending && done) {
        cum += fr.reduce((a, b) => a + b, 0);
        frames.push({ rolls: fr, cumulative: cum });
      } else {
        frames.push({ rolls: fr, cumulative: null });
      }
    }
  }
  return frames;
}

export function totalScore(rolls: number[]): number | null {
  const frames = computeFrames(rolls);
  return frames[9]!.cumulative;
}

/**
 * ゲーム進行。投球結果を積み、次投のラック状態とゲーム終了を判定する。
 */
export class BowlingGame {
  readonly rolls: number[] = [];
  /** 現在のフレーム番号 0-9 */
  frame = 0;
  /** フレーム内の投球番号 0始まり */
  rollInFrame = 0;

  /** 次の投球がフルラック（10本）で始まるか */
  needsFullRack(): boolean {
    if (this.frame < 9) return this.rollInFrame === 0;
    // 10フレーム目: 1投目、またはストライク/スペア直後
    if (this.rollInFrame === 0) return true;
    const fr = this.rolls.slice(this.tenthStart());
    if (this.rollInFrame === 1) return fr[0] === 10;
    return fr[0] === 10 ? fr[1] === 10 || fr[0]! + fr[1]! - 10 === 10 : fr[0]! + fr[1]! === 10;
  }

  private tenthStart(): number {
    // 10フレーム目開始時点の投球index
    let i = 0;
    for (let f = 0; f < 9; f++) {
      if (this.rolls[i] === undefined) return this.rolls.length;
      i += this.rolls[i] === 10 ? 1 : 2;
    }
    return i;
  }

  addRoll(pins: number): void {
    this.rolls.push(pins);
    if (this.frame < 9) {
      if (pins === 10 || this.rollInFrame === 1) {
        this.frame++;
        this.rollInFrame = 0;
      } else {
        this.rollInFrame = 1;
      }
    } else {
      this.rollInFrame++;
    }
  }

  isOver(): boolean {
    if (this.frame < 9) return false;
    const fr = this.rolls.slice(this.tenthStart());
    if (fr.length >= 3) return true;
    if (fr.length === 2) return fr[0]! !== 10 && fr[0]! + fr[1]! < 10;
    return false;
  }

  frames(): FrameView[] {
    return computeFrames(this.rolls);
  }

  total(): number | null {
    return totalScore(this.rolls);
  }
}
