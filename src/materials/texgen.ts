import * as THREE from 'three';
import { trackTexture } from '../ui/debug';

/**
 * Procedural PBR map generator.
 *
 * Every surface in the pavilion is authored as a small "recipe" function that,
 * for a given point on the surface, reports its base colour, roughness,
 * metalness, ambient occlusion and micro-height. The generator runs that
 * function once per texel and bakes three tileable textures:
 *
 *   map        RGB base colour (sRGB)
 *   orm        R = AO, G = roughness, B = metalness (linear)
 *   normalMap  tangent-space normal derived from the micro-height field
 *
 * Shipping no image files keeps the first load instant on a phone, keeps the
 * build fully static, and lets every material carry its own local variation
 * (wear, damp patches, dust, scuffs) instead of one uniform value per surface.
 */

export interface Sample {
  /** Base colour, authored in sRGB, 0..1. */
  r: number;
  g: number;
  b: number;
  /** Perceptual roughness, 0 = mirror, 1 = fully diffuse. */
  rough: number;
  /** 0 for dielectrics, 1 for bare metal. */
  metal: number;
  /** Baked cavity occlusion, 1 = fully open. */
  ao: number;
  /** Micro relief in 0..1; converted to a tangent-space normal. */
  height: number;
}

export interface Recipe {
  id: string;
  /** Texture edge length in texels. Powers of two only. */
  size?: number;
  /** Height-to-normal gain. Higher = deeper apparent relief. */
  bump?: number;
  sample(u: number, v: number, s: Sample): void;
}

export interface SurfaceMaps {
  map: THREE.DataTexture;
  orm: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  dispose(): void;
}

function makeTexture(data: Uint8Array<ArrayBuffer>, size: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  trackTexture(t);
  return t;
}

const scratch: Sample = { r: 0.5, g: 0.5, b: 0.5, rough: 0.8, metal: 0, ao: 1, height: 0.5 };

export function bakeSurface(recipe: Recipe, size = 256): SurfaceMaps {
  const n = recipe.size ?? size;
  const px = n * n;
  const albedo = new Uint8Array(px * 4);
  const orm = new Uint8Array(px * 4);
  const normal = new Uint8Array(px * 4);
  const height = new Float32Array(px);
  const inv = 1 / n;

  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      scratch.r = 0.5;
      scratch.g = 0.5;
      scratch.b = 0.5;
      scratch.rough = 0.8;
      scratch.metal = 0;
      scratch.ao = 1;
      scratch.height = 0.5;
      recipe.sample(u, v, scratch);
      const i = (y * n + x) * 4;
      albedo[i] = scratch.r * 255;
      albedo[i + 1] = scratch.g * 255;
      albedo[i + 2] = scratch.b * 255;
      albedo[i + 3] = 255;
      orm[i] = scratch.ao * 255;
      orm[i + 1] = scratch.rough * 255;
      orm[i + 2] = scratch.metal * 255;
      orm[i + 3] = 255;
      height[y * n + x] = scratch.height;
    }
  }

  // Sobel the height field into a tangent-space normal map, wrapping at the
  // edges so the result tiles seamlessly.
  const gain = (recipe.bump ?? 1) * n * 0.02;
  for (let y = 0; y < n; y++) {
    const ym = ((y - 1 + n) % n) * n;
    const y0 = y * n;
    const yp = ((y + 1) % n) * n;
    for (let x = 0; x < n; x++) {
      const xm = (x - 1 + n) % n;
      const xp = (x + 1) % n;
      const h00 = height[ym + xm];
      const h10 = height[ym + x];
      const h20 = height[ym + xp];
      const h01 = height[y0 + xm];
      const h21 = height[y0 + xp];
      const h02 = height[yp + xm];
      const h12 = height[yp + x];
      const h22 = height[yp + xp];
      const dx = h00 + 2 * h01 + h02 - (h20 + 2 * h21 + h22);
      const dy = h00 + 2 * h10 + h20 - (h02 + 2 * h12 + h22);
      let nx = dx * gain;
      let ny = dy * gain;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * n + x) * 4;
      normal[i] = (nx * 0.5 + 0.5) * 255;
      normal[i + 1] = (ny * 0.5 + 0.5) * 255;
      normal[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      normal[i + 3] = 255;
    }
  }

  const mapT = makeTexture(albedo, n, true);
  const ormT = makeTexture(orm, n, false);
  const normalT = makeTexture(normal, n, false);

  return {
    map: mapT,
    orm: ormT,
    normalMap: normalT,
    dispose() {
      mapT.dispose();
      ormT.dispose();
      normalT.dispose();
    },
  };
}

export interface StandardOptions {
  color?: THREE.ColorRepresentation;
  repeat?: number;
  normalScale?: number;
  aoIntensity?: number;
  envMapIntensity?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: THREE.ColorRepresentation;
  sheenRoughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  transparent?: boolean;
  opacity?: number;
  physical?: boolean;
  side?: THREE.Side;
  anisotropy?: number;
}

/** Build a Standard/Physical material wired to a baked surface. */
export function surfaceMaterial(maps: SurfaceMaps, o: StandardOptions = {}) {
  const repeat = o.repeat ?? 1;
  for (const t of [maps.map, maps.orm, maps.normalMap]) {
    t.repeat.set(repeat, repeat);
    t.anisotropy = o.anisotropy ?? 4;
    t.needsUpdate = true;
  }
  const params: THREE.MeshPhysicalMaterialParameters = {
    color: o.color ?? 0xffffff,
    map: maps.map,
    aoMap: maps.orm,
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
    normalMap: maps.normalMap,
    roughness: o.roughness ?? 1,
    metalness: o.metalness ?? 1,
    aoMapIntensity: o.aoIntensity ?? 1,
    envMapIntensity: o.envMapIntensity ?? 1,
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    side: o.side ?? THREE.FrontSide,
  };
  if (o.transparent) {
    params.transparent = true;
    params.opacity = o.opacity ?? 1;
  }
  if (o.physical) {
    const m = new THREE.MeshPhysicalMaterial(params);
    if (o.clearcoat !== undefined) m.clearcoat = o.clearcoat;
    if (o.clearcoatRoughness !== undefined) m.clearcoatRoughness = o.clearcoatRoughness;
    if (o.sheen !== undefined) m.sheen = o.sheen;
    if (o.sheenColor !== undefined) m.sheenColor = new THREE.Color(o.sheenColor);
    if (o.sheenRoughness !== undefined) m.sheenRoughness = o.sheenRoughness;
    if (o.transmission !== undefined) m.transmission = o.transmission;
    if (o.ior !== undefined) m.ior = o.ior;
    if (o.thickness !== undefined) m.thickness = o.thickness;
    return m;
  }
  return new THREE.MeshStandardMaterial(params as THREE.MeshStandardMaterialParameters);
}
