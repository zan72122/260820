// カメラ -- 自由操作なし。場面ごとに決めた位置へ滑らかに誘導する。
import * as THREE from '../vendor/three.module.js';

function damp(cur, target, smooth, dt) {
  if (smooth <= 0) return target;
  const l = 1 - Math.exp(-dt / (smooth * 0.5));
  return cur + (target - cur) * l;
}

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(2.6, 1.55, 3.0);
    this.look = new THREE.Vector3(0, 0.7, -0.2);
    this.tPos = this.pos.clone();
    this.tLook = this.look.clone();
    this.fov = 42; this.tFov = 42;
    this.smooth = 0.9;
    this.shakeAmt = 0; this.shakeT = 0;
    this.portrait = false;
    this._off = new THREE.Vector3();
    this.roll = 0; this.tRoll = 0;
  }
  /* shot: {pos:[x,y,z], look:[x,y,z], fov, smooth, roll} */
  set(shot, instant = false) {
    if (shot.pos) this.tPos.set(shot.pos[0], shot.pos[1], shot.pos[2]);
    if (shot.look) this.tLook.set(shot.look[0], shot.look[1], shot.look[2]);
    if (shot.fov !== undefined) this.tFov = shot.fov;
    this.wr = shot.wr !== undefined ? shot.wr : 0.72;
    if (shot.smooth !== undefined) this.smooth = shot.smooth;
    this.tRoll = shot.roll || 0;
    if (instant) { this.pos.copy(this.tPos); this.look.copy(this.tLook); this.fov = this.tFov; this.roll = this.tRoll; }
  }
  shake(power = 1) { this.shakeAmt = Math.min(1.5, this.shakeAmt + power); }
  update(dt, aspect) {
    this.pos.x = damp(this.pos.x, this.tPos.x, this.smooth, dt);
    this.pos.y = damp(this.pos.y, this.tPos.y, this.smooth, dt);
    this.pos.z = damp(this.pos.z, this.tPos.z, this.smooth, dt);
    this.look.x = damp(this.look.x, this.tLook.x, this.smooth, dt);
    this.look.y = damp(this.look.y, this.tLook.y, this.smooth, dt);
    this.look.z = damp(this.look.z, this.tLook.z, this.smooth, dt);
    this.fov = damp(this.fov, this.tFov, this.smooth, dt);
    this.roll = damp(this.roll, this.tRoll, this.smooth, dt);

    // どの画面比でも被写体が切れないよう距離を解き直す。
    // 構図は横 16:10 で作り、被写体の横幅は縦の wr 倍として扱う。
    const fov = this.fov;
    const vHalf = THREE.MathUtils.degToRad(fov) * 0.5;
    const asp = Math.max(0.35, Math.min(3.2, aspect));
    const hHalf = Math.atan(Math.tan(vHalf) * asp);
    this._off.copy(this.pos).sub(this.look);
    const d0 = this._off.length() || 1e-3;
    const ry = d0 * Math.sin(vHalf);                 // 縦に必要な半径
    const rx = ry * (this.wr || 0.72);               // 横に必要な半径
    const d1 = Math.min(d0 * 2.2, Math.max(d0, rx / Math.max(0.05, Math.sin(hHalf))));
    this._off.multiplyScalar(d1 / d0);
    this.cam.position.copy(this.look).add(this._off);
    // 縦持ちは足元が余るので画面を少し持ち上げる
    const lift = 0.10 * Math.min(1, Math.max(0, (1 - aspect) * 1.5));
    this.cam.position.y += lift;

    // 打撃の揺れ
    this.shakeT += dt;
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt;
      const s = 0.016 * a;
      this.cam.position.x += Math.sin(this.shakeT * 61) * s;
      this.cam.position.y += Math.sin(this.shakeT * 47 + 1.3) * s * 1.4;
      this.cam.position.z += Math.sin(this.shakeT * 53 + 2.1) * s * 0.6;
      this.shakeAmt *= Math.exp(-dt * 7.5);
    }
    this.cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    this._tmpLook = this._tmpLook || new THREE.Vector3();
    this._tmpLook.copy(this.look); this._tmpLook.y += lift;
    this.cam.lookAt(this._tmpLook);
    if (Math.abs(this.cam.fov - fov) > 0.001 || this.cam.aspect !== aspect) {
      this.cam.fov = fov; this.cam.aspect = aspect;
      this.cam.updateProjectionMatrix();
    }
  }
}
