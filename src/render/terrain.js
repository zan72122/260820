import { Rng } from '../rng.js';
import { fbm1, clamp } from '../math.js';
import { FAR } from '../world.js';
import { scratch as P } from '../camera.js';

const r = new Rng(31337);

// 東山連峰のシルエット
const RIDGE = [];
for (let i = 0; i <= 120; i++) {
  const x = -14000 + (28000 * i) / 120;
  const h = 210 + fbm1(x * 0.00042, 4) * 190 + fbm1(x * 0.0015 + 9, 3) * 60;
  RIDGE.push({ x, y: Math.max(60, h), z: FAR.mountainZ });
}

// 対岸の街あかり
const TOWN = [];
for (let i = 0; i < 420; i++) {
  const band = r.next();
  const z = band < 0.45 ? r.range(1500, 2100) : (band < 0.8 ? r.range(2100, 2900) : r.range(2900, 3900));
  const x = r.gauss() * 1900 + r.range(-900, 900);
  const y = r.range(1.5, 3.5) + (r.next() < 0.10 ? r.range(6, 34) : 0);
  const w = r.next();
  TOWN.push({
    x, y, z,
    r: w < 0.62 ? 255 : (w < 0.86 ? 210 : 170),
    g: w < 0.62 ? 196 : (w < 0.86 ? 220 : 205),
    b: w < 0.62 ? 118 : (w < 0.86 ? 240 : 255),
    m: r.range(0.25, 1) ** 1.6,
    tw: r.range(0, 6.28),
  });
}
export const TOWN_LIGHTS = TOWN;

/** 遠景（山→対岸の土手→街あかり）。すべて水平線のすぐ上に薄く積む */
export function drawFar(ctx, cam, env) {
  const W = cam.W, H = cam.H;
  const hy = cam.horizonY();
  if (hy < -40) return;

  // 山
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < RIDGE.length; i++) {
    const p = RIDGE[i];
    cam.project(p.x, p.y, p.z, P);
    if (!P.ok) continue;
    if (!started) { ctx.moveTo(P.x, P.y); started = true; } else ctx.lineTo(P.x, P.y);
  }
  if (started) {
    ctx.lineTo(W + 200, hy + 6);
    ctx.lineTo(-200, hy + 6);
    ctx.closePath();
    ctx.fillStyle = '#0b1220';
    ctx.fill();
  }

  // 対岸の土手（水面と陸の境目）
  cam.project(0, 0, 1250, P);
  const bankY = P.ok ? P.y : hy;
  cam.project(0, 7.5, 1250, P);
  const bankTop = P.ok ? P.y : hy - 2;
  ctx.fillStyle = '#070b13';
  ctx.fillRect(-10, bankTop, W + 20, Math.max(1.5, bankY - bankTop + 1.5));

  // 街あかり
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < TOWN.length; i++) {
    const L = TOWN[i];
    cam.project(L.x, L.y, L.z, P);
    if (!P.ok) continue;
    if (P.x < -6 || P.x > W + 6 || P.y < -6 || P.y > hy + 4) continue;
    const a = L.m * 0.85 * (0.82 + 0.18 * Math.sin(env.t * 2.1 + L.tw)) * (1 - (env.flash || 0) * 0.7);
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${L.r},${L.g},${L.b})`;
    const s = clamp(P.s * 6, 0.8, 2.4);
    ctx.fillRect(P.x - s * 0.5, P.y - s * 0.5, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 川面ぎわの靄
  ctx.globalCompositeOperation = 'lighter';
  const mg = ctx.createLinearGradient(0, hy - H * 0.045, 0, hy + H * 0.02);
  mg.addColorStop(0, 'rgba(80,92,110,0)');
  mg.addColorStop(0.55, 'rgba(84,96,116,0.10)');
  mg.addColorStop(1, 'rgba(70,82,104,0.02)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, hy - H * 0.045, W, H * 0.065);
  ctx.globalCompositeOperation = 'source-over';
}

// 手前のヨシ・ススキ。地面ごと描くと画面を食うので、縁のシルエットだけ置く
const GRASS = [];
for (let i = 0; i < 34; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  GRASS.push({
    x: side * r.range(26, 150), z: r.range(16, 62),
    h: r.range(1.0, 2.8), lean: r.range(-0.5, 0.5), ph: r.range(0, 6.28),
  });
}

export function drawNearBank(ctx, cam, env) {
  const W = cam.W, H = cam.H;
  ctx.strokeStyle = '#01030800';
  ctx.lineCap = 'round';
  for (let i = 0; i < GRASS.length; i++) {
    const g = GRASS[i];
    cam.project(g.x, 0, g.z, P);
    if (!P.ok || P.x < -40 || P.x > W + 40) continue;
    const x0 = P.x, y0 = P.y;
    if (y0 < H * 0.55) continue;              // 画面下の方にいるときだけ描く
    const sway = Math.sin(env.t * 0.9 + g.ph) * 0.28 + g.lean;
    cam.project(g.x + sway * g.h, g.h, g.z, P);
    if (!P.ok) continue;
    ctx.strokeStyle = '#010308';
    ctx.lineWidth = Math.max(1, P.s * 0.05);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + (P.x - x0) * 0.35, (y0 + P.y) * 0.5, P.x, P.y);
    ctx.stroke();
  }
}
