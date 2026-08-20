// ---------------------------------------------------------------------------
// ビー玉の物理。瓶ローカルの XY 断面（2D）に限定した円 vs 多角形ソルバ。
// 瓶は瓶ローカル Z 軸まわりにしか倒さないので、重力は常にローカル XY 平面内に
// 収まる。よって 2D で厳密に足りる。軽く、安定し、音と完全に同期できる。
// ---------------------------------------------------------------------------

import { INNER, MARBLE_R, DIMPLE, innerRadiusAt, dimpleInset } from './profile.js';

const G = 9.81;

/** 内壁ポリゴン（閉ループ）を作る。くぼみは ±X 側に凸として入る。 */
export function buildCavityPolygon() {
  const yTop = INNER[0][0];
  const ys = [];
  // プロファイルの節点 + くぼみ周辺を細かく
  const base = INNER.map((p) => p[0]).slice().sort((a, b) => a - b);
  for (const y of base) ys.push(y);
  for (let i = -6; i <= 6; i++) ys.push(DIMPLE.y + i * DIMPLE.sigmaY * 0.42);
  // 座面付近も細かく
  for (let i = 0; i <= 8; i++) ys.push(0.1840 + (i / 8) * (yTop - 0.1840));
  const uniq = [...new Set(ys.map((v) => Math.round(v * 1e6) / 1e6))]
    .filter((y) => y >= 0.0080 && y <= yTop)
    .sort((a, b) => a - b);

  const wall = uniq.map((y) => {
    const r = innerRadiusAt(y) - dimpleInset(y, 0);
    return [Math.max(r, 0.0006), y];
  });

  const poly = [];
  // 右壁（下→上）
  for (const [r, y] of wall) poly.push([r, y]);
  // 天井（瓶口）
  poly.push([-wall[wall.length - 1][0], wall[wall.length - 1][1]]);
  // 左壁（上→下）
  for (let i = wall.length - 2; i >= 0; i--) poly.push([-wall[i][0], wall[i][1]]);
  // 床
  poly.push([wall[0][0], wall[0][1]]);
  return poly;
}

export class MarblePhysics {
  constructor() {
    this.poly = buildCavityPolygon();
    this.r = MARBLE_R;
    this.x = 0;
    this.y = 0.1892;
    this.vx = 0;
    this.vy = 0;
    this.spin = 0;      // 見た目の転がり用（rad）
    this.spinAxisZ = 1;
    this.active = false;
    this.contacts = []; // { speed, x, y } 直近サブステップの衝突
    this.restitution = 0.34;
    this.friction = 0.14;
    this.submergedY = -1; // これ以下は液中（抵抗大）
    this.lastContactAge = 999;
  }

  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.spin = 0; this.active = false;
  }

  /** 瓶口を塞いでいるか（座面に達しているか） */
  isSealingMouth() {
    return this.y > 0.1868;
  }

  /** くぼみに保持されているか */
  isHeldByDimple() {
    return !this.isSealingMouth() && this.y > 0.1655 && Math.abs(this.x) > 0.0018;
  }

  /**
   * @param {number} dt   秒
   * @param {number} gx   瓶ローカルの重力 X 成分（正規化されていない、m/s^2）
   * @param {number} gy   瓶ローカルの重力 Y 成分
   */
  step(dt, gx, gy) {
    this.contacts.length = 0;
    this.rollSpeed = 0;
    this.lastContactAge += dt;
    if (!this.active) return;
    const sub = Math.min(8, Math.max(1, Math.ceil(dt / 0.0045)));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) this._substep(h, gx, gy);
    // 見た目の転がり（接触点での転がりを近似）
    const speed = Math.hypot(this.vx, this.vy);
    this.spin += (speed / this.r) * dt * Math.sign(this.vx || 1) * 0.6;
  }

  _substep(h, gx, gy) {
    const inLiquid = this.y < this.submergedY;
    const drag = inLiquid ? 1.5 : 0.22;
    this.vx += gx * h;
    this.vy += gy * h;
    const d = Math.exp(-drag * h);
    this.vx *= d; this.vy *= d;
    this.x += this.vx * h;
    this.y += this.vy * h;

    const poly = this.poly;
    const n = poly.length;
    for (let iter = 0; iter < 3; iter++) {
      let bestPen = 0, bnx = 0, bny = 0;
      for (let i = 0; i < n; i++) {
        const ax = poly[i][0], ay = poly[i][1];
        const bx = poly[(i + 1) % n][0], by = poly[(i + 1) % n][1];
        const ex = bx - ax, ey = by - ay;
        const len2 = ex * ex + ey * ey;
        if (len2 < 1e-12) continue;
        let t = ((this.x - ax) * ex + (this.y - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + ex * t, cy = ay + ey * t;
        let dx = this.x - cx, dy = this.y - cy;
        let dist = Math.hypot(dx, dy);
        if (dist > this.r) continue;
        if (dist < 1e-9) {
          // 稜線に完全に乗った場合は辺の内向き法線を使う
          dx = -ey; dy = ex; dist = Math.hypot(dx, dy) || 1;
        }
        const pen = this.r - dist;
        if (pen > bestPen) { bestPen = pen; bnx = dx / dist; bny = dy / dist; }
      }
      if (bestPen <= 0) break;
      this.x += bnx * bestPen;
      this.y += bny * bestPen;
      const vn = this.vx * bnx + this.vy * bny;
      if (vn < 0) {
        const impact = -vn;
        this.vx -= (1 + this.restitution) * vn * bnx;
        this.vy -= (1 + this.restitution) * vn * bny;
        // 接線方向の摩擦（転がり抵抗込み）
        const tx = -bny, ty = bnx;
        const vt = this.vx * tx + this.vy * ty;
        const f = vt * this.friction;
        this.vx -= f * tx; this.vy -= f * ty;
        const at = Math.abs(vt);
        if (at > this.rollSpeed) this.rollSpeed = at;
        // 転がって落ち着いたビー玉が壁を小突き続けて「カチカチ」鳴るのを防ぐ。
        // 音を出すのは、ちゃんと当たりに行ったときだけ。
        const moving = Math.hypot(this.vx, this.vy);
        if (impact > 0.048 && moving > 0.055 && this.lastContactAge > 0.045) {
          this.contacts.push({ speed: impact, x: this.x, y: this.y });
          this.lastContactAge = 0;
        }
      }
      // 低速時は微振動を殺して、そこで眠らせる
      const sp = Math.hypot(this.vx, this.vy);
      if (sp < 0.030) { const k = sp < 0.012 ? 0.35 : 0.72; this.vx *= k; this.vy *= k; }
    }
  }
}

/** 傾き角 theta（度, 瓶ローカル Z 軸まわり）に対する瓶ローカル重力 */
export function localGravity(thetaRad) {
  return [G * Math.sin(thetaRad), -G * Math.cos(thetaRad)];
}
