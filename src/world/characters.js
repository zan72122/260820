/**
 * Hero characters.
 *
 * Three or four articulated figures only — everyone further away is part of the
 * instanced distant crowd. Deliberately soft and stylised: the photographic
 * detail budget belongs to the fruit and the beach, and a stylised child avatar
 * keeps the "blindfolded person swinging a stick" reading safe and playful.
 */
import * as THREE from 'three';
import { makeRng, makeBlobAlpha } from '../textures.js';

let BLOB = null;
const contactBlob = () => (BLOB ??= makeBlobAlpha(96, 0.8));

const SKIN = [0xf0c9a4, 0xe8b98d, 0xd9a274, 0xf5d3b3];

function capsule(r, len, color, rough = 0.85) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: rough }));
}

function limb(parent, r, len, color, originY) {
  const pivot = new THREE.Group();
  pivot.position.y = originY;
  const m = capsule(r, len, color);
  m.position.y = -(len / 2 + r * 0.4);
  m.castShadow = true;
  pivot.add(m);
  pivot.userData.end = -(len + r * 0.4);
  parent.add(pivot);
  return pivot;
}

function ball(r, color, rough = 0.75) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 10, 8),
    new THREE.MeshStandardMaterial({ color, roughness: rough }),
  );
  m.castShadow = true;
  return m;
}

/**
 * @param {object} opts height (m), palette, wearsHat, etc.
 */
export function buildCharacter(opts = {}) {
  const {
    height = 1.4,
    skin = SKIN[0],
    outfit = 0x2f6fb5,
    outfit2 = 0xffffff,
    hair = 0x2a1c14,
    seed = 1,
  } = opts;
  const rng = makeRng(seed);
  const S = height / 1.4;             // everything below is authored at 1.4 m

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hipY = 0.62 * S;
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);

  const chest = capsule(0.115 * S, 0.30 * S, outfit);
  chest.position.y = 0.20 * S;
  chest.scale.set(1.18, 1, 0.78);
  chest.castShadow = true;
  torso.add(chest);

  const waist = capsule(0.10 * S, 0.10 * S, outfit2);
  waist.position.y = 0.02 * S;
  waist.scale.set(1.14, 1, 0.8);
  waist.castShadow = true;
  torso.add(waist);

  const neck = new THREE.Group();
  neck.position.y = 0.40 * S;
  torso.add(neck);

  const head = new THREE.Group();
  neck.add(head);
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.098 * S, 18, 14),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72 }),
  );
  skull.position.y = 0.09 * S;
  skull.scale.set(0.94, 1.06, 1.0);
  skull.castShadow = true;
  head.add(skull);

  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.104 * S, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: hair, roughness: 0.66 }),
  );
  hairMesh.position.y = 0.095 * S;
  hairMesh.scale.set(0.98, 1.12, 1.02);
  hairMesh.castShadow = true;
  head.add(hairMesh);

  // arms
  const armColor = skin;
  const shoulderL = limb(torso, 0.036 * S, 0.19 * S, armColor, 0.345 * S);
  shoulderL.position.x = -0.135 * S;
  const shoulderR = limb(torso, 0.036 * S, 0.19 * S, armColor, 0.345 * S);
  shoulderR.position.x = 0.135 * S;
  const elbowL = limb(shoulderL, 0.032 * S, 0.18 * S, armColor, -0.23 * S);
  const elbowR = limb(shoulderR, 0.032 * S, 0.18 * S, armColor, -0.23 * S);

  // legs
  const hipL = limb(torso, 0.048 * S, 0.22 * S, skin, -0.02 * S);
  hipL.position.x = -0.058 * S;
  const hipR = limb(torso, 0.048 * S, 0.22 * S, skin, -0.02 * S);
  hipR.position.x = 0.058 * S;
  const kneeL = limb(hipL, 0.040 * S, 0.22 * S, skin, -0.27 * S);
  const kneeR = limb(hipR, 0.040 * S, 0.22 * S, skin, -0.27 * S);

  // hands
  for (const el of [elbowL, elbowR]) {
    const hand = ball(0.040 * S, skin, 0.7);
    hand.position.y = -0.24 * S;
    hand.scale.set(0.9, 1.15, 0.65);
    el.add(hand);
  }
  // bare feet on the sand
  for (const kn of [kneeL, kneeR]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.070 * S, 0.045 * S, 0.135 * S),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }),
    );
    foot.position.set(0, -0.30 * S, 0.030 * S);
    foot.castShadow = true;
    kn.add(foot);
  }
  // swim shorts over the hips
  const shorts = capsule(0.098 * S, 0.11 * S, outfit2);
  shorts.position.y = -0.045 * S;
  shorts.scale.set(1.22, 1, 0.92);
  shorts.castShadow = true;
  torso.add(shorts);

  if (opts.hat) {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20 * S, 0.215 * S, 0.012 * S, 18),
      new THREE.MeshStandardMaterial({ color: 0xe0c286, roughness: 0.95 }),
    );
    brim.position.y = 0.145 * S;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098 * S, 0.108 * S, 0.075 * S, 16),
      new THREE.MeshStandardMaterial({ color: 0xd9b678, roughness: 0.95 }),
    );
    crown.position.y = 0.185 * S;
    brim.castShadow = crown.castShadow = true;
    head.add(brim, crown);
  }

  // soft occlusion where the feet meet the sand: real shadows are short at
  // midday and a figure without one always reads as floating
  const blobTex = contactBlob();
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36 * S, 0.26 * S),
    new THREE.MeshBasicMaterial({
      color: 0x2b2417, transparent: true, opacity: 0.30,
      alphaMap: blobTex, depthWrite: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.renderOrder = 2;
  root.add(blob);

  const ch = {
    root, body, torso, neck, head, skull,
    shoulderL, shoulderR, elbowL, elbowR,
    hipL, hipR, kneeL, kneeR,
    scale: S, height,
    state: 'idle',
    phase: rng() * 6.28,
    intensity: 0,
    headY: hipY + 0.40 * S + 0.09 * S,
    swing: 0,
  };
  return ch;
}

/** The stick, parented to the avatar's hands. */
export function buildStick(scale = 1) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017 * scale, 0.021 * scale, 0.86 * scale, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.85 }),
  );
  shaft.position.y = -0.30 * scale;
  shaft.castShadow = true;
  g.add(shaft);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023 * scale, 0.023 * scale, 0.13 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.95 }),
  );
  grip.position.y = 0.02 * scale;
  g.add(grip);
  g.userData.tipLocal = new THREE.Vector3(0, -0.74 * scale, 0);
  return g;
}

/** The blindfold worn by the avatar (seen in third person before it drops). */
export function buildBlindfoldBand(scale = 1) {
  const geo = new THREE.CylinderGeometry(0.101 * scale, 0.101 * scale, 0.062 * scale, 18, 1, true);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1d2c4d, roughness: 0.94, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 0.098 * scale, 0.004 * scale);
  m.scale.set(1.0, 1, 1.02);
  const knot = new THREE.Mesh(
    new THREE.TorusGeometry(0.02 * scale, 0.011 * scale, 6, 10),
    mat,
  );
  knot.position.set(0, 0.098 * scale, -0.10 * scale);
  knot.rotation.y = Math.PI / 2;
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.026 * scale, 0.16 * scale, 0.008 * scale),
    mat,
  );
  tail.position.set(0.01 * scale, 0.028 * scale, -0.108 * scale);
  tail.rotation.x = -0.3;
  const g = new THREE.Group();
  g.add(m, knot, tail);
  return g;
}

const lerp = THREE.MathUtils.lerp;

/**
 * Pose update. States: idle | call | cheer | walk | ready | swing.
 * `ch.swing` (0..1) drives the strike, driven externally so the animation and
 * the collision moment stay in sync.
 */
export function updateCharacter(ch, t, dt) {
  const p = ch.phase + t;
  const breathe = Math.sin(p * 1.5) * 0.5 + 0.5;
  const k = Math.min(1, dt * 10);

  const set = (obj, x, y, z) => {
    obj.rotation.x = lerp(obj.rotation.x, x, k);
    obj.rotation.y = lerp(obj.rotation.y, y, k);
    obj.rotation.z = lerp(obj.rotation.z, z, k);
  };

  ch.torso.position.y = ch.torso.userData.baseY ??= ch.torso.position.y;

  switch (ch.state) {
    case 'call': {
      // leaning forward, hands cupped by the mouth, bouncing with the shout
      const e = ch.intensity;
      const bounce = Math.sin(p * (5 + e * 4)) * (0.012 + e * 0.03);
      ch.torso.position.y = ch.torso.userData.baseY + bounce;
      set(ch.torso, -0.16 - e * 0.16, ch.torso.rotation.y, 0);
      set(ch.neck, -0.10 - e * 0.12, 0, 0);
      set(ch.shoulderL, -2.05 - e * 0.25, 0, 0.62);
      set(ch.shoulderR, -2.05 - e * 0.25, 0, -0.62);
      set(ch.elbowL, -1.15, 0, -0.5);
      set(ch.elbowR, -1.15, 0, 0.5);
      set(ch.hipL, 0.06, 0, 0.05); set(ch.hipR, -0.06, 0, -0.05);
      set(ch.kneeL, -0.12, 0, 0); set(ch.kneeR, -0.12, 0, 0);
      break;
    }
    case 'cheer': {
      const bounce = Math.abs(Math.sin(p * 6.2)) * 0.09;
      ch.torso.position.y = ch.torso.userData.baseY + bounce;
      set(ch.torso, -0.05, ch.torso.rotation.y, Math.sin(p * 6.2) * 0.06);
      set(ch.neck, -0.22, 0, 0);
      set(ch.shoulderL, -2.42 + Math.sin(p * 7) * 0.28, 0, 0.62);
      set(ch.shoulderR, -2.42 + Math.cos(p * 7) * 0.28, 0, -0.62);
      set(ch.elbowL, -0.40, 0, -0.18); set(ch.elbowR, -0.40, 0, 0.18);
      set(ch.hipL, 0.1, 0, 0.08); set(ch.hipR, -0.1, 0, -0.08);
      set(ch.kneeL, -0.3, 0, 0); set(ch.kneeR, -0.3, 0, 0);
      break;
    }
    case 'walk': {
      const g = p * 4.6;
      set(ch.torso, 0.06, ch.torso.rotation.y, 0);
      set(ch.neck, 0.03, 0, 0);
      set(ch.hipL, Math.sin(g) * 0.62, 0, 0.04);
      set(ch.hipR, Math.sin(g + Math.PI) * 0.62, 0, -0.04);
      set(ch.kneeL, -Math.max(0, Math.sin(g - 0.8)) * 0.8, 0, 0);
      set(ch.kneeR, -Math.max(0, Math.sin(g + Math.PI - 0.8)) * 0.8, 0, 0);
      // arms held forward, feeling the way — not swinging freely
      set(ch.shoulderL, -0.95 + Math.sin(g + Math.PI) * 0.12, 0, 0.22);
      set(ch.shoulderR, -0.95 + Math.sin(g) * 0.12, 0, -0.22);
      set(ch.elbowL, -0.75, 0, -0.15); set(ch.elbowR, -0.75, 0, 0.15);
      break;
    }
    case 'ready': {
      set(ch.torso, -0.05, ch.torso.rotation.y, 0);
      set(ch.neck, 0.08, 0, 0);
      set(ch.shoulderL, -2.35, 0, 0.30);
      set(ch.shoulderR, -2.35, 0, -0.30);
      set(ch.elbowL, -0.55, 0, 0); set(ch.elbowR, -0.55, 0, 0);
      set(ch.hipL, 0.1, 0, 0.06); set(ch.hipR, -0.16, 0, -0.06);
      set(ch.kneeL, -0.16, 0, 0); set(ch.kneeR, -0.24, 0, 0);
      break;
    }
    case 'swing': {
      // s: 0 wound up overhead -> 1 follow-through low
      const s = ch.swing;
      const arm = lerp(-2.6, 0.55, s);
      const kf = Math.min(1, dt * 26);
      const setF = (o, x, y, z) => {
        o.rotation.x = lerp(o.rotation.x, x, kf);
        o.rotation.y = lerp(o.rotation.y, y, kf);
        o.rotation.z = lerp(o.rotation.z, z, kf);
      };
      setF(ch.torso, lerp(-0.28, 0.42, s), ch.torso.rotation.y, 0);
      setF(ch.neck, lerp(0.16, -0.12, s), 0, 0);
      setF(ch.shoulderL, arm, 0, 0.24);
      setF(ch.shoulderR, arm, 0, -0.24);
      setF(ch.elbowL, lerp(-0.85, -0.15, s), 0, 0);
      setF(ch.elbowR, lerp(-0.85, -0.15, s), 0, 0);
      setF(ch.hipL, lerp(0.05, 0.30, s), 0, 0.06);
      setF(ch.hipR, lerp(-0.2, -0.05, s), 0, -0.06);
      setF(ch.kneeL, lerp(-0.15, -0.45, s), 0, 0);
      setF(ch.kneeR, lerp(-0.3, -0.5, s), 0, 0);
      break;
    }
    default: {
      // idle: quiet breathing and a little weight shift
      ch.torso.position.y = ch.torso.userData.baseY + breathe * 0.008;
      set(ch.torso, 0.02, ch.torso.rotation.y, Math.sin(p * 0.7) * 0.03);
      set(ch.neck, Math.sin(p * 0.5) * 0.05, Math.sin(p * 0.33) * 0.22, 0);
      set(ch.shoulderL, -0.06 + Math.sin(p * 0.9) * 0.05, 0, 0.13);
      set(ch.shoulderR, -0.06 + Math.cos(p * 0.9) * 0.05, 0, -0.13);
      set(ch.elbowL, -0.22, 0, 0); set(ch.elbowR, -0.22, 0, 0);
      set(ch.hipL, 0.02, 0, 0.03); set(ch.hipR, -0.02, 0, -0.03);
      set(ch.kneeL, -0.05, 0, 0); set(ch.kneeR, -0.05, 0, 0);
    }
  }
}
