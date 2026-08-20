// 夜の信濃川河川敷。両岸・川面・遠景の街あかり・橋のシルエット・観客の気配。
// すべて世界座標で持ち、Camera で投影する（＝カメラが引くと本当に「広がって」見える）。
import { clamp, lerp, smoothstep, makeRng, rngRange, TAU } from './util.js';

// --- 河川敷のレイアウト（世界座標の単位はおよそ 1 = 1m 相当） ---
export const LAYOUT = {
  launchZ: -400,     // 打上げ地点の並ぶ線（中州の台船）
  waterNearZ: -50,   // 手前の汀線（こちら岸）
  waterFarZ: -1500,  // 対岸の汀線（信濃川はここでは広い）
  farBankZ: -1524,   // 対岸の堤防（観客・木立）
  townZ: -1700,      // その向こうの町
  nearGroundY: 4,
};

const FIXED_SEED = 0x9e3779b9; // 場所は毎回おなじ（＝「長岡のあの河川敷」）

export function buildWorld(spanX) {
  const rng = makeRng(FIXED_SEED);
  const w = { spanX };

  // --- 星 ---
  w.stars = [];
  for (let i = 0; i < 260; i++) {
    const az = rngRange(rng, -1.25, 1.25);
    const el = Math.pow(rng(), 1.5) * 0.85 + 0.02;
    const R = 26000;
    w.stars.push({
      x: Math.sin(az) * R, y: Math.sin(el) * R * 0.85, z: -Math.cos(az) * R,
      m: rngRange(rng, 0.25, 1), p: rngRange(rng, 0, TAU),
    });
  }

  // --- 対岸の町並み（シルエット + 窓あかり） ---
  w.town = [];
  const townSpan = spanX * 3.0 + 2600;
  for (let x = -townSpan; x < townSpan; ) {
    const wdt = rngRange(rng, 46, 190);
    const h = rngRange(rng, 9, 26) * (1 + 0.55 * Math.exp(-Math.abs(x) / (spanX * 1.1)));
    const b = { x0: x, x1: x + wdt, h, lights: [] };
    const n = (rng() * 5) | 0;
    for (let i = 0; i < n; i++) {
      b.lights.push({ x: rngRange(rng, x + 6, x + wdt - 6), y: rngRange(rng, 6, h * 0.92), w: rngRange(rng, 1.6, 3.4) });
    }
    w.town.push(b);
    x += wdt + rngRange(rng, 6, 44);
  }
  // 対岸の木立（両岸があることをはっきり見せる）
  w.farTrees = [];
  for (let i = 0; i < 260; i++) {
    const x = rngRange(rng, -(spanX * 2.4 + 1800), spanX * 2.4 + 1800);
    w.farTrees.push({ x, z: LAYOUT.farBankZ + rngRange(rng, -26, 10), h: rngRange(rng, 9, 22), wd: rngRange(rng, 7, 17) });
  }
  w.farTrees.sort((a, b) => a.z - b.z);

  // 対岸にも人がいる（豆粒でよい。両岸の存在感のため）
  w.farCrowd = [];
  for (let i = 0; i < 420; i++) {
    w.farCrowd.push({
      x: rngRange(rng, -(spanX * 1.7 + 900), spanX * 1.7 + 900),
      z: LAYOUT.farBankZ + rngRange(rng, 4, 34),
      h: rngRange(rng, 12, 17), wd: rngRange(rng, 4, 6),
    });
  }

  // 街あかりの帯（光害のにじみ）用のスポット
  w.glowSpots = [];
  for (let i = 0; i < 26; i++) {
    w.glowSpots.push({ x: rngRange(rng, -townSpan, townSpan), i: rngRange(rng, .25, 1) });
  }

  // --- 橋（長生橋のようなトラス／大手大橋のような桁） ---
  w.bridges = [
    makeTrussBridge(rng, -spanX * 1.24, 9, 34),
    makeGirderBridge(rng, spanX * 1.52, 40),
  ];

  // --- 観客（手前の堤防に、奥から手前までびっしり） ---
  // 手前の列はカメラのすぐ近くに来るため、川幅いっぱいに撒くとほとんど画面に入らない。
  // 「対岸まで見わたす列」と「カメラ周辺の近景の列」を作り分ける。
  w.crowd = [];
  const person = (x, z, big) => {
    const seated = rng() < 0.48;
    return {
      x, z,
      h: seated ? rngRange(rng, 7, 9.8) : rngRange(rng, 12.6, 15.8),
      wd: rngRange(rng, 3.8, 5.8), seated,
      phone: rng() < (big ? 0.02 : 0.03),
      ph: rngRange(rng, 0, TAU), sway: rngRange(rng, .5, 1.4),
    };
  };

  // (1) 汀線から堤防上までの列：川幅いっぱいに広く
  const FAR_ROWS = 22;
  for (let r = 0; r < FAR_ROWS; r++) {
    const t = r / (FAR_ROWS - 1);
    const z = lerp(LAYOUT.waterNearZ + 6, 520, Math.pow(t, 1.7));
    const halfW = spanX * 1.3 + 400;
    const gap = lerp(30, 52, t);
    const count = Math.round((halfW * 2) / gap);
    for (let i = 0; i < count; i++) {
      w.crowd.push(person(rngRange(rng, -halfW, halfW), z + rngRange(rng, -14, 14), false));
    }
  }

  // (2) カメラのすぐ手前に来る近景の列：狭く、密に
  const NEAR_RANKS = 18;
  for (let r = 0; r < NEAR_RANKS; r++) {
    const t = r / (NEAR_RANKS - 1);
    const z = lerp(560, 4400, Math.pow(t, 1.35));
    const halfW = 1500 + z * 0.14;
    const count = Math.round((halfW * 2) / 13);
    for (let i = 0; i < count; i++) {
      w.crowd.push(person(rngRange(rng, -halfW, halfW), z + rngRange(rng, -30, 30), true));
    }
  }

  // (3) 汀線ぎわの人垣（頭のならびが水面の光を切る）
  for (let i = 0; i < 900; i++) {
    w.crowd.push(person(
      rngRange(rng, -(spanX * 1.4 + 500), spanX * 1.4 + 500),
      LAYOUT.waterNearZ + rngRange(rng, 2, 120), false));
  }

  w.crowd.sort((a, b) => a.z - b.z); // 奥（zが小さい）から描く

  // --- 手前のすすき／堤防の草（近景のディテール） ---
  w.reeds = [];
  for (let i = 0; i < 420; i++) {
    const near = i % 2 === 0;
    const z = near ? rngRange(rng, 500, 4200) : rngRange(rng, LAYOUT.waterNearZ - 2, 500);
    const halfW = near ? 1500 + z * 0.14 : spanX * 1.3 + 400;
    w.reeds.push({
      x: rngRange(rng, -halfW, halfW),
      z, h: rngRange(rng, 3, 11), ph: rngRange(rng, 0, TAU),
    });
  }
  w.reeds.sort((a, b) => a.z - b.z);

  // --- 川面のさざなみ ---
  w.ripples = [];
  for (let i = 0; i < 44; i++) {
    const t = i / 43;
    w.ripples.push({ z: lerp(LAYOUT.waterFarZ, LAYOUT.waterNearZ, Math.pow(t, 1.9)), a: rngRange(rng, .3, 1), ph: rngRange(rng, 0, TAU) });
  }

  // --- 河原の係留船・台船（打上げ地点の実体感） ---
  w.barges = [];
  return w;
}

function makeTrussBridge(rng, x, spans, y) {
  const z0 = LAYOUT.waterFarZ - 30, z1 = LAYOUT.waterNearZ + 10;
  const segs = [];
  for (let s = 0; s < spans; s++) {
    const a = lerp(z0, z1, s / spans), b = lerp(z0, z1, (s + 1) / spans);
    segs.push({ a, b, h: (s % 2 === 0 ? 15 : 11) });
  }
  const lamps = [];
  for (let i = 0; i <= spans; i++) lamps.push(lerp(z0, z1, i / spans));
  return { kind: 'truss', x, y, z0, z1, segs, lamps, deckH: 3.2 };
}
function makeGirderBridge(rng, x, y) {
  const z0 = LAYOUT.waterFarZ - 60, z1 = LAYOUT.waterNearZ - 16;
  const piers = [];
  for (let i = 1; i < 6; i++) piers.push(lerp(z0, z1, i / 6));
  const lamps = [];
  for (let i = 0; i <= 10; i++) lamps.push(lerp(z0, z1, i / 10));
  return { kind: 'girder', x, y, z0, z1, piers, lamps, deckH: 4.5 };
}

// ---------------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------------

export function drawSky(ctx, cam, w, h, t, amb) {
  const hy = clamp(cam.horizonY, -h * 2, h * 3);
  const g = ctx.createLinearGradient(0, Math.min(0, hy - h * 1.15), 0, hy);
  g.addColorStop(0, '#03050c');
  g.addColorStop(0.42, '#070c1b');
  g.addColorStop(0.74, '#0e1630');
  g.addColorStop(0.92, '#1b2039');
  g.addColorStop(1, '#2b2637');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, Math.max(0, hy) + 2);

  // 地平の光害（町のあかりが空へにじむ）
  const gh = Math.max(46, h * 0.20);
  const g2 = ctx.createLinearGradient(0, hy - gh, 0, hy + 4);
  g2.addColorStop(0, 'rgba(120,84,52,0)');
  g2.addColorStop(0.55, 'rgba(150,96,52,0.10)');
  g2.addColorStop(1, 'rgba(200,132,68,0.22)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, hy - gh, w, gh + 4);

  // 花火の照り返しで空全体がわずかに染まる
  if (amb.i > 0.01) {
    const g3 = ctx.createRadialGradient(amb.x, amb.y, 0, amb.x, amb.y, Math.max(w, h) * 0.55);
    g3.addColorStop(0, `rgba(${amb.r},${amb.g},${amb.b},${0.045 * amb.i})`);
    g3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, w, Math.max(0, hy) + 2);
  }
}

export function drawStars(ctx, cam, world, t, hazeTop) {
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  ctx.save();
  for (let i = 0; i < world.stars.length; i++) {
    const s = world.stars[i];
    cam.project(s.x, s.y, s.z, p);
    if (!p.vis || p.y > cam.horizonY - 4 || p.y < -20 || p.x < -20 || p.x > cam.w + 20) continue;
    const tw = 0.62 + 0.38 * Math.sin(t * 1.6 + s.p);
    const fade = clamp((cam.horizonY - p.y) / 140, 0, 1);
    ctx.globalAlpha = s.m * tw * 0.85 * (0.25 + 0.75 * fade);
    ctx.fillStyle = '#dfe8ff';
    const r = s.m * 1.15;
    ctx.fillRect(p.x - r * .5, p.y - r * .5, r, r);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawTown(ctx, cam, world, t, amb) {
  const base = cam.groundLine(LAYOUT.townZ, 0);
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  const w = cam.w;

  // 町の背後のにじみ
  ctx.save();
  for (const s of world.glowSpots) {
    cam.project(s.x, 20, LAYOUT.townZ, p);
    if (!p.vis || p.x < -300 || p.x > w + 300) continue;
    const rad = Math.max(30, p.scale * 230);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(24, rad));
    g.addColorStop(0, `rgba(255,176,104,${0.16 * s.i})`);
    g.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
  }
  ctx.restore();

  // シルエット
  ctx.beginPath();
  ctx.moveTo(0, base.y0);
  let started = false;
  for (const b of world.town) {
    const a = cam.project(b.x0, 0, LAYOUT.townZ, p); if (!a.vis) continue;
    const x0 = a.x, yBase = a.y;
    const c = cam.project(b.x1, b.h, LAYOUT.townZ, p); if (!c.vis) continue;
    const x1 = c.x, yTop = c.y;
    if (x1 < -60 || x0 > w + 60) continue;
    if (!started) { ctx.moveTo(x0, yBase); started = true; }
    ctx.lineTo(x0, yTop); ctx.lineTo(x1, yTop); ctx.lineTo(x1, yBase);
  }
  if (started) {
    ctx.lineTo(w + 60, base.y1); ctx.lineTo(w + 60, base.y1 + 40); ctx.lineTo(-60, base.y0 + 40);
    ctx.closePath();
    ctx.fillStyle = '#080b16';
    ctx.fill();
  }

  // 窓あかり
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.town) {
    for (const L of b.lights) {
      cam.project(L.x, L.y, LAYOUT.townZ, p);
      if (!p.vis || p.x < -10 || p.x > w + 10) continue;
      const s = Math.max(0.6, L.w * p.scale);
      ctx.fillStyle = 'rgba(255,186,110,0.85)';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s * 0.75);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function bridgeSilhouette(ctx, cam, br, t) {
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  const pt = (z, y) => { const q = cam.project(br.x, y, z, p); return q.vis ? { x: q.x, y: q.y } : null; };
  ctx.strokeStyle = '#05070f';
  ctx.fillStyle = '#05070f';
  ctx.lineJoin = 'round';

  // 桁
  const a = pt(br.z0, br.y), b = pt(br.z1, br.y);
  const a2 = pt(br.z0, br.y - br.deckH), b2 = pt(br.z1, br.y - br.deckH);
  if (a && b && a2 && b2) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y);
    ctx.closePath(); ctx.fill();
  }

  if (br.kind === 'truss') {
    for (const s of br.segs) {
      const l = pt(s.a, br.y), r = pt(s.b, br.y), m = pt((s.a + s.b) / 2, br.y + s.h);
      if (!l || !r || !m) continue;
      ctx.lineWidth = Math.max(1, Math.abs(r.x - l.x) * 0.05 + 1);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.quadraticCurveTo(m.x, m.y - Math.abs(r.x - l.x) * 0.10, r.x, r.y);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(m.x, m.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
  } else {
    for (const pz of br.piers) {
      const top = pt(pz, br.y - br.deckH), bot = pt(pz, -2);
      if (!top || !bot) continue;
      ctx.lineWidth = Math.max(1.5, Math.abs(bot.y - top.y) * 0.09);
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lz of br.lamps) {
    const q = cam.project(br.x, br.y + 5.5, lz, p);
    if (!q.vis) continue;
    const r = Math.max(1.0, q.scale * 2.6);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 4);
    g.addColorStop(0, 'rgba(255,214,150,0.9)');
    g.addColorStop(0.35, 'rgba(255,170,90,0.30)');
    g.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(q.x - r * 4, q.y - r * 4, r * 8, r * 8);
  }
  ctx.restore();
}

// 対岸の堤防・木立・豆粒の観客。「両岸がある」ことをはっきり見せる。
export function drawFarBank(ctx, cam, world, t, amb) {
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  const W = cam.w;
  const line = cam.groundLine(LAYOUT.farBankZ, 0);

  // 空気遠近：遠くほど霞ませて、距離感を出す
  const hy = cam.horizonY;
  const bot = Math.max(line.y0, line.y1) + 3;
  if (bot > hy - 200) {
    const hz = ctx.createLinearGradient(0, hy - 90, 0, bot);
    hz.addColorStop(0, 'rgba(52,46,58,0.00)');
    hz.addColorStop(0.55, 'rgba(66,56,60,0.09)');
    hz.addColorStop(1, 'rgba(86,70,64,0.16)');
    ctx.fillStyle = hz;
    ctx.fillRect(-2, hy - 90, W + 4, bot - (hy - 90) + 2);
  }

  // 対岸の観客（豆粒）
  ctx.save();
  ctx.fillStyle = '#04060f';
  for (let i = 0; i < world.farCrowd.length; i++) {
    const c = world.farCrowd[i];
    cam.project(c.x, 0, c.z, p);
    if (!p.vis || p.x < -8 || p.x > W + 8) continue;
    const hh = Math.max(0.9, c.h * p.scale), ww = Math.max(0.7, c.wd * p.scale);
    ctx.fillRect(p.x - ww / 2, p.y - hh, ww, hh);
  }
  ctx.restore();

  // 木立
  ctx.save();
  ctx.fillStyle = '#040711';
  for (let i = 0; i < world.farTrees.length; i++) {
    const tr = world.farTrees[i];
    cam.project(tr.x, 0, tr.z, p);
    if (!p.vis || p.x < -30 || p.x > W + 30) continue;
    const hh = Math.max(1.2, tr.h * p.scale), ww = Math.max(1.4, tr.wd * p.scale);
    ctx.beginPath();
    ctx.moveTo(p.x - ww / 2, p.y);
    ctx.quadraticCurveTo(p.x - ww * 0.5, p.y - hh, p.x, p.y - hh);
    ctx.quadraticCurveTo(p.x + ww * 0.5, p.y - hh, p.x + ww / 2, p.y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // 堤防の面（水面との境をはっきりさせる）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-2, line.y0); ctx.lineTo(W + 2, line.y1);
  ctx.lineTo(W + 2, line.y1 + 5); ctx.lineTo(-2, line.y0 + 5);
  ctx.closePath();
  ctx.fillStyle = '#070b16';
  ctx.fill();
  ctx.restore();
}

export function drawBridges(ctx, cam, world, t) {
  for (const br of world.bridges) bridgeSilhouette(ctx, cam, br, t);
}

export function waterClip(ctx, cam) {
  const far = cam.groundLine(LAYOUT.waterFarZ, 0);
  const near = cam.groundLine(LAYOUT.waterNearZ, 0);
  ctx.beginPath();
  ctx.moveTo(-2, far.y0 - 1); ctx.lineTo(cam.w + 2, far.y1 - 1);
  ctx.lineTo(cam.w + 2, Math.max(near.y1, far.y1) + 2); ctx.lineTo(-2, Math.max(near.y0, far.y0) + 2);
  ctx.closePath();
  return { far, near };
}

export function drawWater(ctx, cam, world, t, amb) {
  const w = cam.w, h = cam.h;
  ctx.save();
  const lines = waterClip(ctx, cam);
  ctx.clip();

  const top = Math.min(lines.far.y0, lines.far.y1);
  const bot = Math.max(lines.near.y0, lines.near.y1, top + 8);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#111a33');
  g.addColorStop(0.22, '#0b1226');
  g.addColorStop(0.66, '#070c1b');
  g.addColorStop(1, '#040711');
  ctx.fillStyle = g;
  ctx.fillRect(-2, top - 2, w + 4, bot - top + 6);

  // 対岸のあかりが水面に落ちる帯
  const gg = ctx.createLinearGradient(0, top, 0, top + (bot - top) * 0.45);
  gg.addColorStop(0, 'rgba(214,144,80,0.26)');
  gg.addColorStop(1, 'rgba(214,140,74,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(-2, top - 2, w + 4, (bot - top) * 0.5);

  // さざなみ
  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  ctx.lineWidth = 1;
  for (const r of world.ripples) {
    const ln = cam.groundLine(r.z + Math.sin(t * 0.5 + r.ph) * 3, 0);
    const yy = (ln.y0 + ln.y1) / 2;
    if (yy < top - 4 || yy > bot + 4) continue;
    const dp = (r.z - cam.eye.z);
    const alpha = r.a * 0.11 * clamp((yy - top) / Math.max(24, (bot - top) * 0.35), 0.15, 1);
    ctx.strokeStyle = `rgba(150,180,225,${alpha})`;
    ctx.beginPath();
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const xx = (i / segs) * w;
      const wob = Math.sin(t * 1.5 + r.ph + i * 0.9) * (1.2 + (yy - top) * 0.012);
      if (i === 0) ctx.moveTo(xx, ln.y0 + (ln.y1 - ln.y0) * (i / segs) + wob);
      else ctx.lineTo(xx, ln.y0 + (ln.y1 - ln.y0) * (i / segs) + wob);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// 花火の照り返しで観客・水面がふわっと明るくなる。
export function drawNearBank(ctx, cam, world, t, amb) {
  const w = cam.w;
  const near = cam.groundLine(LAYOUT.waterNearZ, 0);

  // 手前の河川敷（暗い土手）
  ctx.beginPath();
  ctx.moveTo(-2, near.y0); ctx.lineTo(w + 2, near.y1);
  ctx.lineTo(w + 2, cam.h + 60); ctx.lineTo(-2, cam.h + 60);
  ctx.closePath();
  const midY = (near.y0 + near.y1) / 2;
  const gg = ctx.createLinearGradient(0, midY, 0, cam.h);
  gg.addColorStop(0, '#101a2c');   // 汀ぎわは空あかりを受けて明るい
  gg.addColorStop(0.07, '#080e1c');
  gg.addColorStop(0.32, '#050912');
  gg.addColorStop(1, '#03060f');
  ctx.fillStyle = gg;
  ctx.fill();

  // 花火が上がると河原全体がぼうっと明るくなる
  if (amb.i > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, midY, 0, cam.h);
    const k = clamp(amb.i * 0.035, 0, 0.055);
    lg.addColorStop(0, `rgba(${amb.r},${amb.g},${amb.b},${k})`);
    lg.addColorStop(1, `rgba(${amb.r},${amb.g},${amb.b},0)`);
    ctx.fillStyle = lg;
    ctx.fillRect(-2, midY, w + 4, cam.h - midY + 4);
    ctx.restore();
  }

  const p = { x: 0, y: 0, scale: 1, depth: 1, vis: false };
  const ar = amb.r, ag = amb.g, ab = amb.b, ai = amb.i;

  // 観客のシルエット（奥→手前）。端末が非力なときは間引く。
  const stride = world.stride || 1;
  for (let i = 0; i < world.crowd.length; i += stride) {
    const c = world.crowd[i];
    if (c.z > cam.eye.z - 26) continue;
    cam.project(c.x, LAYOUT.nearGroundY, c.z, p);
    if (!p.vis) continue;
    const s = p.scale;
    const bodyH = c.h * s, bodyW = c.wd * s;
    if (bodyH < 1.6) continue;
    if (p.x < -bodyW * 3 || p.x > w + bodyW * 3) continue;

    ctx.globalAlpha = clamp(1.20 - p.depth / 4200, 0.5, 1);
    const sway = Math.sin(t * 0.8 + c.ph) * bodyW * 0.05 * c.sway;
    const bx = p.x + sway, by = p.y;
    const headR = bodyW * 0.46;

    // 花火の照り返しをふちに乗せる
    const rim = clamp(ai * 0.85, 0, 1);
    ctx.fillStyle = rim > 0.02
      ? `rgb(${(2 + ar * 0.055 * rim) | 0},${(3 + ag * 0.05 * rim) | 0},${(7 + ab * 0.055 * rim) | 0})`
      : '#010206';

    ctx.beginPath();
    if (c.seated) {
      ctx.moveTo(bx - bodyW * 0.66, by);
      ctx.lineTo(bx - bodyW * 0.44, by - bodyH * 0.62);
      ctx.quadraticCurveTo(bx - bodyW * 0.36, by - bodyH * 0.78, bx, by - bodyH * 0.78);
      ctx.quadraticCurveTo(bx + bodyW * 0.40, by - bodyH * 0.78, bx + bodyW * 0.48, by - bodyH * 0.60);
      ctx.lineTo(bx + bodyW * 0.76, by);
    } else {
      ctx.moveTo(bx - bodyW * 0.46, by);
      ctx.lineTo(bx - bodyW * 0.44, by - bodyH * 0.58);
      ctx.quadraticCurveTo(bx - bodyW * 0.40, by - bodyH * 0.74, bx - bodyW * 0.16, by - bodyH * 0.76);
      ctx.lineTo(bx + bodyW * 0.16, by - bodyH * 0.76);
      ctx.quadraticCurveTo(bx + bodyW * 0.40, by - bodyH * 0.74, bx + bodyW * 0.44, by - bodyH * 0.58);
      ctx.lineTo(bx + bodyW * 0.46, by);
    }
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by - bodyH * (c.seated ? 0.78 : 0.76) - headR * 0.78, headR, 0, TAU);
    ctx.fill();

    // 頭と肩のふち明かり（空あかり＋花火の照り返し）
    if (bodyH > 7) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${(126 + ar * 0.34 * rim) | 0},${(146 + ag * 0.30 * rim) | 0},${(184 + ab * 0.28 * rim) | 0},${0.16 + 0.30 * rim})`;
      ctx.lineWidth = Math.max(0.7, bodyW * 0.17);
      ctx.beginPath();
      ctx.arc(bx, by - bodyH * (c.seated ? 0.78 : 0.76) - headR * 0.78, headR * 1.03, Math.PI * 1.10, Math.PI * 1.96);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    if (c.phone && bodyH > 6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = Math.max(0.8, bodyW * 0.22);
      const g = ctx.createRadialGradient(bx + bodyW * 0.5, by - bodyH * 0.78, 0, bx + bodyW * 0.5, by - bodyH * 0.78, r * 3.5);
      g.addColorStop(0, 'rgba(180,212,255,0.5)');
      g.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx + bodyW * 0.5 - r * 3.5, by - bodyH * 0.78 - r * 3.5, r * 7, r * 7);
      ctx.restore();
    }
  }

  // 手前のすすき
  ctx.strokeStyle = '#010206';
  for (let i = 0; i < world.reeds.length; i++) {
    const rd = world.reeds[i];
    if (rd.z > cam.eye.z - 18) continue;
    cam.project(rd.x, LAYOUT.nearGroundY, rd.z, p);
    if (!p.vis) continue;
    const hh = rd.h * p.scale;
    if (hh < 3 || p.x < -20 || p.x > w + 20) continue;
    ctx.lineWidth = Math.max(0.8, hh * 0.05);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + Math.sin(t * 0.9 + rd.ph) * hh * 0.16, p.y - hh * 0.6, p.x + Math.sin(t * 0.9 + rd.ph) * hh * 0.34, p.y - hh);
    ctx.stroke();
  }
}

// 画面全体の仕上げ（ビネット・粒子感）— 「現地写真」らしさのため。
export function drawGrade(ctx, w, h, amb, grain) {
  if (amb.i > 0.015) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${amb.r},${amb.g},${amb.b},${clamp(amb.i * 0.018, 0, 0.032)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.30, w / 2, h * 0.48, Math.max(w, h) * 0.76);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, h * 0.72, 0, h);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  if (grain) { ctx.globalAlpha = 0.030; ctx.drawImage(grain, 0, 0, w, h); ctx.globalAlpha = 1; }
}

export function makeGrain(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const d = g.createImageData(size, size);
  const rng = makeRng(1234567);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + rng() * 145;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}
