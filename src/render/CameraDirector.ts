import * as THREE from 'three';

/**
 * カメラ鎖。自由回転はなく、名前付きショット間を滑らかに移動するだけ。
 * 基本は入口に対して25〜35度振った少し高い3/4。
 */
export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov?: number;
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export const SHOTS: Record<string, Shot> = {
  // 1. 二つの進路(横切り廊下と入口進路)を同時に見る全景
  wide: { pos: v(4.9, 3.1, 7.6), look: v(-0.4, 0.9, 0.6), fov: 46 },
  // 2. 横切るロボットと開く扉
  crossFocus: { pos: v(3.4, 2.0, 5.6), look: v(-0.8, 0.9, 1.6), fov: 44 },
  // 3. センサー筐体への短い上昇
  sensorRise: { pos: v(1.15, 2.35, 2.1), look: v(0, 2.22, 0.1), fov: 40 },
  // 4. 診断領域が床へ現れる俯瞰寄り3/4(天井の下に収める)
  diagTop: { pos: v(3.0, 3.8, 5.4), look: v(-0.2, 0, 1.2), fov: 50 },
  // 5. 角度リングと領域外縁を同時に見る
  calibrate: { pos: v(1.5, 2.7, 3.6), look: v(-0.1, 1.5, 0.4), fov: 47 },
  // 7. 戸口保護試験: 床セルと扉端を同時に見る低い中景
  curtainLow: { pos: v(2.9, 1.25, 3.1), look: v(-0.3, 0.75, 0), fov: 44 },
  // 経路描画用: やや高い俯瞰(指で床が見える)
  drawTop: { pos: v(2.2, 3.9, 6.1), look: v(-0.2, 0, 1.7), fov: 52 },
};

export class CameraDirector {
  camera: THREE.PerspectiveCamera;
  private from: Shot;
  private to: Shot;
  private t = 1;
  private duration = 1;
  current = 'wide';

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 60);
    this.from = this.to = SHOTS.wide;
    this.apply(SHOTS.wide, SHOTS.wide, 1);
  }

  goTo(name: keyof typeof SHOTS | string, duration = 1.6): void {
    const shot = SHOTS[name];
    if (!shot || name === this.current) return;
    this.from = {
      pos: this.camera.position.clone(),
      look: this.currentLook(),
      fov: this.camera.fov,
    };
    this.to = shot;
    this.t = 0;
    this.duration = Math.max(0.01, duration);
    this.current = name;
  }

  private lookTarget = new THREE.Vector3(0, 1, 0);

  private currentLook(): THREE.Vector3 {
    return this.lookTarget.clone();
  }

  private apply(a: Shot, b: Shot, k: number): void {
    const e = k * k * (3 - 2 * k); // smoothstep
    this.camera.position.lerpVectors(a.pos, b.pos, e);
    this.lookTarget.lerpVectors(a.look, b.look, e);
    this.camera.lookAt(this.lookTarget);
    const fovA = a.fov ?? 46;
    const fovB = b.fov ?? 46;
    this.camera.fov = fovA + (fovB - fovA) * e;
    this.camera.updateProjectionMatrix();
  }

  get settled(): boolean {
    return this.t >= 1;
  }

  update(dt: number): void {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      this.apply(this.from, this.to, this.t);
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
