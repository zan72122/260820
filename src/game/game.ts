import type * as THREE from 'three';
import { BALL_RADIUS, LANE_WIDTH } from '../util/units';
import type { PhysicsWorld, ThrowParams } from '../physics/world';
import { BowlingGame } from './scoring';
import { computeThrow, type SwingInput, type SwingSample } from '../input/swing';
import type { Hud } from '../ui/hud';
import type { CameraRig } from '../scene/cameraRig';

export type GameState = 'aim' | 'rolling' | 'swept' | 'over';

interface Deps {
  physics: PhysicsWorld;
  ballMesh: THREE.Mesh;
  pinMeshes: THREE.Mesh[];
  hud: Hud;
  swing: SwingInput;
  rig: CameraRig;
}

const STAGE_Z = -0.6;
const SETTLE_MIN_STEPS = 240; // 2秒は必ず流す
const ROLL_TIMEOUT_STEPS = 14 * 120;
const SWEEP_STEPS = 110;

/**
 * ゲーム進行の統括。物理は固定ステップ、演出は描画フレームで進む。
 * 状態遷移はすべてシミュレーション時間基準（E2Eが論理時間で再現できる）。
 */
export class Game {
  state: GameState = 'aim';
  score = new BowlingGame();
  private d: Deps;
  /** 右投げの自然な立ち位置（板10付近 = ボウラーの右寄り = -x） */
  private aimX = -0.2;
  private throwStartStep = 0;
  private sweepStartStep = 0;
  private standingBefore = 10;
  private standingFlags: boolean[] = Array(10).fill(true);

  constructor(deps: Deps) {
    this.d = deps;
    deps.swing.onRelease = (s) => this.release(s);
    deps.swing.enabled = true;
    deps.physics.rackPins();
    deps.physics.stageBall();
    deps.rig.setAim(this.aimX);
    deps.hud.update(this.score.frames(), 0);
    deps.hud.setHint('ドラッグして手前に引き、前へ振り抜いて投球（横の払いでフック）');
  }

  /** 固定Δtステップ（物理・進行） */
  fixedStep(): void {
    if (this.state === 'rolling') {
      this.d.physics.step();
      const since = this.d.physics.steps - this.throwStartStep;
      if ((since > SETTLE_MIN_STEPS && this.d.physics.isSettled()) || since > ROLL_TIMEOUT_STEPS) {
        this.tally();
      }
    } else if (this.state === 'swept') {
      this.d.physics.step();
      if (this.d.physics.steps - this.sweepStartStep > SWEEP_STEPS) {
        this.nextRoll();
      }
    }
  }

  /** 描画フレーム（メッシュ同期・カメラ・構え演出） */
  frame(frameDt: number): void {
    const bp = this.d.physics.ballPose();
    if (bp.enabled) {
      this.d.ballMesh.position.set(bp.position.x, bp.position.y, bp.position.z);
      this.d.ballMesh.quaternion.set(bp.rotation.x, bp.rotation.y, bp.rotation.z, bp.rotation.w);
      if (this.state === 'rolling') this.d.rig.followBall(bp.position);
    } else {
      // 構え中: ポインタxに追従
      if (this.d.swing.phase === 'dragging') {
        // 画面右へのドラッグ = ボウラーの右（-x）
        const nx = (0.5 - this.d.swing.currentX) * (LANE_WIDTH + 0.5);
        this.aimX = Math.max(-LANE_WIDTH / 2 + 0.11, Math.min(LANE_WIDTH / 2 - 0.11, nx));
      }
      const p = this.d.ballMesh.position;
      p.x += (this.aimX - p.x) * Math.min(1, frameDt * 10);
      p.y = BALL_RADIUS;
      p.z = STAGE_Z;
      if (this.state === 'aim') this.d.rig.setAim(this.aimX);
    }
    // ピン同期
    const poses = this.d.physics.pinPoses();
    poses.forEach((pose, i) => {
      const m = this.d.pinMeshes[i]!;
      m.visible = pose.enabled;
      if (pose.enabled) {
        m.position.set(pose.position.x, pose.position.y, pose.position.z);
        m.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      }
    });
    this.d.rig.update(frameDt);
  }

  private release(samples: SwingSample[]): void {
    if (this.state !== 'aim') return;
    const params = computeThrow(samples, this.aimX);
    if (!params) return;
    this.throw_(params);
  }

  /** E2E・デバッグ用の直接投球 */
  throw_(params: ThrowParams): void {
    if (this.state !== 'aim') return;
    this.standingBefore = this.d.physics.standingCount();
    this.d.physics.throwBall(params);
    this.throwStartStep = this.d.physics.steps;
    this.state = 'rolling';
    this.d.swing.enabled = false;
    this.d.hud.setHint('');
  }

  private tally(): void {
    const poses = this.d.physics.pinPoses();
    this.standingFlags = poses.map((p) => p.standing);
    const standingNow = this.standingFlags.filter(Boolean).length;
    const pinsDown = Math.max(0, this.standingBefore - standingNow);
    const firstOfFrame = this.score.rollInFrame === 0;
    this.score.addRoll(pinsDown);
    this.d.hud.update(this.score.frames(), Math.min(this.score.frame, 9));

    const bp = this.d.physics.ballPose();
    const gutter = Math.abs(bp.position.x) > LANE_WIDTH / 2 && pinsDown === 0;
    if (pinsDown === 10 && firstOfFrame) this.d.hud.showMessage('ストライク！');
    else if (standingNow === 0 && !firstOfFrame) this.d.hud.showMessage('スペア！');
    else if (gutter) this.d.hud.showMessage('ガター…');
    else if (pinsDown === 0) this.d.hud.showMessage('残念…');

    this.state = 'swept';
    this.sweepStartStep = this.d.physics.steps;
  }

  private nextRoll(): void {
    if (this.score.isOver()) {
      this.state = 'over';
      this.d.hud.showMessage(`ゲーム終了  スコア ${this.score.total()}`, 60000);
      this.d.hud.setHint('クリックで新しいゲーム');
      const restart = (): void => {
        window.removeEventListener('pointerdown', restart);
        this.restart();
      };
      window.addEventListener('pointerdown', restart);
      return;
    }
    if (this.score.needsFullRack()) {
      this.d.physics.rackPins();
    } else {
      // デッドウッドだけ撤去。立っているピンは現位置のまま（実機のピンセッター同様）
      this.d.physics.clearDeadwood(this.standingFlags);
    }
    this.d.physics.stageBall();
    this.state = 'aim';
    this.d.swing.enabled = true;
    this.d.rig.setAim(this.aimX);
    this.d.hud.setHint('ドラッグして投球');
  }

  private restart(): void {
    this.score = new BowlingGame();
    this.d.physics.rackPins();
    this.d.physics.stageBall();
    this.state = 'aim';
    this.d.swing.enabled = true;
    this.d.hud.update(this.score.frames(), 0);
    this.d.hud.showMessage('', 1);
    this.d.hud.setHint('ドラッグして投球');
  }
}
