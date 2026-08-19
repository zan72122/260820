import * as THREE from 'three';
import { Rng } from '../core/rng';
import { brushedSteelMaps } from './textures';

const TAU = Math.PI * 2;

export interface ToolMaterials {
  steel: THREE.MeshStandardMaterial;
  /** brighter, less mirror-like steel so a thin blade still reads on screen */
  blade: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  resin: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createToolMaterials(): ToolMaterials {
  const maps = brushedSteelMaps(256);
  const steel = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    color: 0xdcdee1,
    roughness: 0.36,
    metalness: 0.84,
  });
  const brass = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    color: 0xd6b070,
    roughness: 0.36,
    metalness: 0.86,
  });
  const blade = new THREE.MeshStandardMaterial({
    color: 0xe9ecef,
    roughness: 0.2,
    metalness: 0.62,
  });
  const resin = new THREE.MeshStandardMaterial({
    color: 0x22262b,
    roughness: 0.58,
    metalness: 0.05,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xd7a084,
    roughness: 0.66,
    metalness: 0,
  });
  const sleeve = new THREE.MeshStandardMaterial({
    color: 0xe8e6e0,
    roughness: 0.92,
    metalness: 0,
  });
  const fabric = new THREE.MeshStandardMaterial({
    color: 0xe6e3da,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x4c3526,
    roughness: 0.66,
    metalness: 0.04,
  });
  return {
    steel,
    blade,
    brass,
    resin,
    skin,
    sleeve,
    fabric,
    wood,
    dispose: () => {
      maps.map?.dispose();
      maps.normalMap?.dispose();
      maps.roughnessMap?.dispose();
      for (const m of [steel, blade, brass, resin, skin, sleeve, fabric, wood]) m.dispose();
    },
  };
}

/**
 * An adult pastry chef's hand, closed around a grip that runs along local Y.
 * Only ever seen cropped and in the near field — what has to read is scale,
 * a confident grip and a safe distance from the flame, not knuckle detail.
 */
export function buildHand(
  mats: ToolMaterials,
  o: { gripRadius: number; mirror?: boolean } = { gripRadius: 0.26 },
): THREE.Group {
  const g = new THREE.Group();
  const seed = new Rng(0x4a17d);
  const rg = o.gripRadius;

  // four fingers wrapped around the grip, index to little
  for (let i = 0; i < 4; i++) {
    const fr = 0.076 - i * 0.006;
    const arc = 3.25 - i * 0.14;
    const finger = new THREE.Mesh(
      new THREE.TorusGeometry(rg + fr * 0.9, fr, 6, 14, arc),
      mats.skin,
    );
    finger.rotation.x = Math.PI / 2;
    finger.rotation.y = -0.3 + seed.range(-0.05, 0.05);
    finger.position.y = -0.02 - i * 0.152;
    g.add(finger);
    // knuckle, sitting proud on the back of the hand
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(fr * 1.15, 8, 6), mats.skin);
    knuckle.position.set(-(rg + fr * 0.75), -0.02 - i * 0.152, 0.03);
    knuckle.scale.set(1, 0.85, 1);
    g.add(knuckle);
  }

  // thumb, crossing over from the other side
  const thumb = new THREE.Mesh(
    new THREE.TorusGeometry(rg + 0.07, 0.085, 6, 12, 1.85),
    mats.skin,
  );
  thumb.rotation.set(Math.PI / 2, 0, 0);
  thumb.rotation.y = 2.5;
  thumb.position.set(0, 0.08, 0);
  g.add(thumb);

  // back of the hand
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mats.skin);
  back.scale.set(1.0, 1.45, 0.52);
  back.position.set(-(rg + 0.18), -0.28, 0);
  g.add(back);

  // wrist + chef-jacket cuff, running out of frame
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.42, 14), mats.skin);
  wrist.position.set(-(rg + 0.2), -0.86, 0);
  wrist.rotation.z = -0.16;
  g.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.34, 0.22, 16), mats.sleeve);
  cuff.position.set(-(rg + 0.27), -1.12, 0);
  cuff.rotation.z = -0.18;
  g.add(cuff);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.3, 16), mats.sleeve);
  arm.position.set(-(rg + 0.42), -1.82, 0);
  arm.rotation.z = -0.2;
  g.add(arm);

  if (o.mirror) g.scale.x *= -1;
  return g;
}


/** Tools are modelled life-size, then shrunk into a "view model" scale: at
 *  arm's length a real torch would fill half the screen and hide the cake. */
function shrink(group: THREE.Group, scale: number): void {
  const inner = new THREE.Group();
  for (const child of [...group.children]) inner.add(child);
  inner.scale.setScalar(scale);
  group.add(inner);
}

export const TOOL_SCALE = { torch: 0.52, bag: 0.46, knife: 0.5 } as const;

export interface Torch {
  group: THREE.Group;
  /** where the flame is born, in torch-local space */
  nozzleTip: THREE.Vector3;
  /** the big ignition button — a generous tap target */
  igniter: THREE.Mesh;
  igniterWorld: THREE.Vector3;
  setLit: (lit: boolean) => void;
  dispose: () => void;
}

/**
 * A realistic small kitchen torch: metal nozzle, resin grip, a used-looking
 * canister, and an over-sized piezo button that a four-year-old can hit.
 * The flame leaves the nozzle from the right place, and the adult hand holds
 * it at a safe working distance.
 */
export function buildTorch(mats: ToolMaterials): Torch {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T): T => {
    geos.push(x);
    return x;
  };

  // gas canister
  const tank = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.34, 0.36, 1.0, 20)), mats.steel);
  tank.position.y = -1.15;
  group.add(tank);
  const tankBottom = new THREE.Mesh(keep(new THREE.SphereGeometry(0.36, 16, 8)), mats.steel);
  tankBottom.scale.y = 0.45;
  tankBottom.position.y = -1.62;
  group.add(tankBottom);
  const label = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.362, 0.362, 0.36, 20, 1, true)),
    new THREE.MeshStandardMaterial({ color: 0x9a3d2c, roughness: 0.78, metalness: 0.05 }),
  );
  label.position.y = -1.2;
  group.add(label);

  // body / grip
  const grip = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.3, 0.33, 0.78, 18)), mats.resin);
  grip.position.y = -0.34;
  group.add(grip);

  const collar = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.24, 0.3, 0.16, 18)), mats.steel);
  collar.position.y = 0.09;
  group.add(collar);

  // adjustment wheel — the small detail that says "tool", not "prop"
  const wheel = new THREE.Mesh(keep(new THREE.TorusGeometry(0.17, 0.045, 6, 16)), mats.brass);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0.28, -0.5, 0);
  wheel.rotation.z = 0.4;
  group.add(wheel);

  // nozzle
  const nozzle = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.088, 0.12, 0.62, 16)),
    mats.brass,
  );
  nozzle.position.y = 0.46;
  group.add(nozzle);
  const knurl = new THREE.Mesh(keep(new THREE.TorusGeometry(0.1, 0.022, 5, 16)), mats.steel);
  knurl.rotation.x = Math.PI / 2;
  knurl.position.y = 0.3;
  group.add(knurl);

  // flame guard around the tip
  const guard = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.14, 0.115, 0.2, 16, 1, true)),
    mats.steel,
  );
  guard.position.y = 0.79;
  guard.material = mats.steel;
  group.add(guard);

  // trigger
  const trigger = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.26, 0.1)), mats.resin);
  trigger.position.set(0, -0.42, 0.3);
  trigger.rotation.x = -0.25;
  group.add(trigger);

  // large piezo ignition button, facing the player
  const igniterMat = new THREE.MeshStandardMaterial({
    color: 0xd85a34,
    roughness: 0.45,
    metalness: 0.1,
    emissive: 0x2a0b04,
    emissiveIntensity: 1,
  });
  const igniter = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 18)), igniterMat);
  igniter.rotation.x = Math.PI / 2;
  igniter.position.set(0, -0.16, 0.3);
  group.add(igniter);
  const igniterRing = new THREE.Mesh(keep(new THREE.TorusGeometry(0.19, 0.026, 6, 20)), mats.steel);
  igniterRing.position.set(0, -0.16, 0.3);
  group.add(igniterRing);

  const hand = buildHand(mats, { gripRadius: 0.3 });
  hand.position.set(0, -0.42, 0);
  hand.rotation.y = -0.35;
  group.add(hand);

  shrink(group, TOOL_SCALE.torch);

  return {
    group,
    nozzleTip: new THREE.Vector3(0, 0.88 * TOOL_SCALE.torch, 0),
    igniter,
    igniterWorld: new THREE.Vector3(),
    setLit: (lit: boolean) => {
      igniterMat.emissive.setHex(lit ? 0x5c1a06 : 0x2a0b04);
      igniterMat.color.setHex(lit ? 0xef7a4c : 0xd85a34);
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      igniterMat.dispose();
      (label.material as THREE.Material).dispose();
    },
  };
}

export interface PipingBag {
  group: THREE.Group;
  /** where the meringue leaves the star nozzle, in local space */
  tip: THREE.Vector3;
  /** squeeze 0..1 — the bag bulges and the nozzle bites in */
  setSqueeze: (v: number) => void;
  dispose: () => void;
}

/** A canvas piping bag with a large open-star tip. */
export function buildPipingBag(mats: ToolMaterials): PipingBag {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];

  // bag: lathe profile — gathered at the coupler, full and heavy in the middle,
  // twisted shut at the top. A straight cone reads as paper, not canvas.
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = 0.16 + Math.sin(Math.pow(t, 0.8) * 1.42) * 0.68;
    profile.push(new THREE.Vector2(r, t * 1.7));
  }
  const bagGeo = new THREE.LatheGeometry(profile, 22);
  geos.push(bagGeo);
  const bag = new THREE.Mesh(bagGeo, mats.fabric);
  bag.position.y = 0.16;
  group.add(bag);

  // twisted tail at the top
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 14), mats.fabric);
  geos.push(tail.geometry);
  tail.position.y = 2.05;
  tail.rotation.z = 0.3;
  group.add(tail);

  const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.185, 0.2, 18), mats.resin);
  geos.push(coupler.geometry);
  coupler.position.y = 0.12;
  group.add(coupler);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.028, 6, 20), mats.steel);
  geos.push(collar.geometry);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.04;
  group.add(collar);

  // open-star tip, built from a fluted profile so the flutes are real geometry
  const pos: number[] = [];
  const idx: number[] = [];
  const points = 8;
  const seg = 24;
  const rings = 5;
  for (let k = 0; k < rings; k++) {
    const t = k / (rings - 1);
    const y = 0.02 - t * 0.3;
    const base = 0.165 - t * 0.035;
    const amp = 0.34 * t;
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * TAU;
      const r = base * (1 + amp * Math.cos(points * th));
      pos.push(r * Math.cos(th), y, r * Math.sin(th));
    }
  }
  for (let k = 0; k < rings - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const a = k * seg + i;
      const b = k * seg + ((i + 1) % seg);
      idx.push(a, a + seg, b, b, a + seg, b + seg);
    }
  }
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tipGeo.setIndex(idx);
  tipGeo.computeVertexNormals();
  geos.push(tipGeo);
  const starTip = new THREE.Mesh(tipGeo, mats.steel);
  starTip.position.y = 0.0;
  group.add(starTip);

  const hand = buildHand(mats, { gripRadius: 0.42 });
  hand.position.set(0, 1.15, 0);
  hand.rotation.y = -0.5;
  group.add(hand);

  shrink(group, TOOL_SCALE.bag);

  const setSqueeze = (v: number) => {
    const s = 1 + v * 0.06;
    bag.scale.set(s, 1 - v * 0.03, s);
  };

  return {
    group,
    tip: new THREE.Vector3(0, -0.3 * TOOL_SCALE.bag, 0),
    setSqueeze,
    dispose: () => {
      for (const g of geos) g.dispose();
    },
  };
}

export interface Knife {
  group: THREE.Group;
  /** distance from the group origin down to the blade tip */
  bladeLength: number;
  dispose: () => void;
}

/** A long serrated cake knife, held by the same adult hand. */
export function buildKnife(mats: ToolMaterials): Knife {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];

  // blade: thin, slightly tapered, edge downwards along local -Y
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.44), mats.blade);
  geos.push(blade.geometry);
  blade.position.y = -1.3;
  group.add(blade);

  // serrations, kept coarse — they only read as a silhouette
  const teeth = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.055, 0.05, 0.06),
    mats.blade,
    26,
  );
  geos.push(teeth.geometry);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    m.makeRotationY(Math.PI / 4);
    m.setPosition(0, -0.14 - i * 0.095, -0.22);
    teeth.setMatrixAt(i, m);
  }
  teeth.instanceMatrix.needsUpdate = true;
  group.add(teeth);

  const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.46), mats.blade);
  geos.push(bolster.geometry);
  bolster.position.y = 0.06;
  group.add(bolster);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.0, 14), mats.wood);
  geos.push(handle.geometry);
  handle.position.y = 0.62;
  group.add(handle);

  const hand = buildHand(mats, { gripRadius: 0.15 });
  // The blade runs down local -Y, so the arm has to leave along +Y.
  hand.rotation.set(Math.PI, -0.9, 0);
  hand.position.set(0, 0.55, 0);
  group.add(hand);

  shrink(group, TOOL_SCALE.knife);

  return {
    group,
    bladeLength: 2.62 * TOOL_SCALE.knife,
    dispose: () => {
      for (const g of geos) g.dispose();
    },
  };
}

/** The silicone hemisphere mould the frozen dome comes out of. */
export function buildMold(radius: number): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8e9aa6,
    roughness: 0.52,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 20, 0, TAU, 0, Math.PI / 2),
    mat,
  );
  geos.push(shell.geometry);
  group.add(shell);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 44), mat);
  geos.push(rim.geometry);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mat);
  geos.push(knob.geometry);
  knob.position.y = radius + 0.04;
  knob.scale.y = 0.7;
  group.add(knob);

  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      mat.dispose();
    },
  };
}
