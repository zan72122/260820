/**
 * The hero prop.
 *
 * `buildWhole()`  – the intact fruit: a real ellipsoid (never a sphere), with
 *                   low-frequency lumpiness so the silhouette is not symmetric.
 * `buildBroken()` – a small number of large, hand-authored chunks. Each chunk is
 *                   an angular sector of the same ellipsoid, closed by two
 *                   fracture faces that carry a real cross-section (thick green
 *                   rind → pale inner rind → red flesh → seeds). No fragment
 *                   physics: the break is keyframed so it always lands well.
 */
import * as THREE from 'three';
import { makeRindMaps, makeCrossSectionMaps, makeRng } from '../textures.js';

export const MELON = { rx: 0.176, ry: 0.198, rz: 0.176 };

/** Low-frequency lumpiness shared by the whole fruit and every chunk. */
function lump(theta, phi) {
  return 1
    + 0.019 * Math.sin(theta * 2.0 + 0.7) * Math.sin(phi * 1.6)
    + 0.012 * Math.sin(theta * 3.0 - 1.9) * Math.sin(phi * 2.4 + 0.5)
    - 0.026 * Math.pow(Math.cos(phi), 6);        // slightly flattened poles
}

function surfacePoint(theta, phi, target = new THREE.Vector3()) {
  const k = lump(theta, phi);
  return target.set(
    MELON.rx * k * Math.sin(phi) * Math.cos(theta),
    MELON.ry * k * Math.cos(phi),
    MELON.rz * k * Math.sin(phi) * Math.sin(theta),
  );
}

/** Horizontal radius of the ellipsoid at a given azimuth. */
function horizRadius(theta) {
  const c = Math.cos(theta) / MELON.rx, s = Math.sin(theta) / MELON.rz;
  return 1 / Math.sqrt(c * c + s * s);
}

let rindMaps = null;
let sectionMaps = null;

function getMaps(quality) {
  if (!rindMaps) rindMaps = makeRindMaps(quality.rindTexture);
  if (!sectionMaps) sectionMaps = makeCrossSectionMaps(quality.sectionTexture);
  return { rindMaps, sectionMaps };
}

function rindMaterial(maps) {
  return new THREE.MeshPhysicalMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.28,          // the waxy bloom of a fresh rind
    clearcoatRoughness: 0.55,
    sheen: 0.15,
    sheenColor: new THREE.Color(0x9fd46a),
  });
}

function fleshMaterial(maps) {
  return new THREE.MeshPhysicalMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 1.0,
    metalness: 0.0,
    // wet, freshly torn — but restrained: a mirror-bright clearcoat turns the
    // whole cut face into a white highlight in direct midday sun
    clearcoat: 0.34,
    clearcoatRoughness: 0.38,
    sheen: 0.10,
    sheenColor: new THREE.Color(0xff8a80),
    side: THREE.DoubleSide,
  });
}

/* ------------------------------------------------------------------ */

export function buildWhole(quality) {
  const { rindMaps: maps } = getMaps(quality);
  const seg = quality.melonSegments;
  const geo = new THREE.SphereGeometry(1, seg, seg >> 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const phi = Math.acos(THREE.MathUtils.clamp(v.y, -1, 1));
    const theta = Math.atan2(v.z, v.x);
    surfacePoint(theta, phi, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, rindMaterial(maps));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.add(buildStem());
  group.userData.radius = MELON.ry;
  return group;
}

function buildStem() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, MELON.ry * 0.96, 0),
    new THREE.Vector3(0.012, MELON.ry * 1.05, 0.008),
    new THREE.Vector3(0.004, MELON.ry * 1.10, 0.026),
    new THREE.Vector3(-0.016, MELON.ry * 1.09, 0.034),
  ]);
  const geo = new THREE.TubeGeometry(curve, 14, 0.0085, 7, false);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f7a3a, roughness: 0.92 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/* ------------------------------------------------------------------ *
 * broken fruit
 * ------------------------------------------------------------------ */

/** Crack lines wander with height instead of being straight vertical cuts. */
function makeBoundary(baseTheta, rng) {
  const a1 = (rng() - 0.5) * 0.30, a2 = (rng() - 0.5) * 0.18, ph = rng() * 6.28;
  return (phi) => baseTheta
    + a1 * Math.sin(phi * 1.7 + ph)
    + a2 * Math.sin(phi * 3.3 - ph * 0.7);
}

function sectorGeometry(bA, bB, quality) {
  const nPhi = quality.chunkPhi, nTheta = quality.chunkTheta;
  const positions = [], uvs = [], indices = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= nPhi; i++) {
    const phi = (i / nPhi) * Math.PI;
    const t0 = bA(phi), t1 = bB(phi);
    for (let j = 0; j <= nTheta; j++) {
      const f = j / nTheta;
      const theta = t0 + (t1 - t0) * f;
      surfacePoint(theta, phi, v);
      positions.push(v.x, v.y, v.z);
      // keep the rind texture continuous with the intact fruit
      uvs.push((theta / (Math.PI * 2) + 0.5), 1 - phi / Math.PI);
    }
  }
  for (let i = 0; i < nPhi; i++) {
    for (let j = 0; j < nTheta; j++) {
      const a = i * (nTheta + 1) + j;
      const b = a + nTheta + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * One fracture face: the half cross-section from the core out to the skin,
 * roughened so the break never looks like a knife cut.
 */
function faceGeometry(boundary, flip, quality, rng) {
  const nPhi = quality.chunkPhi, nR = quality.chunkRadial;
  const positions = [], uvs = [], indices = [];
  const rot = rng() * Math.PI * 2;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const wob = (a, b) => Math.sin(a * 5.3 + b * 3.1) * Math.sin(a * 2.1 - b * 7.7);

  for (let i = 0; i <= nPhi; i++) {
    const phi = (i / nPhi) * Math.PI;
    const theta = boundary(phi);
    const R = horizRadius(theta) * lump(theta, phi);
    const ux = Math.cos(theta), uz = Math.sin(theta);
    // in-plane normal, used to give the torn face relief
    const nx = -Math.sin(theta) * (flip ? -1 : 1), nz = Math.cos(theta) * (flip ? -1 : 1);
    for (let j = 0; j <= nR; j++) {
      const t = j / nR;
      const rad = t * R * Math.sin(phi);
      const y = MELON.ry * lump(theta, phi) * Math.cos(phi);
      // torn relief: strongest in the flesh, calmer through the rind
      const relief = 0.0075 * wob(t * 4 + i * 0.2, phi * 2) * Math.sin(Math.PI * Math.min(1, t * 1.15));
      positions.push(
        ux * rad + nx * relief,
        y,
        uz * rad + nz * relief,
      );
      // radial mapping onto the circular cross-section texture
      const px = 0.965 * t * Math.sin(phi) * (flip ? -1 : 1);
      const py = 0.965 * Math.cos(phi);
      const rx = px * cr - py * sr, ry2 = px * sr + py * cr;
      uvs.push(0.5 + rx * 0.5, 0.5 - ry2 * 0.5);
    }
  }
  for (let i = 0; i < nPhi; i++) {
    for (let j = 0; j < nR; j++) {
      const a = i * (nR + 1) + j;
      const b = a + nR + 1;
      if (flip) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build `count` big chunks plus loose seeds. Everything is returned still
 * assembled at the origin; `game.js` keyframes them apart on impact.
 */
export function buildBroken(quality, seed = 20260820, count = 3) {
  const rng = makeRng(seed);
  const { rindMaps: rm, sectionMaps: sm } = getMaps(quality);
  const rindMat = rindMaterial(rm);
  const fleshMat = fleshMaterial(sm);

  // uneven wedge widths — a real melon never splits into equal thirds
  const cuts = [];
  let acc = 0;
  const weights = [];
  for (let i = 0; i < count; i++) weights.push(0.7 + rng() * 0.6);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    cuts.push(acc / total * Math.PI * 2);
    acc += weights[i];
  }
  const boundaries = cuts.map((c) => makeBoundary(c, rng));

  const group = new THREE.Group();
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const bA = boundaries[i];
    const bB = (phi) => boundaries[(i + 1) % count](phi) + (i === count - 1 ? Math.PI * 2 : 0);

    const chunk = new THREE.Group();
    const rind = new THREE.Mesh(sectorGeometry(bA, bB, quality), rindMat);
    rind.castShadow = true; rind.receiveShadow = true;
    chunk.add(rind);

    const fa = new THREE.Mesh(faceGeometry(bA, true, quality, rng), fleshMat);
    const fb = new THREE.Mesh(faceGeometry(bB, false, quality, rng), fleshMat);
    fa.castShadow = fb.castShadow = true;
    fa.receiveShadow = fb.receiveShadow = true;
    chunk.add(fa, fb);

    // outward direction of this wedge, used for the keyframed tumble
    const mid = (bA(Math.PI / 2) + bB(Math.PI / 2)) * 0.5;
    chunk.userData.out = new THREE.Vector3(Math.cos(mid), 0, Math.sin(mid));
    chunk.userData.index = i;
    group.add(chunk);
    chunks.push(chunk);
  }

  const seeds = buildSeeds(rng, quality);
  group.add(seeds.group);

  group.userData.chunks = chunks;
  group.userData.seeds = seeds;
  return group;
}

function buildSeeds(rng, quality) {
  const n = quality.seedCount;
  const geo = new THREE.SphereGeometry(1, 7, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * 0.0042, pos.getY(i) * 0.0072, pos.getZ(i) * 0.0016);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x18100a, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const state = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const sp = 0.55 + rng() * 1.5;
    state.push({
      p0: new THREE.Vector3(Math.cos(a) * 0.03, MELON.ry * (0.3 + rng() * 0.5), Math.sin(a) * 0.03),
      v: new THREE.Vector3(Math.cos(a) * sp * 0.32, 0.8 + rng() * 1.0, Math.sin(a) * sp * 0.32),
      spin: new THREE.Vector3(rng() * 8 - 4, rng() * 8 - 4, rng() * 8 - 4),
      rot: new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28),
      rest: 0,
    });
    dummy.position.copy(state[i].p0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = false;
  return { group: mesh, mesh, state, dummy };
}

export function disposeMelonTextureCache() {
  rindMaps = null;
  sectionMaps = null;
}
