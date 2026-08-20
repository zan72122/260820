import { LAUNCH, SHELL } from '../world.js';
import { clamp, easeOutCubic } from '../math.js';
import { K_STAR, K_TRAIL } from './particles.js';
import { rng } from '../rng.js';

const D = { x: 0, y: 0, z: 0 };
const P = { x: 0, y: 0, s: 0, ok: false };

export const S_IDLE = 0, S_RISE = 1, S_BURST = 2, S_DONE = 3;

// 三重芯変化菊：外側の親星＋3つの芯。正三尺玉の定番の姿。
const LAYERS = [
  { n: 1000, v: 175, drag: 0.58, life: 6.6, size: 1.30, r: 255, g: 74, b: 98, r2: 255, g2: 206, b2: 96, chg: 0.60 },
  { n: 420, v: 112, drag: 0.60, life: 5.6, size: 1.20, r: 238, g: 247, b: 255, r2: 255, g2: 255, b2: 255, chg: -1 },
  { n: 280, v: 70, drag: 0.63, life: 5.0, size: 1.15, r: 96, g: 255, b: 168, r2: 255, g2: 100, b2: 124, chg: 0.52 },
  { n: 170, v: 40, drag: 0.66, life: 4.6, size: 1.10, r: 255, g: 208, b: 96, r2: 255, g2: 246, b2: 212, chg: 0.46 },
];

/**
 * 正三尺玉。直径90cm・開いて約600m。長岡の夜のいちばん高いところ。
 * ここでは「上向きの巨大現象」を担当する。
 */
export class Shell {
  constructor() { this.reset(); }

  reset() {
    this.state = S_IDLE;
    this.x = LAUNCH.x; this.y = LAUNCH.y; this.z = LAUNCH.z;
    this.vx = 0; this.vy = 0;
    this.t0 = 0; this.burstAt = 0;
    this.flash = 0;
    this.shockR = -1;
    this.trailAcc = 0;
    this.launched = false;
    this.soundPending = null;
  }

  launch(now) {
    if (this.state !== S_IDLE) return false;
    this.state = S_RISE;
    this.t0 = now;
    this.launched = true;
    this.x = LAUNCH.x; this.y = LAUNCH.y; this.z = LAUNCH.z;
    this.vx = rng.range(-1.2, 1.2);
    return true;
  }

  get rising() { return this.state === S_RISE; }
  get burst() { return this.state >= S_BURST; }
  /** 開いてからの経過（秒） */
  since(now) { return this.state >= S_BURST ? now - this.burstAt : -1; }

  /** いまの半径（カメラのフレーミングに使う） */
  radiusNow(now) {
    if (this.state < S_BURST) return 0;
    const e = now - this.burstAt;
    // v/drag * (1-e^{-drag t}) の閉じた形
    const v = LAYERS[0].v, d = LAYERS[0].drag;
    return (v / d) * (1 - Math.exp(-d * e));
  }

  update(dt, now, parts, smoke, cam, q, onBurst) {
    if (this.state === S_RISE) {
      const T = SHELL.riseTime;
      const e = now - this.t0;
      const g = (2 * (SHELL.apex - LAUNCH.y)) / (T * T);
      const v0 = 2 * (SHELL.apex - LAUNCH.y) / T;
      this.y = LAUNCH.y + v0 * e - 0.5 * g * e * e;
      this.x = LAUNCH.x + this.vx * e;
      this.vy = v0 - g * e;

      // 昇り曲導（尾）
      this.trailAcc += dt * q.trailRate;
      let n = this.trailAcc | 0; this.trailAcc -= n;
      if (n > 14) n = 14;
      for (let k = 0; k < n; k++) {
        const f = k / Math.max(1, n);
        parts.spawn({
          kind: K_TRAIL,
          x: this.x + rng.gauss() * 1.2, y: this.y - this.vy * dt * f + rng.gauss() * 1.5, z: this.z + rng.gauss() * 1.2,
          vx: rng.gauss() * 4.5, vy: rng.range(-6, 4) - this.vy * 0.06, vz: rng.gauss() * 4.5,
          life: rng.range(0.45, 1.25), size: rng.range(0.28, 0.62),
          drag: 1.5, grav: 6.5, seed: rng.range(0, 6.28),
          r: 255, g: 226, b: 150,
        });
      }
      // 昇りの煙柱
      this._sm = (this._sm || 0) + dt * q.smokeRate * 16;
      while (this._sm >= 1) {
        this._sm -= 1;
        smoke.spawn({
          x: this.x + rng.gauss() * 4, y: this.y - rng.range(0, 46), z: this.z + rng.gauss() * 4,
          vx: rng.gauss() * 5.5, vy: rng.range(0.4, 1.8), vz: rng.gauss() * 5.5,
          life: rng.range(6, 11), r0: rng.range(5, 11), grow: rng.range(1.2, 2.4),
          seed: rng.next(), warm: 0.5,
        });
      }

      if (e >= T) this.explode(now, parts, smoke, q, onBurst);
    }

    if (this.state >= S_BURST) {
      this.flash *= Math.exp(-dt * 5.2);
      if (this.shockR >= 0) {
        this.shockR += 320 * dt;
        if (this.shockR > SHELL.radius * 2.4) this.shockR = -1;
      }
    }
  }

  explode(now, parts, smoke, q, onBurst) {
    this.state = S_BURST;
    this.burstAt = now;
    this.y = SHELL.apex;
    this.flash = 1;
    this.shockR = 0;

    const scale = q.starScale;
    for (let li = 0; li < LAYERS.length; li++) {
      const L = LAYERS[li];
      const n = Math.max(40, Math.round(L.n * scale));
      for (let i = 0; i < n; i++) {
        rng.dir3(D);
        const sp = L.v * (0.94 + rng.next() * 0.12);
        parts.spawn({
          kind: K_STAR,
          x: this.x, y: this.y, z: this.z,
          vx: D.x * sp, vy: D.y * sp, vz: D.z * sp,
          life: L.life * (0.82 + rng.next() * 0.36),
          size: L.size * (0.8 + rng.next() * 0.5),
          drag: L.drag * (0.97 + rng.next() * 0.06),
          grav: 3.4, seed: rng.range(0, 6.28),
          r: L.r, g: L.g, b: L.b, r2: L.r2, g2: L.g2, b2: L.b2, chg: L.chg,
        });
      }
    }
    // 開発の煙玉
    for (let i = 0; i < Math.round(26 * q.smokeRate); i++) {
      rng.dir3(D);
      const sp = rng.range(20, 90);
      smoke.spawn({
        x: this.x, y: this.y, z: this.z,
        vx: D.x * sp, vy: D.y * sp * 0.6, vz: D.z * sp,
        life: rng.range(11, 18), r0: rng.range(10, 22), grow: rng.range(2.4, 5.0),
        seed: rng.next(), warm: 0.3,
      });
    }
    if (onBurst) onBurst(this);
  }

  /** 中心の光球と衝撃波。星だけでは“炸裂”に見えない */
  draw(ctx, cam, now, m) {
    if (this.state === S_IDLE) return;
    const mirror = m && m.mirror;
    const gA = (m && m.alpha) ?? 1;
    const pr = mirror ? cam.projectMirror.bind(cam) : cam.project.bind(cam);
    pr(this.x, this.y, this.z, P);
    if (!P.ok) return;
    let sx = P.x, sy = P.y;
    if (m && m.wob) sx += m.wob(sy, 3.1);

    ctx.globalCompositeOperation = 'lighter';

    if (this.state === S_RISE) {
      const a = 0.9 * gA;
      const rad = Math.max(3, P.s * 5);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * 5);
      g.addColorStop(0, `rgba(255,255,240,${a})`);
      g.addColorStop(0.25, `rgba(255,215,130,${a * 0.5})`);
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - rad * 5, sy - rad * 5, rad * 10, rad * 10);
    } else {
      const e = now - this.burstAt;
      // 光球
      if (e < 1.4) {
        const k = Math.exp(-e * 3.0);
        const rad = Math.max(8, P.s * (30 + 320 * easeOutCubic(e / 0.6)));
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, `rgba(255,252,235,${0.85 * k * gA})`);
        g.addColorStop(0.18, `rgba(255,225,170,${0.42 * k * gA})`);
        g.addColorStop(0.5, `rgba(255,170,110,${0.14 * k * gA})`);
        g.addColorStop(1, 'rgba(255,140,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      }
      // 花全体をひとかたまりの光に見せる、ごく薄いハロー
      if (e < 6.0) {
        const rr = this.radiusNow(now) * P.s;
        if (rr > 6) {
          const a = Math.exp(-e * 0.5) * 0.13 * gA;
          const gh = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 1.15);
          gh.addColorStop(0, `rgba(255,236,205,${a})`);
          gh.addColorStop(0.45, `rgba(255,190,150,${a * 0.45})`);
          gh.addColorStop(1, 'rgba(255,150,120,0)');
          ctx.fillStyle = gh;
          ctx.fillRect(sx - rr * 1.15, sy - rr * 1.15, rr * 2.3, rr * 2.3);
        }
      }
      // 衝撃波（空気が震えたことが分かる程度に）
      if (false && this.shockR > 0 && !mirror) {
        const a = clamp(1 - this.shockR / (SHELL.radius * 2.4), 0, 1) ** 3 * 0.085 * gA;
        if (a > 0.01) {
          ctx.strokeStyle = `rgba(200,220,255,${a})`;
          ctx.lineWidth = Math.max(1, P.s * 14);
          ctx.beginPath();
          ctx.arc(sx, sy, this.shockR * P.s, 0, 6.2832);
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  lights(out, now) {
    if (this.state === S_RISE) {
      out.push({ x: this.x, y: this.y, z: this.z, r: 255, g: 220, b: 150, power: 0.30, range: 85 });
    } else if (this.state >= S_BURST) {
      const e = now - this.burstAt;
      const p = Math.exp(-e * 0.55) * 2.0;
      if (p > 0.01) out.push({ x: this.x, y: this.y, z: this.z, r: 255, g: 190, b: 150, power: p, range: 420 });
    }
    return out;
  }

  glitter(out, now) {
    if (this.state === S_RISE) {
      out.push({ x: this.x, y: this.y, z: this.z, r: 255, g: 220, b: 150, power: 0.35, width: 26 });
    } else if (this.state >= S_BURST) {
      const e = now - this.burstAt;
      const p = clamp(Math.exp(-e * 0.34) * 1.25, 0, 1.15);
      if (p > 0.02) out.push({ x: this.x, y: this.y, z: this.z, r: 255, g: 186, b: 138, power: p, width: this.radiusNow(now) * 1.1 + 40 });
    }
    return out;
  }
}
