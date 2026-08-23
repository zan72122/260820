// A small, sturdy unicorn built from primitives and driven entirely in
// code: grounded hooves, weight shifts, a braced stance when pulling.
// It must never float, and it must visibly use shoulders and body —
// not just the neck — when it works on the knot.

import * as THREE from 'three';
import { clamp, damp, lerp } from './util';
import { terrainHeight } from './world';

export type UnicornMode = 'idle' | 'walk' | 'brace' | 'pull';

export interface UnicornInput {
  mode: UnicornMode;
  lookTarget: THREE.Vector3;   // what the ears/nose point to
  hornTarget: THREE.Vector3;   // what the horn tip reaches for
  hornReach: number;           // 0 head high .. 1 horn extended to target
  torque: number;              // -1..1 current unwinding effort
  effort: number;              // 0..1 |gesture speed|
  hintNudge: number;           // 0..1 head nudge toward correct direction
  walkDir: THREE.Vector3;      // desired movement (walk mode / free steps)
  windAmp: number;
}

const BODY = 0xdcd2c1;
const MANE = 0x8d879e;
const HOOF = 0x4a4440;
const MUZZLE = 0xcabfae;

export class Unicorn {
  root = new THREE.Group();
  private body = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private hornTip = new THREE.Object3D();
  private legs: Leg[] = [];
  private tail = new THREE.Group();
  private maneStrips: THREE.Mesh[] = [];
  private earL!: THREE.Mesh;
  private earR!: THREE.Mesh;
  private walkPhase = 0;
  private breath = 0;
  private stepAnim = 0;      // re-plant animation timer
  private stepLeg = 0;
  private pullAccum = 0;
  private crouch = 0;
  private leanZ = 0;
  private leanX = 0;
  heading = Math.PI; // faces -x initially

  constructor() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: BODY });
    const maneMat = new THREE.MeshLambertMaterial({ color: MANE });
    const hoofMat = new THREE.MeshLambertMaterial({ color: HOOF });
    const muzzleMat = new THREE.MeshLambertMaterial({ color: MUZZLE });

    // torso: capsule along local +z (forward)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 6, 12), bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 1.28;
    torso.scale.set(1, 1, 1.08);
    this.body.add(torso);
    // chest slightly deeper than rump (weight forward)
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), bodyMat);
    chest.position.set(0, 1.22, 0.5);
    chest.scale.set(0.95, 1.05, 0.9);
    this.body.add(chest);

    // neck: group pivots at chest top
    this.neck.position.set(0, 1.55, 0.62);
    const neckMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.52, 4, 8), bodyMat);
    neckMesh.position.set(0, 0.3, 0.1);
    neckMesh.rotation.x = -0.5;
    this.neck.add(neckMesh);
    this.body.add(this.neck);

    // head at neck end
    this.head.position.set(0, 0.62, 0.28);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), bodyMat);
    skull.scale.set(0.85, 0.9, 1.05);
    this.head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.3, 8), muzzleMat);
    muzzle.rotation.x = Math.PI / 2 - 0.25;
    muzzle.position.set(0, -0.05, 0.28);
    this.head.add(muzzle);
    // ears
    const earGeo = new THREE.ConeGeometry(0.05, 0.16, 5);
    this.earL = new THREE.Mesh(earGeo, bodyMat);
    this.earL.position.set(-0.1, 0.2, -0.02);
    this.earR = new THREE.Mesh(earGeo, bodyMat);
    this.earR.position.set(0.1, 0.2, -0.02);
    this.head.add(this.earL, this.earR);
    // spiral horn
    const horn = makeHorn();
    horn.position.set(0, 0.17, 0.1);
    horn.rotation.x = 0.35;
    this.head.add(horn);
    this.hornTip.position.set(0, 0.95, 0); // tip of the tapered helix
    horn.add(this.hornTip);
    this.neck.add(this.head);

    // mane: a few offset strips along the neck (never a single smooth shell)
    for (let i = 0; i < 5; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34 - i * 0.03, 0.16), maneMat);
      strip.position.set(0.02 * ((i % 2) * 2 - 1), 0.5 - i * 0.13, -0.13 - i * 0.02);
      strip.rotation.x = -0.4;
      this.neck.add(strip);
      this.maneStrips.push(strip);
    }
    const forelock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), maneMat);
    forelock.position.set(0, 0.16, 0.06);
    this.head.add(forelock);

    // tail
    this.tail.position.set(0, 1.42, -0.72);
    const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 6), maneMat);
    tailMesh.position.y = -0.32;
    tailMesh.rotation.x = 0.3;
    this.tail.add(tailMesh);
    this.body.add(this.tail);

    // legs: pivot heights, lateral/longitudinal offsets
    const legDefs = [
      { x: -0.24, z: 0.42 },  // front left
      { x: 0.24, z: 0.42 },   // front right
      { x: -0.24, z: -0.46 }, // back left
      { x: 0.24, z: -0.46 },  // back right
    ];
    for (const def of legDefs) {
      const leg = new Leg(bodyMat, hoofMat, def.x, def.z);
      this.body.add(leg.pivot);
      this.legs.push(leg);
    }

    this.root.add(this.body);
  }

  hornTipWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.hornTip.getWorldPosition(out);
  }

  /** trigger a visible fore-hoof re-plant (called when pull effort accumulates) */
  replant() {
    if (this.stepAnim <= 0) {
      this.stepAnim = 0.38;
      this.stepLeg = this.stepLeg === 0 ? 1 : 0;
    }
  }

  update(dt: number, time: number, inp: UnicornInput) {
    const p = this.root.position;

    // --- locomotion ---
    let moving = 0;
    if (inp.mode === 'walk' && inp.walkDir.lengthSq() > 0.0001) {
      const speed = 1.5;
      p.x += inp.walkDir.x * speed * dt;
      p.z += inp.walkDir.z * speed * dt;
      const targetHeading = Math.atan2(inp.walkDir.x, inp.walkDir.z);
      this.heading = dampAngle(this.heading, targetHeading, 5, dt);
      moving = 1;
      this.walkPhase += dt * 5.2;
    } else {
      // face the look target (yaw only), slowly
      const to = new THREE.Vector3().subVectors(inp.lookTarget, p);
      const targetHeading = Math.atan2(to.x, to.z);
      this.heading = dampAngle(this.heading, targetHeading, inp.mode === 'idle' ? 0.8 : 2.5, dt);
      this.walkPhase = damp(this.walkPhase % (Math.PI * 2), 0, 4, dt);
    }

    // --- grounding: sample terrain under body + orient to slope ---
    const hC = terrainHeight(p.x, p.z);
    const ahead = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const hF = terrainHeight(p.x + ahead.x * 0.6, p.z + ahead.z * 0.6);
    const hB = terrainHeight(p.x - ahead.x * 0.6, p.z - ahead.z * 0.6);
    const right = new THREE.Vector3(ahead.z, 0, -ahead.x);
    const hR = terrainHeight(p.x + right.x * 0.35, p.z + right.z * 0.35);
    const hL = terrainHeight(p.x - right.x * 0.35, p.z - right.z * 0.35);
    p.y = damp(p.y, hC, 12, dt);
    const pitchSlope = Math.atan2(hF - hB, 1.2);
    const rollSlope = Math.atan2(hR - hL, 0.7);

    // --- posture ---
    const braceT = inp.mode === 'brace' || inp.mode === 'pull' ? 1 : 0;
    this.crouch = damp(this.crouch, braceT * 0.09 + inp.effort * 0.05, 5, dt);
    // pulling: lean back & sideways against the twist; shoulders take load
    const targetLeanZ = inp.mode === 'pull' ? -0.10 - inp.effort * 0.08 : 0;
    const targetLeanX = inp.mode === 'pull' ? inp.torque * 0.07 : 0;
    this.leanZ = damp(this.leanZ, targetLeanZ, 5, dt);
    this.leanX = damp(this.leanX, targetLeanX, 5, dt);

    this.breath += dt * (1.1 + inp.effort * 1.4);
    const breathS = 1 + Math.sin(this.breath) * 0.012;

    this.root.rotation.set(0, 0, 0);
    this.root.rotateY(this.heading);
    this.root.rotateX(pitchSlope * 0.55 + this.leanZ);
    this.root.rotateZ(-rollSlope * 0.4 + this.leanX);

    this.body.position.y = -this.crouch;
    this.body.scale.set(breathS, 1 / breathS, breathS);

    // --- neck & head: reach horn toward target ---
    const hornT = inp.hornTarget;
    const neckWorld = new THREE.Vector3();
    this.neck.getWorldPosition(neckWorld);
    const toT = new THREE.Vector3().subVectors(hornT, neckWorld);
    const invRoot = this.root.quaternion.clone().invert();
    toT.applyQuaternion(invRoot);
    const yaw = clamp(Math.atan2(toT.x, toT.z), -0.9, 0.9);
    const flat = Math.hypot(toT.x, toT.z);
    // aim pitch: >0 means the target is above the head
    const pitchAim = clamp(Math.atan2(toT.y - 0.4, flat), -0.5, 1.1);
    const reach = inp.hornReach;
    const nod = Math.sin(time * 0.9) * 0.03 * (1 - reach);
    // neck leans forward and rises with the target; head finishes the aim
    this.neck.rotation.set(
      damp(this.neck.rotation.x, 0.18 - pitchAim * (0.25 + reach * 0.3) + nod - braceT * 0.05, 6, dt),
      damp(this.neck.rotation.y, yaw * 0.55, 6, dt),
      0
    );
    // hint nudge: head tips opposite the knot's winding, briefly
    const nudge = inp.hintNudge * Math.sin(time * 2.2) * 0.25;
    this.head.rotation.set(
      damp(this.head.rotation.x, -pitchAim * (0.3 + reach * 0.35) + 0.08, 6, dt),
      damp(this.head.rotation.y, yaw * 0.45 + nudge, 6, dt),
      damp(this.head.rotation.z, inp.torque * 0.12, 6, dt)
    );
    // neck strain while pulling
    const strain = 1 + inp.effort * 0.05;
    this.neck.scale.set(strain, 1, strain);

    // ears prick toward the cloud; flick occasionally
    const flick = Math.sin(time * 0.7) > 0.985 ? 0.5 : 0;
    this.earL.rotation.z = 0.3 + flick;
    this.earR.rotation.z = -0.3;
    this.earL.rotation.x = -0.2 - reach * 0.15;
    this.earR.rotation.x = -0.2 - reach * 0.15 - flick * 0.3;

    // tail: wind + effort swish
    this.tail.rotation.x = 0.25 + Math.sin(time * 1.3) * 0.12 * inp.windAmp;
    this.tail.rotation.z = Math.sin(time * 1.7 + 1) * (0.1 + inp.effort * 0.25);

    // mane blown by wind (world -x → +x)
    const windLocal = Math.cos(this.heading); // how much +x aligns with local z
    for (let i = 0; i < this.maneStrips.length; i++) {
      const m = this.maneStrips[i];
      m.rotation.z = Math.sin(time * 2.1 + i * 1.3) * 0.12 * inp.windAmp + windLocal * 0.15 * inp.windAmp;
    }

    // --- legs ---
    if (this.stepAnim > 0) this.stepAnim -= dt;
    for (let i = 0; i < 4; i++) {
      const leg = this.legs[i];
      const isFront = i < 2;
      let swing = 0, lift = 0;
      if (moving > 0) {
        const ph = this.walkPhase + (i === 0 || i === 3 ? 0 : Math.PI);
        swing = Math.sin(ph) * 0.45;
        lift = Math.max(0, Math.sin(ph + Math.PI / 2)) * 0.14;
      } else if (braceT > 0) {
        // braced: front legs planted wide & slightly forward
        swing = isFront ? 0.18 : -0.12;
        // re-plant animation on one fore hoof
        if (isFront && i === this.stepLeg && this.stepAnim > 0) {
          const t = 1 - this.stepAnim / 0.38;
          lift = Math.sin(t * Math.PI) * 0.16;
          swing += Math.sin(t * Math.PI) * -0.2;
        }
      }
      leg.pose(swing, lift, this.crouch, isFront ? 0.1 * braceT : 0);
      // per-hoof ground adaptation
      const hoofWorld = leg.hoofWorld(new THREE.Vector3());
      const gh = terrainHeight(hoofWorld.x, hoofWorld.z);
      leg.groundAdjust(gh - hoofWorld.y + lift * 0.0, dt);
    }
  }
}

class Leg {
  pivot = new THREE.Group();
  private lower = new THREE.Group();
  private hoof: THREE.Mesh;
  private adj = 0;

  constructor(bodyMat: THREE.Material, hoofMat: THREE.Material, x: number, z: number) {
    this.pivot.position.set(x, 1.05, z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.52, 6), bodyMat);
    upper.position.y = -0.26;
    this.pivot.add(upper);
    this.lower.position.y = -0.52;
    const lowerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.42, 6), bodyMat);
    lowerMesh.position.y = -0.21;
    this.lower.add(lowerMesh);
    this.hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 8), hoofMat);
    this.hoof.position.y = -0.46;
    this.lower.add(this.hoof);
    this.pivot.add(this.lower);
  }

  pose(swing: number, lift: number, crouch: number, spread: number) {
    this.pivot.rotation.x = swing;
    this.pivot.rotation.z = spread * (this.pivot.position.x > 0 ? -1 : 1);
    this.lower.rotation.x = -swing * 0.6 + lift * 2.2 + crouch * 1.4;
    this.pivot.position.y = 1.05 - lift * 0.2;
  }

  hoofWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.hoof.getWorldPosition(out);
  }

  groundAdjust(delta: number, dt: number) {
    // stretch/shorten the lower leg slightly so hooves meet uneven ground
    this.adj = damp(this.adj, clamp(delta, -0.14, 0.1), 10, dt);
    this.lower.position.y = -0.52 + this.adj;
  }
}

function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-lambda * dt));
}

function makeHorn(): THREE.Mesh {
  // tapered helix: rings along a straight spine, radius→0, spiral groove
  const turns = 3.2, segs = 26, ringN = 7, len = 0.95, baseR = 0.085;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = baseR * (1 - t * 0.94);
    const y = t * len;
    const spiral = t * turns * Math.PI * 2;
    for (let j = 0; j <= ringN; j++) {
      const a = (j / ringN) * Math.PI * 2;
      // groove: radius dips along the spiral line
      const groove = 0.82 + 0.18 * Math.cos(a * 1.0 - spiral);
      pos.push(Math.cos(a) * r * groove, y, Math.sin(a) * r * groove);
      const shade = 0.86 + 0.1 * Math.cos(a - spiral);
      col.push(0.93 * shade, 0.9 * shade, 0.84 * shade);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < ringN; j++) {
      const a = i * (ringN + 1) + j;
      const b = a + ringN + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(g, m);
}
