import * as THREE from 'three';
import { clamp01, fbm, lerp, makeRng, makeValueNoise2D, smoothstep } from './math';

/**
 * Every surface in this project is authored procedurally at boot: there are no
 * binary art assets to ship, and every material still gets its own weave,
 * tool-mark or pore structure rather than a flat colour.
 */

type PixelFn = (
  x: number,
  y: number,
  u: number,
  v: number,
  out: number[],
) => void;

const makeCanvas = (size: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
};

const paint = (size: number, fn: PixelFn): HTMLCanvasElement => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  // One shared triple: allocating an array per texel across a dozen 512px
  // maps is enough garbage to stall the first frames on a phone.
  const out = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, x / size, y / size, out);
      const i = (y * size + x) * 4;
      d[i] = clamp01(out[0]) * 255;
      d[i + 1] = clamp01(out[1]) * 255;
      d[i + 2] = clamp01(out[2]) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

/** Evaluate a height function once per texel. */
const makeField = (
  size: number,
  fn: (x: number, y: number) => number,
): Float32Array => {
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) f[y * size + x] = fn(x, y);
  }
  return f;
};

/**
 * Sobel a height field into a tangent-space normal map.
 *
 * The height function is evaluated once per texel into a buffer first. Sobel
 * reads nine neighbours, and these height functions are multi-octave noise, so
 * sampling them directly inside the filter would cost nine times as much — on
 * a phone that is the difference between a brief pause at boot and a frozen
 * first few seconds.
 */
const heightToNormal = (
  size: number,
  height: ((x: number, y: number) => number) | Float32Array,
  strength: number,
): HTMLCanvasElement => {
  const field = height instanceof Float32Array ? height : makeField(size, height);
  const at = (x: number, y: number): number =>
    field[((y + size) % size) * size + ((x + size) % size)];
  return paint(size, (x, y, _u, _v, out) => {
    const gx =
      at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
      (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
    const gy =
      at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
      (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
    const nx = gx * strength;
    const ny = gy * strength;
    const len = Math.sqrt(nx * nx + ny * ny + 1);
    out[0] = (nx / len) * 0.5 + 0.5;
    out[1] = (ny / len) * 0.5 + 0.5;
    out[2] = (1 / len) * 0.5 + 0.5;
  });
};

const toTexture = (
  canvas: HTMLCanvasElement,
  repeat: number,
  srgb: boolean,
): THREE.Texture => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

export interface SurfaceMaps {
  map?: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/* ------------------------------------------------------------------ fabric */

/**
 * Woven nylon cuff shell: a real warp/weft interlace, stitched seam lines, and
 * light nap only where fingers actually grab the cuff.
 */
export const makeCuffFabric = (): SurfaceMaps & { map: THREE.Texture } => {
  const size = 512;
  const noise = makeValueNoise2D(1717);
  const threads = 46; // warp/weft count across the tile

  const weave = (x: number, y: number): number => {
    const u = (x / size) * threads;
    const v = (y / size) * threads;
    const cell = (Math.floor(u) + Math.floor(v)) % 2;
    // Rounded thread cross-section, alternating which yarn rides on top.
    const fu = u - Math.floor(u);
    const fv = v - Math.floor(v);
    const along = cell === 0 ? fv : fu;
    const across = cell === 0 ? fu : fv;
    // sqrt(sqrt(s)) approximates s**0.7 closely enough for a thread profile
    // and avoids a pow() per texel across half a million of them.
    const sN = Math.sin(Math.PI * across);
    const barrel = Math.sqrt(Math.sqrt(sN * sN * sN));
    const ripple = 0.86 + 0.14 * Math.sin(Math.PI * 2 * along * 2);
    const fuzz = fbm(noise, x * 0.5, y * 0.5, 2) * 0.16;
    return clamp01(barrel * ripple * 0.82 + fuzz + (cell === 0 ? 0.06 : 0));
  };

  // Stitched seams run along the long edges of the band plus a bar-tack.
  const seam = (u: number, v: number): number => {
    const rows = [0.075, 0.925];
    let s = 0;
    for (const r of rows) {
      const d = Math.abs(v - r);
      const stitch = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 64);
      s = Math.max(s, smoothstep(0.014, 0.0, d) * (0.45 + 0.55 * stitch));
    }
    return s;
  };

  const weaveField = makeField(size, weave);
  const W = (x: number, y: number): number => weaveField[y * size + x];
  const heightField = makeField(size, (x, y) =>
    clamp01(W(x, y) * 0.8 + seam(x / size, y / size) * 0.5),
  );

  const rng = makeRng(90210);
  // Asymmetric wear: one grab patch, one scuffed print, never mirrored.
  const wearU = 0.63;
  const wearV = 0.42;
  const printU = 0.28;
  const printV = 0.5;

  const map = paint(size, (x, y, u, v, out) => {
    const w = W(x, y);
    // Desaturated clinical navy with dye variation between yarn directions.
    const base = [0.196, 0.256, 0.322];
    const alt = [0.164, 0.218, 0.278];
    const cell = (Math.floor((u * threads)) + Math.floor(v * threads)) % 2;
    const c = cell === 0 ? base : alt;
    const dye = 0.9 + fbm(noise, x * 0.05, y * 0.05, 3) * 0.24;
    const shade = 0.62 + w * 0.58;
    const nap =
      smoothstep(0.22, 0.0, Math.sqrt((u - wearU) ** 2 + (v - wearV) ** 2)) * 0.14;
    const printWear =
      smoothstep(0.1, 0.0, Math.sqrt(((u - printU) * 1.6) ** 2 + (v - printV) ** 2)) * 0.5;
    // A worn printed index bar, scuffed away toward one end only.
    const printed =
      smoothstep(0.006, 0.0, Math.abs(v - printV) - 0.02) *
      smoothstep(0.0, 0.02, u - 0.2) *
      smoothstep(0.42, 0.3, u) *
      (0.55 + 0.45 * rng());
    const s = seam(u, v);
    let r = (c[0] * dye * shade + nap) * (1 - printWear * 0.35);
    let g = (c[1] * dye * shade + nap) * (1 - printWear * 0.35);
    let b = (c[2] * dye * shade + nap) * (1 - printWear * 0.35);
    r = lerp(r, 0.66, printed * 0.8);
    g = lerp(g, 0.69, printed * 0.8);
    b = lerp(b, 0.7, printed * 0.8);
    r = lerp(r, 0.2, s * 0.5);
    g = lerp(g, 0.23, s * 0.5);
    b = lerp(b, 0.27, s * 0.5);
    out[0] = r;
    out[1] = g;
    out[2] = b;
  });

  const rough = paint(size, (x, y, u, v, out) => {
    const w = W(x, y);
    const nap = smoothstep(0.22, 0.0, Math.sqrt((u - wearU) ** 2 + (v - wearV) ** 2));
    const r = 0.94 - w * 0.1 + nap * 0.05;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });

  return {
    map: toTexture(map, 4, true),
    normalMap: toTexture(heightToNormal(size, heightField, 2.2), 4, false),
    roughnessMap: toTexture(rough, 4, false),
  };
};

/** Hook-and-loop patch: dense hook field, clearly not the same weave. */
export const makeHookLoop = (): SurfaceMaps & { map: THREE.Texture } => {
  const size = 256;
  const noise = makeValueNoise2D(4242);
  const height = (x: number, y: number): number => {
    const h = fbm(noise, x * 0.9, y * 0.9, 2);
    const hooks = Math.sin(x * 1.9) * Math.sin(y * 2.3);
    return clamp01(0.4 + hooks * 0.25 + h * 0.5);
  };
  const map = paint(size, (x, y, _u, _v, out) => {
    const h = height(x, y);
    const g = 0.1 + h * 0.09;
    out[0] = g * 0.95;
    out[1] = g;
    out[2] = g * 1.06;
  });
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.97 - height(x, y) * 0.06;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    map: toTexture(map, 1, true),
    normalMap: toTexture(heightToNormal(size, height, 3.4), 1, false),
    roughnessMap: toTexture(rough, 1, false),
  };
};

/* ------------------------------------------------------------------- metal */

/** Diamond knurling for the brass release valve. */
export const makeKnurl = (): SurfaceMaps => {
  const size = 256;
  const pitch = 13;
  const height = (x: number, y: number): number => {
    const a = Math.sin(((x + y) / size) * Math.PI * 2 * pitch);
    const b = Math.sin(((x - y) / size) * Math.PI * 2 * pitch);
    // Sharp pyramids with a slightly flattened crest, as rolled knurls have.
    return clamp01(Math.min(1, (Math.abs(a) * Math.abs(b)) ** 0.45 * 1.15));
  };
  const rough = paint(size, (x, y, _u, _v, out) => {
    // Crests polished by fingers, valleys still matte from machining.
    const r = 0.62 - height(x, y) * 0.3;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    normalMap: toTexture(heightToNormal(size, height, 3.0), 1, false),
    roughnessMap: toTexture(rough, 1, false),
  };
};

/** Directional tool marks. `axis` 0 = along U, 1 = along V. */
export const makeBrushedMetal = (
  axis: 0 | 1,
  seed = 77,
  repeat = 4,
): SurfaceMaps => {
  const size = 256;
  const noise = makeValueNoise2D(seed);
  const height = (x: number, y: number): number => {
    const a = axis === 0 ? x : y;
    const b = axis === 0 ? y : x;
    // Fine, shallow drawing marks running one way — not a churned surface.
    return clamp01(
      0.5 + (fbm(noise, a * 0.04, b * 1.1, 2) - 0.5) * 0.35 + (noise(a * 0.008, b * 4) - 0.5) * 0.18,
    );
  };
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.34 + height(x, y) * 0.1;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    normalMap: toTexture(heightToNormal(size, height, 0.16), repeat, false),
    roughnessMap: toTexture(rough, repeat, false),
  };
};

/* -------------------------------------------------------------------- skin */

/**
 * Manikin skin: a moulded synthetic, so it gets a mould texture and part
 * seams rather than the fine detail of live skin.
 */
export const makeManikinSkin = (): SurfaceMaps & { map: THREE.Texture } => {
  const size = 320;
  const noise = makeValueNoise2D(31337);
  const height = (x: number, y: number): number => {
    const grain = fbm(noise, x * 0.35, y * 0.35, 4) * 0.55;
    const orangePeel = fbm(noise, x * 0.09, y * 0.09, 2) * 0.45;
    return clamp01(0.35 + grain * 0.5 + orangePeel * 0.5);
  };
  const field = makeField(size, height);
  const H = (x: number, y: number): number => field[y * size + x];
  const map = paint(size, (x, y, _u, _v, out) => {
    const h = H(x, y);
    const blotch = fbm(noise, x * 0.012, y * 0.012, 3);
    // Warm neutral vinyl, deliberately a shade flatter than living skin.
    const r = 0.575 + blotch * 0.075 + h * 0.05;
    const g = 0.455 + blotch * 0.058 + h * 0.045;
    const b = 0.395 + blotch * 0.045 + h * 0.04;
    out[0] = r;
    out[1] = g;
    out[2] = b;
  });
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.72 + H(x, y) * 0.14;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    map: toTexture(map, 2, true),
    normalMap: toTexture(heightToNormal(size, field, 1.1), 2, false),
    roughnessMap: toTexture(rough, 2, false),
  };
};

/* ------------------------------------------------------------------ rubber */

/** Moulded bulb rubber: orange-peel surface, dull sheen, no gloss. */
export const makeBulbRubber = (): SurfaceMaps => {
  const size = 256;
  const noise = makeValueNoise2D(6161);
  const height = (x: number, y: number): number =>
    clamp01(0.42 + fbm(noise, x * 0.16, y * 0.16, 3) * 0.62);
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.78 + height(x, y) * 0.12;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    normalMap: toTexture(heightToNormal(size, height, 0.85), 2, false),
    roughnessMap: toTexture(rough, 2, false),
  };
};

/* ------------------------------------------------------- room / furniture  */

export const makeVinylFloor = (): SurfaceMaps & { map: THREE.Texture } => {
  const size = 256;
  const noise = makeValueNoise2D(505);
  const height = (x: number, y: number): number => {
    const seam = smoothstep(3, 0, Math.abs((y % 170) - 85) - 82) * 0.7;
    return clamp01(0.5 + fbm(noise, x * 0.3, y * 0.3, 3) * 0.3 - seam * 0.4);
  };
  const map = paint(size, (x, y, _u, _v, out) => {
    const speck = fbm(noise, x * 1.4, y * 1.4, 2);
    const wash = fbm(noise, x * 0.02, y * 0.02, 2);
    const g = 0.30 + speck * 0.1 + wash * 0.05;
    out[0] = g * 0.99;
    out[1] = g * 1.01;
    out[2] = g;
  });
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.42 + fbm(noise, x * 0.5, y * 0.5, 2) * 0.16;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    map: toTexture(map, 8, true),
    normalMap: toTexture(heightToNormal(size, height, 0.4), 8, false),
    roughnessMap: toTexture(rough, 8, false),
  };
};

export const makePaintedWall = (): SurfaceMaps => {
  const size = 256;
  const noise = makeValueNoise2D(808);
  const height = (x: number, y: number): number =>
    clamp01(0.5 + fbm(noise, x * 0.25, y * 0.25, 3) * 0.28);
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.82 + fbm(noise, x * 0.2, y * 0.2, 2) * 0.1;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    normalMap: toTexture(heightToNormal(size, height, 0.35), 5, false),
    roughnessMap: toTexture(rough, 5, false),
  };
};

/** Curtain: vertical pleats plus a loose weave. */
export const makeCurtain = (): SurfaceMaps => {
  const size = 256;
  const noise = makeValueNoise2D(999);
  const height = (x: number, y: number): number => {
    const weave = Math.sin(x * 2.1) * Math.sin(y * 2.1) * 0.2;
    return clamp01(0.5 + weave + fbm(noise, x * 0.4, y * 0.4, 2) * 0.3);
  };
  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = 0.9 - height(x, y) * 0.08;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });
  return {
    normalMap: toTexture(heightToNormal(size, height, 1.2), 3, false),
    roughnessMap: toTexture(rough, 3, false),
  };
};

/* ------------------------------------------------------------- gauge dial  */

/**
 * The aneroid dial carries tick marks and two zones told apart by finish and
 * area only: a matte inner sweep and a satin outer sweep. No numerals, no red
 * or green "right answer" colour.
 */
export const makeGaugeFace = (): { map: THREE.Texture; roughnessMap: THREE.Texture } => {
  const size = 384;
  const c = size / 2;
  const noise = makeValueNoise2D(4711);

  const zone = (x: number, y: number): number => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.sqrt(dx * dx + dy * dy) / c;
    if (r > 0.92 || r < 0.2) return 0;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const t = a / (Math.PI * 2);
    // "firmly closed" arc occupies the upper sweep, distinguished by finish.
    return t > 0.52 && t < 0.9 ? 1 : 0;
  };

  const map = paint(size, (x, y, _u, _v, out) => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.sqrt(dx * dx + dy * dy) / c;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const t = a / (Math.PI * 2);

    let v = 0.9 + fbm(noise, x * 0.06, y * 0.06, 2) * 0.06;
    if (r > 0.97) v = 0.28; // bezel shadow
    // Tick ring
    if (r > 0.72 && r < 0.9) {
      const ticks = 40;
      const p = (t * ticks) % 1;
      const major = Math.round(t * ticks) % 5 === 0;
      const w = major ? 0.16 : 0.075;
      if (p < w || p > 1 - w) v = major ? 0.1 : 0.22;
      if (major && r < 0.78) v = 0.9;
    }
    if (r > 0.9 && r < 0.965) v = 0.82;
    if (zone(x, y) > 0 && r > 0.58 && r < 0.71) v -= 0.1; // matte inset sweep
    if (r < 0.2) v = 0.72;
    // dust in the dial's lower well
    v -= smoothstep(0.55, 0.95, r) * fbm(noise, x * 0.3, y * 0.3, 2) * 0.05;
    out[0] = v * 0.985;
    out[1] = v * 0.99;
    out[2] = v * 0.955;
  });

  const rough = paint(size, (x, y, _u, _v, out) => {
    const r = zone(x, y) > 0 ? 0.78 : 0.46;
    out[0] = r;
    out[1] = r;
    out[2] = r;
  });

  const mapTex = toTexture(map, 1, true);
  mapTex.wrapS = THREE.ClampToEdgeWrapping;
  mapTex.wrapT = THREE.ClampToEdgeWrapping;
  const roughTex = toTexture(rough, 1, false);
  roughTex.wrapS = THREE.ClampToEdgeWrapping;
  roughTex.wrapT = THREE.ClampToEdgeWrapping;
  return { map: mapTex, roughnessMap: roughTex };
};

/* ------------------------------------------------------- contact shadows   */

/** Soft elliptical ground shadow so nothing floats. */
export const makeContactShadow = (): THREE.Texture => {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.09)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
};
