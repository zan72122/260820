// 花火のパーティクル。世界座標で動き、Camera で投影される。
// 川面への映り込みは (x, -y, z) の鏡像を水面クリップの中に描くだけ。
import { clamp, lerp, TAU, hsl2rgb } from './util.js';
import { LAYOUT, waterClip } from './world.js';

const GRAV = 62;

function newP() {
  return {
    on: false, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0,
    vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1,
    r: 255, g: 200, b: 120, drag: 0.55, grav: 1, twk: 0, ph: 0,
    trail: 1, glow: 1, pop: 0, kind: 0,
  };
}

export class Fireworks {
  constructor(opts = {}) {
    this.cap = opts.cap || 2600;
    this.pool = new Array(this.cap);
    for (let i = 0; i < this.cap; i++) this.pool[i] = newP();
    this.cursor = 0;
    this.alive = 0;
    this.flashes = [];
    this.rockets = [];
    this.rng = opts.rng || Math.random;
    this.quality = opts.quality || 1;      // 0.35(低) .. 1(高)
    this.onBurst = opts.onBurst || (() => {});
    this.amb = { x: 0, y: 0, r: 255, g: 190, b: 120, i: 0 };
  }

  reset() {
    for (const p of this.pool) p.on = false;
    this.alive = 0; this.flashes.length = 0; this.rockets.length = 0;
    this.amb.i = 0;
  }

  _take() {
    for (let i = 0; i < this.cap; i++) {
      const idx = (this.cursor + i) % this.cap;
      const p = this.pool[idx];
      if (!p.on) { this.cursor = (idx + 1) % this.cap; p.on = true; this.alive++; return p; }
    }
    // 満杯なら一番古いものを奪う
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.cap;
    return p;
  }

  // --- 打上げ（昇り） ---
  // 4歳児が押してから開くまでが長いと「押した気」がしないので、
  // 実物の落下加速ではなく「到達時間」を決めて逆算する。
  launch(x, z, apexY, opts = {}) {
    const rise = opts.rise || (0.95 + apexY / 950);
    this.rockets.push({
      x, y: 2, z,
      vy: 2 * apexY / rise,
      acc: 2 * apexY / (rise * rise),
      rise, ttl: rise,
      vx: (this.rng() - .5) * 3, vz: (this.rng() - .5) * 3,
      t: 0, spark: 0,
      hue: opts.hue ?? 40, sat: opts.sat ?? 0.85,
      shell: opts.shell || 'peony',
      size: opts.size || 1,
      color: opts.color || null,
      delay: opts.delay || 0,
      onBurst: opts.onBurst || null,
    });
  }

  _colorOf(hue, sat, l = 0.62) { return hsl2rgb(hue, sat, l); }

  // --- 開花 ---
  burst(x, y, z, opts = {}) {
    const q = this.quality;
    const shell = opts.shell || 'peony';
    const size = opts.size || 1;
    const col = opts.color || this._colorOf(opts.hue ?? 40, opts.sat ?? 0.85);
    const col2 = opts.color2 || this._colorOf((opts.hue ?? 40) + (opts.hueSpread ?? 40), 0.8, 0.66);
    const rng = this.rng;

    const SZ = 0.72 + 0.28 * size;   // 玉の号数は半径に穏やかに効かせる
    let n, speed, spreadX = 1, spreadY = 1, spreadZ = 1, life, drag, grav, psize, trail, pop = 0;

    switch (shell) {
      case 'wide': // フェニックス＝横に広がる型
        n = 210; speed = 150 * SZ; spreadX = 2.25; spreadY = 0.62; spreadZ = 0.66;
        life = 2.6; drag = 0.82; grav = 0.85; psize = 1.6; trail = 1; break;
      case 'willow': // しだれ柳
        n = 140; speed = 170 * SZ; spreadY = 1.05;
        life = 4.0; drag = 1.00; grav = 1.30; psize = 1.8; trail = 1; pop = 0; break;
      case 'palm':
        n = 70; speed = 200 * SZ; life = 3.0; drag = 0.72; grav = 1.0; psize = 2.6; trail = 1; pop = 1; break;
      case 'crackle':
        n = 34; speed = 82 * SZ; life = 0.75; drag = 2.0; grav = 0.6; psize = 1.1; trail = 0; break;
      case 'ring':
        n = 130; speed = 178 * SZ; life = 2.4; drag = 0.66; grav = 0.9; psize = 1.4; trail = 1; break;
      default: // peony
        n = 150; speed = 180 * SZ; life = 2.5; drag = 0.66; grav = 0.95; psize = 1.6; trail = 1;
    }
    n = Math.max(10, Math.round(n * q * (opts.density ?? 1)));

    for (let i = 0; i < n; i++) {
      const p = this._take();
      let ux, uy, uz;
      if (shell === 'ring') {
        const a = (i / n) * TAU + rng() * 0.05;
        ux = Math.cos(a); uy = Math.sin(a) * 0.35; uz = Math.sin(a) * 0.94;
      } else {
        // 球面一様
        const u = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - u * u);
        ux = s * Math.cos(a); uy = u; uz = s * Math.sin(a);
      }
      const sp = speed * (0.62 + 0.48 * Math.pow(rng(), 0.55));
      p.x = p.px = x; p.y = p.py = y; p.z = p.pz = z;
      p.vx = ux * sp * spreadX;
      p.vy = uy * sp * spreadY + (shell === 'willow' ? 16 : 0);
      p.vz = uz * sp * spreadZ;
      p.max = p.life = life * (0.72 + rng() * 0.55);
      p.drag = drag; p.grav = grav;
      p.size = psize * (0.7 + rng() * 0.7) * (0.75 + size * 0.35);
      const mix = rng();
      const c = mix < (opts.mix ?? 0.72) ? col : col2;
      p.r = c[0]; p.g = c[1]; p.b = c[2];
      p.twk = rng() < 0.30 ? 1 : 0;
      p.ph = rng() * TAU;
      p.trail = trail; p.glow = 1; p.pop = pop && rng() < 0.25 ? 1 : 0;
    }

    this.flashes.push({
      x, y, z, r: col[0], g: col[1], b: col[2],
      t: 0, life: 0.55 + size * 0.22, pow: size,
    });
    this.onBurst({ x, y, z, size, shell });
  }

  update(dt) {
    // 昇り
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.t += dt;
      r.vy -= r.acc * dt;
      r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      r.spark += dt;
      if (r.spark > 0.02) {
        r.spark = 0;
        const p = this._take();
        p.x = p.px = r.x + (this.rng() - .5) * 1.5;
        p.y = p.py = r.y; p.z = p.pz = r.z;
        p.vx = (this.rng() - .5) * 9; p.vy = -r.vy * 0.10 + (this.rng() - .5) * 6; p.vz = (this.rng() - .5) * 9;
        p.max = p.life = 0.30 + this.rng() * 0.30;
        p.drag = 2.4; p.grav = 0.5; p.size = 1.1;
        p.r = 255; p.g = 196; p.b = 118; p.twk = 1; p.trail = 1; p.glow = 0.7; p.pop = 0;
        p.ph = this.rng() * TAU;
      }
      if (r.vy <= 2 || r.t >= r.ttl) {
        this.rockets.splice(i, 1);
        this.burst(r.x, r.y, r.z, { hue: r.hue, sat: r.sat, shell: r.shell, size: r.size, color: r.color, ...(r.opts || {}) });
        if (r.onBurst) r.onBurst(r);
      }
    }

    // 粒子
    const damp = Math.exp;
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.on = false;
        if (p.pop) this.burst(p.x, p.y, p.z, { shell: 'crackle', color: [255, 236, 190], size: 0.5, density: 0.6 });
        continue;
      }
      alive++;
      p.px = p.x; p.py = p.y; p.pz = p.z;
      const d = damp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.vy -= GRAV * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.5) { p.on = false; }
    }
    this.alive = alive;

    // 閃光
    let ax = 0, ay = 0, ai = 0, ar = 0, ag = 0, ab = 0;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t >= f.life) { this.flashes.splice(i, 1); continue; }
    }
    this._ambAccum = { ax, ay, ai, ar, ag, ab };
  }

  // --- 描画 ---
  draw(ctx, cam, t) {
    const W = cam.w, H = cam.h;
    const p3 = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
    const q3 = { x: 0, y: 0, scale: 1, depth: 1, vis: false };

    // 1) 川面の映り込み。
    // 幾何どおりに y を反転すると、高い花火の像は汀線よりさらに手前に落ちて
    // 川幅の外へ出てしまう（実際、岸から離れて見ると映り込みは見えない）。
    // ここでは「汀線を軸に、圧縮して折り返す」スクリーン空間の反射にして、
    // 川面がいつでも花火を映すようにしている。
    ctx.save();
    const band = waterClip(ctx, cam);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const topAt = (x) => band.far.y0 + (band.far.y1 - band.far.y0) * (x / W);
    const botAt = (x) => band.near.y0 + (band.near.y1 - band.near.y0) * (x / W);
    // 川幅が画面上で細くなるほど強く圧縮し、いつでも川面が花火を映すようにする
    const bandH = Math.max(2, ((band.near.y0 + band.near.y1) - (band.far.y0 + band.far.y1)) * 0.5);
    const K = clamp(bandH / 230, 0.055, 0.34);
    const step = this.quality > 0.8 ? 2 : 4;
    for (let i = 0; i < this.cap; i += step) {
      const p = this.pool[i];
      if (!p.on || p.y <= 0) continue;
      cam.project(p.x, p.y, p.z, p3);
      if (!p3.vis || p3.x < -30 || p3.x > W + 30) continue;
      const top = topAt(p3.x);
      if (p3.y >= top) continue;
      const ry = top + (top - p3.y) * K;
      if (ry > botAt(p3.x) + 4) continue;
      const lf = p.life / p.max;
      const a = clamp(lf * 0.34, 0, 0.34);
      if (a < 0.012) continue;
      const sz = Math.max(2.4, Math.min(18, p.size * p3.scale * 2.6));
      const wob = Math.sin(t * 3.1 + p.z * 0.03 + p.ph) * sz * 1.2;
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
      ctx.fillRect(p3.x - sz * 0.5 + wob, ry - sz * 1.4, sz, sz * 3.4);
    }
    // 閃光の水面反射（帯全体がぼうっと光る）
    for (const f of this.flashes) {
      cam.project(f.x, f.y, f.z, p3);
      if (!p3.vis) continue;
      const top = topAt(p3.x);
      const ry = p3.y < top ? top + (top - p3.y) * K : p3.y;
      const k = 1 - f.t / f.life;
      const r = Math.max(26, p3.scale * 110 * f.pow) * (0.6 + k);
      const g = ctx.createRadialGradient(p3.x, ry, 0, p3.x, ry, r);
      g.addColorStop(0, `rgba(${f.r},${f.g},${f.b},${0.30 * k * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p3.x - r, ry - r, r * 2, r * 2);

      // 手前へ伸びる光の柱
      const colTop = topAt(p3.x), colBot = botAt(p3.x) + 6;
      const cw = Math.max(10, r * 0.55);
      const cg = ctx.createLinearGradient(0, colTop, 0, colBot);
      cg.addColorStop(0, `rgba(${f.r},${f.g},${f.b},${0.30 * k})`);
      cg.addColorStop(0.45, `rgba(${f.r},${f.g},${f.b},${0.16 * k})`);
      cg.addColorStop(1, `rgba(${f.r},${f.g},${f.b},0)`);
      ctx.fillStyle = cg;
      for (let c = 0; c < 3; c++) {
        const off = Math.sin(t * 2.2 + c * 2.1 + f.x * 0.01) * cw * 0.35;
        ctx.fillRect(p3.x - cw * 0.5 + off, colTop, cw * (0.5 + c * 0.35), colBot - colTop);
      }
    }
    ctx.restore();

    // 2) 閃光（空側のブルーム）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let ax = 0, ay = 0, ai = 0, ar = 0, ag = 0, ab = 0;
    for (const f of this.flashes) {
      cam.project(f.x, f.y, f.z, p3);
      const k = Math.pow(1 - f.t / f.life, 2.2);
      if (!p3.vis) continue;
      const r = Math.max(20, p3.scale * 105 * f.pow) * (0.45 + (1 - k) * 0.9);
      const g = ctx.createRadialGradient(p3.x, p3.y, 0, p3.x, p3.y, r);
      g.addColorStop(0, `rgba(${f.r},${f.g},${f.b},${0.34 * k})`);
      g.addColorStop(0.30, `rgba(${f.r},${f.g},${f.b},${0.10 * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p3.x - r, p3.y - r, r * 2, r * 2);
      const wgt = k * f.pow;
      ax += p3.x * wgt; ay += p3.y * wgt; ai += wgt;
      ar += f.r * wgt; ag += f.g * wgt; ab += f.b * wgt;
    }
    ctx.restore();

    if (ai > 0.001) {
      this.amb.x = ax / ai; this.amb.y = ay / ai;
      this.amb.r = clamp(ar / ai, 0, 255) | 0;
      this.amb.g = clamp(ag / ai, 0, 255) | 0;
      this.amb.b = clamp(ab / ai, 0, 255) | 0;
      this.amb.i = clamp(ai * 0.55, 0, 1.15);
    } else {
      this.amb.i *= 0.86;
    }

    // 3) 粒子本体
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      cam.project(p.x, p.y, p.z, p3);
      if (!p3.vis || p3.x < -60 || p3.x > W + 60 || p3.y < -60 || p3.y > H + 60) continue;
      const lf = p.life / p.max;
      let a = Math.pow(lf, 0.62) * p.glow;
      if (p.twk) a *= 0.45 + 0.55 * Math.abs(Math.sin(t * 26 + p.ph));
      if (a < 0.02) continue;
      const s = Math.max(1.3, Math.min(26, p.size * p3.scale * 2.2));
      if (p.trail) {
        cam.project(p.px, p.py, p.pz, q3);
        if (q3.vis) {
          const dx = p3.x - q3.x, dy = p3.y - q3.y;
          if (dx * dx + dy * dy > 0.6) {
            ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${a * 0.85})`;
            ctx.lineWidth = s;
            ctx.beginPath();
            ctx.moveTo(q3.x - dx * 1.6, q3.y - dy * 1.6);
            ctx.lineTo(p3.x, p3.y);
            ctx.stroke();
            continue;
          }
        }
      }
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
      ctx.fillRect(p3.x - s * 0.5, p3.y - s * 0.5, s, s);
    }
    ctx.restore();
  }
}
