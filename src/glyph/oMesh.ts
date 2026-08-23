/**
 * Glyph O as hardware: a ring-gauge with a 12-leaf iris of blackened
 * steel overlap plates. All dimensions come from O_SPEC / the o* functions
 * in spec.ts — the same numbers the collision test uses.
 *
 * Leaves are RIGID: built once, posed by rotation about their pivot pin.
 * No geometry is rewritten while the handle moves.
 *
 * Shell cross-section (revolved): outer wall + top rim, an internal slot
 * housing the leaves and drive ring, and a funnel below that guides a
 * passed ball down into the receiving bowl.
 */
import * as THREE from 'three';
import { O_SPEC, oLeafArcCenterDist, oLeafGamma, oLeafPsi } from './spec';
import type { LabMaterials } from '../core/materials';
import { extrudePolygonXZ, lathe } from '../geo/dynamic';

export const O_MESH = {
  buildWeight: 1,
  leafBottomY: 0.256,
  leafStepY: 0.0019,
  leafThickness: 0.013,
  slotFloorY: 0.232,
  slotCeilY: 0.296,
  rimTopY: 0.345,
  funnelMouthR: 0.352,
  leafTailR: 0.42,
  leafMaxR: 0.55, // leaves stay inside the mechanism drum over full travel
  drumInnerR: 0.56,
  drumOuterR: 0.575,
};

export function leafTopY(): number {
  return O_MESH.leafBottomY + (O_SPEC.leafCount - 1) * O_MESH.leafStepY + O_MESH.leafThickness;
}

/** Max distance from ring center a leaf-local point reaches over the whole
 *  weight range (the leaf rotates about its pivot; distance to pivot is
 *  invariant, azimuth sweeps). */
export function maxRadiusOverTravel(pt: { x: number; z: number }, buildWeight: number): number {
  const px = O_SPEC.pivotR;
  const rho = Math.hypot(pt.x - px, pt.z);
  const eta = Math.atan2(pt.z, pt.x - px); // pivot-local angle at build pose
  let worst = 0;
  for (let i = 0; i <= 24; i++) {
    const w = i / 24;
    const rot = -(oLeafPsi(w) - oLeafPsi(buildWeight));
    const a = eta + rot;
    const r = Math.sqrt(px * px + rho * rho + 2 * px * rho * Math.cos(a));
    if (r > worst) worst = r;
  }
  return worst;
}

/** 2D leaf outline in ring space at build weight (node-safe, testable).
 *
 * Boundary, counter-clockwise in azimuth around the ring center:
 *   outer chain  : root azimuth (behind the pivot) up to the far end, at
 *                  the tail radius, each vertex pulled toward the pivot
 *                  until it stays inside the mechanism drum over travel
 *   inner chain  : the circular cutting edge (defines the counter), then
 *                  the root's inner edge arc back to the start
 */
export function leafPolygon(buildWeight = O_MESH.buildWeight): { x: number; z: number }[] {
  const q = O_SPEC.leafEdgeR;
  const d0 = oLeafArcCenterDist(buildWeight);
  const g0 = oLeafGamma(buildWeight);
  const c = { x: Math.cos(g0) * d0, z: Math.sin(g0) * d0 };
  const toCenter = Math.atan2(-c.z, -c.x);
  const spread = (52 * Math.PI) / 180;
  const nIn = 14;
  // cutting edge samples (convex toward the ring center)
  const edge: { x: number; z: number }[] = [];
  for (let i = 0; i <= nIn; i++) {
    const phi = toCenter - spread + (2 * spread * i) / nIn;
    edge.push({ x: c.x + q * Math.cos(phi), z: c.z + q * Math.sin(phi) });
  }
  const azOf = (p: { x: number; z: number }) => Math.atan2(p.z, p.x);
  // order the edge by descending azimuth (far end first)
  if (azOf(edge[0]) < azOf(edge[edge.length - 1])) edge.reverse();
  const azFar = azOf(edge[0]);
  const azNear = azOf(edge[edge.length - 1]);
  const azRoot = (-15 * Math.PI) / 180;
  const rOut = O_MESH.leafTailR;
  const px = O_SPEC.pivotR;

  const contain = (p: { x: number; z: number }) => {
    let guard = 0;
    while (maxRadiusOverTravel(p, buildWeight) > O_MESH.leafMaxR && guard++ < 300) {
      p.x = px + (p.x - px) * 0.98;
      p.z = p.z * 0.98;
    }
    return p;
  };

  const pts: { x: number; z: number }[] = [];
  // outer chain: root -> far end
  const nOut = 20;
  for (let i = 0; i <= nOut; i++) {
    const a = azRoot + ((azFar - azRoot) * i) / nOut;
    pts.push(contain({ x: rOut * Math.cos(a), z: rOut * Math.sin(a) }));
  }
  // inner chain: cutting edge (far -> near)
  pts.push(...edge);
  // root inner edge: near end azimuth back to root azimuth at r = rootInner
  const rootInner = 0.32;
  const nRoot = 6;
  for (let i = 1; i <= nRoot; i++) {
    const a = azNear + ((azRoot - azNear) * i) / nRoot;
    pts.push({ x: rootInner * Math.cos(a), z: rootInner * Math.sin(a) });
  }
  return pts;
}

/** 2D rotation (in ring plane, CCW+) of every leaf about its own pivot. */
export function leafRotation(weight: number, buildWeight = O_MESH.buildWeight): number {
  return -(oLeafPsi(weight) - oLeafPsi(buildWeight));
}

/** Pivot location of leaf i in ring space (2D angle i*2PI/n). */
export function leafPivot(i: number): { x: number; z: number } {
  const a = (i * 2 * Math.PI) / O_SPEC.leafCount;
  return { x: Math.cos(a) * O_SPEC.pivotR, z: Math.sin(a) * O_SPEC.pivotR };
}

export interface OGauge {
  group: THREE.Group; // gauge-local: ring base at y=0, +Y up (pre-cant)
  setWeight(w: number): void;
  leafTopY: number;
  shellTopY: number;
}

export function makeOGauge(mats: LabMaterials): OGauge {
  const group = new THREE.Group();
  const q = O_SPEC;
  const M = O_MESH;

  // --- the letter itself: funnel + top rim (blackened steel) --------------
  const letterProfile: [number, number][] = [
    [0.285, 0.0], // funnel bottom opening
    [0.285, 0.045],
    [0.31, 0.115],
    [M.funnelMouthR, M.slotFloorY], // funnel mouth
  ];
  letterProfile.reverse(); // top-to-bottom: interior faces the viewer
  const funnel = new THREE.Mesh(lathe(letterProfile, 96), mats.aluminum);
  funnel.castShadow = true;
  funnel.receiveShadow = true;
  group.add(funnel);
  const rimProfile: [number, number][] = [
    [0.365, M.slotCeilY], // rim underside inner edge
    [0.365, 0.338], // rim inner face
    [0.372, M.rimTopY], // chamfer
    [0.414, M.rimTopY], // rim top — the letter's visible top land
    [0.425, 0.334], // chamfer
    [0.425, M.slotCeilY], // rim outer face — a bold step above the housing
  ];
  rimProfile.reverse(); // outer-down start: top land faces up, walls face out
  const rim = new THREE.Mesh(lathe(rimProfile, 128), mats.blackSteel);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  // --- mechanism drum (cast iron housing, one step wider than the letter) -
  const drumProfile: [number, number][] = [
    [M.funnelMouthR, M.slotFloorY], // slot floor from funnel mouth ...
    [M.drumInnerR, M.slotFloorY], // ... out to the drum wall
    [M.drumInnerR, 0.302],
    [0.429, 0.302], // slot ceiling (underside of the 10mm top plate)
    [0.429, 0.312], // inner lip — a 4mm machined seam ring around the letter rim
    [0.555, 0.312], // flat drum top land, below the letter rim
    [0.572, 0.306], // from here down the profile is strictly convex —
    [0.588, 0.29], // a cast bell shape. A concave lip/wall corner made the
    [0.61, 0.245], // silhouette fold into detached-looking dark sails at
    [0.628, 0.17], // grazing tangents on the canted body.
    [0.638, 0.08],
    [0.64, 0.0],
  ];
  drumProfile.reverse(); // bell wall out, land up, slot floor up
  const drum = new THREE.Mesh(lathe(drumProfile, 128), mats.castIron);
  drum.castShadow = true;
  drum.receiveShadow = true;
  group.add(drum);

  // --- iris leaves --------------------------------------------------------
  const poly = leafPolygon();
  const pivot0 = leafPivot(0);
  const local = poly.map((p) => ({ x: p.x - pivot0.x, z: p.z - pivot0.z }));
  const leafGeo = extrudePolygonXZ(local, 0, M.leafThickness);
  const leaves: THREE.Object3D[] = [];
  for (let i = 0; i < q.leafCount; i++) {
    const pivotGroup = new THREE.Group();
    const mesh = new THREE.Mesh(leafGeo, i % 2 ? mats.blackSteel : mats.blackSteelSlide);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    pivotGroup.add(mesh);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.018, 8), mats.brass);
    pin.position.y = 0.005;
    pivotGroup.add(pin);
    const place = new THREE.Group();
    place.rotation.y = -((i * 2 * Math.PI) / q.leafCount);
    pivotGroup.position.set(q.pivotR, M.leafBottomY + i * M.leafStepY, 0);
    place.add(pivotGroup);
    group.add(place);
    leaves.push(pivotGroup);
  }

  // --- synchronizing drive ring in the slot ------------------------------
  const driveRing = new THREE.Group();
  const ringMesh = new THREE.Mesh(
    lathe(
      [
        [0.4, 0.0],
        [0.4, 0.016],
        [0.36, 0.016],
        [0.36, 0.0],
      ],
      64,
    ),
    mats.blackSteelSlide,
  );
  driveRing.add(ringMesh);
  const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.02, 6);
  for (let i = 0; i < q.leafCount; i++) {
    const a = (i * 2 * Math.PI) / q.leafCount + 0.14;
    const p = new THREE.Mesh(pinGeo, mats.brass);
    p.position.set(Math.cos(a) * 0.38, 0.02, Math.sin(a) * 0.38);
    driveRing.add(p);
  }
  driveRing.position.y = M.slotFloorY + 0.003;
  group.add(driveRing);

  const setWeight = (w: number) => {
    const rot = leafRotation(w);
    for (const leaf of leaves) leaf.rotation.y = -rot; // 2D CCW == -Y rotation
    driveRing.rotation.y = -rot * 0.55;
  };
  setWeight(M.buildWeight);

  return { group, setWeight, leafTopY: leafTopY(), shellTopY: M.rimTopY };
}
