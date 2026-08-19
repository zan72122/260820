import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Procedural texture bakery.
 *
 * Everything the machine and the paddy are made of is painted here at
 * boot time on 2D canvases: wet paddy mud, ripe rice, weathered enamel
 * on steel, rubber belts, compressed straw, stretch film.  Keeping it
 * procedural means zero network assets on a phone, and it lets us keep
 * the palette dirty and photographic instead of candy coloured.
 * ------------------------------------------------------------------ */

const cache = new Map<string, THREE.Texture>();

function makeCanvas(size: number, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

/* ---- value noise ---------------------------------------------------- */

function hash2(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const w = (a: number, b: number) => ((a % b) + b) % b;
  const x0 = w(xi, period);
  const x1 = w(xi + 1, period);
  const y0 = w(yi, period);
  const y1 = w(yi + 1, period);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** Tileable fractal noise in [0,1]. */
export function fbm(x: number, y: number, octaves: number, baseFreq: number, seed = 1): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 71, Math.max(1, Math.round(freq))) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function finish(c: HTMLCanvasElement, repeat: number, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function cached(key: string, build: () => THREE.Texture): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const t = build();
  cache.set(key, t);
  return t;
}

/* ---- paddy soil ----------------------------------------------------- */

/** Wet, trodden paddy mud with dried crusts, clods and old water sheen. */
export function soilColor(size = 512): THREE.Texture {
  return cached('soilColor' + size, () => {
    const { c, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const big = fbm(u * 8, v * 8, 4, 1, 11);
        const grit = fbm(u * 64, v * 64, 3, 1, 23);
        const wet = Math.pow(fbm(u * 4, v * 4, 3, 1, 41), 2.1);
        // dry crust (light greyish brown) -> wet mud (dark umber)
        const dry = big * 0.7 + grit * 0.3;
        let r = 92 + dry * 76;
        let g = 72 + dry * 62;
        let b = 52 + dry * 42;
        // wet patches darken and go cooler
        r -= wet * 52;
        g -= wet * 44;
        b -= wet * 26;
        // scattered pale chaff / dried leaf bits
        const chaff = fbm(u * 96 + 3.1, v * 96 - 1.7, 2, 1, 67);
        if (chaff > 0.79) {
          const k = (chaff - 0.79) / 0.21;
          r += k * 92;
          g += k * 80;
          b += k * 46;
        }
        const i = (y * size + x) * 4;
        d[i] = Math.max(0, Math.min(255, r));
        d[i + 1] = Math.max(0, Math.min(255, g));
        d[i + 2] = Math.max(0, Math.min(255, b));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // hairline shrink cracks in the dried crust
    ctx.strokeStyle = 'rgba(38,28,18,0.5)';
    ctx.lineWidth = 1.2;
    for (let n = 0; n < 44; n++) {
      let px = Math.random() * size;
      let py = Math.random() * size;
      let ang = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 0; s < 14; s++) {
        ang += (Math.random() - 0.5) * 1.2;
        px += Math.cos(ang) * 7;
        py += Math.sin(ang) * 7;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    return finish(c, 1, true);
  });
}

/** Roughness companion for the soil: wet hollows read glossier. */
export function soilRough(size = 256): THREE.Texture {
  return cached('soilRough' + size, () => {
    const { c, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const wet = Math.pow(fbm(u * 4, v * 4, 3, 1, 41), 2.1);
        const grit = fbm(u * 40, v * 40, 2, 1, 29);
        const r = (1 - wet * 0.72) * (0.72 + grit * 0.28);
        const i = (y * size + x) * 4;
        const val = Math.max(0, Math.min(255, r * 255));
        d[i] = d[i + 1] = d[i + 2] = val;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, 1, false);
  });
}

/* ---- rice ----------------------------------------------------------- */

/**
 * One atlas strip holding the two rice parts we billboard on geometry:
 * left half = a ripe drooping panicle (grain cluster),
 * right half = a dried-tip leaf blade.
 * Alpha-tested, so no sorting cost with thousands of instances.
 */
export function riceAtlas(size = 512): THREE.Texture {
  return cached('riceAtlas' + size, () => {
    const { c, ctx } = makeCanvas(size, size);
    ctx.clearRect(0, 0, size, size);
    const half = size / 2;

    /* --- left: panicle ------------------------------------------- */
    // A rachis with ~9 branches, each carrying elongated husked grains.
    const cx = half * 0.5;
    ctx.save();
    ctx.translate(cx, 0);
    ctx.strokeStyle = '#b5a24a';
    ctx.lineWidth = size * 0.008;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.02);
    ctx.lineTo(0, size * 0.98);
    ctx.stroke();

    const grain = (gx: number, gy: number, len: number, ang: number, tone: number) => {
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ang);
      const w = len * 0.34;
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      const base = 196 + tone * 56;
      g.addColorStop(0, `rgb(${base * 0.62 | 0},${base * 0.52 | 0},${base * 0.2 | 0})`);
      g.addColorStop(0.45, `rgb(${base | 0},${(base * 0.86) | 0},${(base * 0.36) | 0})`);
      g.addColorStop(1, `rgb(${(base * 0.74) | 0},${(base * 0.62) | 0},${(base * 0.24) | 0})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // awn / husk seam
      ctx.strokeStyle = 'rgba(120,96,34,0.55)';
      ctx.lineWidth = Math.max(0.7, len * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.45);
      ctx.lineTo(0, len * 0.45);
      ctx.stroke();
      ctx.restore();
    };

    for (let b = 0; b < 11; b++) {
      const t = b / 10;
      const y = size * (0.06 + t * 0.88);
      const side = b % 2 === 0 ? 1 : -1;
      const spread = half * 0.34 * (0.35 + t * 0.85);
      const bx = side * spread;
      ctx.strokeStyle = '#a89646';
      ctx.lineWidth = size * 0.005;
      ctx.beginPath();
      ctx.moveTo(0, y - size * 0.05);
      ctx.quadraticCurveTo(bx * 0.5, y - size * 0.02, bx, y + size * 0.03);
      ctx.stroke();
      const n = 4 + Math.floor(t * 3);
      for (let k = 0; k < n; k++) {
        const kt = k / (n - 1 || 1);
        const gx = bx * (0.28 + kt * 0.78);
        const gy = y - size * 0.03 + kt * size * 0.07;
        grain(gx, gy, size * 0.062, side * (0.35 + kt * 0.5), (b * 7 + k * 13) % 10 / 10);
      }
    }
    ctx.restore();

    /* --- right: leaf blade --------------------------------------- */
    const lx = half * 1.5;
    const lg = ctx.createLinearGradient(0, 0, 0, size);
    lg.addColorStop(0.0, '#d6c274');
    lg.addColorStop(0.22, '#c3b25c');
    lg.addColorStop(0.58, '#9ba350');
    lg.addColorStop(1.0, '#7d8c3e');
    ctx.fillStyle = lg;
    ctx.beginPath();
    const wBase = half * 0.30;
    ctx.moveTo(lx, size * 0.995);
    ctx.quadraticCurveTo(lx - wBase * 0.9, size * 0.62, lx - wBase * 0.42, size * 0.16);
    ctx.quadraticCurveTo(lx - wBase * 0.2, size * 0.02, lx, size * 0.004);
    ctx.quadraticCurveTo(lx + wBase * 0.2, size * 0.02, lx + wBase * 0.42, size * 0.16);
    ctx.quadraticCurveTo(lx + wBase * 0.9, size * 0.62, lx, size * 0.995);
    ctx.closePath();
    ctx.fill();
    // midrib + parallel venation
    ctx.strokeStyle = 'rgba(226,222,166,0.5)';
    ctx.lineWidth = size * 0.006;
    ctx.beginPath();
    ctx.moveTo(lx, size * 0.02);
    ctx.lineTo(lx, size * 0.98);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,74,30,0.34)';
    ctx.lineWidth = size * 0.003;
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(lx + i * wBase * 0.09, size * 0.04);
      ctx.lineTo(lx + i * wBase * 0.17, size * 0.97);
      ctx.stroke();
    }
    // sun-burnt tip
    const tip = ctx.createLinearGradient(0, 0, 0, size * 0.3);
    tip.addColorStop(0, 'rgba(196,168,84,0.85)');
    tip.addColorStop(1, 'rgba(196,168,84,0)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tip;
    ctx.fillRect(half, 0, half, size * 0.3);
    ctx.globalCompositeOperation = 'source-over';

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  });
}

/* ---- machine surfaces ----------------------------------------------- */

/** Weathered enamel over sheet steel: orange peel, chips, mud spatter. */
export function paintedSteel(hex: number, size = 512): THREE.Texture {
  return cached('paint' + hex + size, () => {
    const { c, ctx } = makeCanvas(size);
    const base = new THREE.Color(hex);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const peel = fbm(u * 30, v * 30, 3, 1, 7) - 0.5;
        const grime = Math.pow(fbm(u * 5, v * 5, 4, 1, 19), 1.8);
        const k = 1 + peel * 0.12 - grime * 0.2;
        const i = (y * size + x) * 4;
        d[i] = Math.max(0, Math.min(255, base.r * 255 * k + grime * 26));
        d[i + 1] = Math.max(0, Math.min(255, base.g * 255 * k + grime * 21));
        d[i + 2] = Math.max(0, Math.min(255, base.b * 255 * k + grime * 12));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // vertical dirt runs from the seams
    for (let n = 0; n < 26; n++) {
      const x = Math.random() * size;
      const w = 1 + Math.random() * 4;
      const h = size * (0.15 + Math.random() * 0.6);
      const y0 = Math.random() * size * 0.5;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, 'rgba(48,38,24,0.30)');
      g.addColorStop(1, 'rgba(48,38,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, w, h);
    }
    // paint chips down to primer / bare metal
    for (let n = 0; n < 130; n++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.6 + Math.random() * 2.6;
      ctx.fillStyle = Math.random() > 0.45 ? 'rgba(122,116,106,0.75)' : 'rgba(78,58,36,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return finish(c, 1, true);
  });
}

/** Bare / galvanised steel for the header, tubes and frames. */
export function bareSteel(size = 256): THREE.Texture {
  return cached('bareSteel' + size, () => {
    const { c, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const brush = fbm(u * 128, v * 6, 3, 1, 5);
        const patina = fbm(u * 6, v * 6, 4, 1, 15);
        let r = 118 + brush * 58 - patina * 30;
        let g = 120 + brush * 56 - patina * 34;
        let b = 122 + brush * 52 - patina * 44;
        // rust blooms
        const rust = fbm(u * 9 + 4.4, v * 9 - 2.2, 4, 1, 55);
        if (rust > 0.66) {
          const k = (rust - 0.66) / 0.34;
          r += k * 84;
          g -= k * 18;
          b -= k * 44;
        }
        const i = (y * size + x) * 4;
        d[i] = Math.max(0, Math.min(255, r));
        d[i + 1] = Math.max(0, Math.min(255, g));
        d[i + 2] = Math.max(0, Math.min(255, b));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, 1, true);
  });
}

/** Black rubber conveyor belt: cross lugs, scuffs, embedded chaff. */
export function rubberBelt(size = 256): THREE.Texture {
  return cached('rubber' + size, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.fillStyle = '#131412';
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / size * 40, y / size * 40, 3, 1, 91);
        const i = (y * size + x) * 4;
        const k = 14 + n * 22;
        d[i] = k;
        d[i + 1] = k + 1;
        d[i + 2] = k;
      }
    }
    ctx.putImageData(img, 0, 0);
    // moulded cross lugs
    for (let i = 0; i < 8; i++) {
      const y = (i + 0.5) * (size / 8);
      const g = ctx.createLinearGradient(0, y - size * 0.05, 0, y + size * 0.05);
      g.addColorStop(0, 'rgba(90,92,88,0.55)');
      g.addColorStop(0.5, 'rgba(52,54,50,0.9)');
      g.addColorStop(1, 'rgba(6,7,6,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - size * 0.045, size, size * 0.09);
    }
    // caught straw fibres
    ctx.lineWidth = 1;
    for (let n = 0; n < 60; n++) {
      ctx.strokeStyle = `rgba(${150 + Math.random() * 60 | 0},${130 + Math.random() * 50 | 0},70,0.5)`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = Math.random() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      ctx.stroke();
    }
    return finish(c, 1, true);
  });
}

/** Tyre tread — deep agricultural lugs. */
export function tyreTread(size = 256): THREE.Texture {
  return cached('tyre' + size, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.fillStyle = '#161815';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const y = (i / 12) * size;
      ctx.fillStyle = '#2b2e29';
      ctx.save();
      ctx.translate(size * 0.5, y);
      ctx.rotate(0.42);
      ctx.fillRect(-size * 0.6, -size * 0.028, size * 1.2, size * 0.056);
      ctx.restore();
      ctx.fillStyle = '#0d0e0c';
      ctx.save();
      ctx.translate(size * 0.5, y + size * 0.02);
      ctx.rotate(0.42);
      ctx.fillRect(-size * 0.6, -size * 0.01, size * 1.2, size * 0.02);
      ctx.restore();
    }
    ctx.restore();
    // caked mud
    for (let n = 0; n < 200; n++) {
      ctx.fillStyle = `rgba(${70 + Math.random() * 40 | 0},${52 + Math.random() * 30 | 0},32,${0.15 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size, 2 + Math.random() * 9, 2 + Math.random() * 7, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return finish(c, 1, true);
  });
}

/* ---- bale surfaces --------------------------------------------------- */

/** Compressed chopped-crop barrel: tight helical layering, cut ends. */
export function baleBarrel(size = 512): THREE.Texture {
  return cached('baleBarrel' + size, () => {
    const { c, ctx } = makeCanvas(size);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#6f6a33');
    g.addColorStop(0.5, '#8e8341');
    g.addColorStop(1, '#6a6430');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // dense chopped stems, mostly circumferential (x direction)
    for (let n = 0; n < 5200; n++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 5 + Math.random() * 34;
      const a = (Math.random() - 0.5) * 0.45;
      const lum = 0.55 + Math.random() * 0.62;
      const green = Math.random();
      const r = (green > 0.7 ? 122 : 176) * lum;
      const gg = (green > 0.7 ? 128 : 158) * lum;
      const b = (green > 0.7 ? 62 : 76) * lum;
      ctx.strokeStyle = `rgba(${r | 0},${gg | 0},${b | 0},${0.3 + Math.random() * 0.6})`;
      ctx.lineWidth = 0.7 + Math.random() * 2.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // compression bands where the belts bit in
    for (let i = 0; i < 7; i++) {
      const y = (i + 0.5) * (size / 7) + (Math.random() - 0.5) * 8;
      const gg = ctx.createLinearGradient(0, y - 10, 0, y + 10);
      gg.addColorStop(0, 'rgba(30,26,10,0)');
      gg.addColorStop(0.5, 'rgba(30,26,10,0.34)');
      gg.addColorStop(1, 'rgba(30,26,10,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, y - 10, size, 20);
    }
    // stray whiskers standing off the surface
    for (let n = 0; n < 400; n++) {
      ctx.strokeStyle = `rgba(212,196,120,${0.25 + Math.random() * 0.5})`;
      ctx.lineWidth = 0.8;
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 12);
      ctx.stroke();
    }
    return finish(c, 1, true);
  });
}

/** The spiral-packed cut end of a round bale. */
export function baleEnd(size = 512): THREE.Texture {
  return cached('baleEnd' + size, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.fillStyle = '#8a7f3d';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    // concentric packed layers
    for (let r = size * 0.5; r > 0; r -= 2.4) {
      const t = r / (size * 0.5);
      const lum = 0.78 + (1 - t) * 0.34 + Math.random() * 0.14;
      ctx.strokeStyle = `rgba(${(186 * lum) | 0},${(170 * lum) | 0},${(88 * lum) | 0},0.9)`;
      ctx.lineWidth = 1.6 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.arc(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // cut stem ends poking out of the face
    for (let n = 0; n < 2600; n++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * size * 0.49;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const lum = 0.5 + Math.random() * 0.7;
      ctx.fillStyle = `rgba(${(226 * lum) | 0},${(208 * lum) | 0},${(118 * lum) | 0},${0.4 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + Math.random() * 2.4, 0.8 + Math.random() * 1.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // vignette so the rim reads round
    const vg = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(40,30,8,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, size, size);
    return finish(c, 1, true);
  });
}

/** White stretch film: overlapping bands, creases, a little translucency. */
export function wrapFilm(size = 512): THREE.Texture {
  return cached('wrapFilm' + size, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.fillStyle = '#eef1ec';
    ctx.fillRect(0, 0, size, size);
    // overlapping helical bands (they run around the barrel = x here)
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * size;
      const h = size / bands;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.12, 'rgba(228,233,228,0.55)');
      g.addColorStop(0.55, 'rgba(246,249,245,0.2)');
      g.addColorStop(1, 'rgba(206,213,206,0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, size, h);
      ctx.strokeStyle = 'rgba(178,188,178,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(size, y + 0.5);
      ctx.stroke();
    }
    // stretch creases
    for (let n = 0; n < 150; n++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 20 + Math.random() * 130;
      const a = (Math.random() - 0.5) * 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y + (Math.random() - 0.5) * 8, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // the crop showing through in the thin spots
    for (let n = 0; n < 90; n++) {
      ctx.fillStyle = `rgba(${150 + Math.random() * 40 | 0},${140 + Math.random() * 30 | 0},90,${0.05 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size, 8 + Math.random() * 40, 4 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // dust flecks
    for (let n = 0; n < 220; n++) {
      ctx.fillStyle = `rgba(${110 + Math.random() * 60 | 0},${100 + Math.random() * 50 | 0},80,${0.1 + Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    return finish(c, 1, true);
  });
}

/* ---- misc ------------------------------------------------------------ */

/** Soft round alpha blob used by every particle system. */
export function puff(size = 128): THREE.Texture {
  return cached('puff' + size, () => {
    const { c, ctx } = makeCanvas(size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.62)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** Short straw fleck for the chaff spray. */
export function fleck(size = 64): THREE.Texture {
  return cached('fleck' + size, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.beginPath();
    ctx.moveTo(size * 0.12, size * 0.62);
    ctx.quadraticCurveTo(size * 0.5, size * 0.3, size * 0.9, size * 0.44);
    ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** Distant tree canopy strip for the far treeline (alpha along the top). */
export function treeStrip(w = 512, h = 256): THREE.Texture {
  return cached('treeStrip', () => {
    const { c, ctx } = makeCanvas(w, h);
    ctx.clearRect(0, 0, w, h);
    // lumpy canopy silhouette
    for (let pass = 0; pass < 3; pass++) {
      const depth = pass / 2;
      ctx.fillStyle = `rgb(${(40 + depth * 34) | 0},${(58 + depth * 30) | 0},${(38 + depth * 26) | 0})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const u = x / w;
        const n = fbm(u * 10 + pass * 3.3, pass * 1.7, 4, 1, 3 + pass);
        const y = h * (0.68 - depth * 0.2) - n * h * (0.3 - depth * 0.1);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    // foliage speckle
    for (let n = 0; n < 2400; n++) {
      const x = Math.random() * w;
      const y = h * 0.3 + Math.random() * h * 0.7;
      ctx.fillStyle = `rgba(${(50 + Math.random() * 60) | 0},${(74 + Math.random() * 56) | 0},${(44 + Math.random() * 34) | 0},${0.15 + Math.random() * 0.35})`;
      ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  });
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
