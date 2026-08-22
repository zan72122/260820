import * as THREE from 'three';
import { KEY, LOCK } from '../core/config';
import { KeyProfileSpec, bladeHeightAt } from '../game/FictionalKeyProfile';
import { MaterialSet } from './materials';

/**
 * Builds a key mesh whose blade silhouette is generated from the SAME
 * bladeHeightAt() function that drives pin lifts, so what the child sees
 * riding under the pins is exactly the surface doing the lifting.
 *
 * Local frame: tip at z = 0, blade extending toward +z, bow beyond the
 * shoulder. The blade bottom sits on the keyway floor plane (y offset
 * applied here).
 */
export function buildKey(spec: KeyProfileSpec, mats: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = `key-${spec.id}`;

  const mat =
    spec.finish === 'brass'
      ? mats.brassKey
      : spec.finish === 'nickelSilver'
        ? mats.nickelSilverKey
        : mats.agedBrassKey;

  // ---- blade silhouette (side view) --------------------------------------
  const shape = new THREE.Shape();
  const L = KEY.bladeLength;
  const SAMPLES = 140;
  shape.moveTo(0, 0.0015); // tip chamfer start
  for (let i = 0; i <= SAMPLES; i++) {
    const s = (i / SAMPLES) * L;
    let h = bladeHeightAt(spec, s);
    // small tip chamfer so the point is not razor sharp
    if (s < 0.004) h = Math.min(h, 0.0015 + s * 1.2);
    shape.lineTo(s, h);
  }
  shape.lineTo(L, 0);
  // bottom edge with a slight tip bevel
  shape.lineTo(0.005, 0);
  shape.lineTo(0, 0.0015);

  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: KEY.bladeThickness,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0005,
    bevelSegments: 2,
  });
  // shape space: x = distance from tip, y = height. Rotate so x -> -Z? No:
  // we want tip at z=0 and blade toward +z, i.e. shape-x maps to +Z.
  bladeGeo.rotateY(-Math.PI / 2); // x -> +Z? verify: rotateY(-90): (1,0,0)->(0,0,1) yes
  bladeGeo.translate(KEY.bladeThickness / 2, LOCK.keywayFloorY, 0);
  const blade = new THREE.Mesh(bladeGeo, mat);
  blade.castShadow = true;
  blade.name = 'blade';
  group.add(blade);

  // warding groove: a shallow darker channel along the blade side
  const grooveGeo = new THREE.BoxGeometry(0.0008, 0.004, L * 0.94);
  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0x6b5626,
    metalness: 1,
    roughness: 0.7,
  });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.set(KEY.bladeThickness / 2 + 0.0003, LOCK.keywayFloorY + 0.007, L * 0.48);
  group.add(groove);

  // ---- shoulder / collar --------------------------------------------------
  const collarGeo = new THREE.BoxGeometry(KEY.bladeThickness + 0.004, 0.030, 0.012);
  const collar = new THREE.Mesh(collarGeo, mat);
  collar.position.set(0, LOCK.keywayFloorY + 0.012, L + 0.006);
  collar.castShadow = true;
  group.add(collar);

  // ---- bow (grip) — round / triangle / square per key --------------------
  const bowShape = new THREE.Shape();
  const R = 0.030;
  if (spec.id === 'key-a') {
    bowShape.absarc(0, 0, R, 0, Math.PI * 2, false);
  } else if (spec.id === 'key-b') {
    // rounded triangle
    roundedPolygon(bowShape, 3, R * 1.12, 0.010, Math.PI / 2);
  } else {
    // rounded square
    roundedPolygon(bowShape, 4, R * 1.05, 0.009, Math.PI / 4);
  }
  const hole = new THREE.Path();
  hole.absarc(0, R * 0.45, 0.0065, 0, Math.PI * 2, true);
  bowShape.holes.push(hole);

  const bowGeo = new THREE.ExtrudeGeometry(bowShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 3,
  });
  bowGeo.rotateY(Math.PI / 2); // plate faces along Z
  const bow = new THREE.Mesh(bowGeo, mat);
  bow.position.set(-0.003, LOCK.keywayFloorY + 0.012 - R * 0.1, L + 0.012 + R * 0.9);
  bow.rotateX(-0.12);
  bow.castShadow = true;
  bow.name = 'bow';
  group.add(bow);

  return group;
}

function roundedPolygon(
  shape: THREE.Shape,
  sides: number,
  radius: number,
  corner: number,
  phase: number
): void {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2;
    pts.push(new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius));
  }
  for (let i = 0; i < sides; i++) {
    const p0 = pts[i]!;
    const p1 = pts[(i + 1) % sides]!;
    const p2 = pts[(i + 2) % sides]!;
    const inA = p1.clone().sub(p0).normalize();
    const outA = p2.clone().sub(p1).normalize();
    const a = p1.clone().sub(inA.clone().multiplyScalar(corner));
    const b = p1.clone().add(outA.clone().multiplyScalar(corner));
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
  }
  shape.closePath();
}

/** flat silhouette path (SVG-like) for the HUD tray cards */
export function keySilhouettePath(spec: KeyProfileSpec, w: number, h: number): Path2D {
  const p = new Path2D();
  const L = KEY.bladeLength;
  const bowR = 0.030;
  const total = L + 0.012 + bowR * 2.1;
  const sx = w / total;
  const sy = (h * 0.62) / 0.032;
  const y0 = h * 0.68;
  p.moveTo(0, y0);
  const S = 90;
  for (let i = 0; i <= S; i++) {
    const s = (i / S) * L;
    p.lineTo(s * sx, y0 - bladeHeightAt(spec, s) * sy);
  }
  // collar
  p.lineTo(L * sx, y0 - 0.028 * sy);
  p.lineTo((L + 0.012) * sx, y0 - 0.028 * sy);
  p.lineTo((L + 0.012) * sx, y0);
  p.closePath();
  return p;
}
