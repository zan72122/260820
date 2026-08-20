/**
 * Goldfish — built, not approximated.
 *
 * A capsule with a triangle stuck on the back is the one thing this game
 * cannot do: the child has to see a head, a body, a wrist of a tail, a tail
 * fin and pectorals, because that silhouette is what makes the moment the
 * fish breaks the surface land. So the body is a real lofted surface and the
 * fins are real shaped membranes — but there are only a handful of them on
 * screen, and the swimming is a vertex-shader travelling wave rather than a
 * skeleton.
 *
 * Local axes: +Z is forward (the snout), +Y is up, X is lateral (the wave).
 */

import * as THREE from 'three';
import { clamp, lerp } from '../core/Rng.js';

/** Body height along the fish, 0 = snout, 1 = wrist of the tail. */
const GIRTH = [
  [0.0, 0.05],
  [0.05, 0.33],
  [0.12, 0.58],
  [0.22, 0.82],
  [0.34, 0.98],
  [0.44, 1.0],
  [0.56, 0.92],
  [0.68, 0.7],
  [0.79, 0.46],
  [0.88, 0.28],
  [0.95, 0.18],
  [1.0, 0.13],
];

function sampleCurve(curve, u) {
  const t = clamp(u, 0, 1);
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      const k = (t - x0) / Math.max(x1 - x0, 1e-6);
      const s = k * k * (3 - 2 * k);
      return lerp(y0, y1, s);
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * @param {object} spec
 * @param {number} spec.length      snout-to-wrist, metres
 * @param {number} spec.depth       body height as a fraction of length
 * @param {number} spec.plump       lateral thickness as a fraction of body height
 */
export function buildFishBody(spec, stations = 20, around = 14) {
  const L = spec.length;
  const H = L * spec.depth;
  const pos = [];
  const nrm = [];
  const uvs = [];
  const aU = [];
  const idx = [];

  for (let i = 0; i <= stations; i++) {
    const u = i / stations;
    const g = sampleCurve(GIRTH, u);
    // The tail wrist is squeezed flat sideways, the belly stays round.
    const wScale = spec.plump * (1 - 0.42 * Math.max(0, (u - 0.62) / 0.38));
    const h = H * g;
    const w = H * g * wScale;
    // Backbone: a slight arch, the belly hanging a touch lower at midbody.
    const yOff = -H * 0.055 * Math.sin(Math.PI * clamp((u - 0.1) / 0.8, 0, 1));
    const z = L * (0.5 - u);

    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Fuller below the waterline of the body, a sharper ridge along the back.
      const belly = ca < 0 ? 1.06 : 0.96 + 0.06 * Math.pow(Math.abs(ca), 3);
      pos.push(sa * w, ca * h * belly + yOff, z);
      nrm.push(sa / Math.max(w, 1e-5), ca / Math.max(h, 1e-5), 0);
      uvs.push(u, j / around);
      aU.push(u);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < around; j++) {
      const j1 = (j + 1) % around;
      const a = i * around + j;
      const b = i * around + j1;
      const c = (i + 1) * around + j;
      const d = (i + 1) * around + j1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A flat membrane described by its outline; used for every fin. */
function membrane({ rows = 6, cols = 8, point, uAt }) {
  const pos = [];
  const uvs = [];
  const aU = [];
  const idx = [];
  for (let i = 0; i <= rows; i++) {
    const s = i / rows;
    for (let j = 0; j <= cols; j++) {
      const t = (j / cols) * 2 - 1;
      const p = point(s, t);
      pos.push(p.x, p.y, p.z);
      uvs.push(s, t * 0.5 + 0.5);
      aU.push(uAt(s, t));
    }
  }
  const w = cols + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * w + j;
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildFishFins(spec) {
  const L = spec.length;
  const H = L * spec.depth;
  const wristZ = -L * 0.5;
  const parts = [];

  // Caudal fin: forked, translucent, and by far the loudest part of the swim.
  const tailLen = L * spec.tail;
  const tailSpan = H * 0.92;
  parts.push(
    membrane({
      rows: 7,
      cols: 10,
      point: (s, t) => {
        const fork = 1 - 0.46 * Math.exp(-Math.pow(t * 2.6, 2));
        const span = tailSpan * (0.2 + 0.8 * Math.pow(s, 0.62));
        const trail = Math.sin(t * 5.2) * 0.035 * s * tailLen;
        return {
          x: Math.sin(t * 1.4) * 0.1 * s * tailLen,
          y: t * span,
          z: wristZ - s * tailLen * fork + trail,
        };
      },
      uAt: (s) => 1.0 + s * 0.62,
    })
  );

  // Dorsal.
  parts.push(
    membrane({
      rows: 4,
      cols: 6,
      point: (s, t) => {
        const u0 = 0.3;
        const u1 = 0.63;
        const k = t * 0.5 + 0.5;
        const u = lerp(u0, u1, k);
        const base = sampleCurve(GIRTH, u) * H;
        const h = H * 0.42 * (1 - Math.pow(Math.abs(t), 1.7)) * s;
        return { x: 0, y: base + h, z: L * (0.5 - u) + s * L * 0.03 };
      },
      uAt: (s, t) => lerp(0.3, 0.63, t * 0.5 + 0.5),
    })
  );

  // Anal fin.
  parts.push(
    membrane({
      rows: 3,
      cols: 5,
      point: (s, t) => {
        const u = lerp(0.7, 0.88, t * 0.5 + 0.5);
        const base = -sampleCurve(GIRTH, u) * H;
        const h = H * 0.3 * (1 - Math.pow(Math.abs(t), 1.6)) * s;
        return { x: 0, y: base - h, z: L * (0.5 - u) - s * L * 0.02 };
      },
      uAt: (s, t) => lerp(0.7, 0.88, t * 0.5 + 0.5),
    })
  );

  // Pectorals, one per side, angled out and back.
  for (const side of [-1, 1]) {
    parts.push(
      membrane({
        rows: 3,
        cols: 5,
        point: (s, t) => {
          const u = 0.26;
          const base = sampleCurve(GIRTH, u) * H;
          const len = L * 0.24 * s;
          const spread = (t * 0.5 + 0.5) * 0.9 + 0.1;
          return {
            x: side * (base * 0.52 + len * 0.8 * spread),
            y: -base * 0.25 - len * 0.34 * (1 - spread),
            z: L * (0.5 - u) - len * 0.85,
          };
        },
        // Pectorals flutter on their own, faster than the body wave.
        uAt: () => -1.0,
      })
    );
  }

  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Minimal position/uv/aU geometry merge — avoids pulling in an addon. */
function mergeGeometries(list) {
  let vCount = 0;
  let iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const au = new Float32Array(vCount);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    au.set(g.attributes.aU.array, vo);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('aU', new THREE.BufferAttribute(au, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * Injects the swimming wave into a standard material.
 * `aU` runs 0 at the snout to 1 at the wrist and past 1 out along the tail
 * fin, so amplitude grows naturally down the body. `aU < 0` marks the
 * pectorals, which flutter on a faster, shallower beat of their own.
 */
export function applySwim(material, uniforms, key = 'fish') {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aU;
         uniform float uTime;
         uniform float uPhase;
         uniform float uWaveAmp;
         uniform float uWaveSpeed;
         uniform float uWaveK;
         uniform float uBurst;
         uniform float uLength;
         uniform float uBend;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float swimU = aU;
         float amp, ph, slope;
         if (swimU < 0.0) {
           // pectoral flutter
           ph = uTime * (uWaveSpeed * 2.35) + uPhase * 1.7;
           amp = uWaveAmp * 0.22 * uLength;
           transformed.y += sin(ph) * amp * 0.55;
           transformed.x += cos(ph * 0.83) * amp * 0.32;
           slope = 0.0;
         } else {
           amp = uWaveAmp * (0.05 + swimU * swimU * 1.05) * uLength * (1.0 + uBurst * 2.2);
           ph = swimU * uWaveK - uTime * uWaveSpeed * (1.0 + uBurst * 1.6) + uPhase;
           transformed.x += sin(ph) * amp;
           // a steady sideways lean while the fish turns
           transformed.x += uBend * swimU * swimU * uLength * 0.6;
           slope = cos(ph) * amp * uWaveK;
         }
         {
           float ang = -atan(slope);
           float ca = cos(ang), sa = sin(ang);
           objectNormal = vec3(
             ca * objectNormal.x + sa * objectNormal.z,
             objectNormal.y,
             -sa * objectNormal.x + ca * objectNormal.z
           );
           #ifdef USE_TANGENT
             vec3 t = objectTangent;
             objectTangent = vec3(ca * t.x + sa * t.z, t.y, -sa * t.x + ca * t.z);
           #endif
         }`
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // A wet rim: light wrapping round a body that has just left the water.
       float rimF = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
       gl_FragColor.rgb += vec3(1.0, 0.72, 0.44) * rimF * 0.30;`
    );
  };
  material.customProgramCacheKey = () => `fish-swim-${key}`;
  return material;
}

export function makeSwimUniforms(spec) {
  return {
    uTime: { value: 0 },
    uPhase: { value: spec.phase },
    uWaveAmp: { value: spec.waveAmp },
    uWaveSpeed: { value: spec.waveSpeed },
    uWaveK: { value: spec.waveK },
    uBurst: { value: 0 },
    uLength: { value: spec.length },
    uBend: { value: 0 },
  };
}
