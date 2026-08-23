import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, smoothstep, fbm } from './core';

/**
 * Procedural small horse (pony ~1.15 m withers) with:
 *  - four-beat walk gait, body bob and lateral weight shift
 *  - neck/head aiming with limits; the body steps over when a target is
 *    out of reach, and shoulders compensate on wide head turns
 *  - a spiral-grooved horn that works as a real spool (see threads.ts)
 *  - a "test the bridge with one forehoof" behaviour
 */

export interface HornSpec {
  group: THREE.Group;      // horn local space: +Y along horn axis, origin at base
  length: number;
  r0: number;              // base radius
  r1: number;              // tip radius
  ridgeTurns: number;
}

type GroundFn = (x: number, z: number) => number;

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  hoofMesh: THREE.Mesh;
  phase: number;         // gait offset 0..1
  front: boolean;
  side: number;          // -1 left, +1 right
  restX: number;
  planted: boolean;
}

function dappleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9b4ac';
  g.fillRect(0, 0, 256, 256);
  // wet, slightly darkened coat with faint dapples — no pink, no glow
  for (let i = 0; i < 260; i++) {
    const x = (i * 97.7) % 256, y = (i * 51.3) % 256;
    const r = 6 + (i * 13) % 14;
    const l = 165 + ((i * 29) % 40);
    g.fillStyle = `rgba(${l},${l - 4},${l - 10},0.14)`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 120; i++) {
    const x = (i * 33.1) % 256, y = (i * 87.9) % 256;
    g.fillStyle = 'rgba(94,92,88,0.10)';
    g.beginPath(); g.arc(x, y, 3 + (i % 9), 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Unicorn {
  root = new THREE.Group();
  body = new THREE.Group();
  neck = new THREE.Group();
  head = new THREE.Group();
  hornGroup = new THREE.Group();
  hornSpec: HornSpec;

  private legs: Leg[] = [];
  private earL!: THREE.Group;
  private earR!: THREE.Group;
  private chest!: THREE.Mesh;
  private tail!: THREE.Mesh;

  private groundFn: GroundFn;
  private baseNeckX = -0.72;
  private baseHeadX = 0.86;

  // aim state (damped offsets)
  private aimTarget: THREE.Vector3 | null = null;
  private nYaw = 0; private nPitch = 0; private hYaw = 0; private hPitch = 0;
  private windPhase: number | null = null;
  private windAmp = 0;

  // locomotion
  private path: THREE.Vector3[] = [];
  private pathDone: (() => void) | null = null;
  private followTarget: THREE.Vector3 | null = null;
  private followStandoff = 0.95;
  private speed = 0;              // actual m/s
  private maxSpeed = 0.85;
  private gaitPhase = 0;
  yaw = 0;
  private yawTarget = 0;

  // hoof-test animation
  private testT = -1;
  private testOnPress: ((load: number, x: number, z: number) => void) | null = null;
  private testOnDone: (() => void) | null = null;

  onFootfall: ((pos: THREE.Vector3, soft: boolean) => void) | null = null;

  private gazeTarget: THREE.Vector3 | null = null;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private breatheT = 0;

  constructor(scene: THREE.Scene, groundFn: GroundFn) {
    this.groundFn = groundFn;
    this.buildBody();
    this.hornSpec = this.buildHorn();
    scene.add(this.root);
    this.root.position.set(0.2, 0, 4.6);
    this.yaw = this.yawTarget = 0.12;
  }

  // ------------------------------------------------------------- construction

  private coatMat!: THREE.MeshStandardMaterial;

  private buildBody(): void {
    const tex = dappleTexture();
    this.coatMat = new THREE.MeshStandardMaterial({
      map: tex, color: 0xcfcbc2, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.45
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x55504b, roughness: 0.5, envMapIntensity: 0.4 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.35, envMapIntensity: 0.7 });
    const maneMat = new THREE.MeshStandardMaterial({
      color: 0x9d9891, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.5
    });

    this.body.position.y = 0.84;
    this.root.add(this.body);

    // barrel (capsule along Z)
    const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.255, 0.62, 6, 14), this.coatMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(0.92, 1, 1.04);
    barrel.castShadow = true;
    this.body.add(barrel);

    // chest & shoulders
    this.chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), this.coatMat);
    this.chest.position.set(0, 0.02, -0.36);
    this.chest.scale.set(0.9, 1.05, 1.1);
    this.chest.castShadow = true;
    this.body.add(this.chest);

    // hindquarters
    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), this.coatMat);
    rump.position.set(0, 0.03, 0.38);
    rump.scale.set(0.95, 1.05, 1.15);
    rump.castShadow = true;
    this.body.add(rump);

    // neck: tapered capsule along +Y of neck group
    this.neck.position.set(0, 0.16, -0.44);
    this.neck.rotation.x = this.baseNeckX;
    this.body.add(this.neck);
    const neckMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 6, 12), this.coatMat);
    neckMesh.position.y = 0.22;
    neckMesh.scale.set(0.72, 1, 1.15);
    neckMesh.castShadow = true;
    this.neck.add(neckMesh);

    // head
    this.head.position.set(0, 0.5, 0);
    this.head.rotation.x = this.baseHeadX;
    this.neck.add(this.head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), this.coatMat);
    skull.scale.set(0.78, 0.95, 1.35);
    skull.position.set(0, 0.01, -0.05);
    skull.castShadow = true;
    this.head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.1, 5, 10), this.coatMat);
    muzzle.rotation.x = Math.PI / 2 - 0.22;
    muzzle.position.set(0, -0.045, -0.21);
    muzzle.scale.set(0.95, 1, 1);
    this.head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), darkMat);
    nose.position.set(0, -0.075, -0.27);
    nose.scale.set(0.9, 0.7, 0.8);
    this.head.add(nose);

    // eyes: dark, on the sides (horse anatomy), with a wet catchlight from env
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.08, envMapIntensity: 1.6 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeMat);
      eye.position.set(0.082 * s, 0.045, -0.075);
      this.head.add(eye);
    }

    // ears: small cones that pivot toward what she attends to
    const earGeo = new THREE.ConeGeometry(0.032, 0.11, 6);
    earGeo.translate(0, 0.05, 0);
    this.earL = new THREE.Group(); this.earR = new THREE.Group();
    for (const [grp, s] of [[this.earL, -1], [this.earR, 1]] as [THREE.Group, number][]) {
      const ear = new THREE.Mesh(earGeo, this.coatMat);
      ear.scale.set(1, 1, 0.55);
      grp.add(ear);
      grp.position.set(0.055 * s, 0.1, 0.04);
      grp.rotation.z = -0.28 * s;
      this.head.add(grp);
    }

    // wet mane: clumped strands lying on the neck (no constant flutter)
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const strand = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.2 - t * 0.04, 1, 3), maneMat);
      const pg = strand.geometry.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pg.count; v++) {
        const yy = pg.getY(v);
        pg.setZ(v, -yy * yy * 0.7);  // strands curve in toward the neck
      }
      strand.geometry.computeVertexNormals();
      strand.position.set(0.02 * ((i % 2) * 2 - 1), 0.06 + t * 0.42, 0.1 - t * 0.02);
      strand.rotation.x = -0.5;
      strand.rotation.y = (i % 2 ? 1 : -1) * 0.35;
      this.neck.add(strand);
    }
    const forelock = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), maneMat);
    forelock.position.set(0.01, 0.075, -0.1);
    forelock.rotation.x = -1.1;
    this.head.add(forelock);

    // tail: heavy and wet, hangs
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, 0.52),
      new THREE.Vector3(0, -0.12, 0.62),
      new THREE.Vector3(0.03, -0.42, 0.6),
      new THREE.Vector3(0.01, -0.62, 0.55)
    ]);
    this.tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, 0.045, 8), new THREE.MeshStandardMaterial({
      color: 0x8e8983, roughness: 0.55, envMapIntensity: 0.4
    }));
    this.tail.castShadow = true;
    this.body.add(this.tail);

    // legs
    const mkLeg = (front: boolean, side: number, phase: number): Leg => {
      const hip = new THREE.Group();
      const hx = (front ? 0.155 : 0.165) * side;
      const hz = front ? -0.38 : 0.42;
      hip.position.set(hx, -0.1, hz);
      this.body.add(hip);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(front ? 0.055 : 0.07, 0.3, 4, 8), this.coatMat);
      upper.position.y = -0.17;
      upper.castShadow = true;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.35;
      hip.add(knee);
      const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.3, 4, 8), this.coatMat);
      lower.position.y = -0.17;
      lower.castShadow = true;
      knee.add(lower);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.07, 10), hoofMat);
      hoof.position.y = -0.37;
      hoof.castShadow = true;
      knee.add(hoof);
      return { hip, knee, hoofMesh: hoof, phase, front, side, restX: hx, planted: true };
    };
    // four-beat walk: LH, LF, RH, RF
    this.legs.push(mkLeg(false, -1, 0.0));   // LH
    this.legs.push(mkLeg(true, -1, 0.25));   // LF
    this.legs.push(mkLeg(false, 1, 0.5));    // RH
    this.legs.push(mkLeg(true, 1, 0.75));    // RF
  }

  private buildHorn(): HornSpec {
    const length = 0.34, r0 = 0.041, r1 = 0.0075, ridgeTurns = 6.5;
    this.hornGroup.position.set(0, 0.1, -0.115);
    this.hornGroup.rotation.x = -1.02;   // forward-up out of the forehead
    this.head.add(this.hornGroup);

    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xd8d2c4, roughness: 0.28, metalness: 0.04, envMapIntensity: 1.1
    });

    // core cone
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 0.8, r0 * 0.88, length, 12, 1), hornMat);
    core.position.y = length / 2;
    core.castShadow = true;
    this.hornGroup.add(core);

    // spiral ridge — this is the physical groove the thread seats into
    class HelixCurve extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        const y = t * length;
        const rr = lerp(r0 * 0.92, r1 * 0.85, t);
        const a = t * ridgeTurns * Math.PI * 2;
        return target.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    }
    const ridge = new THREE.Mesh(
      new THREE.TubeGeometry(new HelixCurve(), 160, 0.0075, 6),
      hornMat
    );
    ridge.castShadow = true;
    this.hornGroup.add(ridge);

    return { group: this.hornGroup, length, r0, r1, ridgeTurns };
  }

  // ------------------------------------------------------------- queries

  hornTipWorld(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, this.hornSpec.length, 0);
    this.hornGroup.updateWorldMatrix(true, false);
    return this.hornGroup.localToWorld(out);
  }
  hornPointWorld(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, this.hornSpec.length * t, 0);
    this.hornGroup.updateWorldMatrix(true, false);
    return this.hornGroup.localToWorld(out);
  }
  headWorld(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.head.matrixWorld);
  }
  hoofWorld(i: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.legs[i].hoofMesh.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.legs[i].hoofMesh.matrixWorld);
  }
  get position(): THREE.Vector3 { return this.root.position; }
  get isWalking(): boolean { return this.path.length > 0 || this.followTarget !== null; }
  get isTesting(): boolean { return this.testT >= 0; }

  // ------------------------------------------------------------- control

  setGroundFn(fn: GroundFn): void { this.groundFn = fn; }

  /** Aim the horn tip at a world point (null to relax). Body steps closer if needed. */
  setAimTarget(p: THREE.Vector3 | null): void {
    this.aimTarget = p ? p.clone() : null;
  }

  /** Circular head motion while winding: phase in radians, amp 0..1 (gesture size). */
  setWindMotion(phase: number | null, amp = 0): void {
    this.windPhase = phase;
    this.windAmp = amp;
  }

  setGaze(p: THREE.Vector3 | null): void { this.gazeTarget = p ? p.clone() : null; }

  walkTo(points: THREE.Vector3[], onDone?: () => void, maxSpeed = 0.85): void {
    this.path = points.map(p => p.clone());
    this.pathDone = onDone ?? null;
    this.followTarget = null;
    this.maxSpeed = maxSpeed;
  }

  stop(): void {
    this.path = [];
    this.followTarget = null;
    this.pathDone = null;
  }

  faceToward(p: THREE.Vector3): void {
    const d = this.tmp.copy(p).sub(this.root.position);
    if (d.lengthSq() > 0.001) this.yawTarget = Math.atan2(-d.x, -d.z);
  }

  /** Careful forehoof press on the new bridge. onPress(load01, x, z of the hoof). */
  startTestHoof(onPress: (load: number, x: number, z: number) => void, onDone: () => void): void {
    if (this.testT >= 0) return;
    this.testT = 0;
    this.testOnPress = onPress;
    this.testOnDone = onDone;
  }

  // ------------------------------------------------------------- update

  update(dt: number, t: number): void {
    dt = Math.min(dt, 0.05);
    this.breatheT += dt;
    this.updateLocomotion(dt);
    this.updateAim(dt);
    this.updateGait(dt, t);
    this.updateTestHoof(dt);
    this.updateEars(dt);
    // breathing
    const br = 1 + Math.sin(this.breatheT * 1.4) * 0.012;
    this.chest.scale.set(0.9 * br, 1.05 * br, 1.1);
  }

  private updateLocomotion(dt: number): void {
    let desired: THREE.Vector3 | null = null;
    let arrive = 0.12;

    if (this.path.length > 0) {
      desired = this.path[0];
      arrive = this.path.length > 1 ? 0.3 : 0.12;
    } else if (this.followTarget) {
      desired = this.followTarget;
      arrive = this.followStandoff;
    }

    // aim target beyond reach → step toward it (keep a natural standoff)
    if (!desired && this.aimTarget) {
      const d = this.tmp.copy(this.aimTarget).sub(this.root.position);
      d.y = 0;
      const dist = d.length();
      if (dist > 1.45) {
        desired = this.aimTarget;
        arrive = 1.0;
      }
    }

    let targetSpeed = 0;
    if (desired) {
      const d = this.tmp.copy(desired).sub(this.root.position);
      d.y = 0;
      const dist = d.length();
      if (dist > arrive) {
        this.yawTarget = Math.atan2(-d.x, -d.z);
        targetSpeed = clamp((dist - arrive) * 1.4, 0.12, this.maxSpeed);
      } else if (this.path.length > 0) {
        this.path.shift();
        if (this.path.length === 0 && this.pathDone) {
          const cb = this.pathDone;
          this.pathDone = null;
          cb();
        }
      }
    }

    this.speed = damp(this.speed, targetSpeed, 4, dt);
    this.yaw = dampAngle(this.yaw, this.yawTarget, 3.2, dt);
    this.root.rotation.y = this.yaw;

    if (this.speed > 0.01) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      this.root.position.x += fx * this.speed * dt;
      this.root.position.z += fz * this.speed * dt;
    }

    // settle body height onto terrain (hooves sink a touch into wet ground)
    const gy = this.groundFn(this.root.position.x, this.root.position.z) - 0.012;
    this.root.position.y = damp(this.root.position.y, gy, 10, dt);

    // align pitch to slope along travel direction
    const ahead = this.groundFn(
      this.root.position.x - Math.sin(this.yaw) * 0.6,
      this.root.position.z - Math.cos(this.yaw) * 0.6
    );
    const behind = this.groundFn(
      this.root.position.x + Math.sin(this.yaw) * 0.6,
      this.root.position.z + Math.cos(this.yaw) * 0.6
    );
    const pitch = clamp(Math.atan2(ahead - behind, 1.2), -0.3, 0.3);
    this.body.rotation.x = damp(this.body.rotation.x, pitch, 5, dt);
  }

  private updateAim(dt: number): void {
    let tnYaw = 0, tnPitch = 0, thYaw = 0, thPitch = 0;

    const target = this.aimTarget ?? this.gazeTarget;
    if (target) {
      // target in root-local space
      this.root.updateWorldMatrix(true, false);
      const local = this.tmp.copy(target);
      this.root.worldToLocal(local);
      const nx = local.x - this.neck.position.x;
      const ny = local.y - (this.body.position.y + this.neck.position.y);
      const nz = local.z - (this.neck.position.z - 0.1);
      const yawA = Math.atan2(-nx, -Math.min(nz, -0.05));
      const horiz = Math.max(Math.hypot(nx, nz), 0.25);
      const pitchA = Math.atan2(ny, horiz);      // elevation of target from shoulder
      const gazeOnly = !this.aimTarget;
      const k = gazeOnly ? 0.4 : 1;
      tnYaw = clamp(yawA * 0.55 * k, -0.8, 0.8);
      thYaw = clamp(yawA * 0.45 * k, -0.62, 0.62);
      // neutral horn elevation is ~40°; reduce pitch to bring tip toward target height
      const pitchOff = clamp((pitchA - 0.15), -1.15, 0.7);
      tnPitch = clamp(pitchOff * 0.62, -0.72, 0.5) * k;
      thPitch = clamp(pitchOff * 0.55, -0.62, 0.62) * k;

      // wide turns pull the shoulders around a little (and the walk system
      // will step if it's genuinely out of reach)
      if (Math.abs(yawA) > 0.75 && this.aimTarget) {
        this.yawTarget = this.yaw + clamp(yawA * 0.25, -0.35, 0.35);
      }
    }

    // circular winding motion layered on top
    if (this.windPhase !== null) {
      const a = this.windAmp;
      thYaw += Math.cos(this.windPhase) * 0.16 * a;
      thPitch += Math.sin(this.windPhase) * 0.13 * a;
      tnYaw += Math.cos(this.windPhase) * 0.05 * a;
    }

    const rate = 6;
    this.nYaw = damp(this.nYaw, tnYaw, rate, dt);
    this.nPitch = damp(this.nPitch, tnPitch, rate, dt);
    this.hYaw = damp(this.hYaw, thYaw, rate, dt);
    this.hPitch = damp(this.hPitch, thPitch, rate, dt);

    this.neck.rotation.set(this.baseNeckX + this.nPitch, this.nYaw, 0, 'YXZ');
    this.head.rotation.set(this.baseHeadX + this.hPitch, this.hYaw, 0, 'YXZ');
  }

  private updateGait(dt: number, t: number): void {
    const moving = this.speed > 0.02;
    const strideLen = 0.62;
    if (moving) this.gaitPhase = (this.gaitPhase + (this.speed / strideLen) * dt) % 1;

    const bob = moving ? Math.sin(this.gaitPhase * Math.PI * 4) * 0.014 : 0;
    const idleShift = Math.sin(this.breatheT * 0.33) * 0.01;
    this.body.position.y = 0.84 + bob + idleShift;

    // lateral weight shift toward the supporting side
    const sway = moving ? Math.sin(this.gaitPhase * Math.PI * 2) * 0.035 : 0;
    this.body.position.x = sway;
    this.body.rotation.z = -sway * 0.6;

    for (const leg of this.legs) {
      let hipA = 0, kneeA = 0, lift = 0;
      if (moving) {
        const ph = (this.gaitPhase + leg.phase) % 1;
        const swing = 0.32;                    // fraction of cycle in the air
        if (ph < swing) {
          const s = ph / swing;               // 0..1 through swing
          hipA = lerp(0.35, -0.42, s * s * (3 - 2 * s));
          lift = Math.sin(s * Math.PI) * 0.14;
          kneeA = Math.sin(s * Math.PI) * (leg.front ? 0.9 : 0.75);
          if (leg.planted) {
            leg.planted = false;
          }
        } else {
          const s = (ph - swing) / (1 - swing);   // stance: body passes over foot
          hipA = lerp(-0.42, 0.35, s);
          kneeA = 0.08;
          if (!leg.planted) {
            leg.planted = true;
            if (this.onFootfall) this.onFootfall(this.hoofWorld(this.legs.indexOf(leg), this.tmp2), this.speed < 0.4);
          }
        }
      } else {
        // standing: soft knees, occasional resting hind leg
        kneeA = 0.06 + (leg.front ? 0 : 0.05 * (0.5 + 0.5 * Math.sin(this.breatheT * 0.21 + leg.side)));
        leg.planted = true;
      }
      const sign = leg.front ? 1 : 1;
      leg.hip.rotation.x = hipA * sign;
      leg.knee.rotation.x = leg.front ? kneeA : -kneeA * 0.4;
      leg.hip.position.y = -0.1 + lift;

      // terrain adaptation: shorten/extend via knee so hooves meet the ground
      const hw = this.hoofWorld(this.legs.indexOf(leg), this.tmp2);
      const gy = this.groundFn(hw.x, hw.z);
      const err = hw.y - 0.035 - gy;
      if (!moving || leg.planted) {
        leg.knee.rotation.x += clamp(err * 1.6, -0.22, 0.32) * (leg.front ? 1 : -1);
      }
    }
  }

  private updateTestHoof(dt: number): void {
    if (this.testT < 0) return;
    this.testT += dt;
    const T = this.testT;
    const lf = this.legs[1]; // left fore
    // timeline: 0-0.7 shift weight back, 0.7-1.4 reach out, 1.4-2.4 press, 2.4-3.0 settle
    const back = smoothstep(0, 0.7, T) * (1 - smoothstep(2.4, 3.0, T));
    this.body.position.z = back * 0.085;             // haunches take the weight
    this.body.rotation.x += back * -0.05;
    const reach = smoothstep(0.7, 1.3, T);
    const press = smoothstep(1.5, 2.0, T) * (1 - smoothstep(2.1, 2.6, T));
    if (reach > 0) {
      lf.hip.rotation.x = lerp(lf.hip.rotation.x, -0.72 * reach + press * 0.1, 0.6);
      lf.knee.rotation.x = lerp(lf.knee.rotation.x, 0.55 * reach * (1 - press * 0.8), 0.6);
    }
    if (press > 0.01 && this.testOnPress) {
      const hw = this.hoofWorld(1, this.tmp2);
      this.testOnPress(press, hw.x, hw.z);
    }
    if (T > 3.05) {
      this.testT = -1;
      this.body.position.z = 0;
      const cb = this.testOnDone;
      this.testOnPress = null; this.testOnDone = null;
      if (cb) cb();
    }
  }

  private updateEars(dt: number): void {
    const target = this.gazeTarget ?? this.aimTarget;
    let want = 0.15;
    if (target) {
      this.root.updateWorldMatrix(true, false);
      const local = this.tmp.copy(target);
      this.head.worldToLocal(local);
      want = clamp(Math.atan2(-local.x, -local.z) * 0.4, -0.5, 0.5);
    }
    this.earL.rotation.x = damp(this.earL.rotation.x, -0.25 + (target ? -0.25 : 0), 5, dt);
    this.earR.rotation.x = damp(this.earR.rotation.x, -0.25 + (target ? -0.25 : 0), 5, dt);
    this.earL.rotation.y = damp(this.earL.rotation.y, want, 5, dt);
    this.earR.rotation.y = damp(this.earR.rotation.y, want, 5, dt);
  }
}
