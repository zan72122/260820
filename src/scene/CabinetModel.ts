import * as THREE from 'three';
import { MaterialSet } from './materials';

/**
 * The specimen cabinet under restoration. Door front plane is z = 0 when
 * closed; the cabinet body extends into -Z. The door pivots at the left
 * stile. The educational cylinder (LockModel) is mounted onto the door by
 * Game code; this module provides the door group and the reward.
 */
export interface CabinetRig {
  group: THREE.Group;
  doorGroup: THREE.Group;
  /** attach point for the lock, on the door's front face */
  lockMount: THREE.Group;
  strike: THREE.Mesh;
  musicBox: THREE.Group;
  musicCylinder: THREE.Mesh;
  governor: THREE.Mesh;
  setDoorAngle(a: number): void;
}

export const DOOR_HINGE_X = -0.4;
export const LOCK_ON_DOOR = new THREE.Vector3(0.3, 1.0, 0.154);

export function buildCabinet(mats: MaterialSet): CabinetRig {
  const group = new THREE.Group();
  group.name = 'cabinet';

  const W = 0.92;
  const D = 0.44;
  const H = 1.3;
  const legH = 0.12;
  const bodyY = legH + H / 2;

  // ------------------------------------------------------------- carcass
  const carcass = new THREE.Group();
  const side = (x: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, D), mats.cabinetWoodSide);
    m.position.set(x, bodyY, -D / 2 - 0.02);
    m.castShadow = true;
    m.receiveShadow = true;
    carcass.add(m);
  };
  side(-W / 2 + 0.01);
  side(W / 2 - 0.01);
  const slab = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    carcass.add(m);
    return m;
  };
  slab(W, 0.03, D + 0.04, 0, legH + H - 0.015, -D / 2, mats.cabinetWood); // top
  slab(W, 0.03, D + 0.04, 0, legH + 0.015, -D / 2, mats.cabinetWood); // bottom
  slab(W - 0.04, H - 0.06, 0.016, 0, bodyY, -D - 0.012, mats.cabinetWoodSide); // back
  // interior shelf where the reward sits
  slab(W - 0.06, 0.02, D - 0.06, 0, 0.88, -D / 2 - 0.03, mats.cabinetWood);
  // small warm display light inside (museum case lighting), aimed downward
  const displayLight = new THREE.PointLight(0xffdcae, 0.5, 0.85, 1.9);
  displayLight.position.set(0.16, 1.28, -D / 2 - 0.04);
  carcass.add(displayLight);
  // face-frame stiles beside the door
  slab(0.06, H, 0.024, -W / 2 + 0.03, bodyY, -0.012, mats.cabinetWood);
  slab(0.06, H, 0.024, W / 2 - 0.03, bodyY, -0.012, mats.cabinetWood);
  slab(W, 0.06, 0.024, 0, legH + H - 0.03, -0.012, mats.cabinetWood);
  slab(W, 0.06, 0.024, 0, legH + 0.03, -0.012, mats.cabinetWood);

  // legs with floor contact wear (slightly darkened feet)
  const legMat = mats.cabinetWoodSide;
  for (const lx of [-W / 2 + 0.04, W / 2 - 0.04]) {
    for (const lz of [-0.06, -D + 0.02]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, legH, 0.05), legMat);
      leg.position.set(lx, legH / 2, lz);
      leg.castShadow = true;
      carcass.add(leg);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.012, 0.052),
        new THREE.MeshStandardMaterial({ color: 0x2e1d0f, roughness: 0.9 })
      );
      foot.position.set(lx, 0.006, lz);
      carcass.add(foot);
    }
  }
  group.add(carcass);

  // --------------------------------------------------------------- door
  const doorGroup = new THREE.Group();
  doorGroup.position.set(DOOR_HINGE_X, 0, -0.006);
  const doorW = 0.76;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - 0.14, 0.028), mats.cabinetWood);
  door.position.set(DOOR_HINGE_X * -1 + -0.02, bodyY, 0); // centered between stiles, local
  door.position.x = doorW / 2 + 0.015; // measured from the hinge
  door.castShadow = true;
  door.receiveShadow = true;
  doorGroup.add(door);

  // raised panel detail
  const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.16, H - 0.32, 0.012), mats.cabinetWoodSide);
  panel.position.set(doorW / 2 + 0.015, bodyY, 0.016);
  panel.castShadow = true;
  doorGroup.add(panel);

  // hinges (dark iron)
  for (const hy of [bodyY - 0.42, bodyY + 0.42]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 12), mats.darkIron);
    hinge.position.set(0.006, hy, 0.01);
    doorGroup.add(hinge);
  }

  // lock mount point: the LockModel group is attached here by Game code.
  // Its local -Z points into the door.
  const lockMount = new THREE.Group();
  lockMount.position.set(LOCK_ON_DOOR.x - DOOR_HINGE_X, LOCK_ON_DOOR.y, LOCK_ON_DOOR.z);
  doorGroup.add(lockMount);
  group.add(doorGroup);

  // strike box on the right stile (receives the bolt); brass to match the
  // rest of the surface-mounted educational lock, with a dark bolt mouth
  const strike = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.052, 0.042), mats.plugBrass);
  strike.position.set(W / 2 - 0.02, LOCK_ON_DOOR.y - 0.012, 0.026);
  strike.castShadow = true;
  group.add(strike);
  const strikePlate = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.064, 0.05), mats.boltSteel);
  strikePlate.position.set(W / 2 - 0.041, LOCK_ON_DOOR.y - 0.012, 0.026);
  group.add(strikePlate);
  // strike mouth (dark opening facing the bolt)
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.028, 0.019),
    new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 1 })
  );
  mouth.position.set(W / 2 - 0.043, LOCK_ON_DOOR.y - 0.012, 0.026);
  group.add(mouth);

  // ------------------------------------------------------- reward: music box
  const musicBox = new THREE.Group();
  musicBox.position.set(0.16, 0.9, -D / 2 - 0.05);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.1), mats.cabinetWoodSide);
  base.position.y = 0.017;
  base.castShadow = true;
  musicBox.add(base);
  // pinned brass cylinder — a quiet echo of the big lock's pins
  const musicCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.08, 24),
    mats.musicBoxBrass
  );
  musicCylinder.rotation.z = Math.PI / 2;
  musicCylinder.position.set(-0.01, 0.055, 0);
  musicCylinder.castShadow = true;
  musicBox.add(musicCylinder);
  // deterministic pin pattern on the cylinder
  const pinGeo = new THREE.CylinderGeometry(0.0007, 0.0007, 0.003, 6);
  const pinMat = mats.musicBoxBrass;
  let s = 7;
  for (let i = 0; i < 46; i++) {
    s = (s * 48271) % 2147483647;
    const along = (s / 2147483647) * 0.072 - 0.036;
    s = (s * 48271) % 2147483647;
    const ang = (s / 2147483647) * Math.PI * 2;
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(along, 0, 0);
    pin.rotation.x = ang;
    pin.translateY(0.0165);
    musicCylinder.add(pin);
  }
  // steel comb
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.003, 0.03), mats.boltSteel);
  comb.position.set(-0.01, 0.042, 0.028);
  comb.rotation.x = -0.15;
  musicBox.add(comb);
  // governor (air brake fan) that spins while the box plays
  const governor = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.0012), mats.musicBoxBrass);
  governor.position.set(0.055, 0.065, -0.02);
  musicBox.add(governor);
  const govPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.045, 8), mats.boltSteel);
  govPost.position.set(0.055, 0.045, -0.02);
  musicBox.add(govPost);
  // winding key on the side
  const wind = new THREE.Group();
  const windStem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 10), mats.musicBoxBrass);
  windStem.rotation.x = Math.PI / 2;
  windStem.position.set(0.055, 0.03, 0.055);
  wind.add(windStem);
  const windWing = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.003), mats.musicBoxBrass);
  windWing.position.set(0.055, 0.03, 0.066);
  wind.add(windWing);
  musicBox.add(wind);
  group.add(musicBox);

  return {
    group,
    doorGroup,
    lockMount,
    strike,
    musicBox,
    musicCylinder,
    governor,
    setDoorAngle(a: number) {
      // positive a = open outward (toward the viewer at +Z)
      doorGroup.rotation.y = -a;
    },
  };
}
