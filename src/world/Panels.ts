import { Group, Mesh, Vector2 } from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import type { PatternKind } from '../state/OpticsState';
import { DIM } from './dims';
import { beam, buildPlate, revolve } from './geo';

export interface PlateObject {
  group: Group;
  kind: PatternKind | null;
  mesh: Mesh;
}

const bushGeo = revolve(
  [
    new Vector2(DIM.plateHoleR, -DIM.plateThick * 0.5 - 0.003),
    new Vector2(DIM.plateHoleR + 0.008, -DIM.plateThick * 0.5 - 0.003),
    new Vector2(DIM.plateHoleR + 0.008, DIM.plateThick * 0.5 + 0.003),
    new Vector2(DIM.plateHoleR, DIM.plateThick * 0.5 + 0.003),
  ],
  14,
);

const plateGeo = buildPlate({
  half: DIM.plateHalf,
  thickness: DIM.plateThick,
  corner: DIM.plateCorner,
  holeR: DIM.plateHoleR,
  holeAt: DIM.plateHoleAt,
  bevel: 0.0035,
  curveSegments: 14,
});

/** A real plate: 18 mm of resin, chamfered edge, bushed clamp bores. */
export function makePlate(kind: PatternKind | null, mats: MaterialLibrary): PlateObject {
  const group = new Group();
  const mesh = new Mesh(plateGeo, kind ? mats.plate[kind] : mats.plateBlank);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bush = new Mesh(bushGeo, mats.steel);
      bush.position.set(sx * DIM.plateHoleAt, 0, sz * DIM.plateHoleAt);
      group.add(bush);
    }
  }
  group.userData.kind = kind;
  return { group, kind, mesh };
}

export interface ShelfBuild {
  group: Group;
  /** world-space rest transforms for each slot */
  slots: Group[];
}

/**
 * The plate rack. Plates stand in rubber-lined V notches, leaning back,
 * so their edges catch the sun — which is the only hint the game gives.
 */
export function buildShelf(mats: MaterialLibrary, count: number): ShelfBuild {
  const group = new Group();
  const pitch = 1.22;
  const width = pitch * count + 0.5;
  const lean = 0.12;

  for (const side of [-1, 1]) {
    const rail = new Mesh(beam(width, 0.08, 0.09), mats.steelDark);
    rail.position.set(0, 0.06, side * 0.34);
    rail.castShadow = true;
    group.add(rail);
  }
  for (let i = 0; i <= count; i++) {
    const x = -width * 0.5 + 0.25 + i * pitch;
    const post = new Mesh(beam(0.095, 1.36, 0.095), mats.steelDark);
    post.position.set(x, 0.68, -0.3);
    post.rotation.x = -lean;
    post.castShadow = true;
    group.add(post);
    const foot = new Mesh(buildPlate({ half: 0.1, thickness: 0.018, corner: 0.02 }), mats.steel);
    foot.position.set(x, 0.009, -0.3);
    group.add(foot);
  }
  const backRail = new Mesh(beam(width, 0.07, 0.08), mats.steelDark);
  backRail.position.set(0, 1.2, -0.45);
  backRail.castShadow = true;
  group.add(backRail);
  const padRail = new Mesh(beam(width, 0.035, 0.05), mats.epdm);
  padRail.position.set(0, 1.2, -0.41);
  group.add(padRail);

  const slots: Group[] = [];
  for (let i = 0; i < count; i++) {
    const x = -width * 0.5 + 0.25 + pitch * (i + 0.5);
    // rubber-lined V cradle
    for (const s of [-1, 1]) {
      const v = new Mesh(beam(0.34, 0.05, 0.075), mats.epdm);
      v.position.set(x, 0.14, s * 0.16);
      v.rotation.z = 0;
      v.rotation.x = -lean;
      group.add(v);
    }
    const slot = new Group();
    slot.position.set(x, 0.72, -0.12);
    slot.rotation.set(Math.PI * 0.5 - lean, 0, 0);
    group.add(slot);
    slots.push(slot);
  }
  return { group, slots };
}
