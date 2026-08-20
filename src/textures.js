/**
 * Procedural textures.
 *
 * Everything the game draws is generated at runtime on 2D canvases, so the
 * repository stays asset-free and the download stays small on mobile.
 * The detail budget follows the art direction: the watermelon (hero prop, always
 * in the foreground) gets the largest maps, the beach gets small tiling detail.
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * deterministic noise helpers (fixed seed => identical screenshots)
 * ------------------------------------------------------------------ */

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Tiling value noise. `period` keeps the pattern seamless. */
function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const wrap = (v) => ((v % period) + period) % period;
  const x0 = wrap(xi), x1 = wrap(xi + 1), y0 = wrap(yi), y1 = wrap(yi + 1);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, period, seed, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, period * f, seed + o * 97);
    norm += amp;
    amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, { repeat = 1, srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Derive a tangent-space normal map from a height callback. */
function normalFromHeight(w, h, heightAt, strength = 2.0) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hl = heightAt((x - 1 + w) % w, y);
      const hr = heightAt((x + 1) % w, y);
      const hd = heightAt(x, (y - 1 + h) % h);
      const hu = heightAt(x, (y + 1) % h);
      let nx = (hl - hr) * strength;
      let ny = (hd - hu) * strength;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ *
 * watermelon rind — equirectangular, matches the ellipsoid UVs
 * ------------------------------------------------------------------ */

/**
 * Dark/pale green stripes that converge at the poles, plus mottling and the
 * fine pitting that makes a rind read as a real fruit rather than a ball.
 */
export function makeRindMaps(size = 1024) {
  const w = size, h = size >> 1;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;

  const STRIPES = 9;
  const heights = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);            // 0 = top pole, 1 = bottom pole
    const polar = v * Math.PI;
    // stripes pinch towards the poles exactly like on a real watermelon
    const pinch = Math.sin(polar);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      // wavy stripe edges
      const wob = (fbm(u * 6, v * 3, 6, 11, 4) - 0.5) * 0.55 +
                  (fbm(u * 18, v * 9, 18, 23, 3) - 0.5) * 0.16;
      const phase = (u * STRIPES + wob) % 1;
      const band = Math.abs(phase - 0.5) * 2;           // 0 centre of dark band
      // stripe width breathes along the fruit's length
      const width = 0.40 + 0.20 * pinch;
      let dark = 1 - THREE.MathUtils.smoothstep(band, width - 0.13, width + 0.13);

      // secondary thin veins inside the pale band
      const vein = Math.max(0, 1 - Math.abs(((u * STRIPES * 3 + wob * 2) % 1) - 0.5) * 8) * 0.20;
      dark = Math.min(1, dark + vein * (1 - dark));

      const mottle = fbm(u * 26, v * 13, 26, 41, 4);
      const grain = fbm(u * 190, v * 95, 190, 71, 2);

      // colours sampled from a real "Kuromon" style striped watermelon
      const darkC = [26 + mottle * 22, 58 + mottle * 26, 27 + mottle * 14];
      const paleC = [110 + mottle * 46, 156 + mottle * 42, 66 + mottle * 28];
      let r = paleC[0] + (darkC[0] - paleC[0]) * dark;
      let g = paleC[1] + (darkC[1] - paleC[1]) * dark;
      let b = paleC[2] + (darkC[2] - paleC[2]) * dark;

      // pitting / waxy speckles
      const speck = (grain - 0.5) * 26;
      r += speck; g += speck * 1.05; b += speck * 0.7;

      // subtle bloom towards the poles
      const bloom = Math.pow(1 - pinch, 3) * 22;
      r += bloom; g += bloom; b += bloom * 0.8;

      const i = (y * w + x) * 4;
      d[i] = THREE.MathUtils.clamp(r, 0, 255);
      d[i + 1] = THREE.MathUtils.clamp(g, 0, 255);
      d[i + 2] = THREE.MathUtils.clamp(b, 0, 255);
      d[i + 3] = 255;
      heights[y * w + x] = grain * 0.6 + dark * 0.12 + mottle * 0.28;
    }
  }
  ctx.putImageData(img, 0, 0);

  const normal = normalFromHeight(w, h, (x, y) => heights[y * w + x], 3.2);

  // rougher on the pale bands, waxier on the dark ones
  const rc = canvas(w >> 1, h >> 1);
  const rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(rc.width, rc.height);
  for (let y = 0; y < rc.height; y++) {
    for (let x = 0; x < rc.width; x++) {
      const hgt = heights[(y * 2) * w + x * 2];
      const val = THREE.MathUtils.clamp(150 + (hgt - 0.4) * 190, 90, 235);
      const i = (y * rc.width + x) * 4;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = val;
      rimg.data[i + 3] = 255;
    }
  }
  rctx.putImageData(rimg, 0, 0);

  return {
    map: toTexture(c, { srgb: true, aniso: 16 }),
    normalMap: toTexture(normal, { aniso: 16 }),
    roughnessMap: toTexture(rc, { aniso: 8 }),
  };
}

/* ------------------------------------------------------------------ *
 * cross-section — the payoff image of the whole game
 * ------------------------------------------------------------------ */

/**
 * A full circular slice: dark skin, thick green rind, pale inner rind, red
 * flesh with fibres and seeds. Mapped radially onto the fracture faces so the
 * break reads as "outer shell / white layer / red inside" at a glance.
 */
export function makeCrossSectionMaps(size = 1024) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const cx = size / 2, cy = size / 2;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / cx, dy = (y - cy) / cy;
      let r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const i = (y * size + x) * 4;

      // the flesh boundary is never a perfect circle
      const wob = (fbm(Math.cos(ang) * 3 + 5, Math.sin(ang) * 3 + 5, 64, 7, 3) - 0.5) * 0.045;
      r += wob;

      let col, hgt;
      const mott = fbm(x / size * 30, y / size * 30, 30, 13, 4);
      if (r > 0.955) {
        // waxy dark skin seen edge-on
        col = [30 + mott * 26, 62 + mott * 26, 30 + mott * 16];
        hgt = 0.85;
      } else if (r > 0.885) {
        // thick green rind
        const t = (r - 0.885) / 0.07;
        col = [74 - t * 26 + mott * 30, 128 - t * 40 + mott * 26, 62 - t * 20 + mott * 18];
        hgt = 0.7 + t * 0.1;
      } else if (r > 0.845) {
        // pale inner rind
        const t = (r - 0.845) / 0.04;
        col = [205 + t * 12 + mott * 24, 226 - t * 30 + mott * 18, 186 - t * 40 + mott * 16];
        hgt = 0.6;
      } else {
        // red flesh: radial fibres, paler heart, wet mottling
        const fib = Math.sin(ang * 46 + r * 20 + mott * 6) * 0.5 + 0.5;
        // only the last few millimetres by the rind go pale
        const near = THREE.MathUtils.smoothstep(r, 0.755, 0.845);
        const rr = 208 - near * 12 + fib * 8 + mott * 14;
        const gg = 18 + near * 50 + fib * 6 + mott * 9;
        const bb = 24 + near * 46 + fib * 5 + mott * 9;
        col = [rr, gg, bb];
        hgt = 0.42 + fib * 0.06 + mott * 0.1 - near * 0.05;
      }
      d[i] = THREE.MathUtils.clamp(col[0], 0, 255);
      d[i + 1] = THREE.MathUtils.clamp(col[1], 0, 255);
      d[i + 2] = THREE.MathUtils.clamp(col[2], 0, 255);
      d[i + 3] = 255;
      heights[y * size + x] = hgt;
    }
  }
  ctx.putImageData(img, 0, 0);

  // seeds sit in the flesh in two loose rings, tilted along the radius
  const rng = makeRng(20260820);
  ctx.save();
  for (const ring of [0.42, 0.63]) {
    const n = ring < 0.5 ? 13 : 19;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.26;
      const rr = ring + (rng() - 0.5) * 0.11;
      const px = cx + Math.cos(a) * rr * cx;
      const py = cy + Math.sin(a) * rr * cy;
      const len = size * (0.017 + rng() * 0.008);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2 + (rng() - 0.5) * 0.5);
      const g = ctx.createLinearGradient(0, -len, 0, len);
      g.addColorStop(0, '#3a2410');
      g.addColorStop(0.45, '#150c05');
      g.addColorStop(1, '#241606');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.62, len, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,205,.30)';
      ctx.beginPath();
      ctx.ellipse(-len * 0.18, -len * 0.24, len * 0.2, len * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // mark the seed into the height field so it reads as a bump
      const sx = Math.round(px), sy = Math.round(py);
      const rad = Math.round(len);
      for (let yy = -rad; yy <= rad; yy++) {
        for (let xx = -rad; xx <= rad; xx++) {
          const gx = sx + xx, gy = sy + yy;
          if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue;
          if (xx * xx + yy * yy > rad * rad) continue;
          heights[gy * size + gx] += 0.22;
        }
      }
    }
  }
  ctx.restore();

  const normal = normalFromHeight(size, size, (x, y) => heights[y * size + x], 2.4);

  // the flesh is wet, the rind is not
  const rc = canvas(size >> 1, size >> 1);
  const rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(rc.width, rc.height);
  for (let y = 0; y < rc.height; y++) {
    for (let x = 0; x < rc.width; x++) {
      const dx = (x - rc.width / 2) / (rc.width / 2), dy = (y - rc.height / 2) / (rc.height / 2);
      const r = Math.hypot(dx, dy);
      const wet = r < 0.845 ? 0.30 : (r < 0.955 ? 0.62 : 0.48);
      const jitter = (fbm(x / rc.width * 40, y / rc.height * 40, 40, 3, 3) - 0.5) * 0.16;
      const val = THREE.MathUtils.clamp((wet + jitter) * 255, 20, 250);
      const i = (y * rc.width + x) * 4;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = val;
      rimg.data[i + 3] = 255;
    }
  }
  rctx.putImageData(rimg, 0, 0);

  return {
    map: toTexture(c, { srgb: true, aniso: 16 }),
    normalMap: toTexture(normal, { aniso: 16 }),
    roughnessMap: toTexture(rc, { aniso: 8 }),
  };
}

/* ------------------------------------------------------------------ *
 * beach sand — tiling detail only, never per-grain geometry
 * ------------------------------------------------------------------ */

export function makeSandMaps(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const grain = fbm(u * 220, v * 220, 220, 5, 2);
      const ripple = Math.sin((u * 9 + fbm(u * 5, v * 5, 5, 9, 3) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      const macro = fbm(u * 9, v * 9, 9, 17, 4);
      const shell = grain > 0.965 ? 1 : 0;

      const base = 0.66 + macro * 0.13 + ripple * 0.05 + (grain - 0.5) * 0.16;
      let r = 234 * base, g = 206 * base, b = 160 * base;
      // warm/cool speckles of mixed mineral grains
      if (grain > 0.86) { r += 16; g += 8; b -= 6; }
      if (grain < 0.14) { r -= 20; g -= 18; b -= 12; }
      if (shell) { r = 236; g = 231; b = 219; }

      const i = (y * size + x) * 4;
      d[i] = THREE.MathUtils.clamp(r, 0, 255);
      d[i + 1] = THREE.MathUtils.clamp(g, 0, 255);
      d[i + 2] = THREE.MathUtils.clamp(b, 0, 255);
      d[i + 3] = 255;
      heights[y * size + x] = grain * 0.5 + ripple * 0.32 + macro * 0.18;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normal = normalFromHeight(size, size, (x, y) => heights[y * size + x], 2.6);
  return {
    map: toTexture(c, { srgb: true, repeat: 26, aniso: 16 }),
    normalMap: toTexture(normal, { repeat: 26, aniso: 16 }),
  };
}

/* ------------------------------------------------------------------ *
 * misc props
 * ------------------------------------------------------------------ */

/** Woven blue tarp ("ブルーシート") with the classic PE weave. */
export function makeSheetMaps(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1257a4';
  ctx.fillRect(0, 0, size, size);
  const step = size / 22;
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.12)';
    ctx.fillRect(i * step, 0, step * 0.5, size);
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.08)';
    ctx.fillRect(0, i * step, size, step * 0.5);
  }
  const img = ctx.getImageData(0, 0, size, size);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 60, y / size * 60, 60, 29, 3);
      const i = (y * size + x) * 4;
      const s = (n - 0.5) * 26;
      img.data[i] += s; img.data[i + 1] += s; img.data[i + 2] += s;
      heights[y * size + x] =
        (Math.sin(x / step * Math.PI) * 0.25 + Math.sin(y / step * Math.PI) * 0.25 + 0.5) * 0.8 + n * 0.2;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: toTexture(c, { srgb: true, repeat: 2, aniso: 16 }),
    normalMap: toTexture(normalFromHeight(size, size, (x, y) => heights[y * size + x], 1.0), { repeat: 2 }),
  };
}

/** Soft round alpha used for contact shadows, juice puddles and foam. */
export function makeBlobAlpha(size = 256, softness = 0.55) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.5 * (1 - softness), size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** Wispy sea foam / cloud alpha. */
export function makeFoamTexture(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * 12, y / size * 12, 12, 61, 5);
      const n2 = fbm(x / size * 40, y / size * 40, 40, 83, 3);
      const a = THREE.MathUtils.clamp((n * 0.7 + n2 * 0.5 - 0.42) * 3.4, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: true, repeat: 1 });
}

/** The blindfold cloth itself: a tight cotton weave, seen from the inside. */
export function makeClothMaps(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = (Math.sin(x * 1.15) * 0.5 + 0.5) * (Math.sin(y * 1.15) * 0.5 + 0.5);
      const slub = fbm(x / size * 90, y / size * 90, 90, 37, 3);
      const macro = fbm(x / size * 7, y / size * 7, 7, 53, 4);
      const v = 0.42 + weave * 0.34 + (slub - 0.5) * 0.36 + (macro - 0.5) * 0.3;
      const i = (y * size + x) * 4;
      img.data[i] = THREE.MathUtils.clamp(v * 150, 0, 255);
      img.data[i + 1] = THREE.MathUtils.clamp(v * 120, 0, 255);
      img.data[i + 2] = THREE.MathUtils.clamp(v * 108, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: true, repeat: 1, aniso: 4 });
}
