import * as THREE from 'three';
import { Rng, clamp, lerp, smoothstep } from '../core/rng';

/* ------------------------------------------------------------------ *
 * Small procedural texture kit. Nothing is downloaded: every surface in
 * the kitchen is generated once at boot from a seeded noise field, which
 * keeps the payload tiny and every run byte-identical.
 * ------------------------------------------------------------------ */

function canvasOf(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return { c, ctx };
}

/** Tiling value-noise field. */
class NoiseField {
  private grid: Float32Array;
  private n: number;

  constructor(n: number, rng: Rng) {
    this.n = n;
    this.grid = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) this.grid[i] = rng.next();
  }

  at(x: number, y: number): number {
    const n = this.n;
    const fx = x * n;
    const fy = y * n;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smoothstep(0, 1, fx - x0);
    const ty = smoothstep(0, 1, fy - y0);
    const i0 = ((x0 % n) + n) % n;
    const j0 = ((y0 % n) + n) % n;
    const i1 = (i0 + 1) % n;
    const j1 = (j0 + 1) % n;
    const a = this.grid[j0 * n + i0];
    const b = this.grid[j0 * n + i1];
    const c = this.grid[j1 * n + i0];
    const d = this.grid[j1 * n + i1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }
}

function fbm(fields: NoiseField[], x: number, y: number, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (const f of fields) {
    sum += f.at(x, y) * amp;
    norm += amp;
    amp *= gain;
  }
  return sum / norm;
}

function makeFields(seed: number, bases: number[]): NoiseField[] {
  const rng = new Rng(seed);
  return bases.map((b) => new NoiseField(b, rng));
}

type Shader = (x: number, y: number, h: number) => [number, number, number];

function paint(size: number, fields: NoiseField[], shade: Shader): HTMLCanvasElement {
  const { c, ctx } = canvasOf(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size;
      const y = j / size;
      const h = fbm(fields, x, y);
      const [r, g, b] = shade(x, y, h);
      const o = (j * size + i) * 4;
      d[o] = clamp(r, 0, 1) * 255;
      d[o + 1] = clamp(g, 0, 1) * 255;
      d[o + 2] = clamp(b, 0, 1) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Derive a tangent-space normal map from a greyscale height canvas. */
function heightToNormal(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const size = src.width;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('2D canvas unavailable');
  const s = sctx.getImageData(0, 0, size, size).data;
  const { c, ctx } = canvasOf(size);
  const out = ctx.createImageData(size, size);
  const d = out.data;
  const h = (i: number, j: number) => {
    const ii = ((i % size) + size) % size;
    const jj = ((j % size) + size) % size;
    return s[(jj * size + ii) * 4] / 255;
  };
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (h(i + 1, j) - h(i - 1, j)) * strength;
      const dy = (h(i, j + 1) - h(i, j - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (j * size + i) * 4;
      d[o] = ((-dx / len) * 0.5 + 0.5) * 255;
      d[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      d[o + 2] = (1 / len) * 0.5 * 255 + 127.5;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function tex(
  c: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: number; aniso?: number } = {},
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat, opts.repeat);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

export interface SurfaceMaps {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

/* ----------------------------- ice / frost ----------------------------- */

export function frostMaps(size = 256): SurfaceMaps {
  const fine = makeFields(0x51ce01, [64, 128]);
  const patchy = makeFields(0x51ce02, [8, 24, 64]);

  const height = paint(size, fine, (x, y, h) => {
    // Frost sits in drifts: broad patches, speckled inside.
    const patch = fbm(patchy, x, y);
    const crystal = Math.pow(h, 1.6);
    const v = clamp(crystal * (0.55 + 0.85 * smoothstep(0.28, 0.75, patch)), 0, 1);
    return [v, v, v];
  });

  const rough = paint(size, patchy, (x, y, h) => {
    const speck = fbm(fine, x, y);
    // Frosted areas are matte; bare ice stays slightly glossy.
    const v = lerp(0.24, 0.86, smoothstep(0.3, 0.78, h)) + (speck - 0.5) * 0.14;
    return [v, v, v];
  });

  return {
    normalMap: tex(heightToNormal(height, 3.4), { repeat: 3 }),
    roughnessMap: tex(rough, { repeat: 3 }),
  };
}

/* ------------------------------- sponge -------------------------------- */

export function spongeMaps(size = 256): SurfaceMaps {
  const crumbRng = new Rng(0x5203a9);
  const { c, ctx } = canvasOf(size);
  ctx.fillStyle = '#e8c48d';
  ctx.fillRect(0, 0, size, size);
  // Air bubbles: many small, a few large, none of them squashed.
  for (let i = 0; i < 5200; i++) {
    const r = Math.pow(crumbRng.next(), 3.6) * size * 0.012 + size * 0.0016;
    const x = crumbRng.next() * size;
    const y = crumbRng.next() * size;
    const shade = 0.82 + crumbRng.next() * 0.16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.round(196 * shade)},${Math.round(158 * shade)},${Math.round(
      108 * shade,
    )},0.55)`;
    ctx.fill();
    // A lit rim on the top edge of each bubble reads as depth, not a dot.
    ctx.beginPath();
    ctx.arc(x, y - r * 0.22, r * 0.82, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = 'rgba(255,235,198,0.28)';
    ctx.lineWidth = Math.max(0.6, r * 0.28);
    ctx.stroke();
  }
  const grain = makeFields(0x5203aa, [16, 48, 128]);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const n = fbm(grain, i / size, j / size);
      const o = (j * size + i) * 4;
      const k = 0.92 + n * 0.16;
      d[o] *= k;
      d[o + 1] *= k * 0.995;
      d[o + 2] *= k * 0.98;
    }
  }
  ctx.putImageData(img, 0, 0);

  const heightC = canvasOf(size);
  heightC.ctx.drawImage(c, 0, 0);
  const hd = heightC.ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < hd.data.length; i += 4) {
    const v = (hd.data[i] * 0.6 + hd.data[i + 1] * 0.3 + hd.data[i + 2] * 0.1) | 0;
    hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = v;
  }
  heightC.ctx.putImageData(hd, 0, 0);

  return {
    map: tex(c, { srgb: true, repeat: 1 }),
    normalMap: tex(heightToNormal(heightC.c, 1.1)),
    roughnessMap: tex(
      paint(size, grain, (_x, _y, h) => {
        const v = 0.78 + h * 0.16;
        return [v, v, v];
      }),
    ),
  };
}

/* ---------------------------- stone worktop ---------------------------- */

export function stoneMaps(size = 512): SurfaceMaps {
  const base = makeFields(0x570e01, [4, 12, 40, 120]);
  const veins = makeFields(0x570e02, [6, 18]);
  const scuff = makeFields(0x570e03, [96, 220]);

  const colour = paint(size, base, (x, y, h) => {
    const v = fbm(veins, x * 0.7, y * 1.6);
    const vein = smoothstep(0.46, 0.53, Math.abs(v - 0.5) < 0.045 ? 0.55 : 0.2);
    const s = fbm(scuff, x, y);
    // Dark honed stone, faint pale veining, light circular scuffing.
    const g = 0.3 + h * 0.075 + vein * 0.09 + (s - 0.5) * 0.03;
    return [g * 1.02, g * 1.0, g * 0.985];
  });

  const height = paint(size, base, (x, y, h) => {
    const s = fbm(scuff, x, y);
    const v = h * 0.7 + s * 0.3;
    return [v, v, v];
  });

  const rough = paint(size, scuff, (x, y, h) => {
    const b = fbm(base, x, y);
    const v = 0.62 + h * 0.16 + b * 0.1;
    return [v, v, v];
  });

  return {
    map: tex(colour, { srgb: true, repeat: 2.2, aniso: 8 }),
    normalMap: tex(heightToNormal(height, 0.28), { repeat: 2.2 }),
    roughnessMap: tex(rough, { repeat: 2.2 }),
  };
}

/* ------------------------------ steel ---------------------------------- */

export function brushedSteelMaps(size = 256): SurfaceMaps {
  const { c, ctx } = canvasOf(size);
  ctx.fillStyle = '#8d8d90';
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(0x57ee11);
  for (let i = 0; i < 5200; i++) {
    const y = rng.next() * size;
    const x = rng.next() * size;
    const len = rng.range(size * 0.05, size * 0.5);
    const a = rng.range(0.02, 0.10);
    ctx.strokeStyle = rng.next() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.lineWidth = rng.range(0.5, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + rng.range(-0.7, 0.7));
    ctx.stroke();
  }
  const heightC = canvasOf(size);
  heightC.ctx.drawImage(c, 0, 0);

  const smudge = makeFields(0x57ee12, [8, 32, 96]);
  return {
    map: tex(c, { srgb: true, repeat: 1, aniso: 8 }),
    normalMap: tex(heightToNormal(heightC.c, 0.5)),
    roughnessMap: tex(
      paint(size, smudge, (_x, _y, h) => {
        const v = 0.19 + h * 0.28;
        return [v, v, v];
      }),
      { repeat: 1 },
    ),
  };
}

/* ---------------------------- meringue grain --------------------------- */

/** Very fine sugar grain: only shows up in close-ups, where it matters most. */
export function meringueGrainNormal(size = 256): THREE.Texture {
  const fields = makeFields(0x11e21a, [96, 220]);
  const height = paint(size, fields, (_x, _y, h) => {
    const v = Math.pow(h, 1.4);
    return [v, v, v];
  });
  return tex(heightToNormal(height, 0.85), { repeat: 6 });
}

/* -------------------------------- cloth -------------------------------- */

export function clothMaps(size = 128): SurfaceMaps {
  const weave = makeFields(0xc10a11, [24, 64]);
  const colour = paint(size, weave, (_x, y, h) => {
    const stripe = Math.sin(y * Math.PI * 8) * 0.5 + 0.5;
    const g = 0.42 + h * 0.16;
    // A dull blue-and-cream kitchen towel.
    return [g * (0.72 + stripe * 0.36), g * (0.76 + stripe * 0.3), g * (0.86 + stripe * 0.2)];
  });
  const height = paint(size, weave, (x, y, h) => {
    const w = (Math.sin(x * Math.PI * 2 * 26) + Math.sin(y * Math.PI * 2 * 26)) * 0.25 + 0.5;
    const v = w * 0.6 + h * 0.4;
    return [v, v, v];
  });
  return {
    map: tex(colour, { srgb: true, repeat: 1 }),
    normalMap: tex(heightToNormal(height, 1.4), { repeat: 1 }),
  };
}

/** Radial soft-edged dot used as the paint brush for coverage and browning. */
export function brushTexture(size = 64): THREE.CanvasTexture {
  const { c, ctx } = canvasOf(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** Soft round sprite: flame core glow, contact glow, condensation highlight. */
export function glowTexture(size = 128, softness = 0.5): THREE.CanvasTexture {
  const { c, ctx } = canvasOf(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(clamp(softness * 0.5, 0.05, 0.6), 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
