import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, lerp, noise2, Rng, rrange } from '../core/util';
import { mudMaskTexture, tuberSkinTextures } from '../gfx/textures';

export type TuberParams = {
  length: number;
  radius: number;
  /** Sideways bow of the body, in metres at mid-length. */
  bend: number;
  /** 0 = fat shoulder near the crown, 1 = fat toward the far tip. */
  bias: number;
  seed: number;
};

const RADIAL = 14;
const RINGS = 26;

/**
 * A sweet potato is not a capsule: it has a shoulder where the root enters,
 * a blunt or drawn-out tip, shallow dents, and a bow that differs per root.
 */
export function makeTuberGeometry(p: TuberParams) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const mud: number[] = [];
  const idx: number[] = [];

  const centre = (t: number, out: THREE.Vector3) => {
    // grows along +Z from the shoulder, bowing in X and sagging in Y
    const bow = Math.sin(Math.PI * t);
    out.set(
      p.bend * bow + Math.sin(t * 5.1 + p.seed) * p.radius * 0.16,
      -Math.sin(Math.PI * t) * p.radius * 0.22 * (1 + p.bend * 2),
      t * p.length,
    );
    return out;
  };

  const profile = (t: number) => {
    const s = Math.pow(Math.sin(Math.PI * clamp01(t)), 0.52);
    // shift the fattest point off centre so both ends differ
    const shift = lerp(0.86, 1.14, clamp01(t + (p.bias - 0.5) * 0.9));
    const shoulder = 1 - Math.pow(clamp01(1 - t * 3.2), 2) * 0.22; // slight neck at the root end
    return s * shift * shoulder;
  };

  const c0 = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const nx = new THREE.Vector3();
  const ny = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    centre(t, c0);
    centre(Math.min(1, t + 0.01), c1);
    tangent.subVectors(c1, c0).normalize();
    nx.crossVectors(up, tangent).normalize();
    ny.crossVectors(tangent, nx).normalize();
    const r0 = p.radius * profile(t);

    for (let j = 0; j <= RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // lumpiness + shallow dents where fine roots pull at the skin
      const lump = fbm(ca * 1.6 + 8 + p.seed, sa * 1.6 + t * 3.4, 3, p.seed | 0) - 0.5;
      const dent = Math.pow(clamp01(noise2(ca * 3 + p.seed * 2, sa * 3 + t * 7, (p.seed * 13) | 0)), 6);
      const r = r0 * (1 + lump * 0.20 - dent * 0.32) * (1 + Math.sin(t * 9 + a * 2) * 0.015);

      const px = c0.x + nx.x * ca * r + ny.x * sa * r;
      const py = c0.y + nx.y * ca * r + ny.y * sa * r;
      const pz = c0.z + nx.z * ca * r + ny.z * sa * r;
      pos.push(px, py, pz);
      const n = new THREE.Vector3(px - c0.x, py - c0.y, pz - c0.z).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push((j / RADIAL) * 1.6, t * 2.2);
      // buried, the underside collects the wet soil; the top wipes cleaner
      const downFacing = clamp01(0.42 - n.y * 0.62);
      mud.push(clamp01(downFacing * (0.65 + 0.5 * fbm(ca * 2 + t * 4, sa * 2, 2, 5)) + 0.16));
    }
  }

  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * (RADIAL + 1) + j;
      const b = a + RADIAL + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aMud', new THREE.Float32BufferAttribute(mud, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export type TuberMaterial = THREE.MeshStandardMaterial & {
  userData: { uMud: THREE.IUniform<number>; uWet: THREE.IUniform<number> };
};

export function makeTuberMaterial(): TuberMaterial {
  const skin = tuberSkinTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: skin.map,
    normalMap: skin.normalMap,
    roughnessMap: skin.roughnessMap,
    roughness: 0.66,
    metalness: 0.0,
    normalScale: new THREE.Vector2(0.75, 0.75),
  }) as TuberMaterial;

  const uMud = { value: 1.0 };
  const uWet = { value: 1.0 };
  mat.userData = { uMud, uWet };
  const mudMap = mudMaskTexture();

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMud = uMud;
    shader.uniforms.uWet = uWet;
    shader.uniforms.uMudMap = { value: mudMap };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMud;\nvarying float vMud;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMud = aMud;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vMud;
         uniform float uMud;
         uniform float uWet;
         uniform sampler2D uMudMap;
         float vMudAmt = 0.0;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float mudTex = texture2D(uMudMap, vMapUv * 1.7).r;
         float mudAmt = clamp(vMud * uMud * (0.35 + mudTex * 1.15) * 1.05, 0.0, 1.0);
         mudAmt = smoothstep(0.30, 0.95, mudAmt);
         vec3 mudCol = mix(vec3(0.148, 0.112, 0.078), vec3(0.263, 0.203, 0.140), mudTex);
         diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, mudAmt);
         // skin left wet by the soil reads darker and a shade deeper in hue
         diffuseColor.rgb *= mix(1.0, 0.80, uWet * (1.0 - mudAmt));
         vMudAmt = mudAmt;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor * mix(1.0, 0.58, uWet), 0.94, vMudAmt);`,
      );
  };
  mat.customProgramCacheKey = () => 'tuber-skin-mud';
  return mat;
}

let rootMat: THREE.MeshStandardMaterial | null = null;
export function rootMaterial() {
  if (!rootMat) {
    rootMat = new THREE.MeshStandardMaterial({
      color: 0x9c8461,
      roughness: 0.95,
      metalness: 0,
    });
  }
  return rootMat;
}

/** Hair roots clinging along the body — the detail that stops it reading as a prop. */
export function makeFineRoots(p: TuberParams, rng: Rng) {
  const parts: THREE.BufferGeometry[] = [];
  const count = 9 + Math.floor(rng() * 6);
  for (let i = 0; i < count; i++) {
    const t = rrange(rng, 0.12, 0.92);
    const a = rng() * Math.PI * 2;
    const r = p.radius * Math.pow(Math.sin(Math.PI * t), 0.52) * 0.92;
    const bow = Math.sin(Math.PI * t);
    const cx = p.bend * bow + Math.cos(a) * r;
    const cy = -Math.sin(Math.PI * t) * p.radius * 0.22 + Math.sin(a) * r;
    const cz = t * p.length;
    const len = rrange(rng, 0.018, 0.062);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), rrange(rng, -0.5, 0.5)).normalize();
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 3; s++) {
      const k = s / 3;
      pts.push(
        new THREE.Vector3(
          cx + dir.x * len * k + Math.sin(k * 6 + i) * len * 0.22,
          cy + dir.y * len * k - k * k * len * 0.4,
          cz + dir.z * len * k + Math.cos(k * 5 + i) * len * 0.18,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 4, rrange(rng, 0.0011, 0.0022), 4, false);
    parts.push(tube);
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}
