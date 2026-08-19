// ---------------------------------------------------------------------------
// The carrot itself: a lathed, gently bent root with growth rings and clinging
// soil, plus a fan of feathery fronds built as curved alpha-mapped ribbons.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, lerp, clamp01, smoothstep } from './util.js';
import { carrotTexture, carrotDirtTexture, leafTexture } from './textures.js';

export const CARROT_LEN = 0.175;   // 17.5 cm - a proper winter carrot
export const CARROT_RAD = 0.0215;  // 4.3 cm across the shoulder

let sharedBodyGeo = null;
let sharedMaps = null;

function carrotMaps(aniso = 4) {
  if (!sharedMaps) {
    const skin = carrotTexture(256, 512);
    const dirt = carrotDirtTexture(256, 512);
    skin.anisotropy = aniso;
    sharedMaps = {
      skin, dirt,
      leaves: [leafTexture(256, 3), leafTexture(256, 11), leafTexture(256, 29)],
    };
  }
  return sharedMaps;
}

/** Root profile, t = 0 at the tip, 1 at the shoulder. */
function radiusAt(t, rad) {
  // fast flare from the tip, near-cylindrical middle, rounded crown
  let r = rad * (0.04 + 0.96 * Math.pow(t, 0.40));
  r *= 1 - 0.10 * Math.pow(t, 3.0);                 // slight waist below crown
  if (t > 0.955) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.955) / 0.045, 2) * 0.82));
  return Math.max(0.0006, r);
}

function buildBodyGeometry(seed = 7) {
  const rng = makeRng(seed);
  const N = 46;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push(new THREE.Vector2(radiusAt(t, CARROT_RAD), t * CARROT_LEN));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // organic pass: gentle bend + surface lumps so it never reads as a cone
  const bendDir = new THREE.Vector2(0.9, 0.44).normalize();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = clamp01(v.y / CARROT_LEN);
    const bend = Math.pow(1 - t, 2.1) * 0.026;
    const ang = Math.atan2(v.z, v.x);
    const lump =
      1 + 0.055 * Math.sin(ang * 3 + t * 11) * (0.35 + t) +
      0.03 * Math.sin(ang * 7 - t * 23) +
      0.022 * Math.sin(t * 47);
    v.x *= lump; v.z *= lump;
    v.x += bendDir.x * bend;
    v.z += bendDir.y * bend;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.translate(0, -CARROT_LEN, 0);   // origin sits at the shoulder
  return geo;
}

/**
 * One frond: a ribbon swept along an out-and-up curve, textured with a
 * feathery carrot leaf. Returns raw arrays to be merged into one mesh.
 */
function frondRibbon(out, azimuth, height, spread, width, roll, tint, texIndex) {
  const SEG = 8;
  const dirX = Math.cos(azimuth), dirZ = Math.sin(azimuth);
  const p = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3();

  const curveAt = (t, target) => {
    // cubic-ish arc: shoots up, then leans outward and nods over at the tip
    const y = height * (1.06 * t - 0.06 * t * t * t) * (1 - 0.10 * t * t);
    const rad = spread * (t * t * (0.55 + 0.45 * t)) + 0.010;
    target.set(dirX * rad, y, dirZ * rad);
    return target;
  };

  const base = out.position.length / 3;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    curveAt(t, p);
    curveAt(Math.max(0, t - 0.02), prev);
    tangent.subVectors(p, prev).normalize();
    if (tangent.lengthSq() < 1e-6) tangent.copy(up);
    side.set(-dirZ, 0, dirX);
    // roll the ribbon so the fan has real volume instead of reading as cards
    const r = roll * t;
    const rotAxis = tangent;
    side.applyAxisAngle(rotAxis, r).normalize();
    nrm.crossVectors(tangent, side).normalize();
    const w = width * (0.62 + 0.5 * Math.sin(Math.PI * Math.pow(t, 0.85))) * 0.5;
    for (let s = -1; s <= 1; s += 2) {
      out.position.push(p.x + side.x * w * s, p.y + side.y * w * s, p.z + side.z * w * s);
      out.normal.push(nrm.x, nrm.y, nrm.z);
      out.uv.push(s < 0 ? 0 : 1, t);
      out.color.push(tint.r, tint.g, tint.b);
      out.texid.push(texIndex);
    }
  }
  for (let i = 0; i < SEG; i++) {
    const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
    out.index.push(a, c, b, b, c, d);
  }
}

function buildLeafGeometry(seed, fronds, height) {
  const rng = makeRng(seed);
  const out = { position: [], normal: [], uv: [], color: [], index: [], texid: [] };
  for (let i = 0; i < fronds; i++) {
    const az = (i / fronds) * Math.PI * 2 + rng() * 0.55;
    const outer = i % 3 !== 0;                       // some stand tall, some lean
    const h = height * (outer ? 0.70 + rng() * 0.30 : 0.92 + rng() * 0.22);
    const spread = outer ? 0.085 + rng() * 0.085 : 0.024 + rng() * 0.045;
    const w = 0.090 + rng() * 0.055;
    const roll = (rng() - 0.5) * 1.5;
    const l = 0.82 + rng() * 0.36;
    const tint = new THREE.Color(l * (0.86 + rng() * 0.2), l, l * (0.72 + rng() * 0.2));
    frondRibbon(out, az, h, spread, w, roll, tint, i % 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  g.setIndex(out.index);
  g.computeBoundingSphere();
  return g;
}

/**
 * A whole plant. The group origin sits at the soil line: the root hangs
 * below it, the fronds rise above it, so "pulling" is just moving the group up.
 */
export function makeCarrotPlant(opts = {}) {
  const { seed = 1, aniso = 4, leafHeight = 0.225, fronds = 14 } = opts;
  const maps = carrotMaps(aniso);
  if (!sharedBodyGeo) sharedBodyGeo = buildBodyGeometry();

  const group = new THREE.Group();

  // --- root ---------------------------------------------------------------
  const bodyMat = new THREE.MeshStandardMaterial({
    map: maps.skin,
    roughness: 0.62,
    metalness: 0.0,
  });
  bodyMat.userData.uDirt = { value: 0.80 };
  bodyMat.customProgramCacheKey = () => 'carrotbody';
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDirtMap = { value: maps.dirt };
    sh.uniforms.uDirt = bodyMat.userData.uDirt;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        uniform sampler2D uDirtMap;
        uniform float uDirt;
        float gDirtAmt;
      `)
      .replace('#include <map_fragment>', /* glsl */`
        #include <map_fragment>
        vec4 dirtTex = texture2D(uDirtMap, vMapUv);
        gDirtAmt = dirtTex.a * uDirt;
        diffuseColor.rgb = mix(diffuseColor.rgb, dirtTex.rgb * 0.92, gDirtAmt);
      `)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.95, gDirtAmt);
      `);
  };
  const body = new THREE.Mesh(sharedBodyGeo, bodyMat);
  body.castShadow = true;
  body.name = 'carrotBody';
  group.add(body);

  // --- fronds -------------------------------------------------------------
  const leafGeo = buildLeafGeometry(seed * 131 + 7, fronds, leafHeight);
  const leafMat = new THREE.MeshStandardMaterial({
    map: maps.leaves[seed % maps.leaves.length],
    alphaTest: 0.30,
    side: THREE.DoubleSide,
    roughness: 0.80,
    metalness: 0.0,
    vertexColors: true,
    // carrot tops are thin enough to glow a little in winter light
    emissive: new THREE.Color(0x1d3a12),
    emissiveIntensity: 1.0,
  });
  leafMat.userData.uStretch = { value: 0 };
  leafMat.userData.uWind = { value: 0 };
  leafMat.customProgramCacheKey = () => 'carrotleaf';
  leafMat.onBeforeCompile = (sh) => {
    sh.uniforms.uStretch = leafMat.userData.uStretch;
    sh.uniforms.uWind = leafMat.userData.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uStretch;\nuniform float uWind;`)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        float lt = clamp(transformed.y / 0.24, 0.0, 1.0);
        // gathered and stretched while the child hauls on them
        transformed.xz *= mix(1.0, 0.55, uStretch * lt);
        transformed.y *= 1.0 + uStretch * 0.30 * lt;
        transformed.x += sin(uWind * 1.7 + transformed.z * 9.0) * 0.006 * lt;
        transformed.z += cos(uWind * 1.3 + transformed.x * 8.0) * 0.006 * lt;
      `);
  };
  const leaves = new THREE.Mesh(leafGeo, leafMat);
  leaves.castShadow = true;
  leaves.name = 'carrotLeaves';
  group.add(leaves);

  // Radial silhouette of the tops: the tallest point of the plant at each
  // distance from its centre. The snow layer uses this to guarantee that a
  // buried carrot is genuinely invisible, however the fronds happened to fan.
  const BIN = 0.030;
  const SLOPE = 0.62;          // how steeply settled snow can lie, ~32 degrees
  const profile = [];
  {
    const raw = [];
    const pos = leafGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const b = Math.round(Math.hypot(x, z) / BIN);
      while (raw.length <= b) raw.push(0);
      if (y > raw[b]) raw[b] = y;
    }
    // Drape a cone over the silhouette: the snow that hides the plant then has
    // the shape of a real drift lying over a bump, not a flat-topped plateau.
    const reach = Math.ceil((Math.max(...raw) / SLOPE) / BIN) + raw.length + 1;
    for (let i = 0; i < reach; i++) {
      let m = 0;
      for (let j = 0; j < raw.length; j++) {
        const v = raw[j] - Math.abs(i - j) * BIN * SLOPE;
        if (v > m) m = v;
      }
      profile.push(m);
    }
    // snow lying over a ring of leaves fills the dip in the middle too
    for (let i = profile.length - 2; i >= 0; i--) {
      profile[i] = Math.max(profile[i], profile[i + 1]);
    }
  }

  group.userData = {
    body, leaves, bodyMat, leafMat, leafProfile: { bin: BIN, max: profile },
    setDirt: (v) => { bodyMat.userData.uDirt.value = v; },
    setStretch: (v) => { leafMat.userData.uStretch.value = v; },
    setWind: (v) => { leafMat.userData.uWind.value = v; },
    leafHeight,
  };
  return group;
}

/** A mound of soil sitting over the crown, brushed away to free the leaves. */
export function makeSoilCap(soilMap, soilBump) {
  const geo = new THREE.SphereGeometry(0.100, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lump = 1 + 0.13 * Math.sin(v.x * 62) * Math.cos(v.z * 55) + 0.07 * Math.sin(v.y * 90);
    v.multiplyScalar(lump);
    v.y *= 0.55;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const map = soilMap.clone();
  map.repeat.set(3, 3);
  map.needsUpdate = true;
  const bump = soilBump.clone();
  bump.repeat.set(3, 3);
  bump.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    map, bumpMap: bump, bumpScale: 0.4,
    roughness: 0.9, metalness: 0,
    color: 0xb9b0a4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'soilCap';
  return mesh;
}

/** The dark socket left in the earth once the root comes free. */
export function makeHole(soilMap) {
  const geo = new THREE.CylinderGeometry(0.036, 0.014, 0.12, 20, 3, true);
  geo.translate(0, -0.055, 0);
  const map = soilMap.clone();
  map.repeat.set(2, 1);
  map.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    map, color: 0x6b5c4b, side: THREE.BackSide,
    roughness: 0.98, metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'hole';
  return mesh;
}

let harvestParts = null;

/** Small standalone carrot used for the ones already in the crate. */
export function makeHarvestedCarrot(aniso = 4) {
  if (!harvestParts) {
    const maps = carrotMaps(aniso);
    if (!sharedBodyGeo) sharedBodyGeo = buildBodyGeometry();
    harvestParts = {
      bodyMat: new THREE.MeshStandardMaterial({ map: maps.skin, roughness: 0.66 }),
      stubGeo: new THREE.ConeGeometry(0.012, 0.05, 8),
      stubMat: new THREE.MeshStandardMaterial({ color: 0x5c7a33, roughness: 0.8 }),
    };
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedBodyGeo, harvestParts.bodyMat);
  body.castShadow = true;
  g.add(body);
  const stub = new THREE.Mesh(harvestParts.stubGeo, harvestParts.stubMat);
  stub.position.y = 0.022;
  g.add(stub);
  return g;
}

export { carrotMaps };
