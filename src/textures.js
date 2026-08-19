// ---------------------------------------------------------------------------
// Every texture in the game is generated procedurally on a 2D canvas at boot.
// Keeps the build self-contained (no binary assets, works offline) and lets us
// scale texture sizes down on weak mobile GPUs.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, fbm, tileNoise, clamp01, lerp, smoothstep } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(c, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// --- snow -------------------------------------------------------------------
/**
 * Snow micro-detail: r = fine grain height, g = coarse drift height,
 * b = sparkle specks (sparse, bright), a = 255.
 * Sampled by the snow shader for bump + glitter.
 */
export function snowGrainTexture(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rng = makeRng(9911);
  const per = 16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * per, v = (y / size) * per;
      // tileable-ish fine grain
      let fine = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 4; o++) {
        fine += amp * tileNoise(u * f, v * f, per * f);
        amp *= 0.55; f *= 2.1;
      }
      let coarse = tileNoise(u * 0.35, v * 0.35, per * 0.35) * 0.7 +
                   tileNoise(u * 0.8, v * 0.8, per * 0.8) * 0.3;
      const i = (y * size + x) * 4;
      d[i] = clamp01(fine * 0.9 + 0.5) * 255;
      d[i + 1] = clamp01(coarse * 0.8 + 0.5) * 255;
      d[i + 2] = 0;
      d[i + 3] = 255;
    }
  }
  // sparkle specks: rare, tiny, very bright
  const specks = Math.floor(size * size * 0.0016);
  for (let s = 0; s < specks; s++) {
    const x = (rng() * size) | 0, y = (rng() * size) | 0;
    const i = (y * size + x) * 4;
    d[i + 2] = 200 + rng() * 55;
    // slight bleed to neighbours so it survives mipmapping a bit
    const j = (y * size + ((x + 1) % size)) * 4;
    d[j + 2] = Math.max(d[j + 2], 90);
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: false, repeat: 1 });
}

// --- soil -------------------------------------------------------------------
/** Wet, dark, crumbly field soil with clods, pebbles and straw litter. */
export function soilTexture(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const per = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * per, v = (y / size) * per;
      let n = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 5; o++) {
        n += amp * tileNoise(u * f, v * f, per * f);
        amp *= 0.55; f *= 2.0;
      }
      const clod = Math.abs(tileNoise(u * 3.1, v * 3.1, per * 3.1));
      const t = clamp01(n * 0.8 + 0.5);
      // damp earth: deep umber -> slightly warmer highlights on clod tops
      let r = lerp(66, 152, t) + clod * 26;
      let g = lerp(48, 112, t) + clod * 19;
      let b = lerp(35, 80, t) + clod * 13;
      const i = (y * size + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rng = makeRng(4242);
  // pebbles
  for (let k = 0; k < size * 0.9; k++) {
    const x = rng() * size, y = rng() * size, r = 1 + rng() * 3.2;
    const sh = 70 + rng() * 60;
    ctx.fillStyle = `rgba(${sh},${sh * 0.94},${sh * 0.86},${0.35 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.5), rng() * 6.28, 0, 6.28);
    ctx.fill();
  }
  // dry straw / root litter
  for (let k = 0; k < size * 0.18; k++) {
    const x = rng() * size, y = rng() * size;
    const a = rng() * 6.28, len = 5 + rng() * 22;
    ctx.strokeStyle = `rgba(${120 + rng() * 50},${100 + rng() * 40},${60 + rng() * 30},${0.2 + rng() * 0.35})`;
    ctx.lineWidth = 0.7 + rng() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return finish(c, { repeat: 1 });
}

/** Grayscale roughness/bump companion for the soil. */
export function soilBumpTexture(size = 256) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const per = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * per, v = (y / size) * per;
      let n = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 4; o++) {
        n += amp * tileNoise(u * f, v * f, per * f);
        amp *= 0.5; f *= 2.3;
      }
      const g = clamp01(n + 0.5) * 255;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: false });
}

// --- carrot -----------------------------------------------------------------
/**
 * Carrot skin: v=1 (canvas top) is the shoulder, v=0 (bottom) the tip.
 * Horizontal growth rings, lenticel dots, subtle vertical fibre streaks.
 */
export function carrotTexture(w = 256, h = 512) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const rng = makeRng(777);
  // base gradient: green-tinged shoulder -> vivid orange -> pale tip
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#6f9138');
  g.addColorStop(0.040, '#d4641a');
  g.addColorStop(0.11, '#fb7207');
  g.addColorStop(0.40, '#ff8b06');
  g.addColorStop(0.72, '#fd7a0a');
  g.addColorStop(0.92, '#f4801d');
  g.addColorStop(1.00, '#ea8b33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // cylindrical shading so the carrot reads round even under flat light
  const sh = ctx.createLinearGradient(0, 0, w, 0);
  sh.addColorStop(0.0, 'rgba(96,42,8,0.34)');
  sh.addColorStop(0.22, 'rgba(255,230,196,0.18)');
  sh.addColorStop(0.5, 'rgba(126,58,12,0.07)');
  sh.addColorStop(0.78, 'rgba(255,230,196,0.16)');
  sh.addColorStop(1.0, 'rgba(96,42,8,0.34)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);

  // fine vertical fibre streaks
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < w * 1.6; i++) {
    const x = rng() * w;
    ctx.strokeStyle = rng() > 0.5 ? '#ffd9a0' : '#b4560c';
    ctx.lineWidth = 0.6 + rng() * 1.0;
    ctx.beginPath();
    ctx.moveTo(x, rng() * h * 0.2);
    ctx.lineTo(x + (rng() - 0.5) * 8, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // horizontal growth rings (slightly wavy, denser near the tip)
  for (let y = h * 0.045; y < h; ) {
    const strength = 0.10 + rng() * 0.16;
    ctx.strokeStyle = `rgba(150,70,12,${strength})`;
    ctx.lineWidth = 0.8 + rng() * 1.4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin((x / w) * Math.PI * 2 + y) * 1.6;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,160,${strength * 0.55})`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + 1.8 + Math.sin((x / w) * Math.PI * 2 + y) * 1.6;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    y += 9 + rng() * 12 * (1 - y / h) + 3;
  }

  // lenticels (the little dimples roots grow from)
  for (let i = 0; i < 220; i++) {
    const x = rng() * w, y = h * 0.06 + rng() * h * 0.9;
    const r = 0.9 + rng() * 1.8;
    ctx.fillStyle = `rgba(140,66,12,${0.25 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 0.7, 0, 0, 6.28);
    ctx.fill();
  }
  // tiny side rootlets near the tip
  ctx.strokeStyle = 'rgba(160,90,30,0.35)';
  for (let i = 0; i < 40; i++) {
    const x = rng() * w, y = h * (0.55 + rng() * 0.45);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 14, y + 3 + rng() * 8);
    ctx.stroke();
  }
  return finish(c, { repeat: 1 });
}

/** Alpha-only clinging soil, layered over the carrot skin as it comes out. */
export function carrotDirtTexture(w = 256, h = 512) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const rng = makeRng(31337);
  ctx.clearRect(0, 0, w, h);
  // smeared patches, heavier toward the tip (deeper in the ground)
  for (let i = 0; i < 260; i++) {
    const y = Math.pow(rng(), 0.6) * h;
    const x = rng() * w;
    const bias = 0.25 + 0.75 * (y / h);
    const r = (6 + rng() * 34) * bias;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = (0.10 + rng() * 0.5) * bias;
    grd.addColorStop(0, `rgba(74,52,33,${a})`);
    grd.addColorStop(0.6, `rgba(62,43,28,${a * 0.6})`);
    grd.addColorStop(1, 'rgba(60,42,27,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.6), rng() * 6.28, 0, 6.28);
    ctx.fill();
  }
  // dry crumbs
  for (let i = 0; i < 500; i++) {
    const y = Math.pow(rng(), 0.5) * h, x = rng() * w;
    ctx.fillStyle = `rgba(${50 + rng() * 40},${36 + rng() * 26},${24 + rng() * 18},${0.3 + rng() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + rng() * 2.2, 0, 6.28);
    ctx.fill();
  }
  return finish(c, { repeat: 1 });
}

// --- carrot leaf ------------------------------------------------------------
/**
 * One carrot frond drawn with alpha, base at bottom-centre. Carrot tops are
 * feathery, but a too-lacy silhouette dissolves into specks at phone size, so
 * the lobes here are drawn broad and overlapping: airy up close, solid green
 * from a metre away.
 */
export function leafTexture(size = 256, seed = 5) {
  const w = size, h = size * 2;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const rng = makeRng(seed * 7919 + 13);
  ctx.clearRect(0, 0, w, h);

  const baseX = w * 0.5;
  const stemTop = h * 0.06;

  const green = (l) => {
    const r = lerp(38, 122, l);
    const g = lerp(84, 190, l);
    const b = lerp(26, 78, l);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };

  // one pointed leaflet
  function lobe(x, y, len, ang, wid, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = green(light);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid, -len * 0.28, wid * 0.75, -len * 0.78, 0, -len);
    ctx.bezierCurveTo(-wid * 0.75, -len * 0.78, -wid, -len * 0.28, 0, 0);
    ctx.fill();
    ctx.strokeStyle = green(light * 0.5);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  // a side branch carrying a fan of leaflets
  function pinna(x, y, dir, len, light) {
    const segs = 8;
    const ex = x + dir * len * 0.80, ey = y - len * 0.72;
    ctx.strokeStyle = green(light * 0.75);
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y - len * 0.34, ex, ey);
    ctx.stroke();
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const px = lerp(x, ex, t) + dir * Math.sin(t * 2.4) * 3;
      const py = lerp(y, ey, t);
      const ll = len * (0.56 - 0.26 * t) + 6;
      const lit = light * (0.88 + rng() * 0.24);
      lobe(px, py, ll, dir * (1.05 - t * 0.42) + (rng() - 0.5) * 0.22, ll * 0.34, lit);
      lobe(px, py, ll * 0.86, -dir * (0.30 + t * 0.36) + (rng() - 0.5) * 0.2, ll * 0.30, lit * 0.86);
      lobe(px, py, ll * 0.7, dir * (0.15 + t * 0.2), ll * 0.26, lit * 1.04);
    }
  }

  // petiole running the length of the frond
  ctx.lineCap = 'round';
  ctx.strokeStyle = green(0.5);
  ctx.lineWidth = 5.4;
  ctx.beginPath();
  ctx.moveTo(baseX, h);
  ctx.quadraticCurveTo(baseX + (rng() - 0.5) * 16, h * 0.5, baseX, stemTop);
  ctx.stroke();
  ctx.strokeStyle = green(0.82);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(baseX - 1.1, h);
  ctx.quadraticCurveTo(baseX + (rng() - 0.5) * 14, h * 0.5, baseX - 1.1, stemTop);
  ctx.stroke();

  // pairs of pinnae, biggest low down
  const pairs = 8;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = lerp(h * 0.80, stemTop + 16, t);
    const len = lerp(w * 0.50, w * 0.24, t) * (0.9 + rng() * 0.24);
    const light = 0.40 + t * 0.42 + rng() * 0.12;
    pinna(baseX, y, 1, len, light);
    pinna(baseX, y - len * 0.07, -1, len * (0.92 + rng() * 0.16), light * 0.95);
  }
  pinna(baseX, stemTop + 8, 1, w * 0.20, 0.92);
  pinna(baseX, stemTop + 8, -1, w * 0.20, 0.9);

  return finish(c, { repeat: 1 });
}

// --- wood -------------------------------------------------------------------
export function woodTexture(size = 512, opts = {}) {
  const { planks = 5, base = [150, 116, 78], vertical = false } = opts;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(1717);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = vertical ? y / size : x / size;
      const v = vertical ? x / size : y / size;
      // grain: stretched noise + rings
      const n = fbm(u * 26, v * 2.2, 4) * 0.5 + fbm(u * 90, v * 5, 2) * 0.25;
      const ring = Math.sin((v * 7 + n * 5) * Math.PI * 2) * 0.5 + 0.5;
      const k = 0.72 + n * 0.45 + ring * 0.14;
      const i = (y * size + x) * 4;
      d[i] = clamp01(d[i] * k / 255) * 255;
      d[i + 1] = clamp01(d[i + 1] * k / 255) * 255;
      d[i + 2] = clamp01(d[i + 2] * k / 255) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // plank seams + nail heads
  ctx.globalAlpha = 1;
  for (let p = 1; p < planks; p++) {
    const y = (p / planks) * size;
    ctx.fillStyle = 'rgba(40,26,14,0.55)';
    if (vertical) ctx.fillRect(y - 1.5, 0, 3, size);
    else ctx.fillRect(0, y - 1.5, size, 3);
    ctx.fillStyle = 'rgba(255,240,215,0.10)';
    if (vertical) ctx.fillRect(y + 1.5, 0, 2, size);
    else ctx.fillRect(0, y + 1.5, size, 2);
  }
  for (let i = 0; i < 24; i++) {
    const x = rng() * size, y = rng() * size;
    ctx.fillStyle = 'rgba(60,48,38,0.5)';
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(220,210,195,0.25)';
    ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, 1.1, 0, 6.28); ctx.fill();
  }
  return finish(c, { repeat: 1 });
}

// --- sky --------------------------------------------------------------------
/** Winter sky gradient with soft banded cloud, drawn for an inverted dome. */
export function skyTexture(w = 512, h = 512) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, '#3f7fc4');   // zenith
  g.addColorStop(0.28, '#78a9dc');
  g.addColorStop(0.52, '#b9d3ec');
  g.addColorStop(0.70, '#e2ecf5');
  g.addColorStop(0.84, '#f4f2ee');   // pale haze at horizon
  g.addColorStop(1.00, '#eceae4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // stratus bands
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const band = smoothstep(0.05, 0.35, y / h) * (1 - smoothstep(0.6, 0.95, y / h));
    for (let x = 0; x < w; x++) {
      const n = fbm(x / w * 7, y / h * 13, 5);
      const cl = clamp01((n * 0.5 + 0.5 - 0.42) * 2.6) * band;
      const i = (y * w + x) * 4;
      d[i] = lerp(d[i], 252, cl * 0.75);
      d[i + 1] = lerp(d[i + 1], 250, cl * 0.75);
      d[i + 2] = lerp(d[i + 2], 246, cl * 0.7);
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { repeat: 1 });
}

// --- sprites ----------------------------------------------------------------
export function snowflakeSprite(size = 64) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, { repeat: 1 });
}

export function softDotSprite(size = 64, color = [255, 255, 255]) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},1)`);
  g.addColorStop(0.5, `rgba(${color[0]},${color[1]},${color[2]},0.45)`);
  g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, { repeat: 1 });
}

export function sparkleSprite(size = 128) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const m = size / 2;
  const g = ctx.createRadialGradient(m, m, 0, m, m, m * 0.34);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const len = i % 2 === 0 ? m * 0.92 : m * 0.5;
    const grad = ctx.createLinearGradient(
      m - Math.cos(a) * len, m - Math.sin(a) * len,
      m + Math.cos(a) * len, m + Math.sin(a) * len);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = i % 2 === 0 ? 3.5 : 2;
    ctx.beginPath();
    ctx.moveTo(m - Math.cos(a) * len, m - Math.sin(a) * len);
    ctx.lineTo(m + Math.cos(a) * len, m + Math.sin(a) * len);
    ctx.stroke();
  }
  return finish(c, { repeat: 1 });
}

/**
 * Wordless hint: a pointing hand, drawn as the familiar "cursor hand" - index
 * finger up, thumb out to the side, three folded knuckles - so a small child
 * reads it instantly as "your finger goes here".
 */
export function handSprite(size = 256) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 256;
  ctx.translate(size * 0.46, size * 0.30);
  ctx.scale(s * 0.92, s * 0.92);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const palm = new Path2D();
  // index finger, then across the folded knuckles, down the fist, up the thumb
  palm.moveTo(-16, -66);
  palm.quadraticCurveTo(-16, -82, -2, -82);
  palm.quadraticCurveTo(12, -82, 12, -66);
  palm.lineTo(12, -18);
  palm.quadraticCurveTo(20, -26, 28, -22);
  palm.quadraticCurveTo(34, -19, 33, -8);
  palm.quadraticCurveTo(41, -12, 47, -6);
  palm.quadraticCurveTo(51, -2, 49, 8);
  palm.quadraticCurveTo(56, 4, 60, 12);
  palm.quadraticCurveTo(63, 19, 58, 30);
  palm.quadraticCurveTo(48, 62, 20, 70);
  palm.quadraticCurveTo(-10, 77, -32, 58);
  palm.quadraticCurveTo(-48, 42, -58, 18);
  palm.quadraticCurveTo(-64, 5, -54, -2);
  palm.quadraticCurveTo(-44, -8, -34, 6);
  palm.lineTo(-16, 26);
  palm.closePath();

  ctx.shadowColor = 'rgba(22,46,80,0.42)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill(palm);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(58,96,142,0.9)';
  ctx.lineWidth = 6;
  ctx.stroke(palm);

  // knuckle creases so the fist does not read as one blob
  ctx.strokeStyle = 'rgba(58,96,142,0.55)';
  ctx.lineWidth = 3.4;
  for (const [x, y] of [[24, -14], [40, 2], [50, 18]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 12, y + 6, x - 20, y + 4);
    ctx.stroke();
  }
  return finish(c, { repeat: 1 });
}

/** Wordless hint: a fat upward arrow. */
export function arrowSprite(size = 256) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 256;
  ctx.translate(size / 2, size / 2);
  ctx.scale(s, s);
  const p = new Path2D();
  p.moveTo(0, -92);
  p.lineTo(66, -14);
  p.lineTo(28, -14);
  p.lineTo(28, 88);
  p.lineTo(-28, 88);
  p.lineTo(-28, -14);
  p.lineTo(-66, -14);
  p.closePath();
  ctx.shadowColor = 'rgba(20,40,70,0.4)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill(p);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(70,120,180,0.9)';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  return finish(c, { repeat: 1 });
}

/** Soft ring used to mark "dig here" spots and the box drop zone. */
export function ringSprite(size = 256) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const m = size / 2;
  const g = ctx.createRadialGradient(m, m, m * 0.30, m, m, m * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,246,225,0.85)');
  g.addColorStop(0.8, 'rgba(255,214,150,0.55)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, { repeat: 1 });
}

// --- bark / tree ------------------------------------------------------------
export function barkTexture(size = 128) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 4, y / size * 30, 4);
      const k = 0.55 + n * 0.6;
      const i = (y * size + x) * 4;
      d[i] = 92 * k; d[i + 1] = 78 * k; d[i + 2] = 68 * k; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { repeat: 1 });
}
