import { glow, glowSmall } from './sprites.js';
import { clamp } from '../math.js';

export const K_SPARK = 0;   // ナイアガラの火の粉（ほぼ真下に落ちる）
export const K_STAR = 1;    // 花火の星（全方位・尾を引く）
export const K_TRAIL = 2;   // 昇り／尾
export const K_SPLASH = 3;  // 着水のはじけ

/**
 * 3D パーティクル。位置を世界座標で持つので、
 * 水面の鏡像は (X,-Y,Z) を投影するだけで物理的に正しく出る。
 */
export class Particles {
  constructor(max) {
    this.max = max;
    const f = (n) => new Float32Array(n);
    this.x = f(max); this.y = f(max); this.z = f(max);
    this.px = f(max); this.py = f(max); this.pz = f(max);
    this.vx = f(max); this.vy = f(max); this.vz = f(max);
    this.life = f(max); this.inv = f(max); this.size = f(max);
    this.drag = f(max); this.grav = f(max); this.seed = f(max);
    this.r = f(max); this.g = f(max); this.b = f(max);
    this.r2 = f(max); this.g2 = f(max); this.b2 = f(max);
    this.chg = f(max);          // 色変わりのタイミング（寿命比 0..1）
    this.kind = new Uint8Array(max);
    this.alive = new Uint8Array(max);
    this.n = 0;                 // 使用中の上限インデックス
    this.count = 0;
    this.cursor = 0;
  }

  clear() { this.alive.fill(0); this.n = 0; this.count = 0; this.cursor = 0; }

  spawn(o) {
    if (this.count >= this.max) return -1;
    let i = this.cursor;
    for (let k = 0; k < this.max; k++) {
      if (!this.alive[i]) break;
      i = (i + 1) % this.max;
    }
    if (this.alive[i]) return -1;
    this.cursor = (i + 1) % this.max;
    this.alive[i] = 1; this.count++;
    if (i >= this.n) this.n = i + 1;

    this.x[i] = this.px[i] = o.x; this.y[i] = this.py[i] = o.y; this.z[i] = this.pz[i] = o.z;
    this.vx[i] = o.vx; this.vy[i] = o.vy; this.vz[i] = o.vz;
    this.life[i] = o.life; this.inv[i] = 1 / o.life;
    this.size[i] = o.size; this.drag[i] = o.drag || 0; this.grav[i] = o.grav ?? 9.8;
    this.seed[i] = o.seed || 0;
    this.r[i] = o.r; this.g[i] = o.g; this.b[i] = o.b;
    this.r2[i] = o.r2 ?? o.r; this.g2[i] = o.g2 ?? o.g; this.b2[i] = o.b2 ?? o.b;
    this.chg[i] = o.chg ?? -1;
    this.kind[i] = o.kind;
    return i;
  }

  update(dt, wind) {
    this.dt = dt;
    const { x, y, z, px, py, pz, vx, vy, vz, life, drag, grav, alive } = this;
    let last = 0;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      life[i] -= dt;
      if (life[i] <= 0) { alive[i] = 0; this.count--; continue; }
      // 星は px/py/pz を「開発の中心」として保持する（尾の根元に使う）
      if (this.kind[i] !== K_STAR) { px[i] = x[i]; py[i] = y[i]; pz[i] = z[i]; }
      const d = drag[i] ? Math.exp(-drag[i] * dt) : 1;
      vy[i] = (vy[i] - grav[i] * dt) * d;
      vx[i] = (vx[i] + wind.x * dt) * d;
      vz[i] = (vz[i] + wind.z * dt) * d;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt; z[i] += vz[i] * dt;
      // 水面より下へは行かない（着水で消える）
      if (y[i] < 0 && this.kind[i] !== K_SPLASH) { alive[i] = 0; this.count--; continue; }
      last = i + 1;
    }
    this.n = last;
  }

  /**
   * 描画。mirror=true なら水面の鏡像として (X,-Y,Z) を描く。
   * ctx は呼び出し側で 'lighter' に設定しておくこと。
   */
  draw(ctx, cam, opt) {
    const mirror = opt.mirror === true;
    const alphaMul = opt.alpha ?? 1;
    const wob = opt.wobble || null;
    const H = cam.H, W = cam.W;
    const cx = cam.cx, cyT = cam.cyT, f = cam.f, camx = cam.x, camy = cam.y, camz = cam.z, shx = cam.shx;
    const my = mirror ? -1 : 1;
    const clipTop = opt.clipTop ?? -1e5;
    const t = opt.time || 0;
    const stride = Math.max(1, opt.stride | 0 || 1);
    const simple = opt.simple === true;      // 反射は尾を描かない（軽さのため）
    const kindMask = opt.kindMask ?? 0xff;
    const simpleSize = opt.simpleSize ?? 1;   // 尾のぶんを1粒に含める（反射用）
    // 尾。菊の星は中心へ向かって尾を引く（実際の花火の見え方）
    const dtNow = this.dt || 1 / 60;
    const stretchSpark = clamp((opt.exposure ?? 0.10) * 0.45 / dtNow, 1, 7);
    const tailK = opt.tail ?? 0.24;

    const { x, y, z, px, py, pz, life, inv, size, kind, alive, r, g, b, r2, g2, b2, chg, seed } = this;

    for (let i = 0; i < this.n; i += stride) {
      if (!alive[i]) continue;
      if (!((1 << kind[i]) & kindMask)) continue;
      const dz = z[i] - camz;
      if (dz < 3) continue;
      const s = f / dz;
      let sx = cx + (x[i] - camx) * s + shx;
      let sy = cyT - (y[i] * my - camy) * s;
      if (sy < clipTop) continue;
      const wOff = wob ? wob(sy, seed[i], t) : 0;
      sx += wOff;
      if (sx < -80 || sx > W + 80 || sy < -120 || sy > H + 120) continue;

      const lt = life[i] * inv[i];              // 1 → 0
      const k = kind[i];
      let rr = r[i], gg = g[i], bb = b[i], a = 1, sz = size[i] * s;

      if (k === K_SPARK) {
        // 金 → 橙 → 赤黒。落ちるほど温度が下がる
        const u = 1 - lt;
        rr = 255; gg = 205 - 120 * u; bb = 140 - 135 * u;
        a = lt < 0.18 ? lt / 0.18 : 1;
        a *= 0.55 + 0.45 * Math.sin((t * 34 + seed[i] * 61) % 6.283);
        a = clamp(a, 0, 1) * (0.85 + 0.35 * lt);
        sz = Math.max(1.1, sz * (0.55 + 0.55 * lt));
      } else if (k === K_STAR) {
        const c = chg[i];
        if (c > 0 && lt < c) {
          const m = clamp((c - lt) / 0.16, 0, 1);
          rr = r[i] + (r2[i] - r[i]) * m; gg = g[i] + (g2[i] - g[i]) * m; bb = b[i] + (b2[i] - b[i]) * m;
        }
        a = lt > 0.82 ? 1 : (lt < 0.30 ? (lt / 0.30) ** 1.5 : 1);
        // 終盤のキラキラ（点滅）
        if (lt < 0.5) {
          const tw = Math.sin((t * 46 + seed[i] * 97)) * 0.5 + 0.5;
          a *= 0.35 + 0.9 * tw * tw;
          rr = rr + (255 - rr) * 0.4 * tw; gg = gg + (255 - gg) * 0.4 * tw; bb = bb + (255 - bb) * 0.4 * tw;
        }
        sz = Math.max(1.0, sz * (0.5 + 0.7 * lt));
      } else if (k === K_TRAIL) {
        a = lt * lt;
        rr = 255; gg = 225 - 60 * (1 - lt); bb = 170 - 130 * (1 - lt);
        sz = Math.max(0.9, sz * (0.35 + 0.9 * lt));
      } else { // K_SPLASH
        a = lt * 0.9;
        rr = 255; gg = 210; bb = 150;
        sz = Math.max(1.0, sz * lt);
      }

      a *= alphaMul;
      if (a <= 0.012) continue;
      ctx.globalAlpha = a;
      const w2 = sz * 2.6;
      const spr = w2 < 13 ? glowSmall(rr | 0, gg | 0, bb | 0) : glow(rr | 0, gg | 0, bb | 0);

      // 反射は尾を描かず、少し大きめの丸い光として置く（負荷を半分以下に）
      if (simple) {
        const ww = w2 * simpleSize;
        ctx.drawImage(spr, sx - ww * 0.5, sy - ww * 0.5, ww, ww);
        continue;
      }

      let qx, qy;
      if (kind[i] === K_STAR) {
        // 中心側へ tailK ぶん戻した点を尾の根元にする（px/py/pz は開発中心）
        const tx = x[i] - (x[i] - px[i]) * tailK;
        const ty = y[i] - (y[i] - py[i]) * tailK;
        const tz = z[i] - (z[i] - pz[i]) * tailK;
        const dzt = tz - camz;
        const st = dzt < 3 ? s : f / dzt;
        qx = cx + (tx - camx) * st + shx;
        qy = cyT - (ty * my - camy) * st;
      } else {
        const dzp = pz[i] - camz;
        const sp = dzp < 3 ? s : f / dzp;
        qx = cx + (px[i] - camx) * sp + shx;
        qy = cyT - (py[i] * my - camy) * sp;
      }

      qx += wOff;

      if (k !== K_STAR) { qx = sx - (sx - qx) * stretchSpark; qy = sy - (sy - qy) * stretchSpark; }
      let dx = sx - qx, dy = sy - qy;
      let len = Math.hypot(dx, dy);
      if (len > cam.H * 0.5) { qx = sx; qy = sy; len = 0; }             // カメラ急変時の暴れ止め

      if (len < sz * 0.8) {
        ctx.drawImage(spr, sx - w2 * 0.5, sy - w2 * 0.5, w2, w2);
      } else if (k === K_SPARK || k === K_SPLASH) {
        // 火の粉はほぼ鉛直に落ちるので、縦方向に伸ばすだけで足りる（変換不要＝速い）
        const h2 = w2 + Math.abs(dy);
        ctx.drawImage(spr, sx - w2 * 0.5, Math.min(sy, qy) - w2 * 0.5, w2, h2);
      } else {
        const ang = Math.atan2(dy, dx);
        ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), (sx + qx) * 0.5, (sy + qy) * 0.5);
        ctx.drawImage(spr, -(len + w2) * 0.5, -w2 * 0.5, len + w2, w2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    ctx.globalAlpha = 1;
  }
}
