import {
  ExtrudeGeometry,
  Group,
  Mesh,
  Object3D,
  Shape,
  Vector2,
} from 'three';
import type { MaterialLibrary } from '../materials/Materials';
import { DIM } from './dims';
import {
  beam,
  buildPlate,
  buildSaddleNeck,
  hitProxy,
  revolve,
  roundedRectPoints,
  sweepSeal,
} from './geo';

export interface PortBuild {
  root: Group;
  /** light-tight cover, hinged upstream; rotation.z 0 = shut */
  lid: Group;
  /** turns about the port normal; the plate turns with it */
  collar: Group;
  /** where a seated plate lives */
  slot: Object3D;
  clamps: Group[];
  gripRing: Mesh;
  seal: Mesh;
}

/**
 * The test port: a laminated saddle neck bonded to the barrel, a machined
 * stainless flange, a compressed EPDM seal, and a collar that turns the
 * plate in its own plane.
 */
export function buildPort(mats: MaterialLibrary): PortBuild {
  const root = new Group();
  const Ro = DIM.innerR + DIM.wall;

  const neck = new Mesh(
    buildSaddleNeck(DIM.windowHalf, DIM.neckWall, 0.055, DIM.neckTop, Ro, 7),
    mats.frpRib,
  );
  neck.castShadow = true;
  root.add(neck);

  const flange = new Mesh(
    buildPlate({
      half: DIM.flangeHalf,
      thickness: DIM.flangeThick,
      corner: 0.08,
      boreR: DIM.flangeBore,
      curveSegments: 16,
    }),
    mats.steel,
  );
  flange.position.y = DIM.neckTop + DIM.flangeThick * 0.5;
  flange.castShadow = true;
  flange.receiveShadow = true;
  root.add(flange);

  // flange fasteners
  const boltGeo = revolve(
    [
      new Vector2(0, 0),
      new Vector2(0.021, 0),
      new Vector2(0.021, 0.015),
      new Vector2(0.016, 0.022),
    ],
    12,
    true,
  );
  const bp = DIM.flangeHalf - 0.045;
  for (const [bx, bz] of [
    [bp, bp],
    [-bp, bp],
    [bp, -bp],
    [-bp, -bp],
    [bp, 0],
    [-bp, 0],
    [0, bp],
    [0, -bp],
  ]) {
    const bolt = new Mesh(boltGeo, mats.steel);
    bolt.position.set(bx, DIM.neckTop + DIM.flangeThick, bz);
    root.add(bolt);
  }

  // compressed EPDM seal — squashed, so it bulges
  const sealPath = roundedRectPoints(DIM.pocketHalf - 0.035, DIM.pocketHalf - 0.035, 0.06, 7);
  const sealSection = [
    new Vector2(-0.016, 0.0),
    new Vector2(-0.019, 0.006),
    new Vector2(-0.012, 0.0125),
    new Vector2(0.0, 0.014),
    new Vector2(0.012, 0.0125),
    new Vector2(0.019, 0.006),
    new Vector2(0.016, 0.0),
  ];
  const seal = new Mesh(sweepSeal(sealPath, sealSection), mats.epdm);
  seal.position.y = DIM.neckTop + DIM.flangeThick;
  root.add(seal);

  // ---- the collar that turns ------------------------------------------
  const collar = new Group();
  collar.position.y = DIM.neckTop + DIM.flangeThick;
  root.add(collar);

  const bearing = new Mesh(
    revolve(
      [
        new Vector2(DIM.flangeBore - 0.02, -0.022),
        new Vector2(DIM.flangeBore - 0.02, 0.0),
        new Vector2(DIM.flangeBore + 0.005, 0.004),
        new Vector2(DIM.flangeBore + 0.01, 0.03),
        new Vector2(DIM.collarOuter - 0.07, DIM.collarThick),
        new Vector2(DIM.collarOuter, DIM.collarThick - 0.008),
        new Vector2(DIM.collarOuter, 0.006),
        new Vector2(DIM.collarOuter - 0.012, 0.0),
      ],
      64,
    ),
    mats.steel,
  );
  bearing.castShadow = true;
  collar.add(bearing);

  const knurl = new Mesh(
    revolve(
      [
        new Vector2(DIM.collarOuter - 0.004, 0.004),
        new Vector2(DIM.collarOuter + 0.016, 0.012),
        new Vector2(DIM.collarOuter + 0.02, DIM.collarThick * 0.55),
        new Vector2(DIM.collarOuter + 0.014, DIM.collarThick - 0.006),
        new Vector2(DIM.collarOuter - 0.008, DIM.collarThick - 0.002),
      ],
      72,
    ),
    mats.steelKnurl,
  );
  knurl.castShadow = true;
  collar.add(knurl);
  const gripRing = knurl;

  // three radial grips: what a hand actually turns
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const grip = new Mesh(
      revolve(
        [
          new Vector2(0, 0),
          new Vector2(0.036, 0.006),
          new Vector2(0.04, 0.05),
          new Vector2(0.032, 0.086),
          new Vector2(0.0, 0.094),
        ],
        18,
      ),
      mats.steel,
    );
    grip.position.set(
      Math.cos(a) * (DIM.collarOuter - 0.055),
      DIM.collarThick - 0.004,
      Math.sin(a) * (DIM.collarOuter - 0.055),
    );
    grip.castShadow = true;
    collar.add(grip);
  }

  // index marks so a quarter turn is readable
  const markC = new Mesh(beam(0.05, 0.004, 0.02), mats.paint);
  markC.position.set(DIM.collarOuter - 0.03, DIM.collarThick + 0.001, 0);
  collar.add(markC);
  const markF = new Mesh(beam(0.05, 0.004, 0.02), mats.paint);
  markF.position.set(DIM.flangeHalf - 0.02, DIM.neckTop + DIM.flangeThick + 0.001, 0);
  root.add(markF);

  // ---- guide rails: the plate is dropped in, never aligned by hand -----
  const railShape = new Shape();
  railShape.moveTo(0, 0);
  railShape.lineTo(0.075, 0);
  railShape.lineTo(0.075, 0.052);
  railShape.lineTo(0.028, 0.052);
  railShape.lineTo(0.0, 0.024);
  railShape.lineTo(0, 0);
  const railLen = DIM.pocketHalf * 2 + 0.15;
  const railGeo = new ExtrudeGeometry(railShape, { depth: railLen, bevelEnabled: false });
  railGeo.translate(0, 0, -railLen * 0.5);
  railGeo.computeVertexNormals();
  for (let i = 0; i < 4; i++) {
    const rail = new Mesh(railGeo, mats.steel);
    rail.rotation.y = (i * Math.PI) / 2;
    const d = DIM.pocketHalf;
    rail.position.set(Math.cos(rail.rotation.y) * d, 0.0, -Math.sin(rail.rotation.y) * d);
    rail.castShadow = true;
    collar.add(rail);
  }

  // the collar is meant to be turned with one finger, so its touch target
  // is a generous disc rather than the exact ring geometry
  const collarProxy = new Mesh(hitProxy(0.95), mats.steel);
  collarProxy.visible = false;
  collarProxy.scale.set(1, 0.5, 1);
  collarProxy.position.y = 0.12;
  collar.add(collarProxy);

  const slot = new Object3D();
  slot.position.y = 0.03;
  collar.add(slot);

  // ---- four cam clamps -------------------------------------------------
  const clamps: Group[] = [];
  const camShape = new Shape();
  camShape.moveTo(-0.018, -0.02);
  camShape.lineTo(0.15, -0.014);
  camShape.quadraticCurveTo(0.175, -0.012, 0.175, 0.006);
  camShape.quadraticCurveTo(0.175, 0.024, 0.15, 0.024);
  camShape.lineTo(0.0, 0.03);
  camShape.quadraticCurveTo(-0.032, 0.031, -0.032, 0.004);
  camShape.quadraticCurveTo(-0.032, -0.02, -0.018, -0.02);
  const camGeo = new ExtrudeGeometry(camShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 6,
  });
  camGeo.translate(0, 0, -0.013);
  camGeo.computeVertexNormals();

  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i * Math.PI) / 2;
    const g = new Group();
    g.position.set(
      Math.cos(a) * (DIM.pocketHalf + 0.015),
      DIM.collarThick * 0.4,
      Math.sin(a) * (DIM.pocketHalf + 0.015),
    );
    g.rotation.y = -a + Math.PI;

    const base = new Mesh(beam(0.075, 0.062, 0.085), mats.steel);
    base.position.y = 0.031;
    base.castShadow = true;
    g.add(base);

    const pivot = new Group();
    pivot.position.set(-0.005, 0.062, 0);
    const lever = new Mesh(camGeo, mats.steelDark);
    pivot.add(lever);
    const pin = new Mesh(
      revolve([new Vector2(0, -0.02), new Vector2(0.011, -0.02), new Vector2(0.011, 0.02), new Vector2(0, 0.02)], 12),
      mats.steel,
    );
    pin.rotation.x = Math.PI * 0.5;
    pivot.add(pin);
    pivot.rotation.z = -1.15; // open
    g.add(pivot);

    const proxy = new Mesh(hitProxy(0.19), mats.steel);
    proxy.visible = false;
    proxy.position.set(0.03, 0.07, 0);
    g.add(proxy);
    g.userData.pivot = pivot;
    collar.add(g);
    clamps.push(g);
  }

  // ---- hinged light-tight cover ---------------------------------------
  const lid = new Group();
  const hingeX = -(DIM.flangeHalf + 0.045);
  lid.position.set(hingeX, DIM.neckTop + DIM.flangeThick + DIM.collarThick + 0.028, 0);
  const cover = new Mesh(
    buildPlate({ half: DIM.flangeHalf + 0.02, thickness: 0.026, corner: 0.09, curveSegments: 14 }),
    mats.frpRib,
  );
  cover.position.x = -hingeX;
  cover.castShadow = true;
  lid.add(cover);
  const stiff = new Mesh(beam(0.09, 0.05, DIM.flangeHalf * 1.7), mats.steelDark);
  stiff.position.set(-hingeX, 0.038, 0);
  lid.add(stiff);
  for (const z of [-0.26, 0.26]) {
    const knuckle = new Mesh(
      revolve([new Vector2(0, -0.05), new Vector2(0.028, -0.05), new Vector2(0.028, 0.05), new Vector2(0, 0.05)], 12),
      mats.steel,
    );
    knuckle.rotation.x = Math.PI * 0.5;
    knuckle.position.set(0, 0, z);
    lid.add(knuckle);
    const bracket = new Mesh(beam(0.07, 0.09, 0.05), mats.steel);
    bracket.position.set(hingeX, DIM.neckTop + DIM.flangeThick + DIM.collarThick - 0.01, z);
    root.add(bracket);
  }
  for (const z of [-0.3, 0.3]) {
    const toggle = new Mesh(beam(0.05, 0.03, 0.11), mats.steelDark);
    toggle.position.set(-hingeX * 2 - 0.02, -0.01, z);
    lid.add(toggle);
  }
  root.add(lid);

  return { root, collar, slot, clamps, gripRing, seal, lid };
}
