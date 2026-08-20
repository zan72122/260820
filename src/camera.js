// 手書きのピンホールカメラ。世界座標(x=川に沿う左右, y=上, z=手前が+)を
// スクリーンへ透視投影する。Canvas2D だけで奥行きのある河川敷をつくるための土台。
import { clamp, damp, lerp } from './util.js';

const V = () => ({ x: 0, y: 0, z: 0 });

export class Camera {
  constructor() {
    this.pos = { x: 0, y: 46, z: 120 };
    this.tgt = { x: 0, y: 90, z: -180 };
    this.fov = 46 * Math.PI / 180;

    // 追従用のターゲット値（成長に合わせて引くために外から書き換える）
    this.want = { px: 0, py: 46, pz: 120, tx: 0, ty: 90, fov: this.fov };

    this._fwd = V(); this._right = V(); this._up = V();
    this.w = 1; this.h = 1; this.cx = .5; this.cy = .5;
    this.f = 1; this.horizonY = 0;
    this.shake = 0; this._sx = 0; this._sy = 0; this._t = 0;
  }

  // 目標の「見せたい半幅・半高」からカメラ距離を逆算する。
  // 縦画面では自動的に距離が伸びる = 引きの画になる。
  static distanceFor(halfW, halfH, aspect, fov) {
    const t = Math.tan(fov / 2);
    return Math.max(halfH / t, halfW / (aspect * t));
  }

  follow(dt, snap = false) {
    const k = snap ? 1e9 : 1.9;
    this.pos.x = damp(this.pos.x, this.want.px, k, dt);
    this.pos.y = damp(this.pos.y, this.want.py, k, dt);
    this.pos.z = damp(this.pos.z, this.want.pz, k * 0.85, dt);
    this.tgt.x = damp(this.tgt.x, this.want.tx, k, dt);
    this.tgt.y = damp(this.tgt.y, this.want.ty, k, dt);
    this.fov = damp(this.fov, this.want.fov, k, dt);
    this.tgt.z = -180;
  }

  update(w, h, dt, t) {
    this.w = w; this.h = h; this.cx = w / 2; this.cy = h / 2;
    this._t = t;

    // 手持ちのわずかな揺れ（写真っぽさ）＋ 爆発時のショック
    this.shake = Math.max(0, this.shake - dt * 1.9);
    const hand = 1.1;
    this._sx = Math.sin(t * 0.37) * hand + Math.sin(t * 1.13 + 1.7) * hand * 0.4
      + (Math.sin(t * 41.0) * this.shake * 7);
    this._sy = Math.cos(t * 0.29) * hand * 0.8 + Math.sin(t * 0.91 + .4) * hand * 0.3
      + (Math.cos(t * 37.0) * this.shake * 5);

    const px = this.pos.x + this._sx * 0.6, py = this.pos.y + this._sy * 0.6;

    let fx = this.tgt.x - px, fy = this.tgt.y - py, fz = this.tgt.z - this.pos.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    this._fwd.x = fx; this._fwd.y = fy; this._fwd.z = fz;

    // right = fwd x worldUp
    let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    this._right.x = rx; this._right.y = ry; this._right.z = rz;

    // up = right x fwd
    this._up.x = ry * fz - rz * fy;
    this._up.y = rz * fx - rx * fz;
    this._up.z = rx * fy - ry * fx;

    this.eye = { x: px, y: py, z: this.pos.z };
    this.f = (h / 2) / Math.tan(this.fov / 2);

    // 水平線（無限遠の水平方向）
    const hl = Math.hypot(fx, fz) || 1;
    const hx = fx / hl, hz = fz / hl;
    const dUp = hx * this._up.x + hz * this._up.z;
    const dF = hx * fx + hz * fz;
    this.horizonY = this.cy - (dUp * this.f) / (dF || 1e-6);
    return this;
  }

  // 戻り値は使い回しオブジェクト。呼び出し側で即座に消費すること。
  project(x, y, z, out) {
    const dx = x - this.eye.x, dy = y - this.eye.y, dz = z - this.eye.z;
    const depth = dx * this._fwd.x + dy * this._fwd.y + dz * this._fwd.z;
    const o = out || _tmp;
    if (depth <= 4) { o.vis = false; o.depth = depth; return o; }
    const s = this.f / depth;
    o.x = this.cx + (dx * this._right.x + dy * this._right.y + dz * this._right.z) * s;
    o.y = this.cy - (dx * this._up.x + dy * this._up.y + dz * this._up.z) * s;
    o.scale = s; o.depth = depth; o.vis = true;
    return o;
  }

  // z 一定・y 一定の水平線分をスクリーン上の直線として返す（水面の境界など）。
  groundLine(z, y = 0) {
    const spanX = 20000;
    const a = this.project(this.eye.x - spanX, y, z, _l1);
    const b = this.project(this.eye.x + spanX, y, z, _l2);
    if (!a.vis || !b.vis) {
      const yy = this.horizonY + 1;
      return { y0: yy, y1: yy, flat: true };
    }
    const dxs = (b.x - a.x) || 1e-6;
    const m = (b.y - a.y) / dxs;
    return { y0: a.y + (0 - a.x) * m, y1: a.y + (this.w - a.x) * m, flat: false };
  }
}

const _tmp = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
const _l1 = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
const _l2 = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
export const scratch = () => ({ x: 0, y: 0, scale: 1, depth: 1, vis: false });
export { lerp, clamp };
