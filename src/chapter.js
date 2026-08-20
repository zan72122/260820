import { Camera } from './camera.js';
import { Particles } from './fx/particles.js';
import { Smoke } from './fx/smoke.js';
import { Niagara } from './fx/niagara.js';
import { Shell, S_IDLE, S_BURST } from './fx/shell.js';
import { Sound } from './audio.js';
import { drawSky, drawAirFlash, drawVignette } from './render/sky.js';
import { drawFar, drawNearBank } from './render/terrain.js';
import { drawBridge } from './render/bridge.js';
import {
  drawWaterBase, drawWaterSurface, drawStaticReflections,
  drawLightPath, drawLineLightPath, makeWobble, clipWater, unclip, waterTopY,
} from './render/water.js';
import { BRIDGE, bridgePoint, SHELL, LAUNCH } from './world.js';
import { clamp, lerp, smoothstep } from './math.js';
import { rng } from './rng.js';
import { grain } from './fx/sprites.js';

export const PH = {
  TITLE: 'title',
  ESTABLISH: 'establish',
  WAIT_NIAGARA: 'wait_niagara',
  NIAGARA: 'niagara',
  CUE: 'cue',
  RISE: 'rise',
  BURST: 'burst',
  WIDE: 'wide',
  AFTERGLOW: 'afterglow',
  RESULT: 'result',
};

export const QUALITY = {
  high: { niagaraRate: 55, trailRate: 90, smokeRate: 1.0, starScale: 1.0, pool: 7000, smokePool: 170, glitterDetail: true, reflect: 1.0, mirrorStride: 2 },
  mid:  { niagaraRate: 38,  trailRate: 58, smokeRate: 0.7, starScale: 0.58, pool: 4400, smokePool: 120, glitterDetail: true, reflect: 0.9, mirrorStride: 3 },
  low:  { niagaraRate: 20,  trailRate: 32, smokeRate: 0.38, starScale: 0.30, pool: 2200, smokePool: 70, glitterDetail: false, reflect: 0.7, mirrorStride: 4 },
};

const W3 = { x: 0, y: 0, z: 0 };
const pt = (x, y, z) => ({ x, y, z });
const AMB = { x: 0, y: 0, z: 0 };

/** ふたつのフレーミングをなめらかに混ぜる（f は対数で） */
function blend(a, b, k) {
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    z: lerp(a.z, b.z, k),
    tilt: lerp(a.tilt, b.tilt, k),
    f: Math.exp(lerp(Math.log(a.f), Math.log(b.f), k)),
  };
}

/** 橋のフレーミング用サンプル点 */
function bridgePts(t0, t1, n, withApex, withWater) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n);
    bridgePoint(t, BRIDGE.deckY, 0, W3);
    out.push(pt(W3.x, withApex ? BRIDGE.deckY + BRIDGE.trussH : W3.y, W3.z));
    if (withWater) out.push(pt(W3.x, 0, W3.z));
  }
  return out;
}

export class Chapter {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.cam = new Camera();
    this.snd = new Sound();
    this.q = QUALITY.high;
    this.parts = new Particles(this.q.pool);
    this.smoke = new Smoke(this.q.smokePool);
    this.niagara = new Niagara();
    this.shell = new Shell();
    this.env = { t: 0, flash: 0, niagara: 0, warmGlow: 0 };
    this.wind = { x: 2.4, z: -0.6 };
    this.lights = [];
    this.glitter = [];
    this.refLine = [];
    this.time = 0;
    this.phase = PH.TITLE;
    this.phaseT = 0;
    this.niagaraStart = -1;
    this.launchAt = -1;
    this.burstAt = -1;
    this.grade = null;
    this.cinema = false;
    this.pan = 0;
    this.started = false;
  }

  setQuality(name) {
    const q = QUALITY[name];
    if (!q || q === this.q) return;
    this.q = q;
    if (this.parts.max !== q.pool) this.parts = new Particles(q.pool);
    if (this.smoke.max !== q.smokePool) this.smoke = new Smoke(q.smokePool);
    this.qualityName = name;
  }

  reset() {
    this.parts.clear(); this.smoke.clear();
    this.niagara.reset(); this.shell.reset();
    this.time = 0; this.phaseT = 0;
    this.niagaraStart = -1; this.launchAt = -1; this.burstAt = -1;
    this.grade = null; this.cinema = false; this.pan = 0; this.started = false;
    this.env.flash = 0; this.env.niagara = 0; this.env.warmGlow = 0;
    this.snd.stopNiagara();
    this.setPhase(PH.TITLE);
    this.camSnap = true;
  }

  setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this.phaseT = 0;
    if (this.hooks.onPhase) this.hooks.onPhase(p, this);
  }

  // ---------------- 入力（大きく2つだけ） ----------------
  begin() {
    if (this.started) return;
    this.started = true;
    this.snd.resume();
    this.setPhase(PH.ESTABLISH);
  }

  lightNiagara() {
    if (this.niagara.active) return false;
    this.niagara.start(this.time);
    this.niagaraStart = this.time;
    this.snd.resume();
    this.snd.startNiagara();
    this.setPhase(PH.NIAGARA);
    return true;
  }

  fireShell() {
    if (this.shell.state !== S_IDLE) return false;
    if (!this.niagara.active) this.lightNiagara();     // 順番を間違えても成立させる
    this.shell.launch(this.time);
    this.launchAt = this.time;
    this.snd.resume();
    this.snd.rise(SHELL.riseTime);
    this.setPhase(PH.RISE);
    return true;
  }

  // ---------------- 更新 ----------------
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.phaseT += dt;
    this.env.t = this.time;

    this.runPhases(dt);

    this.updateAmbient(dt);
    this.niagara.update(dt, this.time, this.parts, this.smoke, this.cam, this.q);
    this.shell.update(dt, this.time, this.parts, this.smoke, this.cam, this.q, (s) => this.onBurst(s));
    this.parts.update(dt, this.wind);
    this.smoke.update(dt, this.wind);

    this.env.niagara = this.niagara.intensity;
    this.env.warmGlow = this.niagara.intensity;
    this.env.flash = this.shell.flash;
    this.snd.setNiagara(this.niagara.intensity);

    this.updateCamera(dt);
  }

  onBurst(s) {
    this.burstAt = this.time;
    this.cam.addShake(0.55);
    const dist = Math.hypot(s.x - this.cam.x, s.y - this.cam.y, s.z - this.cam.z);
    this.snd.burst(clamp(dist / 340, 0, 2.2) * 0.75);
    this.setPhase(PH.BURST);
    this.grade = this.computeGrade();
    if (this.hooks.onBurst) this.hooks.onBurst(this);
  }

  computeGrade() {
    const d = this.launchAt - this.niagaraStart;   // 点火から打ち上げまで
    let stars = 3, key = 'perfect';
    if (d < 1.2) { stars = 2; key = 'early'; }
    else if (d > 15) { stars = 2; key = 'late'; }
    return { stars, key, delay: d, niagaraAtBurst: this.niagara.intensity };
  }

  runPhases(dt) {
    const H = this.hooks;
    switch (this.phase) {
      case PH.ESTABLISH:
        if (this.phaseT > 2.6) this.setPhase(PH.WAIT_NIAGARA);
        break;
      case PH.NIAGARA:
        // 点火が渡りきったら、視線を上へ引っ張る合図
        if (this.phaseT > 3.4) { this.snd.cue(); this.setPhase(PH.CUE); }
        break;
      case PH.CUE:
        // 押さなくても終わらないように、長く待ってから自動で上げる
        if (this.phaseT > 22) this.fireShell();
        break;
      case PH.BURST:
        if (this.phaseT > 0.5) this.setPhase(PH.WIDE);
        break;
      case PH.WIDE:
        if (this.phaseT > 5.4) {
          this.niagara.beginFade(this.time);     // 引きの絵を撮り終えてから燃え尽きさせる
          this.cinema = true;
          this.setPhase(PH.AFTERGLOW);
        }
        break;
      case PH.AFTERGLOW:
        if (this.phaseT > 7.0) { this.cinema = false; this.setPhase(PH.RESULT); }
        break;
    }
  }

  // ---------------- カメラ演出 ----------------
  updateCamera(dt) {
    const cam = this.cam;
    const t = this.time;
    let target, omega = 1.5;
    const cy = cam.y, cz = cam.z;

    const drift = Math.sin(t * 0.11) * 0.5 + Math.sin(t * 0.071 + 1.2) * 0.5;

    switch (this.phase) {
      case PH.TITLE:
      case PH.ESTABLISH:
      case PH.WAIT_NIAGARA: {
        // まず橋を十分に見せる。全長ではなく手前半分に寄って、トラスの骨格を見せる
        const tEnd = this.frameSpan();
        const pts = bridgePts(0.02, tEnd, 6, true, true);
        for (let i = 0; i <= 2; i++) {
          bridgePoint(i / 2 * tEnd, -BRIDGE.deckY * 0.7, 0, W3);
          pts.push(pt(W3.x, W3.y, W3.z));
        }
        target = cam.fit(pts, { y: cy, z: cz, marginX: 0.03, marginY: 0.05, biasY: 0.0, horizonMin: 0.44, horizonMax: 0.66, maxF: 2600 });
        target.f *= 1.0 + drift * 0.012;
        target.y = 6.6; target.z = -58;
        omega = 0.9;
        break;
      }
      case PH.NIAGARA: {
        // 滝の流れに寄り添う。点火の先頭へゆっくり視線を送る
        const tEnd = clamp(this.frameSpan() + 0.10, 0.26, 0.76);
        const pts = bridgePts(0.02, tEnd, 6, true, true);
        // 水面の映り込みも入れる
        for (let i = 0; i <= 3; i++) {
          bridgePoint(i / 3 * tEnd, -BRIDGE.deckY * 0.85, 0, W3);
          pts.push(pt(W3.x, W3.y, W3.z));
        }
        target = cam.fit(pts, { y: cy, z: cz, marginX: 0.02, marginY: 0.03, biasY: 0.0, horizonMin: 0.40, horizonMax: 0.62, maxF: 2600 });
        target.f *= lerp(1.0, 1.16, smoothstep(this.phaseT / 3.0));
        // 点火の先頭に沿ってゆっくりパン
        const head = clamp(this.niagara.headT, 0, 1);
        bridgePoint(head, BRIDGE.deckY, 0, W3);
        const mid = bridgePoint(0.5, BRIDGE.deckY, 0, { x: 0, y: 0, z: 0 });
        this.pan = lerp(this.pan, (W3.x - mid.x) * 0.34, 1 - Math.exp(-dt * 1.2));
        target.x += this.pan;
        target.y = 6.2; target.z = -52;
        omega = 1.0;
        break;
      }
      case PH.CUE: {
        // 空を開ける。視線が自然に上を向く
        const pts = bridgePts(0.15, 0.9, 5, true, false);
        pts.push(pt(LAUNCH.x, 300, LAUNCH.z));
        pts.push(pt(LAUNCH.x - 120, 30, LAUNCH.z));
        target = cam.fit(pts, { y: cy, z: cz, marginX: 0.05, marginY: 0.08, biasY: 0.06, maxF: 1400 });
        target.x += this.pan * 0.4;
        this.pan *= Math.exp(-dt * 0.9);
        target.y = 7.0; target.z = -62;
        omega = 0.85;
        break;
      }
      case PH.RISE: {
        // 昇る玉を追う。ただし橋を切り捨てない（上下同時を保つ）
        const s = this.shell;
        const pts = bridgePts(0.16, 0.80, 4, true, true);
        pts.push(pt(s.x, s.y + 110, s.z));
        pts.push(pt(s.x - 110, s.y, s.z));
        pts.push(pt(s.x + 110, s.y, s.z));
        const follow = cam.fit(pts, { y: cy, z: cz, marginX: 0.05, marginY: 0.06, biasY: 0.02, maxF: 2600 });
        // 開発の前に引きの絵へ寄せておく。開いた瞬間に画面を切らないための下準備。
        const wide = this.wideTarget(t, cy, cz, true);
        const p = clamp((t - this.launchAt) / SHELL.riseTime, 0, 1);
        const k = smoothstep((p - 0.26) / 0.62);
        target = blend(follow, wide, k);
        target.y = lerp(6.5, 11.5, k); target.z = lerp(-64, -92, k);
        omega = 1.5;
        break;
      }
      case PH.BURST: {
        // 肝心の瞬間は切らない。すでにほぼ引きの絵にいるので、わずかに息をのむだけ
        target = this.wideTarget(t, cy, cz, false);
        target.f *= 1.05;
        target.y = 11.5; target.z = -92;
        omega = 1.4;
        break;
      }
      case PH.WIDE:
      case PH.AFTERGLOW:
      case PH.RESULT: {
        target = this.wideTarget(t, cy, cz, false);
        const k = this.phase === PH.WIDE ? 0 : 1;
        target.y = 11.5 + k * 0.6;
        target.z = -92 - k * 14;
        target.f *= 1 + drift * 0.010 * (1 + k);
        omega = this.phase === PH.WIDE ? 1.7 : 0.5;
        break;
      }
      default:
        target = { x: cam.x, y: cam.y, z: cam.z, f: cam.f, tilt: cam.tilt };
    }

    if (this.camSnap) { this.camSnap = false; cam.snap(target); }
    else cam.approach(target, dt, omega);
    cam.updateShake(dt, t);
  }

  /** 画面の縦横比に応じて、寄りの絵で見せる橋の割合を決める */
  frameSpan() {
    const a = this.cam.W / Math.max(1, this.cam.H);
    return clamp(0.10 + a * 0.21, 0.20, 0.58);
  }

  /** 遠くで上がり続けている他の花火。長岡の夜は一晩じゅうこう */
  updateAmbient(dt) {
    if (this.shell.state !== S_IDLE || this.phase === PH.TITLE) return;
    this._amb = (this._amb ?? 2.0) - dt;
    if (this._amb > 0) return;
    this._amb = rng.range(3.0, 6.5);
    const x = rng.range(-2400, 2400);
    const z = rng.range(3200, 5400);
    const y = rng.range(160, 340);
    const hue = rng.next();
    const col = hue < 0.34 ? [168, 126, 74] : (hue < 0.67 ? [100, 140, 172] : [170, 96, 116]);
    const n = Math.round(rng.range(50, 110) * this.q.starScale + 24);
    const v = rng.range(46, 78);
    for (let i = 0; i < n; i++) {
      rng.dir3(AMB);
      const sp = v * (0.8 + rng.next() * 0.4);
      this.parts.spawn({
        kind: 1, x, y, z,
        vx: AMB.x * sp, vy: AMB.y * sp, vz: AMB.z * sp,
        life: rng.range(2.0, 3.4), size: rng.range(0.9, 2.0),
        drag: 0.9, grav: 3.0, seed: rng.range(0, 6.28),
        r: col[0], g: col[1], b: col[2], r2: col[0], g2: col[1], b2: col[2], chg: -1,
      });
    }
    if (rng.next() < 0.7) this.snd.boom(0.10, 1.1, 34);
  }

  /** 決定的な引きの絵：橋の全長・上空の大玉・水面の映り込みを一枚に */
  wideTarget(t, cy, cz, atApex) {
    const s = this.shell;
    const r = SHELL.radius * 0.95;   // 実際に光って見える範囲で固定（開発の瞬間に構図を動かさない）
    const sx = (atApex || s.state === S_IDLE) ? LAUNCH.x : s.x;
    const sy = (atApex || s.state === S_IDLE) ? SHELL.apex : s.y;
    const sz = s.z;
    const pts = bridgePts(0, 1, 8, true, true);
    pts.push(pt(sx, sy + r * 1.10, sz));
    pts.push(pt(sx, sy - r * 0.9, sz));
    pts.push(pt(sx - r * 0.95, sy, sz));
    pts.push(pt(sx + r * 0.95, sy, sz));
    // 水面に落ちる映り込みの分だけ下に余白を取る
    // 水面に映った大玉の上半分までを画面に入れる（上下＋水面を一枚にするため）
    pts.push(pt(sx, -(sy - r * 0.30), sz));
    for (let i = 0; i <= 2; i++) {
      bridgePoint(i / 2, -BRIDGE.deckY, 0, W3);
      pts.push(pt(W3.x, W3.y, W3.z));
    }
    const tg = this.cam.fit(pts, {
      y: cy, z: cz, marginX: 0.045, marginY: 0.095, biasY: 0.0,
      horizonMin: 0.50, horizonMax: 0.80, maxF: 1400,
    });
    return tg;
  }

  // ---------------- 描画 ----------------
  render(ctx) {
    const cam = this.cam, env = this.env, t = this.time;
    const W = cam.W, H = cam.H;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#03050b';
    ctx.fillRect(0, 0, W, H);

    // 光源をまとめる（煙と水面が共通で使う）
    this.lights.length = 0;
    this.niagara.lights(this.lights, t);
    this.shell.lights(this.lights, t);

    drawSky(ctx, cam, env);
    drawFar(ctx, cam, env);

    // ---- 川 ----
    drawWaterBase(ctx, cam, env);
    const wob = makeWobble(cam, t, 1);
    const wobHard = makeWobble(cam, t, 2.3);
    const refA = this.q.reflect;
    clipWater(ctx, cam);
    drawStaticReflections(ctx, cam, env, t);

    // 光の道（ナイアガラは線光源として一枚で、大玉は点光源として）
    this.refLine.length = 0;
    this.niagara.reflectionLine(this.refLine, t);
    drawLineLightPath(ctx, cam, this.refLine, t, this.q.glitterDetail);
    this.glitter.length = 0;
    this.shell.glitter(this.glitter, t);
    for (let i = 0; i < this.glitter.length; i++) {
      drawLightPath(ctx, cam, this.glitter[i], t, this.q.glitterDetail);
    }

    // 鏡像。黒い骨組みは黒い川面に映っても見えないので、光だけを映す
    ctx.globalAlpha = 1;
    this.niagara.draw(ctx, cam, t, { mirror: true, wob, alpha: 0.62 * refA });
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx, cam, { mirror: true, alpha: 0.16 * refA * Math.min(3, this.q.mirrorStride), wobble: (sy, seed) => wobHard(sy, seed), time: t, stride: this.q.mirrorStride, simple: true, simpleSize: 3.2, kindMask: 0b0110 });   // 星と尾だけ映す（火の粉の反射は幕と光の道が担う）
    ctx.globalCompositeOperation = 'source-over';
    this.shell.draw(ctx, cam, t, { mirror: true, wob, alpha: 0.26 * refA });
    unclip(ctx);

    drawWaterSurface(ctx, cam, env, t);

    // ---- 空側 ----
    this.smoke.draw(ctx, cam, this.lights, { alpha: 0.9 });
    drawBridge(ctx, cam, env, null);
    this.niagara.draw(ctx, cam, t, null);

    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx, cam, { time: t });
    ctx.globalCompositeOperation = 'source-over';
    this.shell.draw(ctx, cam, t, null);

    drawNearBank(ctx, cam, env);
    drawAirFlash(ctx, cam, env.flash * 0.5, '#3a3a34');
    drawVignette(ctx, cam);
    this.drawGrain(ctx, cam);
  }

  /** 粒状感。暗い階調のバンディングを消し、写真らしい肌理を与える */
  drawGrain(ctx, cam) {
    if (!this._grainPat) {
      try { this._grainPat = ctx.createPattern(grain(), 'repeat'); } catch { this._grainPat = null; }
    }
    if (!this._grainPat || this.qualityName === 'low') return;
    // 段差が目立つのは空の階調なので、水平線より上だけに掛ける
    const h = Math.max(0, Math.min(cam.H, cam.horizonY() + cam.H * 0.06));
    if (h < 2) return;
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = this._grainPat;
    ctx.fillRect(0, 0, cam.W, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** いま生きている星の、画面外へのはみ出し量（px） */
  measureOverflow() {
    const p = this.parts, cam = this.cam;
    let top = 0, bottom = 0, left = 0, right = 0;
    for (let i = 0; i < p.n; i++) {
      if (!p.alive[i] || p.kind[i] !== 1) continue;
      const dz = p.z[i] - cam.z;
      if (dz < 3) continue;
      const s = cam.f / dz;
      const sx = cam.cx + (p.x[i] - cam.x) * s;
      const sy = cam.cyT - (p.y[i] - cam.y) * s;
      if (sy < 0) top = Math.max(top, -sy);
      if (sy > cam.H) bottom = Math.max(bottom, sy - cam.H);
      if (sx < 0) left = Math.max(left, -sx);
      if (sx > cam.W) right = Math.max(right, sx - cam.W);
    }
    return { top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right) };
  }

  /** テスト用の状態 */
  snapshot() {
    return {
      phase: this.phase,
      time: +this.time.toFixed(3),
      niagara: +this.niagara.intensity.toFixed(3),
      niagaraStarted: this.niagara.active,
      shellState: this.shell.state,
      shellY: +this.shell.y.toFixed(1),
      burst: this.shell.state >= S_BURST,
      particles: this.parts.count,
      smoke: this.smoke.count,
      grade: this.grade,
      cam: { f: +this.cam.f.toFixed(1), x: +this.cam.x.toFixed(1), tilt: +this.cam.tilt.toFixed(1), horizon: +(this.cam.horizonY() / this.cam.H).toFixed(3) },
      // 実際に描かれている星が画面からどれだけはみ出しているか（px, 0 なら収まっている）
      overflow: this.measureOverflow(),
    };
  }
}
