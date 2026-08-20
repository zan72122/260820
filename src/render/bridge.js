import { BRIDGE, bridgePoint } from '../world.js';
import { clamp } from '../math.js';

const W3 = { x: 0, y: 0, z: 0 };
const P = { x: 0, y: 0, s: 0, ok: false };

const N = BRIDGE.spans;
const DECK = BRIDGE.deckY;
const GIRD = BRIDGE.girderY;
const APEX = BRIDGE.deckY + BRIDGE.trussH;

// 橋の照明（ナトリウム灯）。反射にも使うので位置を公開する
export const DECK_LAMPS = [];
for (let i = 0; i <= N * 2; i++) {
  const t = i / (N * 2);
  const p = bridgePoint(t, DECK + 4.6, -0.5, { x: 0, y: 0, z: 0 });
  DECK_LAMPS.push({ x: p.x, y: p.y, z: p.z, m: 0.85 + 0.15 * ((i * 7) % 5) / 5 });
}

/** 投影ヘルパ（鏡像・水面のゆらぎに対応） */
function proj(cam, t, y, side, m, out) {
  bridgePoint(t, y, side, W3);
  if (m && m.mirror) cam.projectMirror(W3.x, W3.y, W3.z, out);
  else cam.project(W3.x, W3.y, W3.z, out);
  if (out.ok && m && m.wob) out.x += m.wob(out.y, t * 13.7);
  return out;
}

function tri(ctx, a, b, c) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.fill();
}
function quad(ctx, a, b, c, d) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
}

const A = { x: 0, y: 0 }, B = { x: 0, y: 0 }, C = { x: 0, y: 0 }, D = { x: 0, y: 0 };
const cp = (o, p) => { o.x = p.x; o.y = p.y; };

/**
 * 長生橋。13連トラスの三角形が連なる独特のシルエット。
 * ナイアガラが点くと下から炙られて、骨組みの縁だけが赤く浮く。
 */
export function drawBridge(ctx, cam, env, m) {
  const mirror = m && m.mirror;
  const glowAmt = env.niagara || 0;         // 0..1
  const flash = env.flash || 0;

  // 逆光・環境光でシルエットの色を決める
  const base = mirror ? 0.55 : 1;
  const rC = (7 + 46 * glowAmt + 70 * flash) * base;
  const gC = (11 + 24 * glowAmt + 68 * flash) * base;
  const bC = (20 + 10 * glowAmt + 66 * flash) * base;
  const dark = `rgb(${rC | 0},${gC | 0},${bC | 0})`;
  const darkFar = `rgb(${(rC * 0.72 + 6) | 0},${(gC * 0.72 + 8) | 0},${(bC * 0.72 + 13) | 0})`;

  const lw = () => {
    proj(cam, 0.5, DECK, 0, m, P);
    return P.ok ? P.s : 1;
  };
  const scaleMid = lw();

  // ---- 1) 奥側のトラス ----
  drawTrussPlane(ctx, cam, m, +1, darkFar, env, 0.85);

  // ---- 2) 橋脚（14基）。水際は光にとけるように落とす ----
  const pierCol = mirror ? [40, 44, 56] : [(rC * 1.5 + 8) | 0, (gC * 1.3 + 8) | 0, (bC * 1.2 + 12) | 0];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const halfW = (BRIDGE.pierW * 0.5) / (BRIDGE.width * 0.5);
    proj(cam, t, GIRD, -halfW, m, P); cp(A, P); const ok = P.ok;
    proj(cam, t, GIRD, +halfW, m, P); cp(B, P);
    proj(cam, t, BRIDGE.pierBottom, +halfW, m, P); cp(C, P);
    proj(cam, t, BRIDGE.pierBottom, -halfW, m, P); cp(D, P);
    if (!ok || !P.ok) continue;
    const gp = ctx.createLinearGradient(0, A.y, 0, D.y);
    gp.addColorStop(0, `rgba(${pierCol[0]},${pierCol[1]},${pierCol[2]},1)`);
    gp.addColorStop(0.55, `rgba(${pierCol[0]},${pierCol[1]},${pierCol[2]},0.8)`);
    gp.addColorStop(1, `rgba(${pierCol[0]},${pierCol[1]},${pierCol[2]},0)`);
    ctx.fillStyle = gp;
    quad(ctx, A, B, C, D);
  }

  // ---- 3) 桁と路面 ----
  ctx.fillStyle = dark;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    proj(cam, t0, DECK, -1, m, P); cp(A, P); const ok = P.ok;
    proj(cam, t1, DECK, -1, m, P); cp(B, P);
    proj(cam, t1, GIRD, -1, m, P); cp(C, P);
    proj(cam, t0, GIRD, -1, m, P); cp(D, P);
    if (!ok || !P.ok) continue;
    quad(ctx, A, B, C, D);
  }

  // ---- 4) 手前側のトラス ----
  drawTrussPlane(ctx, cam, m, -1, dark, env, 1);

  // ---- 5) 橋の照明 ----
  if (!mirror) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < DECK_LAMPS.length; i++) {
      const L = DECK_LAMPS[i];
      cam.project(L.x, L.y, L.z, P);
      if (!P.ok || P.x < -20 || P.x > cam.W + 20) continue;
      const a = L.m * (0.55 - 0.32 * glowAmt) * (1 - flash * 0.6);
      if (a <= 0.02) continue;
      const rad = clamp(P.s * 7, 1.6, 14);
      const g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, rad * 3.2);
      g.addColorStop(0, `rgba(255,236,190,${a})`);
      g.addColorStop(0.3, `rgba(255,190,110,${a * 0.42})`);
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(P.x - rad * 3.2, P.y - rad * 3.2, rad * 6.4, rad * 6.4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- 6) ナイアガラ点火中の“縁光り” ----
  if (glowAmt > 0.02 && !mirror) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,180,90,${0.30 * glowAmt})`;
    ctx.lineWidth = Math.max(1, scaleMid * 0.35);
    ctx.beginPath();
    for (let i = 0; i <= N * 2; i++) {
      const t = i / (N * 2);
      proj(cam, t, GIRD - 0.2, -1, m, P);
      if (!P.ok) continue;
      if (i === 0) ctx.moveTo(P.x, P.y); else ctx.lineTo(P.x, P.y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** トラス面（三角形が連なる長生橋らしい骨組み） */
function drawTrussPlane(ctx, cam, m, side, color, env, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';

  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) * 0.5;
    proj(cam, t0, DECK, side, m, P); cp(A, P); const ok0 = P.ok;
    proj(cam, t1, DECK, side, m, P); cp(B, P); const ok1 = P.ok;
    proj(cam, tm, APEX, side, m, P); cp(C, P); const ok2 = P.ok;
    if (!ok0 || !ok1 || !ok2) continue;
    const spanPx = Math.abs(B.x - A.x);
    const memberW = clamp(spanPx * 0.016, 0.9, 5.5);

    ctx.lineWidth = memberW;
    // 上弦材（山形）
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.lineTo(B.x, B.y);
    ctx.stroke();
    // 端柱（垂直）
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(A.x, A.y - (A.y - C.y) * 0.0);
    ctx.stroke();

    if (spanPx > 26) {
      // 斜材・垂直材（1/4, 1/2, 3/4）
      ctx.lineWidth = Math.max(0.7, memberW * 0.62);
      ctx.beginPath();
      for (let k = 1; k <= 3; k++) {
        const tk = t0 + (t1 - t0) * (k / 4);
        // 上弦材上の高さ（山形の内挿）
        const u = k / 4;
        const hTop = DECK + (BRIDGE.trussH) * (1 - Math.abs(u - 0.5) * 2);
        proj(cam, tk, DECK, side, m, P); const bx = P.x, by = P.y;
        proj(cam, tk, hTop, side, m, P);
        if (!P.ok) continue;
        ctx.moveTo(bx, by); ctx.lineTo(P.x, P.y);
      }
      // ジグザグの斜材
      for (let k = 0; k < 4; k++) {
        const ta = t0 + (t1 - t0) * (k / 4);
        const tb = t0 + (t1 - t0) * ((k + 1) / 4);
        const ua = k / 4, ub = (k + 1) / 4;
        const ha = DECK + BRIDGE.trussH * (1 - Math.abs(ua - 0.5) * 2);
        const hb = DECK + BRIDGE.trussH * (1 - Math.abs(ub - 0.5) * 2);
        if (k % 2 === 0) {
          proj(cam, ta, DECK, side, m, P); const ax = P.x, ay = P.y;
          proj(cam, tb, hb, side, m, P);
          if (P.ok) { ctx.moveTo(ax, ay); ctx.lineTo(P.x, P.y); }
        } else {
          proj(cam, ta, ha, side, m, P); const ax = P.x, ay = P.y;
          proj(cam, tb, DECK, side, m, P);
          if (P.ok) { ctx.moveTo(ax, ay); ctx.lineTo(P.x, P.y); }
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
