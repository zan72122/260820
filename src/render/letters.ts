import * as THREE from 'three';
import { getGlyph } from '../core/glyphs';
import { EM, BASE_Y, LETTER_DEPTH, TRAY_TOP_Y, TRAY_WATER_Y } from '../core/constants';
import {
  makeConcreteMaterial,
  makeSteelMaterial,
  makeWornSteelMaterial,
  makeRubberMaterial,
  applyWetness,
  type WetUniforms,
} from './materials';
import { makeRng } from '../core/math';

export interface LetterRig {
  group: THREE.Group;
  glyphName: string;
  wet: WetUniforms;
  /** meshes that accept pointer-drag hits (letter body + bogie + handle). */
  hitMeshes: THREE.Mesh[];
  bogie: THREE.Group;
  wheels: THREE.Mesh[];
}

/**
 * A precast concrete letter standing on a steel transfer bogie.
 * The glyph contour drives the extrusion; chamfer is kept to 12 mm so the
 * silhouette stays faithful to the typeface.
 */
export function buildLetter(glyphName: string, seed: number): LetterRig {
  const glyph = getGlyph(glyphName);
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const hitMeshes: THREE.Mesh[] = [];

  const shape = new THREE.Shape();
  const outer = glyph.contours[0];
  shape.moveTo(outer[0].x * EM, outer[0].y * EM);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x * EM, outer[i].y * EM);
  shape.closePath();
  for (let h = 1; h < glyph.contours.length; h++) {
    const hole = new THREE.Path();
    const loop = glyph.contours[h];
    hole.moveTo(loop[0].x * EM, loop[0].y * EM);
    for (let i = 1; i < loop.length; i++) hole.lineTo(loop[i].x * EM, loop[i].y * EM);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: LETTER_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -LETTER_DEPTH / 2);

  const mat = makeConcreteMaterial(seed, 0.62);
  const wet = applyWetness(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = BASE_Y;
  group.add(mesh);
  hitMeshes.push(mesh);

  const steel = makeSteelMaterial(seed + 3);
  const rubber = makeRubberMaterial();

  // lifting anchor sockets left in the face (patched but visible)
  const socketGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.015, 12);
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x6e6a63, roughness: 0.8, metalness: 0.25 });
  const w = glyph.width * EM;
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(socketGeo, socketMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(w * (0.3 + 0.4 * i) + (rng() - 0.5) * 0.1, BASE_Y + EM * (0.72 + rng() * 0.16), LETTER_DEPTH / 2 + 0.002);
    group.add(s);
  }

  // ---- transfer bogie -------------------------------------------------
  const bogie = new THREE.Group();
  const frameMat = steel;
  const bw = Math.max(w * 0.92, 0.9);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.14, LETTER_DEPTH + 0.28), frameMat);
  frame.position.set(w / 2, BASE_Y - 0.09, 0);
  frame.castShadow = true;
  frame.receiveShadow = true;
  bogie.add(frame);
  hitMeshes.push(frame);

  // twin longitudinal beams under the frame
  const beamGeo = new THREE.BoxGeometry(bw, 0.08, 0.09);
  for (const zz of [-0.33, 0.33]) {
    const b = new THREE.Mesh(beamGeo, frameMat);
    b.position.set(w / 2, BASE_Y - 0.2, zz);
    b.castShadow = true;
    bogie.add(b);
  }

  // wheels riding the embedded rails
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = makeWornSteelMaterial(seed + 9);
  for (const xx of [w * 0.16, w * 0.84]) {
    for (const zz of [-0.33, 0.33]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(xx, 0.095, zz);
      wheel.castShadow = true;
      bogie.add(wheel);
      wheels.push(wheel);
    }
  }

  // grout pads clamping the letter to the frame
  const padGeo = new THREE.BoxGeometry(0.11, 0.06, 0.1);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x8f8b84, roughness: 0.9 });
  for (const xx of [w * 0.2, w * 0.8]) {
    for (const zz of [-LETTER_DEPTH / 2 - 0.01, LETTER_DEPTH / 2 + 0.01]) {
      const p = new THREE.Mesh(padGeo, padMat);
      p.position.set(xx, BASE_Y - 0.01, zz);
      bogie.add(p);
    }
  }

  // push handle on the bogie front — the drag affordance
  const handle = new THREE.Group();
  const barMat = makeWornSteelMaterial(seed + 21);
  const post = new THREE.CylinderGeometry(0.02, 0.02, 0.26, 10);
  for (const xx of [-0.19, 0.19]) {
    const p = new THREE.Mesh(post, barMat);
    p.position.set(xx, 0.13, 0);
    handle.add(p);
  }
  const barGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.46, 12);
  barGeo.rotateZ(Math.PI / 2);
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.y = 0.27;
  handle.add(bar);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 12).rotateZ(Math.PI / 2), rubber);
  grip.position.y = 0.27;
  handle.add(grip);
  handle.position.set(w / 2, BASE_Y - 0.16, LETTER_DEPTH / 2 + 0.24);
  handle.children.forEach((m) => {
    m.castShadow = true;
  });
  bogie.add(handle);
  // generous invisible hit pad around the handle
  const hitPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.55, 0.5),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitPad.position.copy(handle.position);
  hitPad.position.y += 0.15;
  bogie.add(hitPad);
  hitMeshes.push(hitPad);

  group.add(bogie);
  return { group, glyphName, wet, hitMeshes, bogie, wheels };
}

export interface TrayRig {
  group: THREE.Group;
  water: THREE.Mesh;
  waterMat: THREE.MeshStandardMaterial;
}

/**
 * Recovery tray: a low steel trough with a rubber lip, cantilevered from the
 * moving bogie so it always travels with the letter. Sits just above the
 * safety net.
 */
export function buildTray(halfWidth: number, seed: number): TrayRig {
  const group = new THREE.Group();
  const steel = makeSteelMaterial(seed);
  const rubber = makeRubberMaterial();
  const W = halfWidth * 2 + 0.12;
  const D = 0.56;
  const H = TRAY_TOP_Y - 0.1;
  const wallT = 0.03;

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, wallT, D), steel);
  bottom.position.y = 0.1 + wallT / 2;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  group.add(bottom);
  for (const [dx, dz, ww, dd] of [
    [-W / 2 + wallT / 2, 0, wallT, D],
    [W / 2 - wallT / 2, 0, wallT, D],
    [0, -D / 2 + wallT / 2, W, wallT],
    [0, D / 2 - wallT / 2, W, wallT],
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, H, dd), steel);
    wall.position.set(dx, 0.1 + H / 2, dz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
  // rubber lip on the rim
  for (const [dx, dz, ww, dd] of [
    [-W / 2 + wallT / 2, 0, wallT + 0.02, D],
    [W / 2 - wallT / 2, 0, wallT + 0.02, D],
  ] as const) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.035, dd), rubber);
    lip.position.set(dx, 0.1 + H, dz);
    group.add(lip);
  }

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x51616a,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W - wallT * 2, D - wallT * 2), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = TRAY_WATER_Y;
  group.add(water);

  return { group, water, waterMat };
}
