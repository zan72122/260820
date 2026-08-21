import * as THREE from 'three';
import { LANE_LENGTH } from '../util/units';

export type CameraMode = 'aim' | 'roll' | 'deck';

/**
 * カメラリグ。構え（アイレベル背後）→ 追従 → ピンアクション。
 * 位置・注視点とも指数平滑で遷移（描画のみに影響、シミュには無関係）。
 */
export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3(0.2, 1.6, -4.4);
  private look = new THREE.Vector3(0, 0.3, 12);
  private targetPos = this.pos.clone();
  private targetLook = this.look.clone();
  mode: CameraMode = 'aim';

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setAim(ballX: number): void {
    this.mode = 'aim';
    this.targetPos.set(ballX * 0.55, 1.58, -4.4);
    this.targetLook.set(ballX * 0.25, 0.24, 14);
  }

  followBall(ballPos: { x: number; y: number; z: number }): void {
    this.mode = ballPos.z > LANE_LENGTH - 4.5 ? 'deck' : 'roll';
    if (this.mode === 'roll') {
      this.targetPos.set(ballPos.x * 0.45, 0.95, ballPos.z - 2.9);
      this.targetLook.set(ballPos.x * 0.75, 0.18, ballPos.z + 2.2);
    } else {
      // ピン手前でカメラを止めてピンアクションを見せる
      this.targetPos.set(ballPos.x * 0.3, 0.74, LANE_LENGTH - 5.1);
      this.targetLook.set(0, 0.3, LANE_LENGTH + 0.1);
    }
  }

  update(frameDt: number): void {
    const k = 1 - Math.exp(-frameDt * 3.2);
    this.pos.lerp(this.targetPos, k);
    this.look.lerp(this.targetLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  /** デバッグ用に固定アングルへ */
  setStatic(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.pos.copy(pos);
    this.look.copy(look);
    this.targetPos.copy(pos);
    this.targetLook.copy(look);
  }
}
