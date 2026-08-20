import { clamp, spring } from './math.js';

/**
 * シフトレンズ型のピンホールカメラ。
 *  - ヨー回転を持たず、縦は「あおり（principal point のシフト）」で作る。
 *    → 垂直線が常に垂直に写る。建築夜景写真と同じ画づくりになる。
 *  - 水面 Y=0 の鏡像は (X, -Y, Z) をそのまま投影すれば正しい位置に出る。
 */
export class Camera {
  constructor() {
    this.x = 0; this.y = 7.5; this.z = -55;
    this.f = 500; this.tilt = 0;      // tilt: 水平線の中心からの px オフセット（+で下がる）
    this.vx = 0; this.vy = 0; this.vz = 0; this.vf = 0; this.vt = 0;
    this.logF = Math.log(this.f);
    this.W = 1; this.H = 1; this.cx = 0.5; this.cy = 0.5;
    this.shx = 0; this.shy = 0;
    this.shake = 0; this.shakeSeed = 0;
    this.cyT = 0;
  }

  setViewport(w, h) { this.W = w; this.H = h; this.cx = w * 0.5; this.cy = h * 0.5; this.sync(); }
  sync() { this.cyT = this.cy + this.tilt + this.shy; }

  horizonY() { return this.cy + this.tilt + this.shy; }

  /** 1点を投影。奥行きが浅すぎる/後方なら false */
  project(X, Y, Z, out) {
    const dz = Z - this.z;
    if (dz < 2) { out.ok = false; return out; }
    const s = this.f / dz;
    out.x = this.cx + (X - this.x) * s + this.shx;
    out.y = this.cyT - (Y - this.y) * s;
    out.s = s; out.ok = true;
    return out;
  }
  /** 水面での鏡像 */
  projectMirror(X, Y, Z, out) { return this.project(X, -Y, Z, out); }

  /**
   * 与えた世界点がすべて画面に収まるように f / x / tilt を決める。
   * 縦横比に依存せず「決定的な引きの絵」を保証するための中核。
   */
  fit(pts, opt = {}) {
    const mx = opt.marginX ?? 0.07, my = opt.marginY ?? 0.09;
    const availW = this.W * (1 - mx * 2);
    const availH = this.H * (1 - my * 2);
    const camY = opt.y ?? this.y, camZ = opt.z ?? this.z;

    let camX = opt.x ?? 0;
    let f = 500, centerV = 0;

    for (let it = 0; it < 14; it++) {
      let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9, sumInv = 0, n = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dz = p.z - camZ;
        if (dz < 5) continue;
        const inv = 1 / dz;
        const u = (p.x - camX) * inv;
        const v = (p.y - camY) * inv;
        if (u < minU) minU = u; if (u > maxU) maxU = u;
        if (v < minV) minV = v; if (v > maxV) maxV = v;
        sumInv += inv; n++;
      }
      if (!n) break;
      const spanU = Math.max(1e-4, maxU - minU);
      const spanV = Math.max(1e-4, maxV - minV);
      f = Math.min(availW / spanU, availH / spanV);
      if (opt.maxF) f = Math.min(f, opt.maxF);
      if (opt.minF) f = Math.max(f, opt.minF);
      centerV = (maxV + minV) * 0.5;
      if (opt.x === undefined) {
        const centerU = (maxU + minU) * 0.5;
        camX += centerU / (sumInv / n);
      }
    }

    // 縦方向：内容の中心を画面中心（+ bias）に置くようにあおる
    let tilt = f * centerV + (opt.biasY ?? 0) * this.H;
    // 水平線の位置は行き過ぎないよう抑える
    const hMin = (opt.horizonMin ?? 0.42) - 0.5, hMax = (opt.horizonMax ?? 0.86) - 0.5;
    tilt = clamp(tilt, hMin * this.H, hMax * this.H);
    return { f, x: camX, tilt, y: camY, z: camZ };
  }

  /** 目標へばねで追従（カットを作らない） */
  approach(target, dt, omega = 2.0) {
    const o = omega;
    [this.x, this.vx] = spring(this.x, this.vx, target.x, o, dt);
    [this.y, this.vy] = spring(this.y, this.vy, target.y, o, dt);
    [this.z, this.vz] = spring(this.z, this.vz, target.z, o, dt);
    [this.tilt, this.vt] = spring(this.tilt, this.vt, target.tilt, o, dt);
    const lt = Math.log(Math.max(20, target.f));
    [this.logF, this.vf] = spring(this.logF, this.vf, lt, o, dt);
    this.f = Math.exp(this.logF);
    this.sync();
  }

  /** 即時セット（章の開始時のみ） */
  snap(target) {
    this.x = target.x; this.y = target.y; this.z = target.z;
    this.tilt = target.tilt; this.f = target.f; this.logF = Math.log(target.f);
    this.vx = this.vy = this.vz = this.vt = this.vf = 0;
    this.sync();
  }

  /** 衝撃波の揺れ。カットではなく“空気が震える”程度に留める */
  addShake(amount) { this.shake = Math.max(this.shake, amount); }
  updateShake(dt, t) {
    this.shake *= Math.exp(-dt * 3.4);
    if (this.shake < 0.002) { this.shake = 0; this.shx = 0; this.shy = 0; }
    else {
      const a = this.shake * this.H * 0.028;
      this.shx = Math.sin(t * 41.3) * a * 0.9 + Math.sin(t * 27.7) * a * 0.4;
      this.shy = Math.sin(t * 33.1 + 1.7) * a * 0.7 + Math.sin(t * 19.3) * a * 0.35;
    }
    this.sync();
  }
}

export const scratch = { x: 0, y: 0, s: 0, ok: false };
export const scratch2 = { x: 0, y: 0, s: 0, ok: false };
export const scratch3 = { x: 0, y: 0, s: 0, ok: false };
