import { clamp, fbm1 } from '../math.js';
import { Rng } from '../rng.js';
import { TOWN_LIGHTS } from './terrain.js';
import { DECK_LAMPS } from './bridge.js';

const P = { x: 0, y: 0, s: 0, ok: false };
const rr = new Rng(9091);
const RIPPLES = [];
for (let i = 0; i < 260; i++) {
  RIPPLES.push({ u: rr.next(), v: rr.next(), w: rr.range(0.02, 0.16), ph: rr.range(0, 6.28), sp: rr.range(0.4, 1.5) });
}

/** 水面の見えている上端（対岸の汀線） */
export function waterTopY(cam) {
  cam.project(0, 0, 1250, P);
  return P.ok ? P.y : cam.horizonY();
}

/**
 * 反射をゆらす関数。水平線に近いほど揺れは小さく、手前ほど大きい。
 * 反射像を「行ごとにずらす」代わりに頂点単位でずらすので、モバイルでも軽い。
 */
export function makeWobble(cam, t, strength = 1) {
  const hy = cam.horizonY();
  const H = cam.H;
  return (sy, seed) => {
    const d = clamp((sy - hy) / (H * 0.72), 0, 1.6);
    const amp = strength * H * 0.019 * (0.10 + d * 1.9);
    return amp * (Math.sin(sy * 0.075 + t * 2.3 + seed) + 0.55 * Math.sin(sy * 0.027 - t * 1.35 + seed * 0.7) + 0.3 * Math.sin(sy * 0.19 + t * 3.9));
  };
}

/** 川そのもの。信濃川の夜は本当に黒い。まずその黒さを描く */
export function drawWaterBase(ctx, cam, env) {
  const W = cam.W, H = cam.H;
  const top = waterTopY(cam);
  if (top > H) return;
  const y0 = Math.max(-2, top);
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0.00, '#0c141f');
  g.addColorStop(0.10, '#070d16');
  g.addColorStop(0.40, '#040810');
  g.addColorStop(1.00, '#02040a');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, H - y0 + 2);
}

/** 反射を描くための切り抜き（水面より上には出さない） */
export function clipWater(ctx, cam) {
  const top = waterTopY(cam);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-4, top, cam.W + 8, cam.H - top + 8);
  ctx.clip();
}
export function unclip(ctx) { ctx.restore(); }

/**
 * 強い光源が水面に落とす「光の道」。
 *
 * 水面は完全な鏡ではないので、反射像はカメラ側へ長く伸びる。
 * 鏡面反射点（距離 d* = D * camY/(camY+h)）から手前へ向かって、
 * さざ波が光を散らしてできる帯を描く。手前ほど広がり、画面中央へ収束する。
 * これが夜景写真でいちばん気持ちいいところ。
 */
export function drawLightPath(ctx, cam, src, t, detail = true) {
  const power = src.power;
  if (power <= 0.004) return;
  const dx = src.x - cam.x, dz = src.z - cam.z;
  const D = Math.hypot(dx, dz);
  if (D < 20) return;
  const camY = cam.y;
  const dSpec = D * camY / (camY + src.y);          // 鏡面反射点までの距離
  const hy = cam.horizonY();
  const top = Math.max(hy, waterTopY(cam) - 2);
  // 画面の下端に一致する距離まで（それより手前を刻んでも見えない）
  const dNear = Math.max(3.5, camY * cam.f / Math.max(4, cam.H * 1.04 - hy));
  const r = src.r, g = src.g, b = src.b;
  const at = (d, out) => {
    const k = d / D;
    cam.project(cam.x + dx * k, 0, cam.z + dz * k, out);
    return out;
  };
  const A = { x: 0, y: 0, s: 0, ok: false }, B = { x: 0, y: 0, s: 0, ok: false };

  // 高いところの光（上空の大玉）は、鏡面反射点が足元より手前に来てしまう。
  // 実際の川面は荒れているので、手前の水面いっぱいに広く滲んで映る。そちらを描く。
  if (dSpec <= dNear * 1.05) {
    cam.project(src.x, 0, src.z, A);
    const cxs = A.ok ? A.x : cam.cx;
    const y0 = top, y1 = cam.H + 10;
    if (y1 <= y0) return;
    ctx.globalCompositeOperation = 'lighter';
    const gd = ctx.createLinearGradient(0, y0, 0, y1);
    gd.addColorStop(0, `rgba(${r},${g},${b},0)`);
    gd.addColorStop(0.45, `rgba(${r},${g},${b},${0.10 * power})`);
    gd.addColorStop(1, `rgba(${r},${g},${b},${0.42 * power})`);
    ctx.fillStyle = gd;
    const halfTop = Math.max(cam.W * 0.06, (src.width || 40) * cam.f / Math.max(20, dz) * 0.35);
    ctx.beginPath();
    ctx.moveTo(cxs - halfTop, y0); ctx.lineTo(cxs + halfTop, y0);
    ctx.lineTo(cam.W * 1.35, y1); ctx.lineTo(-cam.W * 0.35, y1);
    ctx.closePath(); ctx.fill();

    const M = detail ? 90 : 26;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    for (let i = 0; i < M; i++) {
      const u = (i + 0.5) / M;
      const yy = y0 + (y1 - y0) * (u * u * 0.85 + u * 0.15);
      const spanX = halfTop + (cam.W * 0.85 - halfTop) * u;
      const n1 = fbm1(i * 0.71 + t * 2.1 + src.z * 0.004, 2);
      const n2 = fbm1(i * 1.93 - t * 1.4 + src.x * 0.01, 2);
      const a = clamp(power * (0.10 + 0.9 * u) * (0.25 + 0.75 * n1) * 0.72, 0, 0.9);
      if (a < 0.012) continue;
      const len = cam.W * (0.01 + 0.06 * Math.abs(n2)) * (0.4 + u);
      const hgt = Math.max(0.9, cam.H * 0.0026 * (0.4 + u * 2.2));
      ctx.globalAlpha = a;
      ctx.fillRect(cxs + n2 * spanX - len * 0.5, yy - hgt * 0.5, len, hgt);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return;
  }

  at(dSpec, A); at(dNear, B);
  if (!A.ok || !B.ok || A.y > cam.H + 30) return;

  const srcW = (src.width || 14);
  const w0 = Math.max(3, srcW * cam.f / Math.max(10, dz) * 0.5);
  const w1 = Math.max(w0 * 1.6, cam.W * 0.13);

  ctx.globalCompositeOperation = 'lighter';

  // 1) 連続した下地（光の道の帯）
  const gr = ctx.createLinearGradient(0, A.y, 0, B.y);
  gr.addColorStop(0, `rgba(${r},${g},${b},${0.20 * power})`);
  gr.addColorStop(0.18, `rgba(${r},${g},${b},${0.135 * power})`);
  gr.addColorStop(0.60, `rgba(${r},${g},${b},${0.075 * power})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},${0.038 * power})`);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(A.x - w0, A.y);
  ctx.lineTo(A.x + w0, A.y);
  ctx.lineTo(B.x + w1, B.y);
  ctx.lineTo(B.x - w1, B.y);
  ctx.closePath();
  ctx.fill();

  // 2) さざ波のきらめき
  const N = detail ? 30 : 12;
  const invA = 1 / dSpec, invB = 1 / dNear;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  const key = src.x * 0.017 + src.z * 0.0031;
  const flecks = detail ? 2 : 1;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    at(1 / (invA + (invB - invA) * u), A);
    if (!A.ok || A.y < top) continue;
    if (A.y > cam.H + 20) break;
    const w = w0 + (w1 - w0) * u;
    const fall = Math.exp(-u * 0.95);
    for (let k = 0; k < flecks; k++) {
      const nn = fbm1(i * (k ? 1.61 : 0.83) + t * (k ? -1.7 : 2.4) + key * (k ? 3.1 : 1), 2);
      const a = clamp(power * fall * (0.30 + 0.70 * nn) * 0.50, 0, 0.9);
      if (a < 0.012) continue;
      const len = w * (0.12 + 0.46 * Math.abs(nn));
      const off = nn * w * 0.9;
      const hgt = Math.max(0.9, cam.H * 0.0026 * (0.4 + u * 2.4));
      ctx.globalAlpha = a;
      ctx.fillRect(A.x + off - len * 0.5, A.y - hgt * 0.5, len, hgt);
    }
  }

  // 3) 鏡面点まわりのにじみ
  cam.projectMirror(src.x, src.y, src.z, A);
  if (A.ok && A.y > top - 20 && A.y < cam.H + 40) {
    const rad = Math.max(8, w0 * 1.4 + cam.H * 0.014);
    const g2 = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, rad * 2);
    g2.addColorStop(0, `rgba(${r},${g},${b},${0.26 * power})`);
    g2.addColorStop(0.4, `rgba(${r},${g},${b},${0.09 * power})`);
    g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g2;
    ctx.globalAlpha = 1;
    ctx.fillRect(A.x - rad * 2, A.y - rad, rad * 4, rad * 2.2);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** 対岸の街あかりと橋の照明の、静かな映り込み */
export function drawStaticReflections(ctx, cam, env, t) {
  const hy = cam.horizonY();
  const H = cam.H;
  ctx.globalCompositeOperation = 'lighter';
  const dim = 1 - (env.flash || 0) * 0.6;
  for (let i = 0; i < TOWN_LIGHTS.length; i += 2) {
    const L = TOWN_LIGHTS[i];
    cam.projectMirror(L.x, L.y, L.z, P);
    if (!P.ok || P.y < hy) continue;
    const d = clamp((P.y - hy) / (H * 0.06), 0, 1);
    const a = L.m * 0.24 * dim * (1 - d * 0.2);
    if (a < 0.02) continue;
    const wob = Math.sin(t * 2.4 + i) * 1.2;
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${L.r},${L.g},${L.b})`;
    ctx.fillRect(P.x + wob - 0.7, P.y, 1.6, Math.max(2, H * 0.006));
  }
  for (let i = 0; i < DECK_LAMPS.length; i++) {
    const L = DECK_LAMPS[i];
    cam.projectMirror(L.x, L.y, L.z, P);
    if (!P.ok || P.y < hy) continue;
    const a = 0.30 * L.m * dim * (1 - (env.niagara || 0) * 0.4);
    if (a < 0.02) continue;
    const h = Math.max(4, P.s * 26);
    const g = ctx.createLinearGradient(0, P.y - h * 0.3, 0, P.y + h);
    g.addColorStop(0, `rgba(255,210,140,0)`);
    g.addColorStop(0.35, `rgba(255,200,120,${a})`);
    g.addColorStop(1, `rgba(255,170,80,0)`);
    ctx.fillStyle = g;
    const w = Math.max(2, P.s * 5);
    ctx.fillRect(P.x - w * 0.5 + Math.sin(t * 1.9 + i * 1.3) * w * 0.5, P.y - h * 0.3, w, h * 1.3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** 水面のさざ波。反射のあとに薄くかぶせて「面」を作る */
export function drawWaterSurface(ctx, cam, env, t) {
  const W = cam.W, H = cam.H;
  const top = waterTopY(cam);
  if (top > H) return;
  const span = H - top;
  if (span <= 2) return;

  ctx.globalCompositeOperation = 'lighter';
  const amb = 0.05 + (env.niagara || 0) * 0.05 + (env.flash || 0) * 0.22;
  for (let i = 0; i < RIPPLES.length; i++) {
    const R = RIPPLES[i];
    const yy = top + span * (R.v * R.v);         // 手前ほど密度が下がる
    const d = (yy - top) / span;
    const x = ((R.u + Math.sin(t * R.sp * 0.25 + R.ph) * 0.006) % 1) * W;
    const w = W * R.w * (0.25 + d * 1.5);
    const a = amb * (0.25 + 0.75 * d) * (0.4 + 0.6 * Math.sin(t * R.sp + R.ph) ** 2);
    if (a < 0.008) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = env.flash > 0.05 ? '#cfd8ea' : '#7d93b4';
    ctx.fillRect(x - w * 0.5, yy, w, Math.max(0.8, span * 0.0035 * (0.5 + d)));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 手前の水を沈める（写真的な締まり）
  const g = ctx.createLinearGradient(0, top + span * 0.55, 0, H);
  g.addColorStop(0, 'rgba(2,4,10,0)');
  g.addColorStop(1, 'rgba(2,4,10,0.46)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top + span * 0.55, W, span * 0.45 + 2);
}

/**
 * 線状の光源（850m のナイアガラそのもの）の映り込み。
 * 点光源の帯を並べると継ぎ目が出るので、橋一本ぶんをひとつの面として描く。
 */
export function drawLineLightPath(ctx, cam, samples, t, detail = true) {
  if (!samples || samples.length < 2) return;
  const hy = cam.horizonY();
  const top0 = Math.max(hy, waterTopY(cam) - 2);
  const dNear = Math.max(3.5, cam.y * cam.f / Math.max(4, cam.H * 1.06 - hy));
  const A = { x: 0, y: 0, s: 0, ok: false };
  cam.project(cam.x, 0, cam.z + dNear, A);
  const yNear = A.ok ? A.y : cam.H;

  const top = [];
  let power = 0, n = 0;
  for (let i = 0; i < samples.length; i++) {
    const S = samples[i];
    if (S.power < 0.04) continue;
    const dx = S.x - cam.x, dz = S.z - cam.z;
    const D = Math.hypot(dx, dz);
    if (D < 20 || dz < 10) continue;
    const dSpec = D * cam.y / (cam.y + S.y);
    const k = dSpec / D;
    cam.project(cam.x + dx * k, 0, cam.z + dz * k, A);
    if (!A.ok) continue;
    top.push({ x: A.x, y: Math.max(top0, A.y), p: S.power });
    power += S.power; n++;
  }
  if (n < 2) return;
  power /= n;
  if (yNear <= top[0].y) return;

  // 端をなだらかにするための余白
  const pad = Math.abs(top[top.length - 1].x - top[0].x) / Math.max(1, n - 1) * 1.2 + cam.W * 0.02;
  const padNear = pad + cam.W * 0.55;
  const r = 255, g = 176, b = 88;
  const yTop = Math.min(...top.map((q) => q.y));

  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createLinearGradient(0, yTop, 0, yNear);
  gr.addColorStop(0.00, `rgba(${r},${g},${b},${0.42 * power})`);
  gr.addColorStop(0.16, `rgba(${r},${g},${b},${0.26 * power})`);
  gr.addColorStop(0.55, `rgba(${r},${g},${b},${0.13 * power})`);
  gr.addColorStop(1.00, `rgba(${r},${g},${b},${0.028 * power})`);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(top[0].x - pad, top[0].y);
  for (let i = 0; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  ctx.lineTo(top[top.length - 1].x + pad, top[top.length - 1].y);
  ctx.lineTo(top[top.length - 1].x + padNear, yNear);
  ctx.lineTo(top[0].x - padNear, yNear);
  ctx.closePath();
  ctx.fill();

  if (!detail) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return; }

  // さざ波のきらめき
  const xL0 = top[0].x - pad, xR0 = top[top.length - 1].x + pad;
  const xL1 = top[0].x - padNear, xR1 = top[top.length - 1].x + padNear;
  const rows = 40, per = 5;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  for (let i = 0; i < rows; i++) {
    const u = (i + 0.5) / rows;
    const uu = u * u * 0.75 + u * 0.25;
    const yy = yTop + (yNear - yTop) * uu;
    if (yy < top0) continue;
    const xl = xL0 + (xL1 - xL0) * uu, xr = xR0 + (xR1 - xR0) * uu;
    const span = xr - xl;
    const fall = Math.exp(-uu * 1.15);
    for (let k = 0; k < per; k++) {
      const nn = fbm1(i * 1.37 + k * 5.11 + t * 2.2, 2);
      const mm = fbm1(i * 0.61 + k * 2.71 - t * 1.5 + 31, 2);
      const a = clamp(power * fall * (0.25 + 0.75 * Math.abs(nn)) * 0.45, 0, 0.85);
      if (a < 0.012) continue;
      const cxp = xl + span * ((k + 0.5) / per + mm * 0.16);
      const len = span * (0.012 + 0.055 * Math.abs(mm)) * (0.5 + uu);
      const hgt = Math.max(0.9, cam.H * 0.0026 * (0.4 + uu * 2.2));
      ctx.globalAlpha = a;
      ctx.fillRect(cxp - len * 0.5, yy - hgt * 0.5, len, hgt);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
