import * as THREE from 'three';
import { clamp, easeInOutSine } from '../util/math';
import type { BoatSway } from './sway';

export type ShotName =
  | 'EXTERIOR'
  | 'SEAT'
  | 'PLAY'
  | 'CUTAWAY'
  | 'CUTAWAY_HALF'
  | 'TIP_MACRO'
  | 'LINE_LOW'
  | 'REVEAL'
  | 'BUCKET';

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** 船の揺れをどれだけカメラに伝えるか */
  swayFactor: number;
}

function pose(px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov: number, swayFactor = 1): Pose {
  return {
    pos: new THREE.Vector3(px, py, pz),
    target: new THREE.Vector3(tx, ty, tz),
    fov,
    swayFactor
  };
}

/**
 * 自由カメラは使わない。決められたレール上のショットを滑らかに移動する。
 * 因果（魚→糸→穂先）の途中でカットしない：移動はすべて連続的な補間。
 */
export class CameraRail {
  camera: THREE.PerspectiveCamera;
  current: ShotName = 'EXTERIOR';
  private from: Pose;
  private to: Pose;
  private t = 1;
  private duration = 1;
  private time = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 260);
    const p = this.poseFor('EXTERIOR');
    this.from = p;
    this.to = p;
    this.apply(p, 0);
  }

  private poseFor(name: ShotName): Pose {
    const portrait = this.camera.aspect < 1;
    switch (name) {
      case 'EXTERIOR':
        return portrait
          ? pose(7.5, 2.1, 11.5, 0, 1.1, 0, 58, 0)
          : pose(8.5, 1.9, 10.0, 0, 1.0, 0, 50, 0);
      case 'SEAT':
        return portrait
          ? pose(0.4, 1.45, 2.15, 0, 0.32, -0.5, 62, 1)
          : pose(0.55, 1.3, 2.0, 0, 0.42, -0.4, 55, 1);
      case 'PLAY':
        // 近景リール、中景釣り口、遠景に窓外。縦は穂先・釣り口を上下に重ねる
        return portrait
          ? pose(0.3, 0.85, 1.3, 0.0, 0.02, -0.48, 62, 1)
          : pose(0.38, 0.78, 1.3, -0.02, 0.08, -0.45, 52, 1);
      case 'CUTAWAY':
        // 水面を横切る上下カットアウェイ。上に穂先、下に糸と餌
        return portrait
          ? pose(1.6, -0.35, 0.3, 0, -0.38, 0.12, 66, 0.25)
          : pose(1.85, -0.3, 0.28, 0, -0.34, 0.1, 58, 0.25);
      case 'CUTAWAY_HALF':
        return portrait
          ? pose(1.15, -0.12, 0.32, 0, -0.2, 0.1, 54, 0.3)
          : pose(1.4, -0.1, 0.3, 0, -0.18, 0.1, 48, 0.3);
      case 'TIP_MACRO':
        return portrait
          ? pose(0.26, 0.52, 0.42, 0, 0.345, 0.02, 46, 1)
          : pose(0.3, 0.5, 0.38, 0, 0.35, 0.02, 42, 1);
      case 'LINE_LOW':
        // リールから釣り口までの糸を追う低いカメラ
        return portrait
          ? pose(0.34, 0.34, 0.86, -0.05, 0.1, 0.05, 58, 1)
          : pose(0.42, 0.32, 0.8, -0.05, 0.12, 0.05, 50, 1);
      case 'REVEAL':
        // 釣り口を覗き込み、魚が水面を割るのを見る
        return portrait
          ? pose(0.2, 0.42, 0.44, 0, -0.2, -0.01, 52, 0.6)
          : pose(0.26, 0.38, 0.4, 0, -0.18, -0.01, 46, 0.6);
      case 'BUCKET':
        return portrait
          ? pose(-0.12, 0.6, 0.88, -0.52, 0.13, 0.3, 52, 1)
          : pose(-0.06, 0.55, 0.85, -0.52, 0.13, 0.3, 46, 1);
    }
  }

  /** 現在のショットへ到着済みか */
  get settled() {
    return this.t >= 1;
  }

  goTo(name: ShotName, duration = 1.6) {
    if (name === this.current && this.t >= 1) return;
    this.from = this.capture();
    this.to = this.poseFor(name);
    this.current = name;
    this.duration = Math.max(0.05, duration);
    this.t = 0;
  }

  private capture(): Pose {
    return {
      pos: this.camera.position.clone(),
      target: this.lastTarget.clone(),
      fov: this.camera.fov,
      swayFactor: this.lastSwayFactor
    };
  }

  private lastTarget = new THREE.Vector3();
  private lastSwayFactor = 0;

  onResize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // 現ショットの構図を新しい縦横比で取り直す
    this.to = this.poseFor(this.current);
    if (this.t >= 1) this.from = this.to;
  }

  private apply(p: Pose, swayOffset: number) {
    this.camera.position.copy(p.pos);
    this.camera.lookAt(p.target);
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, sway: BoatSway) {
    this.time += dt;
    if (this.t < 1) this.t = clamp(this.t + dt / this.duration, 0, 1);
    const e = easeInOutSine(this.t);
    const pos = new THREE.Vector3().lerpVectors(this.from.pos, this.to.pos, e);
    const target = new THREE.Vector3().lerpVectors(this.from.target, this.to.target, e);
    const fov = this.from.fov + (this.to.fov - this.from.fov) * e;
    const swayF = this.from.swayFactor + (this.to.swayFactor - this.from.swayFactor) * e;

    // 船の揺れ＋手持ちのごく小さな呼吸
    const t = this.time;
    pos.y += sway.heave * swayF + Math.sin(t * 0.9) * 0.004 * swayF;
    pos.x += Math.sin(t * 0.53) * 0.003 * swayF;
    target.y += sway.heave * swayF * 0.7;
    const rollBank = sway.rollZ * swayF;

    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.rotation.z += rollBank;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.lastTarget.copy(target);
    this.lastSwayFactor = swayF;

    // 外景ショットはゆっくりドリフト
    if (this.current === 'EXTERIOR' && this.t >= 1) {
      const a = t * 0.02;
      this.camera.position.x += Math.sin(a) * 0.5;
      this.camera.position.z += Math.cos(a * 0.8) * 0.3;
      this.camera.lookAt(this.lastTarget);
    }
  }
}
