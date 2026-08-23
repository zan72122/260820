/**
 * Shared laboratory hardware: benches, rails, hand wheels, levers, trays.
 * Every control is a physical machine part — no flat UI sliders.
 */
import * as THREE from 'three';
import type { LabMaterials } from '../core/materials';
import { clamp, lerp } from '../core/math';
import { extrudePolygonXZ } from '../geo/dynamic';
import { oCounterRAt, cRx, cApertureHalfAngle, cStrokeAt, C_SPEC, cCenterline } from '../glyph/spec';

export const PLATE_W = 2.1;
export const PLATE_D = 1.4;
export const PLATE_T = 0.14;

export function makeBench(mats: LabMaterials): THREE.Group {
  const g = new THREE.Group();
  const plateGeo = new THREE.BoxGeometry(PLATE_W, PLATE_T, PLATE_D);
  const plate = new THREE.Mesh(plateGeo, [
    mats.graniteSide,
    mats.graniteSide,
    mats.granite,
    mats.graniteSide,
    mats.graniteSide,
    mats.graniteSide,
  ]);
  plate.position.y = -PLATE_T / 2;
  plate.receiveShadow = true;
  plate.castShadow = true;
  g.add(plate);

  // welded steel base cabinet
  const baseH = 0.72;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_W - 0.24, baseH, PLATE_D - 0.24),
    mats.castIron,
  );
  base.position.y = -PLATE_T - baseH / 2;
  base.receiveShadow = true;
  g.add(base);

  // leveling feet + floor anchor pads
  const footGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.06, 10);
  const padGeo = new THREE.BoxGeometry(0.16, 0.02, 0.16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(footGeo, mats.castIronWorn);
      foot.position.set(sx * (PLATE_W / 2 - 0.24), -PLATE_T - baseH - 0.03, sz * (PLATE_D / 2 - 0.24));
      g.add(foot);
      const pad = new THREE.Mesh(padGeo, mats.aluminumDark);
      pad.position.set(sx * (PLATE_W / 2 - 0.24), -PLATE_T - baseH - 0.062, sz * (PLATE_D / 2 - 0.24));
      pad.receiveShadow = true;
      g.add(pad);
    }
  }
  return g;
}

/** Low guard fence on the far and side edges so balls stay on the plate. */
export function makeFence(mats: LabMaterials): THREE.Group {
  const g = new THREE.Group();
  const h = 0.07;
  const railGeo = new THREE.BoxGeometry(PLATE_W, h, 0.02);
  const back = new THREE.Mesh(railGeo, mats.aluminumDark);
  back.position.set(0, h / 2, -PLATE_D / 2 + 0.02);
  g.add(back);
  const sideGeo = new THREE.BoxGeometry(0.02, h, PLATE_D);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(sideGeo, mats.aluminumDark);
    side.position.set(sx * (PLATE_W / 2 - 0.02), h / 2, 0);
    g.add(side);
  }
  return g;
}

export interface RailHandle {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  grip: THREE.Mesh;
  setValue(v: number): void;
  getValue(): number;
  /** css px per unit value, for drag mapping */
  attention: THREE.PointLight;
}

/**
 * A heavy carriage on a dovetail rail. Sculpted end stops (supplied by the
 * station: e.g. a thin-O and a fat-O model) tell the child what each end
 * means — no numerals, no axis names.
 */
export function makeRailHandle(
  mats: LabMaterials,
  length: number,
  endMinModel: THREE.Object3D,
  endMaxModel: THREE.Object3D,
): RailHandle {
  const g = new THREE.Group();
  const travel = length - 0.3;

  const bed = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.16), mats.aluminum);
  bed.position.y = 0.018;
  bed.castShadow = true;
  bed.receiveShadow = true;
  g.add(bed);
  const dovetail = new THREE.Mesh(new THREE.BoxGeometry(length - 0.06, 0.03, 0.07), mats.blackSteelSlide);
  dovetail.position.y = 0.05;
  g.add(dovetail);
  // graduated scale strip (unlabelled ticks — machine dressing, not UI)
  const ticks = new THREE.Group();
  const tickGeo = new THREE.BoxGeometry(0.004, 0.004, 0.03);
  for (let i = 0; i <= 12; i++) {
    const t = new THREE.Mesh(tickGeo, mats.brass);
    t.position.set(-travel / 2 + (travel * i) / 12, 0.038, 0.075);
    ticks.add(t);
  }
  g.add(ticks);

  const carriage = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.2), mats.castIron);
  block.position.y = 0.09;
  block.castShadow = true;
  carriage.add(block);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 14), mats.castIronWorn);
  grip.rotation.x = Math.PI / 2;
  grip.position.y = 0.18;
  grip.castShadow = true;
  carriage.add(grip);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 8), mats.blackSteel);
    post.position.set(0, 0.145, s * 0.075);
    post.rotation.x = 0; // vertical posts holding the grip
    carriage.add(post);
  }
  g.add(carriage);

  endMinModel.position.set(-length / 2 - 0.09, 0.02, 0);
  endMaxModel.position.set(length / 2 + 0.09, 0.02, 0);
  g.add(endMinModel, endMaxModel);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.36, 0.44),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.14;
  carriage.add(hit);

  const attention = new THREE.PointLight(0xffd9a0, 0, 0.65, 2);
  attention.position.set(0, 0.32, 0.1);
  carriage.add(attention);

  let value = 1;
  const apply = () => {
    carriage.position.x = lerp(-travel / 2, travel / 2, value);
  };
  apply();
  return {
    group: g,
    hitMesh: hit,
    grip,
    attention,
    setValue(v: number) {
      value = clamp(v, 0, 1);
      apply();
    },
    getValue: () => value,
  };
}

export interface TiltLever {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  attention: THREE.PointLight;
  setValue(v: number): void; // -1..1
  getValue(): number;
  maxAngle: number;
}

/** Upright lever that leans left/right — its angle IS the letter's slant. */
export function makeTiltLever(
  mats: LabMaterials,
  leftModel: THREE.Object3D,
  centerModel: THREE.Object3D,
  rightModel: THREE.Object3D,
  maxAngleDeg = 26,
): TiltLever {
  const g = new THREE.Group();
  const maxAngle = (maxAngleDeg * Math.PI) / 180;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.06, 18), mats.castIron);
  base.position.y = 0.03;
  base.castShadow = true;
  g.add(base);

  // sector scale plate behind the lever with three sculpted markers
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 24, 1, false, Math.PI / 3, Math.PI / 3), mats.aluminumDark);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, 0.1, -0.06);
  g.add(plate);

  const arm = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.34, 12), mats.blackSteel);
  shaft.position.y = 0.17;
  shaft.castShadow = true;
  arm.add(shaft);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14), mats.castIronWorn);
  knob.position.y = 0.36;
  knob.castShadow = true;
  arm.add(knob);
  arm.position.y = 0.05;
  g.add(arm);

  const r = 0.34;
  leftModel.position.set(-Math.sin(maxAngle) * r, 0.08 + Math.cos(maxAngle) * r * 0.82, 0.02);
  centerModel.position.set(0, 0.1 + r * 0.84, 0.02);
  rightModel.position.set(Math.sin(maxAngle) * r, 0.08 + Math.cos(maxAngle) * r * 0.82, 0.02);
  g.add(leftModel, centerModel, rightModel);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.3;
  g.add(hit);

  const attention = new THREE.PointLight(0xffd9a0, 0, 0.65, 2);
  attention.position.set(0, 0.45, 0.14);
  g.add(attention);

  let value = 0;
  return {
    group: g,
    hitMesh: hit,
    attention,
    maxAngle,
    setValue(v: number) {
      value = clamp(v, -1, 1);
      arm.rotation.z = -value * maxAngle;
    },
    getValue: () => value,
  };
}

export interface PullLever {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  attention: THREE.PointLight;
  /** 0 = rest, 1 = fully pulled */
  setPull(v: number): void;
  getPull(): number;
}

/** Release lever: pull it down, the feed gate opens, it springs back. */
export function makePullLever(mats: LabMaterials): PullLever {
  const g = new THREE.Group();
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.05), mats.blackSteel);
  mount.castShadow = true;
  g.add(mount);
  const pivot = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.26, 10), mats.castIron);
  arm.position.y = -0.13;
  arm.castShadow = true;
  pivot.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mats.castIronWorn);
  knob.position.y = -0.26;
  knob.castShadow = true;
  pivot.add(knob);
  pivot.position.y = 0.06;
  pivot.rotation.x = -0.5; // rests tilted toward the child
  g.add(pivot);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.5, 0.42),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = -0.16;
  g.add(hit);

  const attention = new THREE.PointLight(0xffd9a0, 0, 0.65, 2);
  attention.position.set(0, -0.1, 0.16);
  g.add(attention);

  let pull = 0;
  return {
    group: g,
    hitMesh: hit,
    attention,
    setPull(v: number) {
      pull = clamp(v, 0, 1);
      pivot.rotation.x = -0.5 - pull * 0.75;
    },
    getPull: () => pull,
  };
}

export function makeTray(mats: LabMaterials, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const wall = 0.025;
  const h = 0.075;
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mats.blackSteel);
  bottom.position.y = 0.01;
  bottom.receiveShadow = true;
  g.add(bottom);
  const feltPad = new THREE.Mesh(new THREE.BoxGeometry(w - wall * 2, 0.012, d - wall * 2), mats.felt);
  feltPad.position.y = 0.024;
  feltPad.receiveShadow = true;
  g.add(feltPad);
  const mkWall = (ww: number, wd: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, h, wd), mats.blackSteel);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    g.add(m);
  };
  mkWall(w, wall, 0, -d / 2 + wall / 2);
  mkWall(w, wall, 0, d / 2 - wall / 2);
  mkWall(wall, d, -w / 2 + wall / 2, 0);
  mkWall(wall, d, w / 2 - wall / 2, 0);
  return g;
}

export interface Andon {
  group: THREE.Group;
  /** call on a pass — green inspection lamp glows for a moment */
  flash(): void;
  update(dt: number): void;
}

/** Industrial pass-lamp: cast housing, green glass lens. Lights on success. */
export function makeAndon(mats: LabMaterials): Andon {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 14), mats.castIron);
  housing.castShadow = true;
  g.add(housing);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x1d4d32,
    roughness: 0.25,
    metalness: 0,
    emissive: 0x0c2417,
    emissiveIntensity: 1,
  });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), lensMat);
  lens.position.y = 0.055;
  g.add(lens);
  const light = new THREE.PointLight(0x59d98c, 0, 0.9, 2);
  light.position.y = 0.09;
  g.add(light);
  let hot = 0;
  return {
    group: g,
    flash() {
      hot = 2.4;
    },
    update(dt: number) {
      hot = Math.max(0, hot - dt);
      const k = Math.min(1, hot);
      light.intensity = k * 1.1;
      lensMat.emissive.setHex(k > 0.02 ? 0x2fae63 : 0x0c2417);
      lensMat.emissiveIntensity = 0.4 + k * 1.6;
    },
  };
}

/** Hex-head bolt geometry for instanced dressing. */
export function boltGeometry(): THREE.BufferGeometry {
  const head = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 6);
  head.translate(0, 0.006, 0);
  return head;
}

// ------------------------------------------------------- sculpted minis —
// Small solid models used as handle end stops. They are the SAME glyph
// math at 22% scale, so the promise they make is the promise the machine
// keeps.

const MINI = 0.22;

export function miniO(mats: LabMaterials, weight: number): THREE.Group {
  const g = new THREE.Group();
  const pts: { x: number; z: number }[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * 0.42 * MINI, z: Math.sin(a) * 0.42 * MINI });
  }
  // punch the counter by drawing ring as extrude with hole
  const shape = new THREE.Shape();
  pts.forEach((p, i) => (i ? shape.lineTo(p.x, p.z) : shape.moveTo(p.x, p.z)));
  shape.closePath();
  const hole = new THREE.Path();
  const hr = Math.max(0.02, oCounterRAt(weight, 0)) * MINI;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = oCounterRAt(weight, a) * MINI;
    const p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
    if (i) hole.lineTo(p.x, p.z);
    else hole.moveTo(p.x, p.z);
  }
  void hr;
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mats.blackSteel);
  m.position.y = 0.03;
  m.castShadow = true;
  g.add(m);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.03, 16), mats.aluminumDark);
  pedestal.position.y = 0.015;
  g.add(pedestal);
  return g;
}

export function miniC(mats: LabMaterials, width: number): THREE.Group {
  const g = new THREE.Group();
  const th = cApertureHalfAngle(width);
  const n = 40;
  const outer: { x: number; z: number }[] = [];
  const inner: { x: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = th + ((Math.PI * 2 - 2 * th) * i) / n;
    const c = cCenterline(width, a);
    const len = Math.hypot(c.x / cRx(width) ** 2, c.z / C_SPEC.ry ** 2) || 1;
    const nx = c.x / cRx(width) ** 2 / len;
    const nz = c.z / C_SPEC.ry ** 2 / len;
    const w = cStrokeAt(width, a) / 2;
    outer.push({ x: (c.x + nx * w) * MINI, z: (c.z + nz * w) * MINI });
    inner.push({ x: (c.x - nx * w) * MINI, z: (c.z - nz * w) * MINI });
  }
  const poly = [...outer, ...inner.reverse()];
  const geo = extrudePolygonXZ(poly, 0, 0.028);
  const m = new THREE.Mesh(geo, mats.blackSteel);
  m.position.y = 0.03;
  m.castShadow = true;
  g.add(m);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 16), mats.aluminumDark);
  pedestal.position.y = 0.015;
  g.add(pedestal);
  return g;
}

/** Upright mini I for the slant lever scale — slanted or straight. */
export function miniI(mats: LabMaterials, slant: number): THREE.Group {
  const g = new THREE.Group();
  const s = 0.16;
  const shear = Math.tan((slant * 12 * Math.PI) / 180);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.06), mats.blackSteel);
  bottom.position.y = 0.05 * s;
  g.add(bottom);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.06), mats.blackSteel);
  top.position.set(shear * 0.8 * s, 0.85 * s, 0);
  g.add(top);
  const stemGeo = new THREE.BoxGeometry(0.16 * s, 0.7 * s, 0.06);
  const shearM = new THREE.Matrix4().set(1, shear, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  stemGeo.applyMatrix4(shearM);
  const stem = new THREE.Mesh(stemGeo, mats.blackSteel);
  stem.position.set(shear * 0.0, 0.45 * s, 0);
  g.add(stem);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
