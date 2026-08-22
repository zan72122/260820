import * as THREE from 'three';
import { LOCK, SHEAR_Y, pinZ } from '../core/config';
import { MaterialSet } from './materials';

/**
 * The fictional, oversized educational pin cylinder.
 *
 * It is modelled as a real sectioned demonstration piece: the +X side of
 * the housing, bible and plug is machined away past the pin bores, the way
 * museum cutaway models are made. Looking from -X the lock appears intact;
 * walking the camera around to +X reveals the section. Nothing fades or
 * glows — the shear line is read from the actual metal-to-metal seam
 * between plug and housing, helped by one fine engraved (non-emissive)
 * witness line on the section face.
 *
 * Local frame: plug axis = Z, front face at z=0, key travels toward -Z.
 * The section (milled) plane is at x = MILL_X.
 */
export const MILL_X = 0.003;
const HOUSING_R = LOCK.housingRadius;
const PLUG_R = LOCK.plugRadius;
const BODY_D = LOCK.bodyDepth;
const KW_TOP = 0.0105; // keyway ceiling (lower pins hang into keyway above this)
const KW_HW = LOCK.keywayHalfWidth;
const CHAMBER_TOP = SHEAR_Y + LOCK.chamberDepth; // 0.076
const BIBLE_TOP = CHAMBER_TOP + 0.008;
const BIBLE_LEFT = -0.017;
const PLATE_BACK = -0.0058; // bible front plate inner face
const PIN_R = 0.005;
const BORE_R = 0.0056;

export interface PinMeshes {
  lower: THREE.Mesh;
  upper: THREE.Mesh;
  spring: THREE.Mesh;
  springSpace: number; // cached to throttle rebuilds
  z: number;
  lowerLength: number;
}

export interface LockRig {
  group: THREE.Group;
  plugGroup: THREE.Group;
  keyHolder: THREE.Group;
  bolt: THREE.Mesh;
  cam: THREE.Group;
  pins: PinMeshes[];
  /** update one stack: bottom of lower pin above keyway floor (visual lift) */
  setStack(i: number, lift: number): void;
  setPlugAngle(a: number): void;
  setBoltProgress(p: number): void;
}

export function buildLock(mats: MaterialSet, lowerLengths: number[]): LockRig {
  const group = new THREE.Group();
  group.name = 'lock';

  // ---------------------------------------------------------------- housing
  // ring sector: the wedge facing +X (|θ| < cutHalf) is machined away
  const cutHalf = THREE.MathUtils.degToRad(72);
  const ring = new THREE.Shape();
  ring.absarc(0, 0, HOUSING_R, cutHalf, Math.PI * 2 - cutHalf, false);
  ring.lineTo(Math.cos(-cutHalf) * (PLUG_R + 0.0004), Math.sin(-cutHalf) * (PLUG_R + 0.0004));
  ring.absarc(0, 0, PLUG_R + 0.0004, Math.PI * 2 - cutHalf, cutHalf, true);
  ring.closePath();
  const housingGeo = new THREE.ExtrudeGeometry(ring, {
    depth: BODY_D,
    bevelEnabled: false,
    curveSegments: 48,
  });
  housingGeo.translate(0, 0, -BODY_D);
  const housing = new THREE.Mesh(housingGeo, mats.housingNickel);
  housing.castShadow = true;
  housing.receiveShadow = true;
  group.add(housing);

  // section faces of the housing wedge (flat milled planes)
  for (const sign of [1, -1]) {
    const a = sign * cutHalf;
    const w = HOUSING_R - PLUG_R;
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(w, BODY_D),
      mats.housingSection
    );
    const rMid = (HOUSING_R + PLUG_R) / 2;
    orientSectionQuad(quad, a, rMid, sign);
    group.add(quad);
  }

  // front collar ring (trim ring on the intact part of the face)
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(PLUG_R + 0.004, 0.0028, 12, 48, Math.PI * 2 - cutHalf * 2),
    mats.housingNickel
  );
  collar.rotation.z = cutHalf;
  collar.position.z = 0.0012;
  group.add(collar);

  // ----------------------------------------------------------------- bible
  const bible = new THREE.Group();
  // back slab behind the chambers
  const backSlab = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_BACK - BIBLE_LEFT, BIBLE_TOP - 0.024, BODY_D),
    mats.housingNickel
  );
  backSlab.position.set(
    (BIBLE_LEFT + PLATE_BACK) / 2,
    (BIBLE_TOP + 0.024) / 2,
    -BODY_D / 2
  );
  backSlab.castShadow = true;
  bible.add(backSlab);

  // chamber liners: rear half-bores visible through the slots
  for (let i = 0; i < LOCK.pinCount; i++) {
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(BORE_R, BORE_R, LOCK.chamberDepth, 24, 1, true, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x67686a,
        metalness: 1,
        roughness: 0.62,
        side: THREE.BackSide,
      })
    );
    liner.position.set(0, SHEAR_Y + LOCK.chamberDepth / 2, pinZ(i));
    bible.add(liner);
  }

  // front plate: rectangle with one rounded slot per chamber (real holes)
  const plate = new THREE.Shape();
  const zF = -0.006; // shape uses lock z directly (negative depths)
  const zB = -BODY_D + 0.006;
  const yB = 0.024;
  plate.moveTo(zB, yB);
  plate.lineTo(zF, yB);
  plate.lineTo(zF, BIBLE_TOP);
  plate.lineTo(zB, BIBLE_TOP);
  plate.closePath();
  for (let i = 0; i < LOCK.pinCount; i++) {
    const z = pinZ(i);
    const r = BORE_R + 0.0006;
    const y0 = SHEAR_Y + 0.0005;
    const y1 = CHAMBER_TOP - 0.0005;
    const slot = new THREE.Path();
    // capsule: right side down, arc, left side up, arc (CCW in (z,y))
    slot.moveTo(z + r, y1);
    slot.lineTo(z + r, y0);
    slot.absarc(z, y0, r, 0, Math.PI, true);
    slot.lineTo(z - r, y1);
    slot.absarc(z, y1, r, Math.PI, 0, true);
    plate.holes.push(slot);
  }
  const plateGeo = new THREE.ExtrudeGeometry(plate, {
    depth: MILL_X - PLATE_BACK,
    bevelEnabled: false,
    curveSegments: 24,
  });
  // shape (u=z, v=y) lies in XY; rotate so shape-x -> +Z world
  plateGeo.rotateY(-Math.PI / 2);
  plateGeo.translate(MILL_X, 0, 0);
  const plateMesh = new THREE.Mesh(plateGeo, mats.housingSection);
  plateMesh.castShadow = true;
  bible.add(plateMesh);

  // spring retainer screws on the bible top
  for (let i = 0; i < LOCK.pinCount; i++) {
    const screw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.0024, 20),
      mats.boltSteel
    );
    screw.position.set(-0.004, BIBLE_TOP + 0.0011, pinZ(i));
    bible.add(screw);
    const slotCut = new THREE.Mesh(
      new THREE.BoxGeometry(0.0065, 0.0006, 0.0012),
      new THREE.MeshStandardMaterial({ color: 0x3c3c3c, metalness: 1, roughness: 0.8 })
    );
    slotCut.position.set(-0.004, BIBLE_TOP + 0.0023, pinZ(i));
    slotCut.rotation.y = i * 0.9; // screws tightened to different angles
    bible.add(slotCut);
  }
  group.add(bible);

  // engraved witness line at the shear height on the bible plate front —
  // a fine dark scribed groove, not emissive
  const witness = new THREE.Mesh(
    new THREE.BoxGeometry(0.0004, 0.0005, BODY_D - 0.014),
    new THREE.MeshStandardMaterial({ color: 0x2f2c26, metalness: 0.4, roughness: 0.9 })
  );
  witness.position.set(MILL_X + 0.0001, SHEAR_Y, -BODY_D / 2);
  group.add(witness);

  // ------------------------------------------------------------------ plug
  const plugGroup = new THREE.Group();
  plugGroup.name = 'plug';
  const plugShape = new THREE.Shape();
  const chordY = Math.sqrt(PLUG_R * PLUG_R - MILL_X * MILL_X);
  const a0 = Math.atan2(chordY, MILL_X);
  const a1 = -a0 + Math.PI * 2;
  plugShape.moveTo(MILL_X, chordY);
  plugShape.absarc(0, 0, PLUG_R, a0, a1, false); // long way round (intact side)
  // up the chord to keyway floor level
  plugShape.lineTo(MILL_X, LOCK.keywayFloorY);
  // keyway notch (open on the milled side)
  plugShape.lineTo(-KW_HW, LOCK.keywayFloorY);
  plugShape.lineTo(-KW_HW, KW_TOP);
  plugShape.lineTo(MILL_X, KW_TOP);
  plugShape.closePath();
  const plugGeo = new THREE.ExtrudeGeometry(plugShape, {
    depth: BODY_D + 0.004,
    bevelEnabled: false,
    curveSegments: 48,
  });
  plugGeo.translate(0, 0, -BODY_D);
  const plug = new THREE.Mesh(plugGeo, mats.plugBrass);
  plug.castShadow = true;
  plug.receiveShadow = true;
  plugGroup.add(plug);

  // milled section overlays on the plug chord face (duller flat milling)
  const secBelow = new THREE.Mesh(
    new THREE.PlaneGeometry(BODY_D, chordY - 0.013),
    mats.plugSection
  );
  orientChordQuad(secBelow, (LOCK.keywayFloorY - chordY) / 2, BODY_D / 2);
  plugGroup.add(secBelow);
  const secAbove = new THREE.Mesh(
    new THREE.PlaneGeometry(BODY_D, chordY - KW_TOP),
    mats.plugSection
  );
  orientChordQuad(secAbove, (KW_TOP + chordY) / 2, BODY_D / 2);
  plugGroup.add(secAbove);

  // opened lower-pin bores in the plug web (dark vertical grooves)
  for (let i = 0; i < LOCK.pinCount; i++) {
    const groove = new THREE.Mesh(
      new THREE.CylinderGeometry(BORE_R, BORE_R, PLUG_R - KW_TOP, 20, 1, true, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x6b5a30,
        metalness: 1,
        roughness: 0.6,
        side: THREE.BackSide,
      })
    );
    groove.position.set(0, (KW_TOP + PLUG_R) / 2, pinZ(i));
    plugGroup.add(groove);
  }

  // key holder: the key mesh is parented here; it slides along Z
  const keyHolder = new THREE.Group();
  keyHolder.name = 'keyHolder';
  plugGroup.add(keyHolder);

  // tailpiece + cam behind the plug (rotate with it)
  const cam = new THREE.Group();
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.024, 0.03),
    mats.plugBrass
  );
  tail.position.set(0, 0, -BODY_D - 0.014);
  cam.add(tail);
  const camDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.007, 32),
    mats.boltSteel
  );
  camDisc.rotation.x = Math.PI / 2;
  camDisc.position.set(0, 0, -BODY_D - 0.026);
  cam.add(camDisc);
  const camLobe = new THREE.Mesh(
    new THREE.BoxGeometry(0.010, 0.030, 0.007),
    mats.boltSteel
  );
  camLobe.position.set(0, -0.014, -BODY_D - 0.026);
  cam.add(camLobe);
  plugGroup.add(cam);
  group.add(plugGroup);

  // ------------------------------------------------------------------ pins
  const pins: PinMeshes[] = [];
  for (let i = 0; i < LOCK.pinCount; i++) {
    const L = lowerLengths[i] ?? 0.03;
    const lower = new THREE.Mesh(lowerPinGeometry(L), mats.lowerPin);
    lower.castShadow = true;
    const upper = new THREE.Mesh(upperPinGeometry(), mats.upperPin);
    upper.castShadow = true;
    const spring = new THREE.Mesh(springGeometry(0.026), mats.springSteel);
    lower.position.set(0, 0, pinZ(i));
    upper.position.set(0, 0, pinZ(i));
    spring.position.set(0, 0, pinZ(i));
    // lower pins ride in the plug (they rotate with it); the drivers and
    // springs live in the housing chambers
    plugGroup.add(lower);
    group.add(upper, spring);
    pins.push({ lower, upper, spring, springSpace: 0.026, z: pinZ(i), lowerLength: L });
  }

  // ------------------------------------------------------- rim-lock case
  // brass box that receives the cylinder rear, cam and bolt; its +X side
  // has an open service window so the cam-to-bolt hand-off stays visible.
  const caseGroup = new THREE.Group();
  const caseMat = mats.plugBrass;
  const cw = 0.058; // half width x
  const ch = 0.06; // half height y
  const czF = -BODY_D - 0.002; // case front (toward viewer)
  const czB = -BODY_D - 0.05; // case back (mounts on door)
  const cd = czF - czB;
  const wall = 0.005;
  const mkBox = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), caseMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    caseGroup.add(m);
    return m;
  };
  const czMid = (czF + czB) / 2;
  mkBox(cw * 2, ch * 2, wall, 0, 0, czB + wall / 2); // back plate
  mkBox(cw * 2, wall, cd, 0, ch - wall / 2, czMid); // top
  mkBox(cw * 2, wall, cd, 0, -ch + wall / 2, czMid); // bottom
  mkBox(wall, ch * 2, cd, -cw + wall / 2, 0, czMid); // left (-X)
  // front plate with a round hole for the cylinder: ring built from shape
  const front = new THREE.Shape();
  front.moveTo(-cw, -ch);
  front.lineTo(cw, -ch);
  front.lineTo(cw, ch);
  front.lineTo(-cw, ch);
  front.closePath();
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, HOUSING_R + 0.0005, 0, Math.PI * 2, true);
  front.holes.push(holePath);
  const frontGeo = new THREE.ExtrudeGeometry(front, { depth: wall, bevelEnabled: false, curveSegments: 40 });
  frontGeo.translate(0, 0, czF - wall);
  const frontMesh = new THREE.Mesh(frontGeo, caseMat);
  frontMesh.castShadow = true;
  caseGroup.add(frontMesh);
  // +X service window frame: two narrow posts instead of a full wall
  mkBox(wall, ch * 2, 0.008, cw - wall / 2, 0, czF - 0.004);
  mkBox(wall, ch * 2, 0.008, cw - wall / 2, 0, czB + 0.004);
  // faint inspection light inside the case so the cam→bolt hand-off is
  // readable through the service window
  const caseLight = new THREE.PointLight(0xffe6c2, 0.35, 0.3, 1.6);
  caseLight.position.set(0.02, 0.03, czMid);
  caseGroup.add(caseLight);
  group.add(caseGroup);

  // ------------------------------------------------------------------ bolt
  // thick steel bolt sliding along +X through the case wall
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.024, 0.016), mats.boltSteel);
  bolt.castShadow = true;
  bolt.receiveShadow = true;
  bolt.position.set(0.055, -0.012, czMid); // extended position (throw = 0.036)
  group.add(bolt);
  const boltGuide = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.032, 0.024), caseMat);
  boltGuide.position.set(0.03, -0.012, czMid);
  caseGroup.add(boltGuide);

  const BOLT_EXTENDED_X = 0.055;
  const BOLT_THROW = 0.038;

  const rig: LockRig = {
    group,
    plugGroup,
    keyHolder,
    bolt,
    cam,
    pins,
    setStack(i: number, lift: number) {
      const p = pins[i];
      if (!p) return;
      const bottom = LOCK.keywayFloorY + lift;
      p.lower.position.y = bottom;
      const boundary = bottom + p.lowerLength;
      p.upper.position.y = boundary;
      const upperTop = boundary + LOCK.upperPinLength;
      const space = Math.max(0.0098, CHAMBER_TOP - upperTop);
      if (Math.abs(space - p.springSpace) > 0.00035) {
        p.spring.geometry.dispose();
        p.spring.geometry = springGeometry(space);
        p.springSpace = space;
      }
      p.spring.position.y = upperTop;
    },
    setPlugAngle(a: number) {
      plugGroup.rotation.z = a;
    },
    setBoltProgress(p: number) {
      bolt.position.x = BOLT_EXTENDED_X - p * BOLT_THROW;
    },
  };
  return rig;
}

function orientSectionQuad(quad: THREE.Mesh, angle: number, rMid: number, sign: number): void {
  // basis: width along the radial direction, height along the plug axis,
  // normal facing into the removed wedge
  const xAxis = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
  const yAxis = new THREE.Vector3(0, 0, sign > 0 ? 1 : -1);
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  quad.quaternion.setFromRotationMatrix(m);
  quad.position.set(Math.cos(angle) * rMid, Math.sin(angle) * rMid, -LOCK.bodyDepth / 2);
  // nudge off the extrude wall to avoid z-fighting
  quad.position.addScaledVector(zAxis, 0.00015);
}

function orientChordQuad(quad: THREE.Mesh, yCenter: number, _zHalf: number): void {
  quad.rotation.y = Math.PI / 2;
  quad.position.set(MILL_X + 0.00015, yCenter, -LOCK.bodyDepth / 2);
}

/** turned lower pin: rounded contact tip, straight body, top chamfer */
function lowerPinGeometry(length: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const r = PIN_R;
  const tip = 0.0032;
  pts.push(new THREE.Vector2(0, 0));
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    const ang = (t * Math.PI) / 2;
    pts.push(new THREE.Vector2(Math.sin(ang) * r, tip - Math.cos(ang) * tip));
  }
  pts.push(new THREE.Vector2(r, length - 0.0012));
  pts.push(new THREE.Vector2(r - 0.0008, length));
  pts.push(new THREE.Vector2(0, length));
  return new THREE.LatheGeometry(pts, 24);
}

/** driver pin: plain cylinder with chamfers, different finish from lower */
function upperPinGeometry(): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const r = PIN_R;
  const L = LOCK.upperPinLength;
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(r - 0.0009, 0));
  pts.push(new THREE.Vector2(r, 0.0011));
  pts.push(new THREE.Vector2(r, L - 0.0011));
  pts.push(new THREE.Vector2(r - 0.0009, L));
  pts.push(new THREE.Vector2(0, L));
  return new THREE.LatheGeometry(pts, 24);
}

/**
 * coil spring filling `space` (m). Coil count is fixed; pitch varies with
 * compression and the solid-height clamp upstream guarantees coils never
 * pass through each other.
 */
function springGeometry(space: number): THREE.TubeGeometry {
  const coils = 5.5;
  const rCoil = 0.0034;
  const rWire = 0.00075;
  const usable = space - rWire * 2;
  class Helix extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    override getPoint(t: number): THREE.Vector3 {
      const a = t * coils * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(a) * rCoil,
        rWire + t * usable,
        Math.sin(a) * rCoil
      );
    }
  }
  return new THREE.TubeGeometry(new Helix(), 96, rWire, 6, false);
}
