import { puffTinted } from './sprites.js';
import { clamp } from '../math.js';

/**
 * 夜の花火煙。自分では光らず、下（ナイアガラ）や上（開発）の光を受けて浮かび上がる。
 * これがあるだけで「現地の空気」が出る。
 */
export class Smoke {
  constructor(max = 260) {
    this.max = max;
    const f = (n) => new Float32Array(n);
    this.x = f(max); this.y = f(max); this.z = f(max);
    this.vx = f(max); this.vy = f(max); this.vz = f(max);
    this.life = f(max); this.inv = f(max);
    this.r0 = f(max); this.grow = f(max); this.seed = f(max);
    this.warm = f(max);   // 下からの暖色光の受け方 0..1
    this.alive = new Uint8Array(max);
    this.n = 0; this.count = 0; this.cursor = 0;
  }
  clear() { this.alive.fill(0); this.n = 0; this.count = 0; this.cursor = 0; }

  spawn(o) {
    if (this.count >= this.max) return -1;
    let i = this.cursor;
    for (let k = 0; k < this.max; k++) { if (!this.alive[i]) break; i = (i + 1) % this.max; }
    if (this.alive[i]) return -1;
    this.cursor = (i + 1) % this.max;
    this.alive[i] = 1; this.count++;
    if (i >= this.n) this.n = i + 1;
    this.x[i] = o.x; this.y[i] = o.y; this.z[i] = o.z;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.life[i] = o.life; this.inv[i] = 1 / o.life;
    this.r0[i] = o.r0; this.grow[i] = o.grow ?? 6;
    this.seed[i] = o.seed || 0; this.warm[i] = o.warm ?? 1;
    return i;
  }

  update(dt, wind) {
    let last = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.alive[i] = 0; this.count--; continue; }
      this.vy[i] += (2.4 - this.vy[i] * 0.6) * dt;       // 浮力＋抵抗
      this.vx[i] += (wind.x - this.vx[i] * 0.5) * dt;
      this.vz[i] += (wind.z - this.vz[i] * 0.5) * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      last = i + 1;
    }
    this.n = last;
  }

  /** lights: [{x,y,z,power,r,g,b}] 近い光源ほど煙を明るく染める */
  draw(ctx, cam, lights, opt = {}) {
    const mirror = opt.mirror === true, my = mirror ? -1 : 1;
    const gAlpha = opt.alpha ?? 1;
    const clipTop = opt.clipTop ?? -1e5;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const dz = this.z[i] - cam.z;
      if (dz < 5) continue;
      const s = cam.f / dz;
      const sx = cam.cx + (this.x[i] - cam.x) * s + cam.shx;
      const sy = cam.cyT - (this.y[i] * my - cam.y) * s;
      const lt = this.life[i] * this.inv[i];
      const age = 1 - lt;
      const rad = (this.r0[i] + this.grow[i] * age * (1 / this.inv[i]) * 1.6) * s;
      if (rad < 2) continue;
      if (sy + rad < clipTop) continue;
      if (sx + rad < 0 || sx - rad > cam.W || sy + rad < 0 || sy - rad > cam.H) continue;

      // 光の当たり具合（煙は自分では光らない）
      let lr = 26, lg = 30, lb = 44, tot = 0;
      for (let k = 0; k < lights.length; k++) {
        const L = lights[k];
        if (L.power <= 0.001) continue;
        const d = Math.hypot(this.x[i] - L.x, this.y[i] - L.y, this.z[i] - L.z);
        const w = L.power / (1 + (d / L.range) ** 2);
        lr += L.r * w; lg += L.g * w; lb += L.b * w; tot += w;
      }
      const norm = 1 / (1 + tot);
      lr = Math.min(255, lr * norm * 1.9); lg = Math.min(255, lg * norm * 1.9); lb = Math.min(255, lb * norm * 1.9);
      const fadeIn = lt > 0.9 ? (1 - lt) / 0.1 : 1;
      const a = clamp(lt * lt * fadeIn, 0, 1) * gAlpha * clamp(tot * 0.62, 0, 0.8) * 0.46;
      if (a < 0.006) continue;

      const spr = puffTinted(lr | 0, lg | 0, lb | 0, i);
      const ang = this.seed[i] * 6.283;
      ctx.globalAlpha = a * 1.7;
      ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), sx, sy);
      ctx.drawImage(spr, -rad, -rad, rad * 2, rad * 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
