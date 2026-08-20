import * as THREE from 'three';
import { clamp, fbmTile, tileNoise2, smoothstep, makeRng } from '../core/util';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function canvasOf(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

type PixelFn = (x: number, y: number, u: number, v: number) => [number, number, number];

function paint(size: number, fn: PixelFn) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgb = fn(x, y, x / size, y / size);
      d[i++] = rgb[0] * 255;
      d[i++] = rgb[1] * 255;
      d[i++] = rgb[2] * 255;
      d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Build a tangent-space normal map from a tiling height function. */
function normalFromHeight(size: number, strength: number, h: (x: number, y: number) => number) {
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = h(x, y);
  const c = canvasOf(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const w = (x: number, y: number) => H[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (w(x + 1, y) - w(x - 1, y)) * strength;
      const dy = (w(x, y + 1) - w(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      d[i++] = (nx * 0.5 + 0.5) * 255;
      d[i++] = (ny * 0.5 + 0.5) * 255;
      d[i++] = (nz / l) * 0.5 * 255 + 127.5;
      d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = 1, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export interface TextureSet {
  sandColor: THREE.Texture;
  sandNormal: THREE.Texture;
  sandORM: THREE.Texture;
  woodColor: THREE.Texture;
  woodNormal: THREE.Texture;
  woodORM: THREE.Texture;
  metalORM: THREE.Texture;
  metalNormal: THREE.Texture;
  paintORM: THREE.Texture;
  paintColor: THREE.Texture;
  leafColor: THREE.Texture;
  leafNormal: THREE.Texture;
  waterNormal: THREE.Texture;
  concreteColor: THREE.Texture;
  concreteORM: THREE.Texture;
  spark: THREE.Texture;
  droplet: THREE.Texture;
}

/* ------------------------------------------------------------------ */
/* sand                                                                */
/* ------------------------------------------------------------------ */

const P = 16; // noise period in cells -> perfectly tiling

function sandGrain(x: number, y: number, size: number) {
  const s = P / size;
  // three scales: macro patches, medium clumps, fine grain
  const macro = fbmTile(x * s * 0.5, y * s * 0.5, P * 0.5, 3, 11);
  const med = fbmTile(x * s * 3, y * s * 3, P * 3, 3, 71);
  const fine = tileNoise2(x * s * 26, y * s * 26, P * 26, 131);
  const fine2 = tileNoise2(x * s * 53, y * s * 53, P * 53, 17);
  return { macro, med, fine, fine2 };
}

function buildSand(size: number) {
  const color = paint(size, (x, y) => {
    const g = sandGrain(x, y, size);
    // Damp morning sand: warm grey-ochre, not saturated yellow.
    const t = g.macro * 0.55 + g.med * 0.45;
    let r = 0.5 + t * 0.16;
    let gg = 0.435 + t * 0.15;
    let b = 0.335 + t * 0.13;
    // individual grains: quartz specks (light) + dark mineral specks
    const sp = g.fine;
    if (sp > 0.86) {
      const k = (sp - 0.86) / 0.14;
      r += 0.15 * k;
      gg += 0.15 * k;
      b += 0.14 * k;
    } else if (sp < 0.1) {
      const k = (0.1 - sp) / 0.1;
      r -= 0.16 * k;
      gg -= 0.15 * k;
      b -= 0.12 * k;
    }
    // sparse tiny pebbles
    const pb = g.fine2;
    if (pb > 0.955) {
      r = r * 0.72 + 0.2;
      gg = gg * 0.72 + 0.19;
      b = b * 0.72 + 0.17;
    }
    return [clamp(r, 0, 1), clamp(gg, 0, 1), clamp(b, 0, 1)];
  });

  const normal = normalFromHeight(size, 3.4, (x, y) => {
    const g = sandGrain(x, y, size);
    return g.med * 0.35 + g.fine * 0.42 + g.fine2 * 0.23 + g.macro * 0.2;
  });

  const orm = paint(size, (x, y) => {
    const g = sandGrain(x, y, size);
    // AO: crevices between grain clumps
    const ao = clamp(0.72 + g.med * 0.28 + g.fine * 0.12 - 0.1, 0, 1);
    // roughness: very high, but grain-size dependent (coarse grains scatter more)
    const rough = clamp(0.88 + g.fine * 0.1 - g.macro * 0.06, 0.6, 1);
    return [ao, rough, 0];
  });

  return { color, normal, orm };
}

/* ------------------------------------------------------------------ */
/* wood                                                                */
/* ------------------------------------------------------------------ */

function woodField(x: number, y: number, size: number) {
  const s = P / size;
  // grain runs along +y; rings from a warped distance field
  const warp = fbmTile(x * s * 1.4, y * s * 0.35, P, 3, 5) - 0.5;
  const g = (x * s * 5.5 + warp * 2.2) % P;
  const rings = Math.abs(Math.sin(g * 2.15));
  const fibre = fbmTile(x * s * 24, y * s * 2.2, P * 24, 2, 41);
  const dirt = fbmTile(x * s * 2.2, y * s * 2.2, P * 2, 4, 909);
  return { rings, fibre, dirt };
}

function buildWood(size: number) {
  const color = paint(size, (x, y) => {
    const w = woodField(x, y, size);
    const t = w.rings * 0.72 + w.fibre * 0.28;
    let r = 0.34 - t * 0.15;
    let g = 0.255 - t * 0.125;
    let b = 0.17 - t * 0.095;
    // weathered greying + mud staining near the lower edge
    const grey = smoothstep(0.45, 0.85, w.dirt) * 0.35;
    r = r * (1 - grey) + 0.3 * grey;
    g = g * (1 - grey) + 0.285 * grey;
    b = b * (1 - grey) + 0.26 * grey;
    const mud = smoothstep(0.62, 1.0, w.dirt) * smoothstep(0.35, 0.95, y / size);
    r = r * (1 - mud) + 0.21 * mud;
    g = g * (1 - mud) + 0.16 * mud;
    b = b * (1 - mud) + 0.115 * mud;
    return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
  });

  const normal = normalFromHeight(size, 2.6, (x, y) => {
    const w = woodField(x, y, size);
    return w.rings * 0.55 + w.fibre * 0.45;
  });

  const orm = paint(size, (x, y) => {
    const w = woodField(x, y, size);
    const ao = clamp(0.78 + w.rings * 0.22 - 0.06, 0, 1);
    // late-wood is harder & smoother; weathered patches are rougher
    const rough = clamp(0.58 + (1 - w.rings) * 0.24 + w.dirt * 0.16, 0.3, 1);
    return [ao, rough, 0];
  });

  return { color, normal, orm };
}

/* ------------------------------------------------------------------ */
/* metal + painted metal                                               */
/* ------------------------------------------------------------------ */

function scratchField(x: number, y: number, size: number) {
  const s = P / size;
  // anisotropic scratches: stretched noise in a couple of directions
  const a = tileNoise2(x * s * 40, y * s * 1.6, P * 40, 3);
  const b = tileNoise2(x * s * 1.6, y * s * 40, P * 40, 77);
  const c = tileNoise2((x + y) * s * 26, (x - y) * s * 1.4, P * 26, 303);
  const wear = fbmTile(x * s * 3, y * s * 3, P * 3, 4, 55);
  return { line: Math.max(a, Math.max(b, c)), wear };
}

function buildMetal(size: number) {
  const normal = normalFromHeight(size, 1.5, (x, y) => {
    const s = scratchField(x, y, size);
    return s.line * 0.6 + s.wear * 0.4;
  });
  const orm = paint(size, (x, y) => {
    const s = scratchField(x, y, size);
    const scr = smoothstep(0.72, 1.0, s.line);
    const ao = clamp(0.86 + s.wear * 0.14, 0, 1);
    // bare galvanised steel: fairly rough, polished where handled
    const rough = clamp(0.42 + s.wear * 0.3 - scr * 0.22, 0.12, 1);
    return [ao, rough, 1];
  });
  return { normal, orm };
}

function buildPaint(size: number) {
  // Painted metal: paint is a dielectric; chips expose bare metal.
  const color = paint(size, (x, y) => {
    const s = scratchField(x, y, size);
    const chip = smoothstep(0.82, 0.96, s.wear);
    // faded red enamel
    let r = 0.52,
      g = 0.13,
      b = 0.1;
    const dust = fbmTile((x * P) / size, (y * P) / size, P, 3, 707);
    r = r * (1 - dust * 0.22) + 0.06;
    g = g * (1 - dust * 0.18) + 0.05;
    b = b * (1 - dust * 0.18) + 0.05;
    // chipped-through primer/metal
    r = r * (1 - chip) + 0.44 * chip;
    g = g * (1 - chip) + 0.43 * chip;
    b = b * (1 - chip) + 0.42 * chip;
    return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
  });
  const orm = paint(size, (x, y) => {
    const s = scratchField(x, y, size);
    const chip = smoothstep(0.82, 0.96, s.wear);
    const scr = smoothstep(0.74, 1.0, s.line);
    const ao = clamp(0.88 + s.wear * 0.12, 0, 1);
    // enamel is smooth; scratches and chips roughen it
    const rough = clamp(0.3 + scr * 0.34 + chip * 0.25, 0.1, 1);
    // metalness ONLY where paint is gone
    return [ao, rough, chip > 0.55 ? 1 : 0];
  });
  return { color, orm };
}

/* ------------------------------------------------------------------ */
/* leaf                                                                */
/* ------------------------------------------------------------------ */

function buildLeaf(size: number) {
  const veinField = (x: number, y: number) => {
    const u = x / size;
    const v = y / size;
    const mid = Math.abs(u - 0.5);
    const main = smoothstep(0.035, 0.0, mid);
    // side veins fanning out from the midrib
    const ang = (v - 0.12) * 13;
    const side = Math.abs(Math.sin(ang * Math.PI + mid * 9.5));
    const sideV = smoothstep(0.93, 1.0, side) * smoothstep(0.5, 0.1, mid);
    return clamp(main + sideV * 0.6, 0, 1);
  };
  const color = paint(size, (x, y) => {
    const u = x / size;
    const v = y / size;
    const n = fbmTile(u * P * 3, v * P * 3, P * 3, 3, 991);
    const vein = veinField(x, y);
    // upper face: deeper green; edges tinted brown-gold (autumn park leaf)
    const edge = smoothstep(0.3, 0.5, Math.abs(u - 0.5)) * 0.8 + smoothstep(0.7, 1.0, v) * 0.5;
    let r = 0.16 + n * 0.1;
    let g = 0.3 + n * 0.14;
    let b = 0.11 + n * 0.06;
    r = r * (1 - edge) + 0.42 * edge;
    g = g * (1 - edge) + 0.3 * edge;
    b = b * (1 - edge) + 0.11 * edge;
    const vk = vein * 0.5;
    r = r * (1 - vk) + 0.4 * vk;
    g = g * (1 - vk) + 0.45 * vk;
    b = b * (1 - vk) + 0.22 * vk;
    // dust from the sandbox
    const dust = smoothstep(0.62, 0.95, n) * 0.3;
    r = r * (1 - dust) + 0.46 * dust;
    g = g * (1 - dust) + 0.42 * dust;
    b = b * (1 - dust) + 0.34 * dust;
    return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
  });
  const normal = normalFromHeight(size, 2.2, (x, y) => {
    const u = x / size;
    const v = y / size;
    return veinField(x, y) * 0.7 + fbmTile(u * P * 6, v * P * 6, P * 6, 2, 33) * 0.3;
  });
  return { color, normal };
}

/* ------------------------------------------------------------------ */
/* water ripples / concrete / sprites                                  */
/* ------------------------------------------------------------------ */

function buildWaterNormal(size: number) {
  return normalFromHeight(size, 1.5, (x, y) => {
    const s = P / size;
    const a = fbmTile(x * s * 3.4, y * s * 3.4, P * 3, 3, 9);
    const b = fbmTile(x * s * 9.5, y * s * 9.5, P * 9, 2, 88);
    return a * 0.65 + b * 0.35;
  });
}

function buildConcrete(size: number) {
  const f = (x: number, y: number) => {
    const s = P / size;
    return {
      m: fbmTile(x * s * 2, y * s * 2, P * 2, 4, 313),
      g: fbmTile(x * s * 14, y * s * 14, P * 14, 2, 511),
    };
  };
  const color = paint(size, (x, y) => {
    const n = f(x, y);
    const t = n.m * 0.6 + n.g * 0.4;
    const v = 0.3 + t * 0.16;
    return [v * 1.02, v, v * 0.95];
  });
  const orm = paint(size, (x, y) => {
    const n = f(x, y);
    return [clamp(0.8 + n.m * 0.2, 0, 1), clamp(0.72 + n.g * 0.22, 0, 1), 0];
  });
  return { color, orm };
}

function buildSprite(size: number, soft: number) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(soft, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function buildDroplet(size: number) {
  const c = canvasOf(size);
  const ctx = c.getContext('2d')!;
  const rng = makeRng(7);
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.4, size * 0.36, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(226,232,228,0.6)');
  g.addColorStop(0.85, 'rgba(190,198,192,0.18)');
  g.addColorStop(1, 'rgba(190,198,192,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  // slight irregularity so droplets do not read as perfect circles
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/* ------------------------------------------------------------------ */

const SAND = 512;
const WOOD = 512;
const SMALL = 256;

/** Build every procedural texture, yielding to the browser between steps. */
export async function buildTextures(onProgress: (p: number) => void): Promise<TextureSet> {
  const step = async <T>(p: number, fn: () => T): Promise<T> => {
    onProgress(p);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return fn();
  };

  const sand = await step(0.05, () => buildSand(SAND));
  const wood = await step(0.35, () => buildWood(WOOD));
  const metal = await step(0.6, () => buildMetal(SMALL));
  const pnt = await step(0.72, () => buildPaint(SMALL));
  const leaf = await step(0.82, () => buildLeaf(SMALL));
  const water = await step(0.9, () => buildWaterNormal(SMALL));
  const conc = await step(0.96, () => buildConcrete(SMALL));
  const spark = buildSprite(64, 0.35);
  const drop = buildDroplet(64);
  onProgress(1);

  return {
    sandColor: tex(sand.color, true, 1, 8),
    sandNormal: tex(sand.normal, false, 1, 8),
    sandORM: tex(sand.orm, false, 1, 8),
    woodColor: tex(wood.color, true, 1, 8),
    woodNormal: tex(wood.normal, false, 1, 8),
    woodORM: tex(wood.orm, false, 1, 8),
    metalORM: tex(metal.orm, false, 1),
    metalNormal: tex(metal.normal, false, 1),
    paintColor: tex(pnt.color, true, 1),
    paintORM: tex(pnt.orm, false, 1),
    leafColor: tex(leaf.color, true, 1),
    leafNormal: tex(leaf.normal, false, 1),
    waterNormal: tex(water, false, 1, 8),
    concreteColor: tex(conc.color, true, 1),
    concreteORM: tex(conc.orm, false, 1),
    spark: tex(spark, true, 1, 1),
    droplet: tex(drop, true, 1, 1),
  };
}
