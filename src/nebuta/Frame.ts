/**
 * The skeleton the child finds on the workbench at the start of the game.
 *
 * Bamboo hoops and ribs, cedar base members and posts, thin steel wire for the tail and the
 * wave scrolls, paper cord at the lashings. Three materials, clearly different under light,
 * and deliberately hard to read as a finished shape until paper turns the lines into faces.
 */

import {
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { bambooTextures, cordTextures, metalTextures, woodTextures } from '../util/textures';
import { buildTubes, pathsToCapsules, type CapsuleSeg, type TubePath } from '../util/tube';
import {
  NEBUTA,
  WAVES,
  bodyAxisX,
  bodyAxisY,
  bodyPoint,
  dorsalPoint,
  pectoralPoint,
  tailPoint,
  wavePoint,
} from './shape';
import type { QualitySettings } from '../core/Quality';
const _a = new Vector3();
const _bb = new Vector3();
const _c = new Vector3();
function bodyInward(u: number, v: number, dist: number, out = new Vector3()): Vector3 {
  bodyPoint(u, v, out);
  _a.set(bodyAxisX(u), bodyAxisY(u), 0);
  _bb.subVectors(out, _a).normalize();
  return out.addScaledVector(_bb, -dist);
}
function patchNormal(
  fn: (a: number, b: number, o: Vector3) => Vector3,
  a: number,
  b: number,
  out = new Vector3(),
): Vector3 {
  const e = 0.004;
  fn(Math.min(1, a + e), b, _a);
  fn(Math.max(0, a - e), b, _bb);
  const du = _a.clone().sub(_bb);
  fn(a, Math.min(1, b + e), _a);
  fn(a, Math.max(0, b - e), _bb);
  const dv = _a.clone().sub(_bb);
  return out.crossVectors(du, dv).normalize();
}
export interface FrameBuild {
  group: Group;
  capsules: CapsuleSeg[];
  dispose(): void;
}
export function buildFrame(quality: QualitySettings): FrameBuild {
  const bamboo: TubePath[] = [];
  const wire: TubePath[] = [];
  const wood: TubePath[] = [];
  const joints: { p: Vector3; n: Vector3; scale: number }[] = [];
  const ringUs = [0.035, 0.13, 0.245, 0.375, 0.51, 0.65, 0.79, 0.92, 0.985];
  const ribVs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  const ringSteps = quality.tier === 'low' ? 22 : 34;
  const ribSteps = quality.tier === 'low' ? 18 : 28;
  // --- body hoops
  for (const u of ringUs) {
    const pts: Vector3[] = [];
    for (let i = 0; i < ringSteps; i++) pts.push(bodyInward(u, i / ringSteps, 0.014));
    bamboo.push({ points: pts, radius: 0.0135, closed: true, vScale: 4 });
  }
  // --- longitudinal ribs
  for (const v of ribVs) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= ribSteps; i++) pts.push(bodyInward(i / ribSteps, v, 0.014));
    bamboo.push({ points: pts, radius: 0.0125, vScale: 6 });
  }
  // --- lashings where hoops cross ribs
  for (const u of ringUs) {
    for (const v of ribVs) {
      const p = bodyInward(u, v, 0.014);
      const n = new Vector3(0, 0, 0);
      bodyPoint(u, v, _c);
      n.set(_c.x - bodyAxisX(u), _c.y - bodyAxisY(u), _c.z).normalize();
      joints.push({ p, n, scale: 0.9 + 0.25 * Math.sin(u * 31 + v * 17) });
    }
  }
  // --- eye rings: thin wire circles the child later inks over
  for (const side of [1, -1]) {
    const v = side > 0 ? 0.225 : 0.775;
    const centre = bodyPoint(0.115, v, new Vector3());
    const n = patchNormal((a, b, o) => bodyPoint(a, b, o), 0.115, v);
    const t1 = new Vector3(0, 1, 0).cross(n).normalize();
    const t2 = new Vector3().crossVectors(n, t1).normalize();
    const pts: Vector3[] = [];
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      pts.push(
        centre
          .clone()
          .addScaledVector(t1, Math.cos(ang) * 0.085)
          .addScaledVector(t2, Math.sin(ang) * 0.085)
          .addScaledVector(n, -0.012),
      );
    }
    wire.push({ points: pts, radius: 0.0062, closed: true });
  }
  // --- tail veil: bamboo outline plus radiating wire ribs
  for (const side of [1, -1]) {
    const outline: Vector3[] = [];
    for (let i = 0; i <= 22; i++) outline.push(tailPoint(1, i / 22, side, new Vector3()));
    bamboo.push({ points: outline, radius: 0.009, vScale: 5 });
    const root: Vector3[] = [];
    for (let i = 0; i <= 10; i++) root.push(tailPoint(0.03, i / 10, side, new Vector3()));
    bamboo.push({ points: root, radius: 0.011 });
    for (let r = 0; r < 6; r++) {
      const t = 0.08 + (r / 5) * 0.84;
      const pts: Vector3[] = [];
      for (let i = 0; i <= 14; i++) pts.push(tailPoint(i / 14, t, side, new Vector3()));
      wire.push({ points: pts, radius: 0.0068, taper: (s) => 1 - 0.3 * s });
    }
    for (const s of [0.42, 0.74]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 14; i++) pts.push(tailPoint(s, i / 14, side, new Vector3()));
      wire.push({ points: pts, radius: 0.0056 });
    }
  }
  // --- pectoral fins and dorsal fin (teacher-made small parts)
  for (const side of [1, -1]) {
    for (let r = 0; r < 4; r++) {
      const t = 0.12 + (r / 3) * 0.76;
      const pts: Vector3[] = [];
      for (let i = 0; i <= 8; i++) pts.push(pectoralPoint(i / 8, t, side, new Vector3()));
      wire.push({ points: pts, radius: 0.006, taper: (s) => 1 - 0.3 * s });
    }
    const edge: Vector3[] = [];
    for (let i = 0; i <= 10; i++) edge.push(pectoralPoint(1, i / 10, side, new Vector3()));
    wire.push({ points: edge, radius: 0.0056 });
  }
  for (let r = 0; r < 5; r++) {
    const t = 0.08 + (r / 4) * 0.84;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) pts.push(dorsalPoint(i / 8, t, new Vector3()));
    wire.push({ points: pts, radius: 0.006 });
  }
  const dorsalEdge: Vector3[] = [];
  for (let i = 0; i <= 12; i++) dorsalEdge.push(dorsalPoint(1, i / 12, new Vector3()));
  bamboo.push({ points: dorsalEdge, radius: 0.008 });
  // --- wave crests: bamboo spine, wire scrolls
  for (const spec of WAVES) {
    for (const t of [0.06, 0.94]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 18; i++) pts.push(wavePoint(spec, i / 18, t, new Vector3()));
      bamboo.push({ points: pts, radius: 0.0105, vScale: 5 });
    }
    for (let r = 0; r < 4; r++) {
      const t = 0.22 + (r / 3) * 0.56;
      const pts: Vector3[] = [];
      for (let i = 0; i <= 16; i++) pts.push(wavePoint(spec, i / 16, t, new Vector3()));
      wire.push({ points: pts, radius: 0.0065, taper: (s) => 1 - 0.3 * s });
    }
    for (const s of [0.3, 0.62, 0.9]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 12; i++) pts.push(wavePoint(spec, s, i / 12, new Vector3()));
      wire.push({ points: pts, radius: 0.0056 });
    }
  }
  // --- cedar base and posts
  const deck = NEBUTA.deckY;
  const bx = 0.74;
  const bz = 0.36;
  wood.push({
    points: [
      new Vector3(bx, deck, bz),
      new Vector3(-bx, deck, bz),
      new Vector3(-bx, deck, -bz),
      new Vector3(bx, deck, -bz),
    ],
    radius: 0.028,
    closed: true,
    vScale: 8,
  });
  for (const x of [0.36, -0.08, -0.48]) {
    wood.push({
      points: [new Vector3(x, deck, bz), new Vector3(x, deck, -bz)],
      radius: 0.024,
      vScale: 3,
    });
  }
  for (const [u, v] of [
    [0.2, 0.42],
    [0.2, 0.58],
    [0.62, 0.42],
    [0.62, 0.58],
  ] as [number, number][]) {
    const top = bodyInward(u, v, 0.02);
    wood.push({
      points: [new Vector3(top.x, deck, top.z), top],
      radius: 0.021,
      vScale: 4,
    });
  }
  // lamp cross bars
  for (const u of [0.18, 0.45, 0.82]) {
    const y = bodyAxisY(u) - 0.02;
    const r = 0.17;
    wood.push({ points: [new Vector3(bodyAxisX(u), y, r), new Vector3(bodyAxisX(u), y, -r)], radius: 0.016 });
  }
  const bambooTex = bambooTextures(quality.tier === 'low' ? 256 : 512);
  const woodTex = woodTextures(quality.tier === 'low' ? 256 : 512, {
    hueA: '#b19163',
    hueB: '#7c5a37',
    ringFreq: 11,
    wear: 0.34,
  });
  const metalTex = metalTextures(quality.tier === 'low' ? 128 : 256);
  const cordTex = cordTextures(128);
  const bambooMat = new MeshPhysicalMaterial({
    map: bambooTex.map,
    normalMap: bambooTex.normalMap,
    roughnessMap: bambooTex.roughnessMap,
    roughness: 1,
    metalness: 0,
    // young bamboo keeps a waxy skin
    clearcoat: quality.tier === 'high' ? 0.35 : 0,
    clearcoatRoughness: 0.5,
    sheen: 0.15,
    sheenColor: new Color('#d9d09a'),
  });
  const woodMat = new MeshStandardMaterial({
    map: woodTex.map,
    normalMap: woodTex.normalMap,
    roughnessMap: woodTex.roughnessMap,
    roughness: 1,
    metalness: 0,
  });
  const wireMat = new MeshStandardMaterial({
    map: metalTex.map,
    normalMap: metalTex.normalMap,
    roughnessMap: metalTex.roughnessMap,
    color: new Color('#8d8f95'),
    metalness: 0.92,
    roughness: 0.42,
  });
  const cordMat = new MeshStandardMaterial({
    map: cordTex.map,
    normalMap: cordTex.normalMap,
    roughness: 0.94,
    metalness: 0,
  });
  const radial = quality.tier === 'low' ? 4 : 6;
  const geos: BufferGeometry[] = [];
  const group = new Group();
  group.name = 'frame';
  const mkMesh = (paths: TubePath[], mat: MeshStandardMaterial, name: string, rs: number): Mesh => {
    const g = buildTubes(paths, rs);
    geos.push(g);
    const m = new Mesh(g, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  mkMesh(bamboo, bambooMat, 'frame-bamboo', radial);
  mkMesh(wood, woodMat, 'frame-wood', radial);
  mkMesh(wire, wireMat, 'frame-wire', Math.max(3, radial - 2));
  // lashings
  const jointGeo = new TorusGeometry(0.019, 0.0062, 4, 9);
  geos.push(jointGeo);
  const jointMesh = new InstancedMesh(jointGeo, cordMat, joints.length);
  jointMesh.name = 'frame-joints';
  jointMesh.castShadow = false;
  jointMesh.receiveShadow = true;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 0, 1);
  const scl = new Vector3();
  joints.forEach((j, i) => {
    q.setFromUnitVectors(up, j.n);
    scl.set(j.scale, j.scale, j.scale);
    m4.compose(j.p, q, scl);
    jointMesh.setMatrixAt(i, m4);
  });
  jointMesh.instanceMatrix.needsUpdate = true;
  group.add(jointMesh);
  const capsules = [
    ...pathsToCapsules(bamboo, 8),
    ...pathsToCapsules(wire, 6),
    ...pathsToCapsules(wood, 3),
  ];
  return {
    group,
    capsules,
    dispose() {
      for (const g of geos) g.dispose();
      bambooMat.dispose();
      woodMat.dispose();
      wireMat.dispose();
      cordMat.dispose();
    },
  };
}
