/* Hand gear: the ice auger, the slush scoop, the little rod, the rig,
   and the bucket the catch goes into. All modelled, not sprites. */
import * as THREE from 'three';
import { HOLE_R } from './world.js';
import { softDot } from './textures.js';

const steel = (c = 0xb9c6ce, r = 0.34, m = 0.8) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const plastic = (c, r = 0.55) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.05 });

/* ---------------------------------------------------------------------
   Ice auger.  Origin at the very tip of the blade so it can be sunk into
   the ice simply by moving the group down.
   --------------------------------------------------------------------- */
export function createAuger() {
  const g = new THREE.Group();
  const R = HOLE_R * 0.98;
  const shaftLen = 0.62, turns = 4.2;

  // helical flighting — a real ribbon wrapped around the shaft
  const seg = 220, pos = [], nor = [], idx = [];
  const rIn = 0.016;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = t * turns * Math.PI * 2;
    const y = 0.045 + t * shaftLen;
    const rOut = rIn + (R - rIn) * Math.min(1, t * 5.5);   // flares out near the tip
    const pitch = 0.055;
    pos.push(Math.cos(a) * rIn, y, Math.sin(a) * rIn);
    pos.push(Math.cos(a) * rOut, y + pitch, Math.sin(a) * rOut);
    const nx = -Math.sin(a) * 0.35, nz = Math.cos(a) * 0.35;
    nor.push(nx, 1, nz); nor.push(nx, 1, nz);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const fl = new THREE.BufferGeometry();
  fl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fl.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  fl.setIndex(idx);
  fl.computeVertexNormals();
  const flight = new THREE.Mesh(fl, new THREE.MeshStandardMaterial({
    color: 0x2f6fa8, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide,
  }));
  flight.castShadow = true;
  g.add(flight);

  // shaft
  const upper = 0.30;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, shaftLen + upper, 16), steel(0xd6dfe6, 0.3, 0.9));
  shaft.position.y = 0.045 + (shaftLen + upper) / 2;
  shaft.castShadow = true;
  g.add(shaft);

  // cutting head
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.075, 12), steel(0x8f9aa2, 0.28, 0.95));
  head.position.y = 0.028; head.rotation.x = Math.PI;
  g.add(head);
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(R * 0.72, 0.007, 0.034), steel(0xa9b6bf, 0.3, 0.85));
    blade.position.set(0, 0.055, 0);
    blade.rotation.y = i * Math.PI / 2 + 0.2;
    blade.rotation.z = 0.16;
    blade.castShadow = true;
    g.add(blade);
  }

  // Z-crank handle
  const topY = 0.045 + shaftLen + upper;
  const armLen = 0.2;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, armLen, 12), steel(0xd6dfe6, 0.3, 0.9));
  arm.rotation.z = Math.PI / 2;
  arm.position.set(armLen / 2, topY, 0);
  g.add(arm);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.115, 14), plastic(0xff8a3d, 0.7));
  grip.position.set(armLen, topY - 0.065, 0);
  grip.castShadow = true;
  g.add(grip);
  const capBar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.13, 12), steel(0xd6dfe6, 0.3, 0.9));
  capBar.rotation.z = Math.PI / 2;
  capBar.position.set(armLen, topY, 0);
  g.add(capBar);
  const topGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 14), plastic(0xff8a3d, 0.7));
  topGrip.rotation.z = Math.PI / 2;
  topGrip.position.set(-0.035, topY, 0);
  g.add(topGrip);

  g.userData = {
    flight, grip,
    gripLocal: new THREE.Vector3(armLen, topY - 0.065, 0),
    hubLocal: new THREE.Vector3(0, topY, 0),      // the axis the handle swings around
    topY,
  };
  return g;
}

/* ---------------------------------------------------------------------
   Slush scoop — perforated plastic bowl on a stick
   --------------------------------------------------------------------- */
function perforationAlpha(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  const step = size / 9;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      g.beginPath();
      g.arc((x + 0.5 + (y % 2) * 0.5) * step, (y + 0.5) * step, step * 0.26, 0, 7);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

export function createScoop() {
  const g = new THREE.Group();
  const R = 0.075;
  const bowlGeo = new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
  const bowl = new THREE.Mesh(bowlGeo, new THREE.MeshStandardMaterial({
    color: 0xf2f6f8, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide,
    alphaMap: perforationAlpha(128), transparent: true, alphaTest: 0.42,
  }));
  bowl.castShadow = true;
  g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.006, 8, 32), plastic(0x2f8fd0, 0.4));
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.42, 12), plastic(0x2f8fd0, 0.45));
  handle.position.set(0, 0.15, -0.19);
  handle.rotation.x = -0.62;
  handle.castShadow = true;
  g.add(handle);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), plastic(0xff8a3d, 0.6));
  knob.position.set(0, 0.29, -0.35);
  g.add(knob);
  g.userData = { bowl, R };
  return g;
}

/* ---------------------------------------------------------------------
   Rod, reel and stand — sits at the edge of the hole
   --------------------------------------------------------------------- */
export function createRod() {
  const g = new THREE.Group();
  const len = 0.44;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.009, len, 10), plastic(0x1c2b36, 0.35));
  rod.position.set(0, len / 2, 0);
  rod.castShadow = true;
  const rodPivot = new THREE.Group();
  rodPivot.add(rod);
  rodPivot.rotation.x = -0.62;
  g.add(rodPivot);

  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.021, 20), plastic(0xe25f3a, 0.5));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.024, 0.05, 0.026);
  g.add(reel);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.024, 16), plastic(0xf6f8fa, 0.5));
  spool.rotation.z = Math.PI / 2;
  spool.position.copy(reel.position);
  g.add(spool);

  // little wooden stand
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.09), plastic(0xa8794f, 0.85));
  base.position.y = 0.009;
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10), plastic(0xa8794f, 0.85));
  post.position.set(0, 0.045, -0.03);
  g.add(post);

  // tip of the rod in local space — where the line leaves
  const tip = new THREE.Object3D();
  tip.position.set(0, Math.cos(0.62) * len, -Math.sin(0.62) * len * -1);
  rodPivot.add(new THREE.Object3D());
  const tipHolder = new THREE.Object3D();
  tipHolder.position.set(0, len, 0);
  rodPivot.add(tipHolder);

  g.userData = { rodPivot, tipHolder, reel, spool };
  return g;
}

/* ---------------------------------------------------------------------
   The rig at the end of the line: sinker, two hooks with red beads,
   plus a soft glow so a small child can always find it in the dark water.
   --------------------------------------------------------------------- */
export function createRig() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(1.45);
  const sinker = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.02, 4, 10), steel(0x6d7880, 0.35, 0.9));
  sinker.position.y = -0.035;
  inner.add(sinker);

  const beads = [];
  for (let i = 0; i < 2; i++) {
    const arm = new THREE.Group();
    arm.position.y = 0.012 - i * 0.042;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0016, 6, 12, Math.PI * 1.4),
      steel(0xdfe6ea, 0.3, 0.9));
    hook.rotation.set(Math.PI / 2, 0, 0);
    hook.position.set(0.019, -0.008, 0);
    arm.add(hook);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xff3b30, roughness: 0.3, metalness: 0.1,
        emissive: 0xff2a10, emissiveIntensity: 0.55,
      }));
    bead.position.set(0.019, 0.004, 0);
    arm.add(bead);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.02, 6), steel(0xcfd8de, 0.3, 0.9));
    stem.rotation.z = Math.PI / 2;
    stem.position.set(0.0095, 0.006, 0);
    arm.add(stem);
    inner.add(arm);
    beads.push(bead);
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDot(64), color: 0xffd9a0, transparent: true, opacity: 0.3,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.scale.setScalar(0.12);
  glow.renderOrder = 12;
  g.add(glow);
  g.add(inner);

  g.userData = { beads, glow, sinker };
  return g;
}

/* ---------------------------------------------------------------------
   Bucket for the catch
   --------------------------------------------------------------------- */
export function createBucket() {
  const g = new THREE.Group();
  const mat = plastic(0x3fa9e0, 0.68);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.068, 0.125, 26, 1, true), mat);
  body.material.side = THREE.DoubleSide;
  body.position.y = 0.0625;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.068, 26), plastic(0x2b7fac, 0.6));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.004;
  g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 8, 28), plastic(0x2b7fac, 0.4));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.125;
  g.add(rim);
  // a splash of water inside
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.075, 26),
    new THREE.MeshStandardMaterial({ color: 0x0b3247, roughness: 0.42, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  g.add(water);
  g.userData = { water };
  return g;
}
