// カメラはすべてゲームが決める。自由カメラは無し。
// 「引きで空間 → 寄りで対象 → 断面 → 接写 → 抜けるところ」を演出として繋ぐ。
import * as THREE from 'three';
import { Ease } from '../core/tween.js';
import { noise2 } from '../core/rng.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = camera.position.clone();
    this.target = new THREE.Vector3(0, 0, 0);
    this.fov = camera.fov;
    this._from = { pos: this.pos.clone(), target: this.target.clone(), fov: this.fov };
    this._to = { pos: this.pos.clone(), target: this.target.clone(), fov: this.fov };
    this.t = 1;
    this.duration = 1;
    this.ease = Ease.inOutCubic;
    this.onComplete = null;
    this.sway = 1;
    this.time = 0;
    this.shake = 0;
  }

  snap(pos, target, fov = this.fov) {
    this.pos.copy(pos);
    this.target.copy(target);
    this.fov = fov;
    this._from = { pos: pos.clone(), target: target.clone(), fov };
    this._to = { pos: pos.clone(), target: target.clone(), fov };
    this.t = 1;
    this.apply();
  }

  moveTo(pos, target, { fov = this.fov, duration = 1.2, ease = Ease.inOutCubic, onComplete = null } = {}) {
    this._from = { pos: this.pos.clone(), target: this.target.clone(), fov: this.fov };
    this._to = { pos: pos.clone(), target: target.clone(), fov };
    this.t = 0;
    this.duration = Math.max(0.0001, duration);
    this.ease = ease;
    this.onComplete = onComplete;
  }

  get busy() {
    return this.t < 1;
  }

  addShake(v) {
    this.shake = Math.min(1, this.shake + v);
  }

  update(dt) {
    this.time += dt;
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const k = this.ease(this.t);
      this.pos.lerpVectors(this._from.pos, this._to.pos, k);
      this.target.lerpVectors(this._from.target, this._to.target, k);
      this.fov = this._from.fov + (this._to.fov - this._from.fov) * k;
      if (this.t >= 1 && this.onComplete) {
        const cb = this.onComplete;
        this.onComplete = null;
        cb();
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.apply();
  }

  apply() {
    const c = this.camera;
    c.position.copy(this.pos);
    if (this.sway > 0) {
      // ほんのり息づかい。手持ちカメラのような微細な揺れ
      const t = this.time;
      c.position.x += noise2(t * 0.35, 0.0) * 0.012 * this.sway;
      c.position.y += noise2(0.0, t * 0.31) * 0.010 * this.sway;
      c.position.z += noise2(t * 0.27, 3.3) * 0.010 * this.sway;
    }
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.05;
      c.position.x += (Math.random() - 0.5) * s;
      c.position.y += (Math.random() - 0.5) * s;
    }
    c.lookAt(this.target);
    if (Math.abs(c.fov - this.fov) > 0.001) {
      c.fov = this.fov;
      c.updateProjectionMatrix();
    }
  }
}

/**
 * 画面比に応じた寄りの調整。
 * 縦画面は横の視野が狭いので引く。極端な横長では縦が足りなくなるので少しだけ引く。
 * @param {number} aspect width / height
 * @param {'close'|'wide'} kind 寄りの絵か、空間を見せる絵か
 */
export function distanceScale(aspect, kind = 'close') {
  if (aspect >= 1) {
    return aspect > 1.9 ? Math.min(1.35, aspect / 1.9) : 1;
  }
  const k = kind === 'close' ? 0.78 : 1.02;
  const max = kind === 'close' ? 1.95 : 1.62;
  return Math.min(max, 1 / Math.max(0.3, aspect * k));
}
