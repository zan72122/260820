/**
 * Every texture in the game is drawn here, at runtime, on a 2D canvas.
 * Nothing is downloaded, nothing is a placeholder, and the whole build stays
 * under a few hundred kilobytes — which matters when a phone is on a festival
 * ground with two bars of signal.
 */

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

function tex(c, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Deterministic value noise so textures replay identically under a fixed seed. */
function hash2(x, y, s = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(g, w, h, { octaves = 4, scale = 8, alpha = 1, seed = 0, tint = '255,255,255' }) {
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      let amp = 0.5;
      let f = scale;
      for (let o = 0; o < octaves; o++) {
        const xi = Math.floor((x / w) * f);
        const yi = Math.floor((y / h) * f);
        const fx = ((x / w) * f) % 1;
        const fy = ((y / h) * f) % 1;
        const a = hash2(xi, yi, seed + o);
        const b = hash2(xi + 1, yi, seed + o);
        const c = hash2(xi, yi + 1, seed + o);
        const dd = hash2(xi + 1, yi + 1, seed + o);
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        v += amp * (a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + dd * sx * sy);
        amp *= 0.5;
        f *= 2;
      }
      const i = (y * w + x) * 4;
      const val = Math.max(0, Math.min(255, v * 255));
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
      d[i + 3] = 255 * alpha;
    }
  }
  const off = canvas(w, h);
  off.g.putImageData(img, 0, 0);
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(off.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return tint;
}

// --------------------------------------------------------------------- washi

/** Thin handmade paper: long fibres, a few darker slubs, faint laid lines. */
export function washiTextures(size = 512) {
  const { c, g } = canvas(size, size);
  g.fillStyle = '#fbf7ef';
  g.fillRect(0, 0, size, size);

  // laid lines from the papermaking screen
  g.globalAlpha = 0.05;
  g.strokeStyle = '#c9bda6';
  g.lineWidth = 1;
  for (let x = 0; x < size; x += 7) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.stroke();
  }

  // long kozo fibres
  for (let i = 0; i < 900; i++) {
    const x = hash2(i, 1) * size;
    const y = hash2(i, 2) * size;
    const a = hash2(i, 3) * Math.PI;
    const len = 6 + hash2(i, 4) * 46;
    const bright = hash2(i, 5);
    g.globalAlpha = 0.05 + bright * 0.13;
    g.strokeStyle = bright > 0.72 ? '#8d7f66' : '#ffffff';
    g.lineWidth = 0.5 + hash2(i, 6) * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 + hash2(i, 7) * 8 - 4,
      y + Math.sin(a) * len * 0.5,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len
    );
    g.stroke();
  }
  g.globalAlpha = 1;

  // grain / thickness variation
  const grain = canvas(size, size);
  fbm(grain.g, size, size, { octaves: 5, scale: 14, seed: 3 });
  g.globalAlpha = 0.16;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(grain.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;

  // A separate single-channel map drives per-fibre thickness in the shader:
  // where the sheet is thin it goes transparent first when it gets wet.
  const th = canvas(size, size);
  th.g.fillStyle = '#808080';
  th.g.fillRect(0, 0, size, size);
  fbm(th.g, size, size, { octaves: 5, scale: 22, seed: 11 });
  th.g.globalAlpha = 0.5;
  th.g.globalCompositeOperation = 'lighter';
  th.g.drawImage(c, 0, 0);
  th.g.globalCompositeOperation = 'source-over';

  return {
    map: tex(c, { repeat: 1 }),
    thickness: tex(th.c, { repeat: 1, srgb: false }),
  };
}

// ---------------------------------------------------------------------- wood

/** Cedar for the tub and the stall counter: wet-dark near the waterline. */
export function woodTexture(size = 512, hue = '#8a5a34') {
  const { c, g } = canvas(size, size);
  g.fillStyle = hue;
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < 150; i++) {
    const y = (i / 150) * size + hash2(i, 21) * 4;
    const dark = hash2(i, 22);
    g.strokeStyle = `rgba(${40 + dark * 60},${22 + dark * 40},${10 + dark * 26},${0.09 + dark * 0.2})`;
    g.lineWidth = 0.6 + dark * 3.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      g.lineTo(x, y + Math.sin(x * 0.021 + i) * (2 + dark * 5) + hash2(i, x) * 2);
    }
    g.stroke();
  }
  // knots
  for (let k = 0; k < 3; k++) {
    const cx = hash2(k, 31) * size;
    const cy = hash2(k, 32) * size;
    for (let r = 26; r > 0; r -= 2) {
      g.strokeStyle = `rgba(48,26,12,${0.05 + (1 - r / 26) * 0.22})`;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.62, hash2(k, 33) * 3, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const grain = canvas(size, size);
  fbm(grain.g, size, size, { octaves: 4, scale: 26, seed: 5 });
  g.globalAlpha = 0.3;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(grain.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return tex(c, { repeat: 1 });
}

// ---------------------------------------------------------------------- fish

const FISH_PALETTES = {
  wakin: { back: '#a01503', side: '#ee4405', flank: '#ff6f16', belly: '#ffd9a2' },
  sarasa: { back: '#b81c02', side: '#f24c07', flank: '#ff8420', belly: '#fff4e6' },
  demekin: { back: '#120a0c', side: '#361d1c', flank: '#5a3126', belly: '#6d442f' },
  calico: { back: '#7d6f78', side: '#cdbdb8', flank: '#f0e2d6', belly: '#fffaf1' },
};

/**
 * Body colour for one goldfish variety.
 * Texture V wraps around the body: 0 = spine, 0.5 = belly, 1 = spine again.
 */
export function fishTexture(kind, w = 320, h = 160) {
  const { c, g } = canvas(w, h);
  const p = FISH_PALETTES[kind] || FISH_PALETTES.wakin;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, p.back);
  grad.addColorStop(0.18, p.side);
  grad.addColorStop(0.38, kind === 'sarasa' ? '#f0803c' : p.flank);
  grad.addColorStop(0.5, p.belly);
  grad.addColorStop(0.62, kind === 'sarasa' ? '#f0803c' : p.flank);
  grad.addColorStop(0.82, p.side);
  grad.addColorStop(1.0, p.back);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // head is a shade deeper, the tail root a shade lighter
  const hz = g.createLinearGradient(0, 0, w, 0);
  hz.addColorStop(0, 'rgba(0,0,0,0.24)');
  hz.addColorStop(0.3, 'rgba(0,0,0,0)');
  hz.addColorStop(0.85, 'rgba(255,255,255,0.06)');
  g.fillStyle = hz;
  g.fillRect(0, 0, w, h);

  if (kind === 'sarasa') {
    // white saddles, the classic red-and-white
    g.fillStyle = 'rgba(252,246,238,0.96)';
    const blobs = [
      [0.24, 0.5, 0.13, 0.42],
      [0.55, 0.34, 0.16, 0.3],
      [0.78, 0.62, 0.12, 0.36],
      [0.42, 0.78, 0.1, 0.24],
    ];
    for (const [bx, by, bw, bh] of blobs) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.22) {
        const wob = 0.78 + hash2(Math.round(a * 10), bx * 100) * 0.44;
        const x = (bx + Math.cos(a) * bw * wob) * w;
        const y = (by + Math.sin(a) * bh * wob) * h;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    }
  }
  if (kind === 'calico') {
    for (let i = 0; i < 70; i++) {
      const x = hash2(i, 41) * w;
      const y = hash2(i, 42) * h;
      const r = 3 + hash2(i, 43) * 11;
      const t = hash2(i, 44);
      g.fillStyle =
        t > 0.62 ? 'rgba(24,20,22,0.72)' : t > 0.3 ? 'rgba(226,96,32,0.66)' : 'rgba(80,110,150,0.3)';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.75, hash2(i, 45) * 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // scales — overlapping arcs, tighter towards the tail
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.lineWidth = 1;
  for (let row = 0; row < 15; row++) {
    const y = (row / 14) * h;
    const step = 15 - row * 0.15;
    for (let x = (row % 2) * step * 0.5; x < w; x += step) {
      const s = 0.55 + (x / w) * 0.5;
      g.globalAlpha = 0.1 + 0.14 * (1 - Math.abs(y / h - 0.5) * 1.6);
      g.beginPath();
      g.arc(x, y, step * 0.62 * s, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // a wet specular band along the flank
  const sheen = g.createLinearGradient(0, h * 0.3, 0, h * 0.5);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,244,225,0.2)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, h * 0.3, w, h * 0.2);

  // eye, drawn where the head UV lands
  const ex = w * 0.055;
  for (const ey of [h * 0.2, h * 0.8]) {
    g.fillStyle = kind === 'demekin' ? '#0a0808' : '#120c0a';
    g.beginPath();
    g.ellipse(ex, ey, 9, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,232,200,0.85)';
    g.beginPath();
    g.ellipse(ex - 2.5, ey - 3, 2.6, 2.6, 0, 0, Math.PI * 2);
    g.fill();
  }

  return tex(c, { repeat: 1 });
}

/** Fin membrane: translucent, with rays fanning out from the base. */
export function finTexture(kind, w = 128, h = 128) {
  const { c, g } = canvas(w, h);
  const warm = kind === 'demekin' ? '30,24,26' : kind === 'calico' ? '210,200,196' : '236,110,48';
  g.clearRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `rgba(${warm},0.95)`);
  grad.addColorStop(0.55, `rgba(${warm},0.6)`);
  grad.addColorStop(1, `rgba(${warm},0.22)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 26; i++) {
    const y = (i / 25) * h;
    g.lineWidth = 0.7;
    g.globalAlpha = 0.2 + hash2(i, 51) * 0.3;
    g.beginPath();
    g.moveTo(0, h * 0.5 + (y - h * 0.5) * 0.12);
    g.quadraticCurveTo(w * 0.5, h * 0.5 + (y - h * 0.5) * 0.7, w, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  return tex(c, { repeat: 1 });
}

// ------------------------------------------------------------------ festival

/** Noren / stall cloth: indigo with a broad off-white band. */
export function clothTexture(size = 256) {
  const { c, g } = canvas(size, size);
  g.fillStyle = '#1d2c47';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#f0e6d4';
  g.fillRect(0, size * 0.5, size, size * 0.22);
  g.fillStyle = '#a8271b';
  g.fillRect(0, size * 0.78, size, size * 0.08);
  const weave = canvas(size, size);
  fbm(weave.g, size, size, { octaves: 3, scale: 60, seed: 9 });
  g.globalAlpha = 0.22;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(weave.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return tex(c, { repeat: 1 });
}

/** Chochin paper: warm, ribbed, with a red band top and bottom. */
export function lanternTexture(w = 128, h = 128, glyph = '') {
  const { c, g } = canvas(w, h);
  g.fillStyle = '#f6cf8c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#c0301c';
  g.fillRect(0, 0, w, h * 0.12);
  g.fillRect(0, h * 0.88, w, h * 0.12);
  g.strokeStyle = 'rgba(150,100,50,0.28)';
  g.lineWidth = 1.6;
  for (let y = h * 0.12; y < h * 0.88; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  if (glyph) {
    g.fillStyle = '#20130c';
    g.font = `bold ${Math.floor(h * 0.42)}px "Hiragino Mincho ProN", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, w * 0.5, h * 0.5);
  }
  return tex(c, { repeat: 1 });
}

/** A sheet of standing festival-goers, seen from behind, as flat silhouettes. */
export function crowdTexture(w = 512, h = 256) {
  const { c, g } = canvas(w, h);
  g.clearRect(0, 0, w, h);
  const cells = 4;
  const cw = w / cells;
  for (let i = 0; i < cells; i++) {
    const ox = i * cw;
    const s = 0.86 + hash2(i, 61) * 0.34;
    const bodyW = cw * 0.5 * s;
    const cx = ox + cw * 0.5;
    const top = h * (0.16 + hash2(i, 62) * 0.08);
    g.fillStyle = 'rgba(18,12,14,0.9)';
    // yukata: shoulders, a slight flare, and a hem that stops above the ankle
    g.beginPath();
    g.moveTo(cx - bodyW * 0.62, top + h * 0.15);
    g.quadraticCurveTo(cx, top + h * 0.1, cx + bodyW * 0.62, top + h * 0.15);
    g.lineTo(cx + bodyW * 0.72, h * 0.82);
    g.lineTo(cx - bodyW * 0.72, h * 0.82);
    g.closePath();
    g.fill();
    // legs below the hem
    for (const lx of [-0.26, 0.26]) {
      g.fillRect(cx + bodyW * lx - bodyW * 0.11, h * 0.8, bodyW * 0.22, h * 0.2);
    }
    // head
    g.beginPath();
    g.ellipse(cx, top + h * 0.055, bodyW * 0.24, bodyW * 0.29, 0, 0, Math.PI * 2);
    g.fill();
    // a hint of an obi catching the lantern light
    g.fillStyle = `rgba(${180 + hash2(i, 63) * 60},${90 + hash2(i, 64) * 70},${60},0.3)`;
    g.fillRect(cx - bodyW * 0.66, h * 0.5, bodyW * 1.32, h * 0.07);
    // a shoulder rim light from the lanterns behind them
    g.fillStyle = 'rgba(255,178,110,0.22)';
    g.fillRect(cx - bodyW * 0.62, top + h * 0.15, bodyW * 0.13, h * 0.62);
  }
  return tex(c, { repeat: 1 });
}

/** Soft round falloff used for droplets, lantern glow and light shafts. */
export function glowTexture(size = 128, inner = 'rgba(255,236,200,1)', outer = 'rgba(255,150,60,0)') {
  const { c, g } = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(/,\s*1\)$/, ',0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = tex(c, { repeat: 1 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Tiling detail normal for the water surface. */
export function waterNormalTexture(size = 256) {
  const { c, g } = canvas(size, size);
  const img = g.createImageData(size, size);
  const d = img.data;
  const height = (x, y) => {
    let v = 0;
    let a = 0.5;
    let f = 4;
    for (let o = 0; o < 4; o++) {
      v += a * Math.sin((x / size) * f * 6.2831 + o * 1.7) * Math.cos((y / size) * f * 6.2831 - o * 2.3);
      a *= 0.55;
      f *= 2;
    }
    return v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hx = height((x + 1) % size, y) - height((x - 1 + size) % size, y);
      const hy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
      const nx = -hx * 1.4;
      const ny = -hy * 1.4;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: 1, srgb: false });
}

/** Glazed porcelain for the bowl: a faint crackle and a blue rim wash. */
export function porcelainTexture(size = 256) {
  const { c, g } = canvas(size, size);
  g.fillStyle = '#f4efe4';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(80,96,120,0.18)';
  g.lineWidth = 0.7;
  for (let i = 0; i < 60; i++) {
    let x = hash2(i, 71) * size;
    let y = hash2(i, 72) * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (hash2(i, 73 + s) - 0.5) * 40;
      y += (hash2(i, 83 + s) - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(46,74,132,0.5)';
  g.fillRect(0, 0, size, size * 0.09);
  g.fillStyle = 'rgba(46,74,132,0.22)';
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.arc(((i + 0.5) / 8) * size, size * 0.2, size * 0.035, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat: 1 });
}

/** Gravel and a few pebbles for the bottom of the tub. */
export function tubFloorTexture(size = 512) {
  const { c, g } = canvas(size, size);
  g.fillStyle = '#221c19';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = hash2(i, 91) * size;
    const y = hash2(i, 92) * size;
    const r = 7 + hash2(i, 93) * 15;
    const t = hash2(i, 94);
    const base = 34 + t * 44;
    g.fillStyle = `rgba(${base + 12},${base - 1},${base - 12},${0.5 + t * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.7 + hash2(i, 95) * 0.4), hash2(i, 96) * 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(255,238,214,${0.02 + t * 0.045})`;
    g.beginPath();
    g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  const shade = canvas(size, size);
  fbm(shade.g, size, size, { octaves: 4, scale: 4, seed: 17 });
  g.globalAlpha = 0.24;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(shade.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return tex(c, { repeat: 1 });
}
