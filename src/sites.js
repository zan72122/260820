// 川に沿って並ぶ打上げ地点（台船）と、それをつなぐ導火の光。
// 「点いた場所のとなりが点けられるようになる」＝ 操作がそのまま横の広がりになる。
import { clamp, lerp, TAU, easeOutCubic } from './util.js';
import { LAYOUT } from './world.js';

export const LOCKED = 0, ARMED = 1, LIT = 2;

export function buildSites(count, spanX) {
  const sites = [];
  const mid = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const t = (i - mid) / mid; // -1..1
    sites.push({
      i,
      x: t * spanX,
      z: LAYOUT.launchZ + Math.sin(i * 1.7) * 12,   // 中州のわずかな蛇行
      t,
      state: LOCKED,
      litAt: -1,
      pulse: 0,
      pop: 0,
    });
  }
  const c = Math.round(mid);
  sites[c].state = ARMED;
  return sites;
}

export class Fuses {
  constructor() { this.list = []; }
  add(from, to, dur, onArrive) {
    this.list.push({ ax: from.x, az: from.z, bx: to.x, bz: to.z, t: 0, dur, onArrive, done: false });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      if (f.t >= f.dur && !f.done) { f.done = true; f.onArrive && f.onArrive(); }
      if (f.t >= f.dur + 0.5) this.list.splice(i, 1);
    }
  }
  reset() { this.list.length = 0; }
}

// 導火の光が水面を走る
export function drawFuses(ctx, cam, fuses, t) {
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of fuses.list) {
    const k = clamp(f.t / f.dur, 0, 1);
    const head = easeOutCubic(k);
    const tailK = Math.max(0, head - 0.42);
    // 走る線
    ctx.beginPath();
    let first = true;
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const u = lerp(tailK, head, i / N);
      const x = lerp(f.ax, f.bx, u), z = lerp(f.az, f.bz, u);
      cam.project(x, 2.2 + Math.sin(t * 8 + u * 9) * 0.8, z, p);
      if (!p.vis) { first = true; continue; }
      if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
    }
    cam.project(lerp(f.ax, f.bx, head), 2, lerp(f.az, f.bz, head), p);
    const lw = p.vis ? Math.max(1.6, p.scale * 4.2) : 2;
    ctx.strokeStyle = `rgba(255,206,132,${0.85 * (1 - Math.max(0, f.t - f.dur) * 2)})`;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
    // 先頭の火の玉
    if (p.vis && f.t <= f.dur) {
      const r = Math.max(6, p.scale * 15);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(255,246,214,0.95)');
      g.addColorStop(0.3, 'rgba(255,180,90,0.55)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}

// つながった地点をむすぶ光の帯（＝どこまで広がったかが一目でわかる）
export function drawChain(ctx, cam, sites, t) {
  const lit = sites.filter(s => s.state === LIT).sort((a, b) => a.x - b.x);
  if (lit.length < 2) return;
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  let first = true;
  for (let i = 0; i < lit.length; i++) {
    const s = lit[i];
    const steps = 4;
    for (let k = 0; k < steps; k++) {
      const nx = i < lit.length - 1 ? lerp(s.x, lit[i + 1].x, k / steps) : s.x;
      const nz = i < lit.length - 1 ? lerp(s.z, lit[i + 1].z, k / steps) : s.z;
      cam.project(nx, 1.6 + Math.sin(t * 2.2 + nx * 0.01) * 0.7, nz, p);
      if (!p.vis) { first = true; continue; }
      if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
    }
  }
  ctx.strokeStyle = 'rgba(255,178,96,0.34)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

// 台船とマーカー。armed は大きく脈打ち、4歳児にも「ここ！」が伝わるようにする。
export function drawSites(ctx, cam, sites, t, opts = {}) {
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  const out = [];
  for (const s of sites) {
    cam.project(s.x, 0, s.z, p);
    if (!p.vis) { s._sx = null; continue; }
    s._sx = p.x; s._sy = p.y; s._ss = p.scale;
    out.push(s);
  }
  // 台船のシルエット
  ctx.save();
  ctx.fillStyle = '#03050c';
  for (const s of out) {
    const w = Math.max(2, s._ss * 20), h = Math.max(1, s._ss * 5);
    ctx.fillRect(s._sx - w / 2, s._sy - h * 0.5, w, h);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of out) {
    const x = s._sx, y = s._sy;
    if (s.state === ARMED) {
      const beat = 0.5 + 0.5 * Math.sin(t * 3.4 + s.i);
      const R = Math.max(20, s._ss * 34) * (0.75 + beat * 0.5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,248,224,${0.55 + beat * 0.25})`);
      g.addColorStop(0.22, `rgba(255,206,130,${0.30 + beat * 0.16})`);
      g.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);

      // 立ちのぼる細い光（遠くの地点でも見つけやすく）
      const top = cam.project(s.x, 44, s.z, p);
      if (top.vis) {
        const lg = ctx.createLinearGradient(x, y, top.x, top.y);
        lg.addColorStop(0, `rgba(255,214,150,${0.32 + beat * 0.22})`);
        lg.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = Math.max(1.4, s._ss * 4.5);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(top.x, top.y); ctx.stroke();
      }

      // 触っていいことを示す輪
      const rr = Math.max(15, s._ss * 24) * (0.6 + beat * 0.9);
      ctx.strokeStyle = `rgba(255,236,200,${0.42 * (1 - beat * 0.6)})`;
      ctx.lineWidth = Math.max(1.2, s._ss * 2.6);
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.34, 0, 0, TAU); ctx.stroke();
    } else if (s.state === LIT) {
      const age = t - s.litAt;
      const k = Math.exp(-age * 1.1);
      const R = Math.max(12, s._ss * 26) * (0.5 + k * 1.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,232,190,${0.28 + k * 0.55})`);
      g.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
    } else if (opts.showLocked) {
      const R = Math.max(4, s._ss * 9);
      ctx.fillStyle = 'rgba(120,140,180,0.10)';
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.34, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  return out;
}

// 画面座標でのヒットテスト（指の太さを考えて必ず大きめに取る）
export function hitTest(sites, sx, sy, minR) {
  let best = null, bestD = Infinity;
  for (const s of sites) {
    if (s.state !== ARMED || s.pending || s._sx == null) continue;
    const r = Math.max(minR, (s._ss || 0) * 48);
    const dx = sx - s._sx, dy = (sy - s._sy) * 0.72;
    const d = Math.hypot(dx, dy);
    if (d < r && d < bestD) { best = s; bestD = d; }
  }
  return best;
}
