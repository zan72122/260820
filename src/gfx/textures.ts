import * as THREE from 'three';
import { ValueNoise, clamp, lerp, smoothstep, makeRng, heightToNormalRGBA } from './noise';

export interface TextureSet {
  map: THREE.DataTexture;
  normalMap?: THREE.DataTexture;
  roughnessMap?: THREE.DataTexture;
}

function dataTex(
  data: Uint8ClampedArray,
  size: number,
  srgb: boolean,
  aniso: number,
): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(data.buffer.slice(0)), size, size, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/**
 * Bake a texture set from a per-texel callback.
 * `fn` fills colour (0..1 linear-ish sRGB values), height and roughness.
 */
function bake(
  size: number,
  aniso: number,
  normalStrength: number,
  fn: (u: number, v: number, out: { r: number; g: number; b: number; h: number; rough: number; a: number }) => void,
): TextureSet {
  const color = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const out = { r: 0, g: 0, b: 0, h: 0.5, rough: 0.8, a: 1 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out.r = out.g = out.b = 0;
      out.h = 0.5;
      out.rough = 0.8;
      out.a = 1;
      fn((x + 0.5) / size, (y + 0.5) / size, out);
      const o = (y * size + x) * 4;
      color[o] = out.r * 255;
      color[o + 1] = out.g * 255;
      color[o + 2] = out.b * 255;
      color[o + 3] = out.a * 255;
      const rv = out.rough * 255;
      rough[o] = rv;
      rough[o + 1] = rv;
      rough[o + 2] = rv;
      rough[o + 3] = 255;
      height[y * size + x] = out.h;
    }
  }
  const set: TextureSet = { map: dataTex(color, size, true, aniso) };
  if (normalStrength > 0) {
    set.normalMap = dataTex(heightToNormalRGBA(height, size, normalStrength), size, false, aniso);
  }
  set.roughnessMap = dataTex(rough, size, false, aniso);
  return set;
}

/* ------------------------------------------------------------------ */
/* wet field soil (top-down)                                           */
/* ------------------------------------------------------------------ */

export function bakeSoil(aniso: number): TextureSet {
  const n = new ValueNoise(1337);
  const stone = new ValueNoise(90210);
  return bake(512, aniso, 2.6, (u, v, o) => {
    const clods = n.billow(u, v, 12, 5);
    const coarse = n.fbm(u, v, 4, 4);
    const fine = n.fbm(u + 0.37, v + 0.11, 40, 3);
    // damp patches: subtle, high frequency, so a 26x repeat never shows a grid
    const damp = smoothstep(0.4, 0.78, n.fbm(u * 0.9 + 5.1, v * 0.9 + 2.7, 11, 3));
    const h = clods * 0.62 + coarse * 0.26 + fine * 0.12;

    // base loam: warm mid brown that still reads as freshly worked and damp
    let r = lerp(0.29, 0.6, h) * lerp(1, 0.84, damp);
    let g = lerp(0.2, 0.44, h) * lerp(1, 0.82, damp);
    let b = lerp(0.135, 0.3, h) * lerp(1, 0.84, damp);

    // small grit highlights
    const grit = smoothstep(0.86, 0.98, fine);
    r += grit * 0.1;
    g += grit * 0.09;
    b += grit * 0.075;

    // occasional pebbles
    const p = stone.noise(u * 34, v * 34, 34);
    if (p > 0.965) {
      const s = (p - 0.965) / 0.035;
      r = lerp(r, 0.44, s);
      g = lerp(g, 0.42, s);
      b = lerp(b, 0.39, s);
    }

    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = h;
    o.rough = clamp(lerp(0.98, 0.66, damp) - grit * 0.08, 0.4, 1);
  });
}

/* ------------------------------------------------------------------ */
/* soil seen in section (used by the x-ray window and pit walls)       */
/* ------------------------------------------------------------------ */

export function bakeSoilProfile(aniso: number): TextureSet {
  const n = new ValueNoise(4242);
  return bake(256, aniso, 1.6, (u, v, o) => {
    // v = 0 at top of the section -> topsoil, deeper = colder and denser
    const wobble = n.fbm(u, v, 6, 3) * 0.09;
    const depth = clamp(v + wobble, 0, 1);
    const grain = n.billow(u, v, 18, 4);
    const strata = smoothstep(0.28, 0.36, depth) * 0.5 + smoothstep(0.62, 0.7, depth) * 0.5;

    const r = lerp(0.3, 0.16, strata) * lerp(0.74, 1.14, grain);
    const g = lerp(0.2, 0.108, strata) * lerp(0.74, 1.14, grain);
    const b = lerp(0.135, 0.082, strata) * lerp(0.74, 1.14, grain);
    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = grain * 0.8 + (1 - depth) * 0.2;
    o.rough = clamp(0.98 - grain * 0.12, 0.5, 1);
  });
}

/* ------------------------------------------------------------------ */
/* daikon leaf: fibrous green with a strong midrib                     */
/* ------------------------------------------------------------------ */

export function bakeLeaf(aniso: number): TextureSet {
  const n = new ValueNoise(777);
  return bake(256, aniso, 2.2, (u, v, o) => {
    // u across the blade (0.5 = midrib), v along the blade (0 = base)
    const mid = Math.abs(u - 0.5) * 2;
    const rib = smoothstep(0.16, 0.0, mid);
    // side veins: chevrons flowing out from the rib
    const vein = Math.abs(((v * 13 + mid * 4.2) % 1) - 0.5) * 2;
    const veinMask = smoothstep(0.86, 1.0, 1 - vein) * (1 - rib) * smoothstep(0.02, 0.2, mid);
    const mottle = n.fbm(u * 1.3, v * 1.3, 9, 4);
    const fiber = n.fbm(u * 4 + 3.3, v * 0.6, 26, 2);

    // young daikon foliage: bright mid green, yellow-green ribs, cooler in the hollows
    let r = lerp(0.2, 0.42, mottle) + veinMask * 0.14 + rib * 0.16;
    let g = lerp(0.38, 0.68, mottle) + veinMask * 0.16 + rib * 0.2;
    let b = lerp(0.11, 0.22, mottle) + veinMask * 0.06 + rib * 0.08;
    // edge yellowing + dust
    const edge = smoothstep(0.78, 1.0, mid);
    r = lerp(r, r * 1.25 + 0.06, edge);
    g = lerp(g, g * 1.02 + 0.02, edge);
    // soil splash near the base
    const splash = smoothstep(0.16, 0.0, v) * smoothstep(0.35, 0.85, n.fbm(u * 2, v * 6, 14, 3));
    r = lerp(r, 0.3, splash * 0.7);
    g = lerp(g, 0.22, splash * 0.7);
    b = lerp(b, 0.15, splash * 0.7);

    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = rib * 0.55 + veinMask * 0.3 + fiber * 0.22 + mottle * 0.1;
    o.rough = clamp(0.66 - rib * 0.12 - veinMask * 0.06 + splash * 0.25, 0.3, 1);

    // lobed silhouette: a bare petiole at the base, deep scallops up the blade
    const petiole = smoothstep(0.05, 0.3, v);
    const lobes = 0.56 + 0.44 * Math.pow(Math.abs(Math.sin(v * 12.4 + 0.6)), 0.5);
    const tipTaper = 1 - smoothstep(0.84, 1.0, v) * 0.72;
    const outline = (0.2 + 0.8 * petiole) * lobes * tipTaper;
    o.a = smoothstep(outline + 0.05, outline - 0.05, mid);
  });
}

/* ------------------------------------------------------------------ */
/* daikon skin: smooth white with rooting-scar rows                    */
/* ------------------------------------------------------------------ */

export function bakeDaikonSkin(aniso: number): TextureSet {
  const n = new ValueNoise(20240);
  const rng = makeRng(9001);
  // pre-place the two spiral rows of lateral-root pits
  const pits: Array<[number, number, number]> = [];
  for (let i = 0; i < 150; i++) {
    const t = i / 150;
    const side = i % 2 === 0 ? 0 : 0.5;
    const u = (t * 0.62 + side + rng() * 0.02) % 1;
    pits.push([u, t * 0.94 + 0.03 + (rng() - 0.5) * 0.012, 0.008 + rng() * 0.006]);
  }
  return bake(256, aniso, 1.35, (u, v, o) => {
    // v: 0 = shoulder (near leaves), 1 = tip
    const striation = n.fbm(u * 6.5, v * 0.55, 44, 2);
    const blotch = n.fbm(u * 1.1 + 2.2, v * 1.1, 5, 3);
    let shade = lerp(0.9, 1.0, striation * 0.45 + blotch * 0.55);

    // faint growth rings across the root
    const rings = Math.sin(v * 96 + blotch * 5) * 0.5 + 0.5;
    shade -= rings * 0.014;

    let pit = 0;
    for (let i = 0; i < pits.length; i++) {
      const p = pits[i];
      let du = u - p[0];
      du -= Math.round(du);
      const dv = v - p[1];
      const d = Math.sqrt(du * du * 1.0 + dv * dv * 3.4);
      if (d < p[2] * 2.2) pit = Math.max(pit, smoothstep(p[2] * 2.2, p[2] * 0.4, d));
    }

    // green shoulder tint: daikon exposed to sun above soil
    const shoulder = smoothstep(0.1, 0.0, v);
    let r = shade * 0.965 - pit * 0.2;
    let g = shade * 0.972 - pit * 0.17;
    let b = shade * 0.93 - pit * 0.17;
    r = lerp(r, r * 0.82, shoulder * 0.55);
    g = lerp(g, g * 0.95, shoulder * 0.55);
    b = lerp(b, b * 0.74, shoulder * 0.55);

    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = 0.5 + striation * 0.18 - pit * 0.7 - rings * 0.05;
    o.rough = clamp(0.34 + striation * 0.14 + pit * 0.25, 0.15, 0.9);
  });
}

/* ------------------------------------------------------------------ */
/* rubber conveyor belt: matte black with transverse cleats            */
/* ------------------------------------------------------------------ */

export function bakeRubber(aniso: number): TextureSet {
  const n = new ValueNoise(555);
  return bake(256, aniso, 3.2, (u, v, o) => {
    const rib = Math.abs(((v * 16) % 1) - 0.5) * 2; // 0 at rib centre
    const ribMask = smoothstep(0.62, 0.3, rib);
    const grain = n.fbm(u * 2, v * 2, 55, 3);
    const wear = n.fbm(u + 1.7, v + 4.4, 6, 3);
    const dust = smoothstep(0.55, 0.9, wear) * 0.5;

    let base = lerp(0.085, 0.145, grain) + ribMask * 0.05;
    let r = base * 1.03 + dust * 0.14;
    let g = base + dust * 0.11;
    let b = base * 0.98 + dust * 0.085;

    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = ribMask * 0.85 + grain * 0.15;
    o.rough = clamp(0.93 - ribMask * 0.06 + dust * 0.05, 0.55, 1);
  });
}

/* ------------------------------------------------------------------ */
/* painted farm-machine steel: chips, scratches, mud film at the base  */
/* ------------------------------------------------------------------ */

export function bakePaint(aniso: number): TextureSet {
  const n = new ValueNoise(31415);
  const scr = new ValueNoise(2718);
  return bake(256, aniso, 1.1, (u, v, o) => {
    const grime = n.fbm(u, v, 5, 4);
    const flake = smoothstep(0.72, 0.9, n.billow(u, v, 22, 3));
    const scratch = smoothstep(0.9, 1.0, scr.fbm(u * 0.15, v * 9, 30, 2));
    // mud film accumulates toward v=1 (bottom of the panel)
    const mud = smoothstep(0.55, 1.0, v) * smoothstep(0.3, 0.8, grime);

    // grayscale wear map, tinted by material.color
    let s = 1 - flake * 0.42 - scratch * 0.18;
    let r = s;
    let g = s;
    let b = s;
    // exposed primer / rust in chips
    r = lerp(r, 0.42, flake * 0.55);
    g = lerp(g, 0.26, flake * 0.55);
    b = lerp(b, 0.17, flake * 0.55);
    // dried mud
    r = lerp(r, 0.34, mud * 0.7);
    g = lerp(g, 0.25, mud * 0.7);
    b = lerp(b, 0.17, mud * 0.7);

    o.r = clamp(r, 0, 1);
    o.g = clamp(g, 0, 1);
    o.b = clamp(b, 0, 1);
    o.h = 0.5 - flake * 0.45 - scratch * 0.2;
    o.rough = clamp(0.38 + flake * 0.4 + mud * 0.45 + grime * 0.1, 0.2, 1);
  });
}

/* ------------------------------------------------------------------ */
/* brushed / honed steel for the cutting blade                         */
/* ------------------------------------------------------------------ */

export function bakeSteel(aniso: number): TextureSet {
  const n = new ValueNoise(60606);
  return bake(128, aniso, 0.9, (u, v, o) => {
    const brush = n.fbm(u * 40, v * 0.4, 60, 2);
    const stain = n.fbm(u + 8, v + 3, 4, 3);
    const s = lerp(0.62, 0.86, brush) * lerp(0.86, 1.0, stain);
    o.r = clamp(s * 1.0, 0, 1);
    o.g = clamp(s * 1.005, 0, 1);
    o.b = clamp(s * 1.03, 0, 1);
    o.h = brush;
    o.rough = clamp(0.16 + brush * 0.16 + (1 - stain) * 0.22, 0.08, 0.7);
  });
}

/* ------------------------------------------------------------------ */
/* alpha sprites                                                       */
/* ------------------------------------------------------------------ */

/** Soft dust puff sprite. */
export function bakeDust(): THREE.DataTexture {
  const size = 64;
  const n = new ValueNoise(1212);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const d = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2;
      const puff = n.fbm(u, v, 5, 3);
      const a = smoothstep(1.0, 0.05, d) * lerp(0.55, 1, puff);
      const o = (y * size + x) * 4;
      data[o] = 232;
      data[o + 1] = 214;
      data[o + 2] = 190;
      data[o + 3] = a * 255;
    }
  }
  const t = new THREE.DataTexture(new Uint8Array(data.buffer.slice(0)), size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Radial soil-crack decal, drawn on the bed the instant a daikon is gripped. */
export function bakeCrack(): THREE.DataTexture {
  const size = 128;
  const n = new ValueNoise(31);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5;
      const v = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(u * u + v * v) * 2;
      const ang = Math.atan2(v, u);
      // radiating fissures
      const spokes = Math.abs(Math.sin(ang * 5.5 + n.fbm(u + 0.5, v + 0.5, 5, 2) * 6));
      const crack = smoothstep(0.55, 0.98, 1 - spokes) * smoothstep(1.0, 0.2, d) * smoothstep(0.08, 0.3, d);
      // upheaved rim
      const rim = smoothstep(0.16, 0.34, d) * smoothstep(0.62, 0.34, d);
      const a = clamp(crack * 1.0 + rim * 0.5, 0, 1) * smoothstep(1.0, 0.7, d);
      const dark = crack * 0.85;
      const o = (y * size + x) * 4;
      data[o] = lerp(96, 26, dark) ;
      data[o + 1] = lerp(70, 17, dark);
      data[o + 2] = lerp(48, 11, dark);
      data[o + 3] = a * 235;
    }
  }
  const t = new THREE.DataTexture(new Uint8Array(data.buffer.slice(0)), size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
