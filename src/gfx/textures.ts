import * as THREE from 'three';

/**
 * All textures are generated procedurally on 2D canvases so the game ships with
 * zero binary assets and boots instantly on a phone. Wear and dirt are painted
 * where the part actually touches something (soil, chain, hands, oil) instead of
 * being sprayed over the whole surface as uniform noise.
 */

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, THREE.Texture>();

function canvas(size: number, h = size): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  const x = c.getContext('2d')!;
  return { c, x };
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Deterministic value noise so every session looks like the same farm. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function grain(x: Ctx, w: number, h: number, amount: number, seed: number, scale = 1) {
  const rng = makeRng(seed);
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const cells = Math.max(1, Math.floor(w / scale));
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const gx = Math.floor((px / w) * cells);
      const gy = Math.floor((py / h) * cells);
      const n = (grid[gy * cells + gx] - 0.5) * amount * 255;
      const i = (py * w + px) * 4;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
  }
  x.putImageData(img, 0, 0);
}

function blobs(x: Ctx, w: number, h: number, count: number, seed: number, colors: string[], rMin: number, rMax: number) {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = rMin + rng() * (rMax - rMin);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = colors[Math.floor(rng() * colors.length)];
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
}

/* ------------------------------------------------------------------ soil */

export function soilAlbedo(): THREE.Texture {
  const key = 'soilA';
  if (cache.has(key)) return cache.get(key)!;
  const S = 512;
  const { c, x } = canvas(S);
  x.fillStyle = '#9c7f5c';
  x.fillRect(0, 0, S, S);
  // dry crust patches and damp hollows: sandy loam is never one colour
  blobs(x, S, S, 90, 11, ['rgba(178,153,116,0.35)', 'rgba(160,134,98,0.3)'], 12, 46);
  blobs(x, S, S, 70, 23, ['rgba(96,74,50,0.3)', 'rgba(112,88,58,0.26)'], 8, 34);
  // small gravel / aggregate
  const rng = makeRng(77);
  for (let i = 0; i < 2200; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const r = 0.6 + rng() * 2.2;
    x.fillStyle = rng() > 0.5 ? 'rgba(214,196,166,0.5)' : 'rgba(74,58,40,0.45)';
    x.beginPath();
    x.ellipse(px, py, r, r * (0.6 + rng() * 0.6), rng() * 6.28, 0, Math.PI * 2);
    x.fill();
  }
  grain(x, S, S, 0.1, 5, 2);
  const t = finish(c, 4);
  cache.set(key, t);
  return t;
}

export function soilRough(): THREE.Texture {
  const key = 'soilR';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#d6d6d6';
  x.fillRect(0, 0, S, S);
  blobs(x, S, S, 30, 31, ['rgba(120,120,120,0.5)'], 20, 80); // damp = smoother
  grain(x, S, S, 0.12, 9, 2);
  const t = finish(c, 4, false);
  cache.set(key, t);
  return t;
}

/** Damp cut-face of the ridge exposed by the blade. */
export function cutSoilAlbedo(): THREE.Texture {
  const key = 'cutA';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#8a6d49';
  x.fillRect(0, 0, S, S);
  blobs(x, S, S, 26, 41, ['rgba(112,88,58,0.5)', 'rgba(78,60,40,0.4)'], 16, 70);
  grain(x, S, S, 0.09, 13, 2);
  const t = finish(c, 3);
  cache.set(key, t);
  return t;
}

/* ------------------------------------------------------------ peanut pod */

/** Reticulated shell: ridged mesh pattern along the pod, plus the waist. */
export function podAlbedo(): THREE.Texture {
  const key = 'podA';
  if (cache.has(key)) return cache.get(key)!;
  const S = 512;
  const { c, x } = canvas(S);

  x.fillStyle = '#cbb083';
  x.fillRect(0, 0, S, S);
  // longitudinal veins
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const px = (i / 26) * S + Math.sin(i) * 3;
    x.strokeStyle = 'rgba(140,110,70,0.5)';
    x.beginPath();
    x.moveTo(px, 0);
    for (let y = 0; y <= S; y += 16) x.lineTo(px + Math.sin((y / S) * 7 + i) * 5, y);
    x.stroke();
  }
  // cross-hatch of the reticulation
  for (let i = 0; i < 40; i++) {
    const py = (i / 40) * S;
    x.strokeStyle = 'rgba(126,98,62,0.4)';
    x.beginPath();
    x.moveTo(0, py);
    for (let px = 0; px <= S; px += 14) x.lineTo(px, py + Math.sin((px / S) * 11 + i) * 5);
    x.stroke();
  }
  // soil staining sits in the hollows, strongest near where the peg attaches
  blobs(x, S, S, 22, 61, ['rgba(120,96,64,0.45)', 'rgba(150,124,86,0.35)'], 20, 90);
  grain(x, S, S, 0.08, 17, 2);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

export function podRough(): THREE.Texture {
  const key = 'podR';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#e2e2e2';
  x.fillRect(0, 0, S, S);
  grain(x, S, S, 0.18, 19, 1);
  const t = finish(c, 1, false);
  cache.set(key, t);
  return t;
}

/** Normal map giving the shell its fine reticulated relief. */
export function podNormal(): THREE.Texture {
  const key = 'podN';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  const img = x.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let px = 0; px < S; px++) {
      const u = (px / S) * Math.PI * 2;
      const v = (y / S) * Math.PI * 2;
      const h = Math.sin(u * 13) * Math.cos(v * 9) + 0.5 * Math.sin(u * 27 + v * 5);
      const hx = 13 * Math.cos(u * 13) * Math.cos(v * 9) * 0.06;
      const hy = -9 * Math.sin(u * 13) * Math.sin(v * 9) * 0.06;
      const i = (y * S + px) * 4;
      const len = Math.hypot(hx, hy, 1);
      d[i] = ((-hx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((-hy / len) * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len) * 255;
      d[i + 3] = 255 * (0.5 + 0.5 * Math.abs(h) * 0);
      d[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = finish(c, 1, false);
  cache.set(key, t);
  return t;
}

/* ----------------------------------------------------------------- steel */

/** Painted steel whose paint has worn off only where the part is handled. */
export function paintedSteel(base: string, seed: number): THREE.Texture {
  const key = 'paint' + base + seed;
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  // chipped paint along one band (the edge that gets knocked)
  const rng = makeRng(seed);
  for (let i = 0; i < 46; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const r = 0.8 + rng() * 3;
    x.fillStyle = rng() > 0.45 ? 'rgba(122,112,104,0.35)' : 'rgba(92,60,38,0.26)';
    x.beginPath();
    x.ellipse(px, py, r, r * (0.5 + rng()), rng() * 6.28, 0, Math.PI * 2);
    x.fill();
  }
  grain(x, S, S, 0.05, seed + 3, 2);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Bare steel polished by soil friction. */
export function polishedSteel(): THREE.Texture {
  const key = 'polish';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#9aa0a4';
  x.fillRect(0, 0, S, S);
  // scouring runs in the direction the soil flows over the blade
  const rng = makeRng(101);
  for (let i = 0; i < 260; i++) {
    const py = rng() * S;
    x.strokeStyle = rng() > 0.5 ? 'rgba(215,220,224,0.35)' : 'rgba(120,126,130,0.35)';
    x.lineWidth = 0.5 + rng() * 1.6;
    x.beginPath();
    x.moveTo(0, py);
    x.lineTo(S, py + (rng() - 0.5) * 6);
    x.stroke();
  }
  const t = finish(c, 2);
  cache.set(key, t);
  return t;
}

/** Dust that has settled on an upward-facing surface: heavier low, thin high. */
export function dustyTop(): THREE.Texture {
  const key = 'dusty';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#b39c76');
  g.addColorStop(0.55, '#9c8763');
  g.addColorStop(1, '#6f6455');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  blobs(x, S, S, 30, 71, ['rgba(196,176,140,0.45)'], 10, 60);
  grain(x, S, S, 0.09, 29, 2);
  const t = finish(c, 2);
  cache.set(key, t);
  return t;
}

/** Oil film that creeps out of a bearing: dark, wet, local. */
export function oilStain(): THREE.Texture {
  const key = 'oil';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#3a352f';
  x.fillRect(0, 0, S, S);
  blobs(x, S, S, 18, 83, ['rgba(20,17,14,0.7)', 'rgba(60,48,34,0.5)'], 16, 70);
  grain(x, S, S, 0.06, 31, 2);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Rubber with mud packed into the lugs. */
export function muddyRubber(): THREE.Texture {
  const key = 'rubber';
  if (cache.has(key)) return cache.get(key)!;
  const S = 512;
  const { c, x } = canvas(S, 256);
  x.fillStyle = '#26241f';
  x.fillRect(0, 0, S, 256);
  // angled lug bars with soil packed on the trailing side
  for (let i = 0; i < 12; i++) {
    const px = (i / 12) * S;
    x.save();
    x.translate(px, 0);
    x.fillStyle = '#332f28';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(26, 0);
    x.lineTo(70, 256);
    x.lineTo(44, 256);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(140,116,80,0.5)';
    x.beginPath();
    x.moveTo(26, 0);
    x.lineTo(34, 0);
    x.lineTo(78, 256);
    x.lineTo(70, 256);
    x.closePath();
    x.fill();
    x.restore();
  }
  blobs(x, S, 256, 24, 97, ['rgba(148,124,88,0.4)'], 12, 46);
  grain(x, S, 256, 0.08, 37, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/* ---------------------------------------------------------------- leaves */

export function leafAlbedo(): THREE.Texture {
  const key = 'leaf';
  if (cache.has(key)) return cache.get(key)!;
  const S = 128;
  const { c, x } = canvas(S);
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#5c7a33');
  g.addColorStop(0.6, '#6d8c3c');
  g.addColorStop(1, '#7d9445');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // midrib + veins
  x.strokeStyle = 'rgba(150,168,96,0.55)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(S * 0.5, 0);
  x.lineTo(S * 0.5, S);
  x.stroke();
  x.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const py = (i / 9) * S;
    x.beginPath();
    x.moveTo(S * 0.5, py);
    x.lineTo(S * 0.1, py + 8);
    x.moveTo(S * 0.5, py);
    x.lineTo(S * 0.9, py + 8);
    x.stroke();
  }
  // late-season yellowing at the tips only
  blobs(x, S, S, 6, 53, ['rgba(178,166,74,0.35)'], 10, 34);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Soft round falloff used for dust motes. */
export function dustSprite(): THREE.Texture {
  const key = 'dustS';
  if (cache.has(key)) return cache.get(key)!;
  const S = 64;
  const { c, x } = canvas(S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(206,186,150,0.85)');
  g.addColorStop(0.5, 'rgba(186,164,126,0.35)');
  g.addColorStop(1, 'rgba(170,150,116,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Cracks that open in the crust just ahead of the blade. */
export function crackMask(): THREE.Texture {
  const key = 'crack';
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const { c, x } = canvas(S);
  x.fillStyle = '#000000';
  x.fillRect(0, 0, S, S);
  const rng = makeRng(211);
  x.strokeStyle = '#ffffff';
  for (let i = 0; i < 22; i++) {
    let px = rng() * S;
    let py = rng() * S;
    x.lineWidth = 1 + rng() * 2.2;
    x.beginPath();
    x.moveTo(px, py);
    const steps = 4 + Math.floor(rng() * 5);
    let ang = rng() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      ang += (rng() - 0.5) * 1.5;
      px += Math.cos(ang) * (8 + rng() * 20);
      py += Math.sin(ang) * (8 + rng() * 20);
      x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = finish(c, 1, false);
  cache.set(key, t);
  return t;
}
