/* Procedural textures — everything is generated at runtime so the game ships
   with zero binary assets and works offline. */
import * as THREE from 'three';

/* --- tiny value-noise ------------------------------------------------- */
function hash2(x, y, seed) {
  // Math.imul keeps this in 32-bit integer space; plain * silently loses the
  // low bits above 2^53 and the whole field collapses to a constant.
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 144665537);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
/* seamless fbm over a period so textures tile without a visible seam */
export function fbm(x, y, period, octaves = 4, seed = 1) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < octaves; o++) {
    const p = period * freq;
    sum += amp * vnoise(((x * freq) % p + p) % p, ((y * freq) % p + p) % p, seed + o * 37);
    amp *= 0.5; freq *= 2;
  }
  return sum;
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function finish(canvas, repeat = 1, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --- snow: fine granular sparkle + gentle wind ripples ---------------- */
export function snowTexture(size = 512) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const P = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * P, v = y / size * P;
      // wind-blown ripples: stretched noise
      const ripple = fbm(u * 0.55, v * 2.6, P, 3, 5);
      // granular snow crystals
      const grain = fbm(u * 9, v * 9, P * 9, 3, 11);
      let l = 232 + ripple * 16 + (grain - 0.5) * 26;
      // occasional bright sparkle crystals
      if (hash2(x, y, 3) > 0.9965) l = 255;
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, l * 0.985);
      d[i + 1] = Math.min(255, l * 0.995);
      d[i + 2] = Math.min(255, l);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, 1);
}

/* --- normal map derived from the same snow height field --------------- */
export function snowNormalTexture(size = 512, strength = 2.2) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const P = 8;
  const h = (x, y) => {
    const u = x / size * P, v = y / size * P;
    return fbm(u * 0.55, v * 2.6, P, 3, 5) * 0.75 + fbm(u * 7, v * 7, P * 7, 2, 11) * 0.25;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = h((x - 1 + size) % size, y), hr = h((x + 1) % size, y);
      const hd = h(x, (y - 1 + size) % size), hu = h(x, (y + 1) % size);
      const nx = (hl - hr) * strength, ny = (hd - hu) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* --- clear ice: streaks, trapped bubbles, hairline cracks ------------- */
export function iceTexture(size = 512) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, '#cfe6f2');
  grd.addColorStop(0.5, '#a9cfe4');
  grd.addColorStop(1, '#7fb2cd');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  // vertical melt streaks (the auger's cut marks run down the bore)
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size;
    g.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.09})`;
    g.lineWidth = 0.6 + Math.random() * 3.4;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 12, size); g.stroke();
  }
  // trapped air bubbles
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 0.5 + Math.random() * 2.6;
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // hairline cracks
  for (let i = 0; i < 14; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  return finish(c, 1);
}

/* --- soft round sprite (snow flakes, breath, bubbles, sparkles) ------- */
export function softDot(size = 64, hardness = 0.0) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, r * hardness, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.42, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --- six-arm snow crystal for the nearest flakes ---------------------- */
export function flakeSprite(size = 64) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.strokeStyle = 'rgba(255,255,255,.95)';
  g.lineCap = 'round';
  for (let a = 0; a < 6; a++) {
    g.save(); g.rotate(a * Math.PI / 3);
    g.lineWidth = size * 0.055;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -size * 0.42); g.stroke();
    g.lineWidth = size * 0.04;
    for (const f of [0.2, 0.34]) {
      g.beginPath();
      g.moveTo(0, -size * f * 1.15);
      g.lineTo(-size * 0.11, -size * f * 1.15 - size * 0.1);
      g.moveTo(0, -size * f * 1.15);
      g.lineTo(size * 0.11, -size * f * 1.15 - size * 0.1);
      g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --- fish body: dark olive back → silver flank → white belly --------- */
export function fishSkinTexture(size = 128) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0.00, '#39434a');
  grd.addColorStop(0.20, '#68787f');
  grd.addColorStop(0.42, '#c9d8e0');
  grd.addColorStop(0.52, '#f2f7fa');
  grd.addColorStop(0.66, '#e2ecf1');
  grd.addColorStop(1.00, '#fbfdfe');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  // lateral line + faint scale speckle
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillRect(0, size * 0.45, size, 1.4);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.16})`;
    g.fillRect(x, y, 1.6, 1.1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* --- ripple normal map for the black water in the hole --------------- */
export function waterNormalTexture(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const P = 6;
  const h = (x, y) => fbm(x / size * P * 2.2, y / size * P * 2.2, P * 2.2, 4, 21);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = h((x - 1 + size) % size, y), hr = h((x + 1) % size, y);
      const hd = h(x, (y - 1 + size) % size), hu = h(x, (y + 1) % size);
      const nx = (hl - hr) * 3.4, ny = (hd - hu) * 3.4, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* --- expanding ring (splash / ripple decal) -------------------------- */
export function ringSprite(size = 128) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, r * 0.6, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.72, 'rgba(255,255,255,.85)');
  grd.addColorStop(0.9, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --- radial cracks that appear on the ice plug before it lets go ----- */
export function crackTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  g.lineCap = 'round';
  const branch = (x, y, ang, len, w, depth) => {
    if (depth > 4 || len < 4) return;
    const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
    g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * (1 - depth / 5)})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
    branch(nx, ny, ang + (Math.random() - 0.5) * 0.85, len * 0.72, w * 0.7, depth + 1);
    if (Math.random() < 0.6) branch(nx, ny, ang + (Math.random() - 0.5) * 1.7, len * 0.55, w * 0.55, depth + 1);
  };
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + Math.random() * 0.3;
    branch(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, a, size * 0.11, 3.4, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
