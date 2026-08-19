import * as THREE from 'three';

/* ------------------------------------------------------------------
   Procedural canvas textures.
   No external assets: everything is painted at runtime so the game
   works completely offline and loads instantly on a phone.
------------------------------------------------------------------- */

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, repeat = 1, aniso = 4) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* value noise helper -------------------------------------------------- */
function noiseFill(ctx, size, opts) {
  const { base, spread, alpha = 1, grain = 1 } = opts;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.random() > grain) continue;
    const n = (Math.random() - 0.5) * spread;
    d[i] = Math.max(0, Math.min(255, base[0] + n));
    d[i + 1] = Math.max(0, Math.min(255, base[1] + n));
    d[i + 2] = Math.max(0, Math.min(255, base[2] + n));
    d[i + 3] = 255 * alpha;
  }
  ctx.putImageData(img, 0, 0);
}

function blobs(ctx, size, count, radius, color, alphaRange) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = radius * (0.4 + Math.random() * 1.2);
    const a = alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------- wet asphalt ---------- */
export function asphaltTexture() {
  const S = 512, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#767e88'; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [118, 126, 136], spread: 26 });
  // aggregate stones
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * S, py = Math.random() * S;
    const r = 0.6 + Math.random() * 2.2;
    const v = 105 + Math.random() * 75;
    x.fillStyle = `rgba(${v},${v + 3},${v + 8},${0.25 + Math.random() * 0.5})`;
    x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  // wet dark patches + slush
  blobs(x, S, 34, 60, '36,44,54', [0.05, 0.2]);
  // frozen slush smeared over the surface
  blobs(x, S, 56, 44, '214,226,238', [0.08, 0.36]);
  blobs(x, S, 18, 90, '230,238,246', [0.05, 0.2]);
  // cracks
  x.strokeStyle = 'rgba(46,52,60,0.3)';
  for (let i = 0; i < 8; i++) {
    x.lineWidth = 0.5 + Math.random() * 0.9;
    x.beginPath();
    let px = Math.random() * S, py = Math.random() * S;
    x.moveTo(px, py);
    for (let k = 0; k < 7; k++) {
      px += (Math.random() - 0.5) * 46; py += (Math.random() - 0.5) * 46;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return c;
}

export function asphaltRoughness() {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [200, 200, 200], spread: 60 });
  // puddles / wet streaks = smooth (dark in roughness map)
  blobs(x, S, 30, 46, '30,30,30', [0.3, 0.85]);
  return c;
}

/* ---------- packed snow (圧雪) ---------- */
export function packedSnowTexture() {
  const S = 512, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#eef4fb'; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [238, 244, 251], spread: 16 });
  // layered strata of plowed snow
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * S;
    const h = 3 + Math.random() * 14;
    x.fillStyle = `rgba(${180 + Math.random() * 40},${196 + Math.random() * 34},${212 + Math.random() * 30},${0.18 + Math.random() * 0.25})`;
    x.beginPath();
    x.moveTo(0, y);
    for (let px = 0; px <= S; px += 32) x.lineTo(px, y + Math.sin(px * 0.03 + i) * 5);
    x.lineTo(S, y + h); 
    for (let px = S; px >= 0; px -= 32) x.lineTo(px, y + h + Math.sin(px * 0.03 + i) * 5);
    x.closePath(); x.fill();
  }
  // road grit frozen into the bank
  for (let i = 0; i < 900; i++) {
    const v = 70 + Math.random() * 90;
    x.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.1 + Math.random() * 0.35})`;
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 0.5 + Math.random() * 1.8, 0, Math.PI * 2); x.fill();
  }
  blobs(x, S, 18, 50, '160,176,196', [0.05, 0.2]);
  return c;
}

/* ---------- fresh / powder snow ---------- */
export function snowTexture() {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#f7fbff'; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [247, 251, 255], spread: 10 });
  blobs(x, S, 30, 40, '206,222,240', [0.05, 0.16]);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 0.4 + Math.random() * 1.1, 0, Math.PI * 2); x.fill();
  }
  return c;
}

/* ---------- painted, worn machine metal ---------- */
export function paintTexture(hex, opts = {}) {
  const { rust = 0.5, dirt = 0.6, scratches = 60 } = opts;
  const S = 512, c = makeCanvas(S), x = c.getContext('2d');
  const col = new THREE.Color(hex);
  const r = Math.round(col.r * 255), g = Math.round(col.g * 255), b = Math.round(col.b * 255);
  x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [r, g, b], spread: 14 });

  // uneven sun-bleaching
  blobs(x, S, 22, 90, '255,255,255', [0.02, 0.1]);
  blobs(x, S, 20, 80, '0,0,0', [0.02, 0.09]);

  // paint chips down to primer / bare metal
  for (let i = 0; i < 90 * rust; i++) {
    const px = Math.random() * S, py = Math.random() * S;
    const rad = 1 + Math.random() * 5;
    x.fillStyle = Math.random() < 0.45
      ? `rgba(${110 + Math.random() * 40},${96 + Math.random() * 30},${88 + Math.random() * 24},${0.5 + Math.random() * 0.4})`
      : `rgba(${132 + Math.random() * 40},${74 + Math.random() * 26},${38 + Math.random() * 20},${0.35 + Math.random() * 0.45})`;
    x.beginPath();
    x.ellipse(px, py, rad, rad * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
    x.fill();
  }
  // scratches
  x.lineCap = 'round';
  for (let i = 0; i < scratches; i++) {
    x.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.18})`;
    x.lineWidth = 0.5 + Math.random();
    const px = Math.random() * S, py = Math.random() * S;
    const len = 8 + Math.random() * 90, ang = Math.random() * Math.PI * 2;
    x.beginPath(); x.moveTo(px, py);
    x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
  }
  // road grime, heaviest toward the bottom of the panel (V coordinate 1)
  const grd = x.createLinearGradient(0, S * 0.35, 0, S);
  grd.addColorStop(0, 'rgba(52,44,36,0)');
  grd.addColorStop(1, `rgba(52,44,36,${0.5 * dirt})`);
  x.fillStyle = grd; x.fillRect(0, 0, S, S);
  // frozen slush splatter
  for (let i = 0; i < 220 * dirt; i++) {
    const py = S * (0.45 + Math.random() * 0.55);
    const a = (py / S - 0.4) * 0.7;
    x.fillStyle = Math.random() < 0.55
      ? `rgba(226,234,244,${a * (0.4 + Math.random() * 0.6)})`
      : `rgba(64,56,46,${a * (0.4 + Math.random() * 0.6)})`;
    x.beginPath();
    x.ellipse(Math.random() * S, py, 1 + Math.random() * 5, 1 + Math.random() * 3, 0, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

/* ---------- concrete / building facade ---------- */
export function buildingTexture(hex, floors) {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  const col = new THREE.Color(hex);
  x.fillStyle = `#${col.getHexString()}`; x.fillRect(0, 0, S, S);
  noiseFill(x, S, { base: [col.r * 255, col.g * 255, col.b * 255], spread: 22 });
  const rows = floors, cols = 5;
  const wW = S / cols * 0.56, wH = S / rows * 0.5;
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = (cx + 0.5) * S / cols - wW / 2;
      const py = (ry + 0.5) * S / rows - wH / 2;
      const lit = Math.random() < 0.34;
      x.fillStyle = lit
        ? `rgba(${250},${226 + Math.random() * 20},${170 + Math.random() * 40},${0.75 + Math.random() * 0.25})`
        : `rgba(${28 + Math.random() * 22},${38 + Math.random() * 22},${52 + Math.random() * 26},0.95)`;
      x.fillRect(px, py, wW, wH);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1;
      x.strokeRect(px, py, wW, wH);
    }
  }
  // snow ledges on each floor line
  for (let ry = 1; ry < rows; ry++) {
    x.fillStyle = 'rgba(236,244,252,0.5)';
    x.fillRect(0, ry * S / rows - 2, S, 2.5);
  }
  return c;
}

/* ---------- radial sprite for particles / smoke ---------- */
export function softSprite(inner = '255,255,255', hardness = 0.25) {
  const S = 128, c = makeCanvas(S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.02, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${inner},1)`);
  g.addColorStop(hardness, `rgba(${inner},0.72)`);
  g.addColorStop(1, `rgba(${inner},0)`);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

/* ---------- Japanese road sign faces ---------- */
export function signSpeed(num) {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#e9edf1'; x.fillRect(0, 0, S, S);
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
  x.fillStyle = '#f2f5f8'; x.fill();
  x.lineWidth = S * 0.075; x.strokeStyle = '#c62828'; x.stroke();
  x.fillStyle = '#15202b';
  x.font = `bold ${S * 0.5}px -apple-system, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(num), S / 2, S / 2 + S * 0.02);
  grime(x, S);
  return c;
}

export function signWarnSnow() {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#1d2731'; x.fillRect(0, 0, S, S);
  x.beginPath();
  x.moveTo(S / 2, S * 0.06); x.lineTo(S * 0.95, S * 0.86); x.lineTo(S * 0.05, S * 0.86);
  x.closePath();
  x.fillStyle = '#f6c93a'; x.fill();
  x.lineWidth = S * 0.045; x.strokeStyle = '#1a1a1a'; x.stroke();
  // snowflake pictogram
  x.strokeStyle = '#1a1a1a'; x.lineWidth = S * 0.035; x.lineCap = 'round';
  const cx2 = S / 2, cy2 = S * 0.58, r2 = S * 0.16;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    x.beginPath();
    x.moveTo(cx2, cy2);
    x.lineTo(cx2 + Math.cos(a) * r2, cy2 + Math.sin(a) * r2);
    x.stroke();
  }
  grime(x, S);
  return c;
}

export function signBlue() {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#1c5aa8'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#f0f4f8'; x.lineWidth = S * 0.05;
  x.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
  // arrow pictogram
  x.fillStyle = '#f0f4f8';
  x.beginPath();
  x.moveTo(S * 0.2, S * 0.5); x.lineTo(S * 0.56, S * 0.24); x.lineTo(S * 0.56, S * 0.4);
  x.lineTo(S * 0.82, S * 0.4); x.lineTo(S * 0.82, S * 0.6); x.lineTo(S * 0.56, S * 0.6);
  x.lineTo(S * 0.56, S * 0.76); x.closePath(); x.fill();
  grime(x, S);
  return c;
}

function grime(x, S) {
  blobs(x, S, 10, 28, '40,44,50', [0.04, 0.16]);
  blobs(x, S, 6, 22, '235,242,250', [0.05, 0.2]);
}

/* ---------- helper to build a full standard material ---------- */
export function stdMaterial(opts) {
  const {
    mapCanvas, repeat = 1, roughCanvas, roughRepeat = repeat,
    color = 0xffffff, roughness = 0.8, metalness = 0.0,
    emissive = 0x000000, emissiveIntensity = 1, flatShading = false,
  } = opts;
  const m = new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive, emissiveIntensity, flatShading,
  });
  if (mapCanvas) m.map = toTexture(mapCanvas, repeat);
  if (roughCanvas) {
    const t = new THREE.CanvasTexture(roughCanvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(roughRepeat, roughRepeat);
    m.roughnessMap = t;
  }
  return m;
}

export { toTexture };

/** Yellow/black hazard stripes for the cutting edge and head sides. */
export function hazardTexture() {
  const S = 256, c = makeCanvas(S), x = c.getContext('2d');
  x.fillStyle = '#f2c21a'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#1a1c20';
  x.save();
  x.translate(S / 2, S / 2); x.rotate(-Math.PI / 4); x.translate(-S, -S);
  for (let i = 0; i < 10; i++) x.fillRect(0, i * S * 0.25, S * 2, S * 0.125);
  x.restore();
  // salt burn and scraped paint
  blobs(x, S, 26, 26, '210,214,220', [0.05, 0.28]);
  blobs(x, S, 18, 22, '60,52,44', [0.06, 0.3]);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(150,155,162,${0.1 + Math.random() * 0.4})`;
    x.lineWidth = 0.6 + Math.random() * 1.6;
    const px = Math.random() * S, py = Math.random() * S, len = 10 + Math.random() * 60;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + len, py + (Math.random() - 0.5) * 6); x.stroke();
  }
  return c;
}
