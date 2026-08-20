import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Wrapping,
} from 'three';
import { Noise2D } from './noise';
import { clamp, smoothstep } from '../core/math';

type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h = w): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }) as Ctx;
  return { c, x };
}

interface TexOpts {
  srgb?: boolean;
  wrap?: Wrapping;
  repeat?: [number, number];
  aniso?: number;
}

let maxAnisotropy = 4;
export function setMaxAnisotropy(v: number): void {
  maxAnisotropy = v;
}

export function toTexture(c: HTMLCanvasElement, o: TexOpts = {}): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = o.srgb ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = o.wrap ?? RepeatWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = Math.min(maxAnisotropy, o.aniso ?? 4);
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Per-pixel field writer: `fn` returns [r,g,b] in 0..1. */
export function field(
  w: number,
  h: number,
  fn: (u: number, v: number, x: number, y: number) => [number, number, number],
): HTMLCanvasElement {
  const { c, x: ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let px = 0; px < w; px++) {
      const u = (px + 0.5) / w;
      const rgb = fn(u, v, px, y);
      d[i++] = clamp(rgb[0], 0, 1) * 255;
      d[i++] = clamp(rgb[1], 0, 1) * 255;
      d[i++] = clamp(rgb[2], 0, 1) * 255;
      d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Grayscale height field -> tangent-space normal map. `scale` in pixels. */
export function normalFromHeight(
  height: Float32Array,
  w: number,
  h: number,
  strength = 2,
): HTMLCanvasElement {
  const { c, x: ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const at = (px: number, py: number): number =>
    height[(((py % h) + h) % h) * w + (((px % w) + w) % w)];
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      d[i++] = (nx * 0.5 + 0.5) * 255;
      d[i++] = (ny * 0.5 + 0.5) * 255;
      d[i++] = (nz * 0.5 + 0.5) * 255;
      d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface SlideMetalMaps {
  map: Texture;
  roughnessMap: Texture;
  normalMap: Texture;
  aoMap: Texture;
  anisotropyMap: Texture;
}

/**
 * Brushed stainless for the slide bed. U runs down the slide, V across it, so
 * the polishing marks are stretched along U. Roughness is deliberately not
 * uniform: fine brushing, deeper stray scratches, a polished centre lane worn
 * by years of use, and greasy fingerprints near the top rail.
 */
export function bakeSlideMetal(w = 1024, h = 256): SlideMetalMaps {
  const n = new Noise2D(20260820);
  const heights = new Float32Array(w * h);
  const rough = new Float32Array(w * h);
  const albedo = new Float32Array(w * h);
  const ao = new Float32Array(w * h);
  const aniso = new Float32Array(w * h);

  // A handful of deep scratches with random slope, kept as line segments.
  const scratches: { u0: number; v0: number; u1: number; v1: number; d: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const u0 = n.value(i * 7.3, 3.1) * 1;
    const v0 = n.value(i * 3.7, 11.9);
    const len = 0.04 + n.value(i * 2.1, 5.5) * 0.5;
    const tilt = (n.value(i * 5.9, 1.3) - 0.5) * 0.08;
    scratches.push({ u0, v0, u1: u0 + len, v1: v0 + tilt, d: 0.4 + n.value(i, 9) * 0.6 });
  }

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const i = y * w + x;

      // Brushing: very high frequency across V, very low along U.
      const brush =
        n.fbm(u * 6, v * 210, 2, 6, 210) * 0.6 + n.value(u * 3, v * 256, 3, 256) * 0.4;
      let hgt = brush * 0.5;

      // Stray scratches.
      let scratch = 0;
      for (const s of scratches) {
        if (u < s.u0 - 0.02 || u > s.u1 + 0.02) continue;
        const t = clamp((u - s.u0) / Math.max(1e-4, s.u1 - s.u0), 0, 1);
        const vv = s.v0 + (s.v1 - s.v0) * t;
        const dv = Math.abs(v - vv);
        scratch = Math.max(scratch, s.d * Math.exp(-(dv * dv) / 2e-6));
      }
      hgt -= scratch * 0.9;

      // Worn lane: everything slides down the middle, so it is polished
      // smoother there and the brushing has been buffed away.
      const lane = Math.exp(-Math.pow((v - 0.5) / 0.24, 2));
      // Fingerprints / hand grease near the sides where kids grab.
      const printField = n.fbm(u * 26, v * 26, 3, 26);
      const prints = smoothstep(0.62, 0.82, printField) * (1 - lane * 0.7);

      const patina = n.fbm(u * 4 + 40, v * 4 + 12, 4, 4);

      rough[i] = clamp(
        0.24 - lane * 0.11 + (brush - 0.5) * 0.16 + prints * 0.3 + (patina - 0.5) * 0.09 +
          scratch * 0.35,
        0.045,
        0.85,
      );
      albedo[i] = clamp(0.78 + (patina - 0.5) * 0.1 - prints * 0.06 - scratch * 0.12, 0.4, 1);
      ao[i] = clamp(1 - scratch * 0.25 - prints * 0.06, 0.6, 1);
      // Anisotropy strength drops where the surface is scratched or greasy.
      aniso[i] = clamp(0.95 - prints * 0.55 - scratch * 0.5 + lane * 0.05, 0.15, 1);
      heights[i] = hgt;
    }
  }

  const mapC = field(w, h, (_u, _v, x, y) => {
    const a = albedo[y * w + x];
    return [a * 1.0, a * 0.995, a * 0.985];
  });
  const roughC = field(w, h, (_u, _v, x, y) => {
    const r = rough[y * w + x];
    return [r, r, r];
  });
  const aoC = field(w, h, (_u, _v, x, y) => {
    const a = ao[y * w + x];
    return [a, a, a];
  });
  // Direction is constant along U (tangent) — strength lives in blue.
  const anisoC = field(w, h, (_u, _v, x, y) => [1, 0.5, aniso[y * w + x]]);
  const normC = normalFromHeight(heights, w, h, 2.6);

  return {
    map: toTexture(mapC, { srgb: true, aniso: 8 }),
    roughnessMap: toTexture(roughC, { aniso: 8 }),
    normalMap: toTexture(normC, { aniso: 8 }),
    aoMap: toTexture(aoC, { aniso: 4 }),
    anisotropyMap: toTexture(anisoC, { aniso: 4 }),
  };
}

/** Powder-coated steel: non-metal film with orange peel and worn edges. */
export function bakePaint(
  hex: [number, number, number],
  size = 256,
): { map: Texture; roughnessMap: Texture; normalMap: Texture; metalnessMap: Texture } {
  const n = new Noise2D(4711);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const wear = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const i = y * w + x;
      const peel = n.fbm(u * 42, v * 42, 3, 42);
      heights[i] = peel * 0.35;
      // Wear concentrates in a low band (kicked by shoes) and a grab band.
      const bands =
        Math.exp(-Math.pow((v - 0.06) / 0.09, 2)) * 0.9 +
        Math.exp(-Math.pow((v - 0.55) / 0.16, 2)) * 0.45;
      const blotch = n.fbm(u * 9 + 3, v * 9 + 7, 4, 9);
      wear[i] = clamp(smoothstep(0.52, 0.78, blotch) * bands * 1.6, 0, 1);
      heights[i] -= wear[i] * 0.25;
    }
  }

  const mapC = field(w, h, (u, v, x, y) => {
    const i = y * w + x;
    const dust = n.fbm(u * 7 + 21, v * 7 + 5, 3, 7);
    const k = 1 + (dust - 0.5) * 0.16;
    const wr = wear[i];
    // Worn spots show dull primed steel underneath.
    return [
      hex[0] * k * (1 - wr) + 0.42 * wr,
      hex[1] * k * (1 - wr) + 0.43 * wr,
      hex[2] * k * (1 - wr) + 0.45 * wr,
    ];
  });
  const roughC = field(w, h, (u, v, x, y) => {
    const i = y * w + x;
    const r = clamp(0.42 + (n.fbm(u * 30, v * 30, 2, 30) - 0.5) * 0.18 + wear[i] * 0.36, 0.1, 0.95);
    return [r, r, r];
  });
  const metalC = field(w, h, (_u, _v, x, y) => {
    const m = wear[y * w + x] * 0.75;
    return [m, m, m];
  });
  return {
    map: toTexture(mapC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(normalFromHeight(heights, w, h, 1.6)),
    metalnessMap: toTexture(metalC),
  };
}

/** Long-grain timber for the deck boards. */
export function bakeWood(size = 512): {
  map: Texture;
  roughnessMap: Texture;
  normalMap: Texture;
} {
  const n = new Noise2D(90210);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const damp = new Float32Array(w * h);
  const grainAt = (u: number, v: number): number => {
    // Rings distorted along the board length.
    const wobble = n.fbm(u * 2, v * 2, 3, 2) * 0.5;
    const rings = Math.sin((v * 12 + wobble * 5.5) * Math.PI * 2);
    const fine = n.value(u * 256, v * 18, 256, 18);
    return clamp(0.5 + rings * 0.28 + (fine - 0.5) * 0.24, 0, 1);
  };

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const i = y * w + x;
      const g = grainAt(u, v);
      heights[i] = g * 0.5 + n.value(u * 256, v * 40, 256, 40) * 0.18;
      // Damp ends: the board ends stay wet after rain.
      const endness = Math.max(smoothstep(0.9, 1.0, u), smoothstep(0.1, 0.0, u));
      damp[i] = endness * 0.8;
      // Scuffed footfall patches sand the grain down.
      const scuff = smoothstep(0.6, 0.85, n.fbm(u * 5 + 13, v * 5 + 2, 3, 5));
      heights[i] -= scuff * 0.1;
    }
  }

  const mapC = field(w, h, (u, v, x, y) => {
    const g = grainAt(u, v);
    const d = damp[y * w + x];
    const base: [number, number, number] = [0.52, 0.37, 0.23];
    const dark: [number, number, number] = [0.3, 0.19, 0.11];
    const k = g;
    const c: [number, number, number] = [
      dark[0] + (base[0] - dark[0]) * k,
      dark[1] + (base[1] - dark[1]) * k,
      dark[2] + (base[2] - dark[2]) * k,
    ];
    return [c[0] * (1 - d * 0.42), c[1] * (1 - d * 0.45), c[2] * (1 - d * 0.4)];
  });
  const roughC = field(w, h, (u, v, x, y) => {
    const g = grainAt(u, v);
    const scuff = smoothstep(0.6, 0.85, n.fbm(u * 5 + 13, v * 5 + 2, 3, 5));
    const r = clamp(0.92 - g * 0.14 - scuff * 0.2 - damp[y * w + x] * 0.34, 0.14, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(normalFromHeight(heights, w, h, 1.7)),
  };
}

/** End grain for the wooden cylinder's flat faces. */
export function bakeWoodEnd(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(1337);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const ring = (u: number, v: number): number => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const wob = n.fbm(Math.cos(a) * 3 + 4, Math.sin(a) * 3 + 4, 3, 256) * 0.5;
    return clamp(0.5 + Math.sin((r * 34 + wob * 6) * Math.PI) * 0.3 + (n.value(u * 200, v * 200, 200) - 0.5) * 0.2, 0, 1);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) heights[y * w + x] = ring((x + 0.5) / w, (y + 0.5) / h) * 0.5;
  const mapC = field(w, h, (u, v) => {
    const g = ring(u, v);
    return [0.28 + g * 0.3, 0.19 + g * 0.22, 0.12 + g * 0.14];
  });
  const roughC = field(w, h, (u, v) => {
    const r = clamp(0.96 - ring(u, v) * 0.16, 0.5, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, wrap: ClampToEdgeWrapping }),
    roughnessMap: toTexture(roughC, { wrap: ClampToEdgeWrapping }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.2), { wrap: ClampToEdgeWrapping }),
  };
}

/** Poured rubber safety surfacing: EPDM crumb, matte, faintly damp. */
export function bakeRubberFloor(size = 512): {
  map: Texture;
  roughnessMap: Texture;
  normalMap: Texture;
} {
  const n = new Noise2D(5150);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const crumb = (u: number, v: number): number => n.ridged(u * 90, v * 90, 3, 90);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = crumb(u, v) * 0.6 + n.fbm(u * 8, v * 8, 3, 8) * 0.25;
    }
  const mapC = field(w, h, (u, v) => {
    const c = crumb(u, v);
    const speck = n.value(u * 140 + 9, v * 140 + 3, 140);
    // Mostly slate green-grey with scattered warm crumbs.
    // Poured EPDM: a dark green-grey binder with warm and pale crumbs in it.
    const patch = n.fbm(u * 5 + 3, v * 5 + 9, 3, 5);
    let r = 0.2 + c * 0.16 + patch * 0.07;
    let g = 0.27 + c * 0.17 + patch * 0.06;
    let b = 0.24 + c * 0.15 + patch * 0.05;
    if (speck > 0.83) {
      r += 0.3;
      g += 0.08;
      b -= 0.02;
    } else if (speck < 0.12) {
      r += 0.16;
      g += 0.2;
      b += 0.14;
    }
    return [r, g, b];
  });
  const roughC = field(w, h, (u, v) => {
    const damp = smoothstep(0.55, 0.85, n.fbm(u * 3 + 30, v * 3 + 8, 4, 3));
    const r = clamp(0.88 - damp * 0.42 + (crumb(u, v) - 0.5) * 0.12, 0.22, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, repeat: [9, 9], aniso: 16 }),
    roughnessMap: toTexture(roughC, { repeat: [9, 9], aniso: 8 }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.4), { repeat: [9, 9], aniso: 8 }),
  };
}

/** Park soil with pebbles and rain-damp patches. */
export function bakeSoil(size = 512): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(31415);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const peb = (u: number, v: number): number => smoothstep(0.72, 0.95, n.ridged(u * 40, v * 40, 2, 40));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = n.fbm(u * 14, v * 14, 4, 14) * 0.22 + peb(u, v) * 0.2;
    }
  const mapC = field(w, h, (u, v) => {
    const t = n.fbm(u * 6, v * 6, 4, 6);
    const damp = smoothstep(0.5, 0.8, n.fbm(u * 2 + 60, v * 2 + 11, 3, 2));
    const p = peb(u, v);
    const base: [number, number, number] = [0.36 + t * 0.16, 0.28 + t * 0.13, 0.2 + t * 0.09];
    const wet = 1 - damp * 0.42;
    return [base[0] * wet + p * 0.16, base[1] * wet + p * 0.15, base[2] * wet + p * 0.14];
  });
  const roughC = field(w, h, (u, v) => {
    const damp = smoothstep(0.5, 0.8, n.fbm(u * 2 + 60, v * 2 + 11, 3, 2));
    const r = clamp(0.96 - damp * 0.4, 0.3, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, repeat: [13, 13], aniso: 16 }),
    roughnessMap: toTexture(roughC, { repeat: [13, 13], aniso: 8 }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.2), { repeat: [13, 13], aniso: 8 }),
  };
}

/** Short-pile felt: fibre direction plus a soft nap. */
export function bakeFelt(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(272727);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      // Fibres lie mostly along U, with clumping.
      heights[y * w + x] =
        n.value(u * 40, v * 190, 40, 190) * 0.55 + n.fbm(u * 22, v * 22, 3, 22) * 0.45;
    }
  const mapC = field(w, h, (u, v) => {
    const f = n.fbm(u * 24, v * 24, 3, 24);
    return [0.75 + f * 0.1, 0.58 + f * 0.1, 0.36 + f * 0.09];
  });
  const roughC = field(w, h, (u, v) => {
    const r = clamp(0.93 + (n.value(u * 60, v * 60, 60) - 0.5) * 0.08, 0.7, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, repeat: [2, 2] }),
    roughnessMap: toTexture(roughC, { repeat: [2, 2] }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.8), { repeat: [2, 2] }),
  };
}

/** Open-cell sponge: big pores, damp on one side. */
export function bakeSponge(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(8080);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const pore = (u: number, v: number): number =>
    smoothstep(0.42, 0.86, n.ridged(u * 26, v * 26, 3, 26));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = -pore(u, v) * 0.9 + n.fbm(u * 50, v * 50, 2, 50) * 0.2;
    }
  const mapC = field(w, h, (u, v) => {
    const p = pore(u, v);
    const wet = smoothstep(0.35, 0.75, v);
    const dry: [number, number, number] = [0.86, 0.72, 0.3];
    return [
      (dry[0] - p * 0.35) * (1 - wet * 0.4),
      (dry[1] - p * 0.3) * (1 - wet * 0.38),
      (dry[2] - p * 0.14) * (1 - wet * 0.3),
    ];
  });
  const roughC = field(w, h, (u, v) => {
    const wet = smoothstep(0.35, 0.75, v);
    const r = clamp(0.95 - wet * 0.44 - pore(u, v) * 0.05, 0.3, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(normalFromHeight(heights, w, h, 3.0)),
  };
}

/** Ice: internal bubbles and micro-fractures. */
export function bakeIce(size = 256): { roughnessMap: Texture; normalMap: Texture; map: Texture } {
  const n = new Noise2D(6161);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const bub = (u: number, v: number): number => smoothstep(0.78, 0.97, n.ridged(u * 16, v * 16, 3, 16));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = bub(u, v) * 0.55 + n.fbm(u * 7, v * 7, 3, 7) * 0.3;
    }
  const mapC = field(w, h, (u, v) => {
    const b = bub(u, v);
    return [0.83 + b * 0.12, 0.9 + b * 0.08, 0.94 + b * 0.05];
  });
  const roughC = field(w, h, (u, v) => {
    const r = clamp(0.08 + bub(u, v) * 0.4 + n.fbm(u * 4 + 2, v * 4, 3, 4) * 0.1, 0.03, 0.6);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(normalFromHeight(heights, w, h, 1.4)),
  };
}

/** Dry leaf: veins, curl blotching, sun-bleached patches. */
export function bakeLeaf(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(777);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const vein = (u: number, v: number): number => {
    const mid = Math.exp(-Math.pow((v - 0.5) / 0.022, 2));
    const rib = Math.abs(Math.sin((v - 0.5) * 9 + (u - 0.1) * 16));
    const side = Math.exp(-Math.pow((1 - rib) / 0.1, 2)) * smoothstep(0.03, 0.2, u) * 0.5;
    return clamp(mid + side, 0, 1);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = vein(u, v) * 0.8 + n.fbm(u * 20, v * 20, 3, 20) * 0.25;
    }
  const mapC = field(w, h, (u, v) => {
    const blotch = n.fbm(u * 5, v * 5, 4, 5);
    const dry = smoothstep(0.35, 0.9, blotch);
    const green: [number, number, number] = [0.34, 0.3, 0.13];
    const brown: [number, number, number] = [0.55, 0.36, 0.15];
    const k = vein(u, v) * 0.25;
    return [
      green[0] + (brown[0] - green[0]) * dry + k,
      green[1] + (brown[1] - green[1]) * dry + k * 0.9,
      green[2] + (brown[2] - green[2]) * dry + k * 0.6,
    ];
  });
  const roughC = field(w, h, (u, v) => {
    const r = clamp(0.78 + (n.fbm(u * 12, v * 12, 3, 12) - 0.5) * 0.24 - vein(u, v) * 0.12, 0.3, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, wrap: ClampToEdgeWrapping }),
    roughnessMap: toTexture(roughC, { wrap: ClampToEdgeWrapping }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.0), { wrap: ClampToEdgeWrapping }),
  };
}

/** Vulcanised rubber (ball, tyres, the rubber strip). */
export function bakeRubber(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(24680);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = n.fbm(u * 70, v * 70, 3, 70) * 0.4 + n.value(u * 200, v * 200, 200) * 0.15;
    }
  const mapC = field(w, h, (u, v) => {
    const t = n.fbm(u * 9, v * 9, 3, 9);
    const scuff = smoothstep(0.68, 0.9, n.fbm(u * 4 + 5, v * 4 + 1, 3, 4));
    return [0.88 + t * 0.09 - scuff * 0.16, 0.3 + t * 0.08 - scuff * 0.06, 0.24 + t * 0.06 - scuff * 0.05];
  });
  const roughC = field(w, h, (u, v) => {
    const scuff = smoothstep(0.68, 0.9, n.fbm(u * 4 + 5, v * 4 + 1, 3, 4));
    const r = clamp(0.62 + (n.fbm(u * 20, v * 20, 2, 20) - 0.5) * 0.16 + scuff * 0.22, 0.3, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.0)),
  };
}

/** Fine sand, used as the loose grit the child can sprinkle on the slide. */
export function bakeSand(size = 256): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(90909);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = n.value(u * 150, v * 150, 150) * 0.55 + n.fbm(u * 24, v * 24, 3, 24) * 0.3;
    }
  const mapC = field(w, h, (u, v) => {
    const g = n.value(u * 150, v * 150, 150);
    const t = n.fbm(u * 10, v * 10, 3, 10);
    return [0.72 + g * 0.14 + t * 0.06, 0.63 + g * 0.13 + t * 0.05, 0.47 + g * 0.12 + t * 0.04];
  });
  const roughC = field(w, h, () => [0.95, 0.95, 0.95]);
  return {
    map: toTexture(mapC, { srgb: true, repeat: [2, 2] }),
    roughnessMap: toTexture(roughC, { repeat: [2, 2] }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.6), { repeat: [2, 2] }),
  };
}

/** Soft radial blob used as the alpha of a contact shadow decal. */
export function bakeContactShadow(size = 128): Texture {
  const { c, x } = makeCanvas(size);
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.42, 'rgba(148,148,148,1)');
  g.addColorStop(0.76, 'rgba(34,34,34,1)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** Leaf-cluster billboard for hedges and tree canopies. */
export function bakeFoliage(size = 256): { map: Texture; alphaMap: Texture } {
  const n = new Noise2D(3232);
  const { c, x } = makeCanvas(size);
  x.clearRect(0, 0, size, size);
  const leaves = 78;
  for (let i = 0; i < leaves; i++) {
    const cx = size * (0.12 + n.value(i * 3.3, 1.1) * 0.76);
    const cy = size * (0.1 + n.value(i * 5.1, 7.7) * 0.8);
    const r = size * (0.05 + n.value(i * 2.2, 3.3) * 0.075);
    const rot = n.value(i * 9.9, 4.4) * Math.PI * 2;
    const tone = n.value(i * 1.7, 8.2);
    x.save();
    x.translate(cx, cy);
    x.rotate(rot);
    const g = x.createLinearGradient(-r, -r, r, r);
    const h = 92 + tone * 34;
    g.addColorStop(0, `hsl(${h} 52% ${40 + tone * 20}%)`);
    g.addColorStop(1, `hsl(${h - 14} 44% ${24 + tone * 14}%)`);
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, 0, r, r * 0.56, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  const img = x.getImageData(0, 0, size, size);
  const { c: ac, x: ax } = makeCanvas(size);
  const aimg = ax.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const a = img.data[i * 4 + 3];
    aimg.data[i * 4] = a;
    aimg.data[i * 4 + 1] = a;
    aimg.data[i * 4 + 2] = a;
    aimg.data[i * 4 + 3] = 255;
  }
  ax.putImageData(aimg, 0, 0);
  return {
    map: toTexture(c, { srgb: true, wrap: ClampToEdgeWrapping }),
    alphaMap: toTexture(ac, { wrap: ClampToEdgeWrapping }),
  };
}

/** Mown park grass: clumped blades, worn patches, still damp in the hollows. */
export function bakeGrass(size = 512): { map: Texture; roughnessMap: Texture; normalMap: Texture } {
  const n = new Noise2D(60606);
  const w = size;
  const h = size;
  const heights = new Float32Array(w * h);
  const blade = (u: number, v: number): number =>
    n.ridged(u * 120, v * 34, 2, 120, 34) * 0.6 + n.fbm(u * 30, v * 30, 3, 30) * 0.4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      heights[y * w + x] = blade(u, v) * 0.7 + n.fbm(u * 5, v * 5, 3, 5) * 0.3;
    }
  const mapC = field(w, h, (u, v) => {
    const b = blade(u, v);
    const patch = n.fbm(u * 3, v * 3, 4, 3);
    const worn = smoothstep(0.62, 0.86, patch);
    const damp = smoothstep(0.55, 0.85, n.fbm(u * 2 + 17, v * 2 + 4, 3, 2));
    const g: [number, number, number] = [0.18 + b * 0.16, 0.3 + b * 0.24, 0.11 + b * 0.1];
    const dirt: [number, number, number] = [0.36, 0.29, 0.19];
    return [
      (g[0] + (dirt[0] - g[0]) * worn) * (1 - damp * 0.24),
      (g[1] + (dirt[1] - g[1]) * worn) * (1 - damp * 0.22),
      (g[2] + (dirt[2] - g[2]) * worn) * (1 - damp * 0.2),
    ];
  });
  const roughC = field(w, h, (u, v) => {
    const damp = smoothstep(0.55, 0.85, n.fbm(u * 2 + 17, v * 2 + 4, 3, 2));
    const r = clamp(0.92 - damp * 0.3, 0.4, 1);
    return [r, r, r];
  });
  return {
    map: toTexture(mapC, { srgb: true, repeat: [12, 12], aniso: 16 }),
    roughnessMap: toTexture(roughC, { repeat: [12, 12], aniso: 8 }),
    normalMap: toTexture(normalFromHeight(heights, w, h, 2.0), { repeat: [12, 12], aniso: 8 }),
  };
}
