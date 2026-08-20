import { BRIDGE, bridgePoint, NIAGARA_SIDE } from '../world.js';
import { clamp, ramp, fbm1, lerp } from '../math.js';
import { K_SPARK, K_SPLASH } from './particles.js';
import { rng } from '../rng.js';
import { halo } from './sprites.js';

const SEG = 56;                 // 光の滝を作るための分割数
const IGNITE_TIME = 2.35;       // 端から端へ火が走る時間
const RISE = 0.55;              // 1区画が全開になるまで
const FADE = 5.5;               // 燃え尽きるまで

const W3 = { x: 0, y: 0, z: 0 };
const P = { x: 0, y: 0, s: 0, ok: false };
const Q = { x: 0, y: 0, s: 0, ok: false };

// 事前に区画ごとの世界座標を作っておく（毎フレームの計算を減らす）
const TOPS = [], BOTS = [], TS = [];
for (let i = 0; i <= SEG; i++) {
  const t = i / SEG;
  TS.push(t);
  const a = bridgePoint(t, BRIDGE.girderY - 0.35, NIAGARA_SIDE, { x: 0, y: 0, z: 0 });
  TOPS.push(a);
  BOTS.push({ x: a.x, y: 0, z: a.z });
}

/**
 * 橋ナイアガラ。
 * 火薬筒が橋の上流側にずらりと吊られ、点火が端から端へ走り、
 * 850m の光の滝になって川へ落ちる。「下向きの巨大現象」。
 */
export class Niagara {
  constructor() { this.reset(); }

  reset() {
    this.started = false;
    this.t0 = 0;
    this.fadeAt = Infinity;
    this.intensity = 0;
    this.headT = 0;
    this.spawnAcc = new Float32Array(SEG);
    this.elapsed = 0;
  }

  start(now) { if (this.started) return; this.started = true; this.t0 = now; }
  beginFade(now) { if (this.fadeAt === Infinity) this.fadeAt = now; }
  get active() { return this.started; }

  /** 区画 i の炎の強さ 0..1 */
  segIntensity(i, now) {
    if (!this.started) return 0;
    const e = now - this.t0;
    const lit = (i / SEG) * IGNITE_TIME;
    let v = ramp(e, lit, lit + RISE);
    if (now > this.fadeAt) {
      // 端から順に燃え尽きる（一斉に消えないのが本物らしい）
      const f = (now - this.fadeAt) - (1 - i / SEG) * 0.9;
      v *= 1 - ramp(f, 0, FADE);
    }
    return v;
  }

  update(dt, now, parts, smoke, cam, q) {
    if (!this.started) { this.intensity = 0; return; }
    this.elapsed = now - this.t0;
    this.headT = clamp(this.elapsed / IGNITE_TIME, 0, 1);

    let sum = 0;
    const budget = q.niagaraRate;
    for (let i = 0; i < SEG; i++) {
      const inten = this.segIntensity(i, now);
      sum += inten;
      if (inten < 0.02) continue;

      // 画面上での見かけの大きさに応じて粒を配る（遠い区画に無駄を割かない）
      cam.project(TOPS[i].x, TOPS[i].y, TOPS[i].z, P);
      cam.project(TOPS[i + 1].x, TOPS[i + 1].y, TOPS[i + 1].z, Q);
      if (!P.ok || !Q.ok) continue;
      const wpx = Math.hypot(Q.x - P.x, Q.y - P.y);
      const onScreen = P.x > -cam.W * 0.25 && P.x < cam.W * 1.25;
      if (!onScreen) continue;
      const rate = budget * inten * clamp(wpx / (cam.W * 0.05), 0.05, 3.2);
      this.spawnAcc[i] += rate * dt;
      let n = this.spawnAcc[i] | 0;
      if (n > 24) n = 24;
      this.spawnAcc[i] -= n;

      for (let k = 0; k < n; k++) {
        const u = rng.next();
        const A = TOPS[i], B = TOPS[i + 1];
        const x = lerp(A.x, B.x, u), z = lerp(A.z, B.z, u);
        parts.spawn({
          kind: K_SPARK,
          x: x + rng.gauss() * 0.5, y: A.y + rng.range(-0.4, 0.35), z: z + rng.gauss() * 0.5,
          vx: rng.gauss() * 1.0, vy: rng.range(-7.5, -2.0), vz: rng.gauss() * 1.0,
          life: rng.range(0.9, 1.75), size: rng.range(0.26, 0.62),
          drag: 0.16, grav: 13.5, seed: rng.range(0, 6.28),
          r: 255, g: 200, b: 120,
        });
      }

      // 着水のはじけと水煙
      if (rng.next() < inten * dt * 26 * clamp(wpx / (cam.W * 0.05), 0.05, 2.4)) {
        const u = rng.next();
        const A = BOTS[i], B = BOTS[i + 1];
        parts.spawn({
          kind: K_SPLASH,
          x: lerp(A.x, B.x, u), y: 0.15, z: lerp(A.z, B.z, u),
          vx: rng.gauss() * 2.2, vy: rng.range(0.6, 3.4), vz: rng.gauss() * 2.2,
          life: rng.range(0.28, 0.6), size: rng.range(0.14, 0.3),
          drag: 1.6, grav: 11, seed: rng.range(0, 6.28),
          r: 255, g: 215, b: 150,
        });
      }
    }
    this.intensity = clamp(sum / SEG, 0, 1);

    // 煙：橋げたと着水点から立ちのぼる
    if (smoke && this.intensity > 0.05) {
      this._acc = (this._acc || 0) + dt * q.smokeRate * this.intensity * 5.5;
      while (this._acc >= 1) {
        this._acc -= 1;
        const i = (rng.next() * SEG) | 0;
        const inten = this.segIntensity(i, now);
        if (inten < 0.15) continue;
        const A = TOPS[i];
        const low = rng.next() < 0.6;
        smoke.spawn({
          x: A.x + rng.gauss() * 12, y: low ? rng.range(0.5, 4) : rng.range(8, 14), z: A.z + rng.gauss() * 12,
          vx: rng.gauss() * 1.2, vy: rng.range(1.2, 3.4), vz: rng.gauss() * 1.2,
          life: rng.range(6, 11), r0: rng.range(4, 9), grow: rng.range(1.2, 2.6),
          seed: rng.next(), warm: 1,
        });
      }
    }
  }

  /** 光の“身”。粒だけでは滝にならないので、連続した幕を敷く */
  draw(ctx, cam, now, m) {
    if (!this.started) return;
    const mirror = m && m.mirror;
    const wob = m && m.wob;
    const gAlpha = (m && m.alpha) || 1;

    ctx.globalCompositeOperation = 'lighter';
    // 単位空間 (0,0)-(0,1) の勾配を1つ作り、区画ごとに変換して使い回す
    const grd = ctx.createLinearGradient(0, 0, 0, 1);
    grd.addColorStop(0.00, 'rgba(255,247,214,0.95)');
    grd.addColorStop(0.06, 'rgba(255,226,150,0.80)');
    grd.addColorStop(0.30, 'rgba(255,180,80,0.42)');
    grd.addColorStop(0.62, 'rgba(255,132,40,0.22)');
    grd.addColorStop(0.90, 'rgba(230,96,26,0.15)');
    grd.addColorStop(1.00, 'rgba(255,130,45,0.10)');

    const pr = mirror ? cam.projectMirror.bind(cam) : cam.project.bind(cam);

    for (let i = 0; i < SEG; i++) {
      const inten = this.segIntensity(i, now);
      if (inten < 0.02) continue;
      const A = TOPS[i], B = TOPS[i + 1], C = BOTS[i];
      pr(A.x, A.y, A.z, P); if (!P.ok) continue;
      let x0 = P.x, y0 = P.y;
      pr(B.x, B.y, B.z, Q); if (!Q.ok) continue;
      let x0b = Q.x, y0b = Q.y;
      pr(C.x, C.y, C.z, P); if (!P.ok) continue;
      let x1 = P.x, y1 = P.y;
      if (wob) { const w0 = wob(y0, i), w1 = wob(y1, i); x0 += w0; x0b += wob(y0b, i + 1); x1 += w1; }
      if (Math.max(x0, x0b) < -60 || Math.min(x0, x0b) > cam.W + 60) continue;

      // ゆらぎ（炎はまっすぐ落ちない）
      const flick = 0.72 + 0.28 * fbm1(i * 0.7 + now * 2.6, 2) + 0.12 * Math.sin(now * 9 + i);
      ctx.globalAlpha = clamp(inten * flick, 0, 1) * 0.85 * gAlpha;

      ctx.save();
      ctx.transform(x0b - x0, y0b - y0, x1 - x0, y1 - y0, x0, y0);
      ctx.fillStyle = grd;
      ctx.fillRect(-0.06, 0, 1.12, 1);
      ctx.restore();
    }

    // ブルーム。遠景では滝そのものより「光る帯」として見える
    {
      const spr = halo();
      for (let i = 0; i < SEG; i += 3) {
        const inten = this.segIntensity(i, now);
        if (inten < 0.05) continue;
        const A = TOPS[i], B2 = TOPS[Math.min(i + 3, SEG)], C = BOTS[i];
        pr(A.x, A.y, A.z, P); if (!P.ok) continue;
        const ax = P.x + (wob ? wob(P.y, i) : 0), ay = P.y;
        pr(C.x, C.y, C.z, Q); if (!Q.ok) continue;
        const cy2 = Q.y;
        pr(B2.x, B2.y, B2.z, Q); if (!Q.ok) continue;
        const w = Math.abs(Q.x - ax) * 1.9 + 6;
        const h = Math.abs(cy2 - ay) * 2.6 + 8;
        if (ax + w < -20 || ax - w > cam.W + 20) continue;
        ctx.globalAlpha = clamp(inten, 0, 1) * 0.36 * gAlpha;
        ctx.drawImage(spr, ax - w * 0.5, (ay + cy2) * 0.5 - h * 0.5, w, h);
      }
    }

    // 点火線（桁の直下がいちばん白い）
    ctx.globalAlpha = gAlpha;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= SEG; i++) {
        const inten = this.segIntensity(Math.min(i, SEG - 1), now);
        const A = TOPS[i];
        pr(A.x, A.y, A.z, P);
        if (!P.ok || inten < 0.05) { drawing = false; continue; }
        let px = P.x;
        if (wob) px += wob(P.y, i);
        if (!drawing) { ctx.moveTo(px, P.y); drawing = true; } else ctx.lineTo(px, P.y);
      }
      cam.project(TOPS[SEG >> 1].x, TOPS[SEG >> 1].y, TOPS[SEG >> 1].z, P);
      const s = P.ok ? P.s : 0.4;
      ctx.lineWidth = pass === 0 ? Math.max(2.4, s * 2.6) : Math.max(0.9, s * 0.75);
      ctx.strokeStyle = pass === 0 ? `rgba(255,170,70,${0.30 * gAlpha})` : `rgba(255,248,225,${0.9 * gAlpha})`;
      ctx.globalAlpha = 1;
      ctx.stroke();
    }

    // 着水線の光溜まり
    if (!mirror) {
      for (let i = 0; i < SEG; i += 2) {
        const inten = this.segIntensity(i, now);
        if (inten < 0.06) continue;
        const C = BOTS[i];
        cam.project(C.x, C.y, C.z, P);
        if (!P.ok) continue;
        const rad = Math.max(6, P.s * 26);
        const g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, rad);
        g.addColorStop(0, `rgba(255,214,140,${0.34 * inten})`);
        g.addColorStop(0.45, `rgba(255,150,60,${0.13 * inten})`);
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(P.x - rad, P.y - rad * 0.55, rad * 2, rad * 1.1);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** 煙を照らす光源 */
  lights(out, now) {
    if (!this.started) return out;
    for (let k = 0; k < 5; k++) {
      const i = Math.round((k / 4) * (SEG - 1));
      const inten = this.segIntensity(i, now);
      if (inten < 0.05) continue;
      const A = TOPS[i];
      out.push({ x: A.x, y: 5, z: A.z, r: 255, g: 165, b: 70, power: inten * 0.9, range: 210 });
    }
    return out;
  }

  /** 水面に落ちる線光源のサンプル（橋一本ぶんを一つの面として扱う） */
  reflectionLine(out, now) {
    if (!this.started) return out;
    const step = 2;
    for (let i = 0; i <= SEG; i += step) {
      const inten = this.segIntensity(Math.min(i, SEG - 1), now);
      const A = TOPS[i];
      out.push({ x: A.x, y: 6.0, z: A.z, power: inten });
    }
    return out;
  }
}
