import * as THREE from 'three';
import { makeRng, rrange } from '../core/util';
import { steelTextures, woodTextures } from '../gfx/textures';
import { makeTuberGeometry, makeTuberMaterial } from './tuber';

/**
 * Digging fork. The group's origin sits at the tine tips so levering the
 * handle is a plain rotation about the point buried in the soil.
 */
export function makeFork() {
  const steel = steelTextures();
  const wood = woodTextures();
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    map: steel.map,
    normalMap: steel.normalMap,
    roughnessMap: steel.roughnessMap,
    metalness: 0.72,
    roughness: 0.38,
    color: 0xd2d4d8,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    normalMap: wood.normalMap,
    roughnessMap: wood.roughnessMap,
    roughness: 0.8,
    metalness: 0,
    color: 0xc4a878,
  });

  const TINE_LEN = 0.27;
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(0.0125, 0.0022, TINE_LEN, 4, 1);
    g.rotateY(Math.PI * 0.25);
    g.scale(1, 1, 0.8);
    const tine = new THREE.Mesh(g, steelMat);
    tine.position.set((i - 1.5) * 0.058, TINE_LEN * 0.5, 0);
    // outer tines splay very slightly, as worn ones do
    tine.rotation.z = (i - 1.5) * 0.018;
    tine.castShadow = true;
    group.add(tine);
  }

  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.034, 0.03), steelMat);
  shoulder.position.y = TINE_LEN + 0.012;
  shoulder.castShadow = true;
  group.add(shoulder);

  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.028, 0.13, 8), steelMat);
  socket.position.y = TINE_LEN + 0.08;
  socket.castShadow = true;
  group.add(socket);

  const SHAFT = 0.34;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0185, SHAFT, 10), woodMat);
  shaft.position.y = TINE_LEN + 0.11 + SHAFT * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  const handleY = TINE_LEN + 0.11 + SHAFT;
  // D-handle: two splayed struts closed by a crossbar
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.135, 7), woodMat);
    strut.position.set(sx * 0.028, handleY + 0.058, 0);
    strut.rotation.z = -sx * 0.42;
    strut.castShadow = true;
    group.add(strut);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.128, 9), woodMat);
  grip.position.y = handleY + 0.122;
  grip.rotation.z = Math.PI * 0.5;
  grip.castShadow = true;
  group.add(grip);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 8, 6), woodMat);
    cap.position.set(sx * 0.064, handleY + 0.122, 0);
    group.add(cap);
  }

  return { group, tineLength: TINE_LEN, handleY: handleY + 0.09 };
}

/** Old field crate with gappy slats, so what is inside stays readable. */
export function makeCrate() {
  const wood = woodTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: wood.map,
    normalMap: wood.normalMap,
    roughnessMap: wood.roughnessMap,
    roughness: 0.86,
    metalness: 0,
    color: 0xb99b71,
  });
  const group = new THREE.Group();
  const W = 0.46;
  const D = 0.32;
  const H = 0.245;
  const t = 0.014;

  const addSlat = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  for (let i = 0; i < 3; i++) {
    const y = 0.035 + i * 0.082;
    addSlat(W, 0.062, t, 0, y, -D * 0.5);
    addSlat(W, 0.062, t, 0, y, D * 0.5);
    addSlat(t, 0.062, D, -W * 0.5, y, 0);
    addSlat(t, 0.062, D, W * 0.5, y, 0);
  }
  for (let i = 0; i < 4; i++) {
    addSlat(W * 0.98, t, 0.058, 0, 0.006, -D * 0.36 + i * (D * 0.24));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addSlat(0.026, H, 0.026, sx * (W * 0.5 - 0.006), H * 0.5 - 0.02, sz * (D * 0.5 - 0.006));
    }
  }
  return { group, width: W, depth: D, height: H };
}

/** A few tubers already in the crate: this is not the first hill of the day. */
export function fillCrate(crate: THREE.Group, count = 5, seed = 8) {
  const rng = makeRng(seed);
  const mat = makeTuberMaterial();
  mat.userData.uMud.value = 0.55;
  mat.userData.uWet.value = 0.4;
  for (let i = 0; i < count; i++) {
    const geo = makeTuberGeometry({
      length: rrange(rng, 0.15, 0.24),
      radius: rrange(rng, 0.033, 0.052),
      bend: rrange(rng, -0.04, 0.04),
      bias: rrange(rng, 0.3, 0.7),
      seed: Math.floor(rng() * 900),
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set(rrange(rng, -0.13, 0.13), 0.035 + (i % 2) * 0.045, rrange(rng, -0.08, 0.08));
    m.rotation.set(rrange(rng, -0.3, 0.3), rng() * Math.PI * 2, Math.PI * 0.5 + rrange(rng, -0.3, 0.3));
    crate.add(m);
  }
}

/**
 * The farmer's gloved hand. It exists to point, to steady the crown and to
 * set the crop down — never to do the digging for the player.
 */
export function makeGloveHand() {
  const group = new THREE.Group();
  const glove = new THREE.MeshStandardMaterial({ color: 0x8d8471, roughness: 0.98, metalness: 0 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x415c47, roughness: 0.8, metalness: 0 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x3d4a5e, roughness: 0.95, metalness: 0 });

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), glove);
  palm.scale.set(1.0, 0.52, 1.25);
  palm.castShadow = true;
  group.add(palm);

  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 8), grip);
  pad.scale.set(0.95, 0.3, 1.2);
  pad.position.y = -0.016;
  group.add(pad);

  const finger = (x: number, len: number, spread: number, curl: number) => {
    const f = new THREE.Group();
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, len * 0.55, 3, 7), glove);
    seg1.rotation.x = Math.PI * 0.5;
    seg1.position.z = len * 0.34;
    seg1.castShadow = true;
    f.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0092, len * 0.4, 3, 7), glove);
    seg2.rotation.x = Math.PI * 0.5 - curl;
    seg2.position.set(0, -Math.sin(curl) * len * 0.34, len * 0.72);
    seg2.castShadow = true;
    f.add(seg2);
    f.position.set(x, 0.004, 0.048);
    f.rotation.y = spread;
    return f;
  };
  group.add(finger(-0.030, 0.078, 0.12, 0.35));
  group.add(finger(-0.010, 0.086, 0.04, 0.30));
  group.add(finger(0.011, 0.081, -0.05, 0.34));
  group.add(finger(0.031, 0.066, -0.15, 0.42));

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.05, 3, 8), glove);
  thumb.rotation.set(Math.PI * 0.42, 0, -0.9);
  thumb.position.set(-0.044, -0.004, 0.012);
  thumb.castShadow = true;
  group.add(thumb);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.075, 12), glove);
  cuff.rotation.x = Math.PI * 0.5;
  cuff.position.z = -0.062;
  cuff.castShadow = true;
  group.add(cuff);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.02, 12), sleeve);
  band.rotation.x = Math.PI * 0.5;
  band.position.z = -0.096;
  group.add(band);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.15, 12), sleeve);
  arm.rotation.x = Math.PI * 0.5;
  arm.position.z = -0.172;
  arm.castShadow = true;
  group.add(arm);

  group.scale.setScalar(0.76);
  return group;
}

/** Knee and boot of the person kneeling at the row — presence, not a character. */
export function makeKneelingLeg() {
  const group = new THREE.Group();
  const trouser = new THREE.MeshStandardMaterial({ color: 0x77808c, roughness: 0.95 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x4a4e42, roughness: 0.62 });

  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 0.36, 12), trouser);
  thigh.rotation.z = Math.PI * 0.5;
  thigh.rotation.y = 0.25;
  thigh.position.set(0.16, 0.10, 0);
  thigh.castShadow = true;
  group.add(thigh);

  const knee = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10), trouser);
  knee.position.set(-0.02, 0.085, 0.02);
  knee.scale.set(1, 0.95, 1.1);
  knee.castShadow = true;
  group.add(knee);

  const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.30, 12), rubber);
  shin.rotation.x = Math.PI * 0.5;
  shin.position.set(-0.03, 0.075, -0.19);
  shin.castShadow = true;
  group.add(shin);

  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.09, 0.22), rubber);
  boot.position.set(-0.03, 0.045, -0.4);
  boot.castShadow = true;
  group.add(boot);

  return group;
}
