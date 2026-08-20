import * as THREE from 'three';
import { clamp, damp, lerp } from '../util/math';
import { paintTexture } from '../util/textures';

const UP = new THREE.Vector3(0, 1, 0);
const SEG_DIR = new THREE.Vector3();

/** Positions/orients a cylinder-style limb between two local-space points. */
function segment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, rest: number) {
  const dir = SEG_DIR.subVectors(to, from);
  const len = Math.max(1e-4, dir.length());
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  mesh.scale.y = len / rest;
}

/**
 * The adult operator. Helmet, hi-vis, gloves and rubber boots — the player's
 * finger drives this person's intent, never a child's hands.
 */
export class Worker {
  readonly group = new THREE.Group();
  readonly leftHand = new THREE.Object3D();
  readonly rightHand = new THREE.Object3D();

  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private upperL: THREE.Mesh;
  private lowerL: THREE.Mesh;
  private upperR: THREE.Mesh;
  private lowerR: THREE.Mesh;
  private gloveL: THREE.Mesh;
  private gloveR: THREE.Mesh;
  private thighL: THREE.Mesh;
  private shinL: THREE.Mesh;
  private thighR: THREE.Mesh;
  private shinR: THREE.Mesh;
  private bootL: THREE.Mesh;
  private bootR: THREE.Mesh;

  private crouch = 0;
  private crouchTarget = 0;
  private facing = 0;
  private facingTarget = 0;
  private posTarget = new THREE.Vector3();
  private breathe = 0;

  private handTargetL = new THREE.Vector3();
  private handTargetR = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();

  private readonly armUpper = 0.3;
  private readonly armLower = 0.29;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private tmpE = new THREE.Vector3();
  private tmpF = new THREE.Vector3();
  private tmpG = new THREE.Vector3();
  private hipV = new THREE.Vector3();
  private kneeV = new THREE.Vector3();
  private footV = new THREE.Vector3();
  private pole = new THREE.Vector3();

  constructor() {
    const hiVis = new THREE.MeshStandardMaterial({
      map: paintTexture(0xc4cf3e, 128),
      roughness: 0.86,
      metalness: 0,
    });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x35404f, roughness: 0.9 });
    const trouser = new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.94 });
    const trouserMud = new THREE.MeshStandardMaterial({ color: 0x4a4132, roughness: 1 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.85 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x3f6f92, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.75 });
    const helmet = new THREE.MeshStandardMaterial({ color: 0xe8e5dd, roughness: 0.42, metalness: 0.05 });
    const strap = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.55, metalness: 0.25 });

    this.group.add(this.hips);
    this.hips.position.y = 0.94;
    this.hips.add(this.torso);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), trouser);
    pelvis.castShadow = true;
    this.hips.add(pelvis);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.24), shirt);
    chest.position.y = 0.31;
    chest.castShadow = true;
    this.torso.add(chest);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.4, 0.27), hiVis);
    vest.position.y = 0.3;
    vest.castShadow = true;
    this.torso.add(vest);
    for (const y of [0.2, 0.36]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.442, 0.032, 0.282), strap);
      band.position.y = y;
      this.torso.add(band);
    }

    this.torso.add(this.head);
    this.head.position.y = 0.62;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skin);
    skull.castShadow = true;
    this.head.add(skull);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), helmet);
    hat.position.y = 0.02;
    hat.castShadow = true;
    this.head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 14), helmet);
    brim.position.y = 0.028;
    this.head.add(brim);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.12), helmet);
    peak.position.set(0, 0.026, 0.15);
    this.head.add(peak);
    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.045, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.25, metalness: 0.2 })
    );
    glasses.position.set(0, 0.0, 0.1);
    this.head.add(glasses);

    const armGeo = new THREE.CylinderGeometry(0.052, 0.05, 1, 8);
    this.upperL = new THREE.Mesh(armGeo, shirt);
    this.lowerL = new THREE.Mesh(armGeo, shirt);
    this.upperR = new THREE.Mesh(armGeo, shirt);
    this.lowerR = new THREE.Mesh(armGeo, shirt);
    for (const m of [this.upperL, this.lowerL, this.upperR, this.lowerR]) {
      m.castShadow = true;
      this.torso.add(m);
    }
    const gloveGeo = new THREE.BoxGeometry(0.085, 0.1, 0.11);
    this.gloveL = new THREE.Mesh(gloveGeo, glove);
    this.gloveR = new THREE.Mesh(gloveGeo, glove);
    this.gloveL.castShadow = true;
    this.gloveR.castShadow = true;
    this.torso.add(this.gloveL, this.gloveR);
    this.gloveL.add(this.leftHand);
    this.gloveR.add(this.rightHand);

    const legGeo = new THREE.CylinderGeometry(0.075, 0.068, 1, 8);
    this.thighL = new THREE.Mesh(legGeo, trouser);
    this.thighR = new THREE.Mesh(legGeo, trouser);
    this.shinL = new THREE.Mesh(legGeo, trouserMud);
    this.shinR = new THREE.Mesh(legGeo, trouserMud);
    for (const m of [this.thighL, this.thighR, this.shinL, this.shinR]) {
      m.castShadow = true;
      this.hips.add(m);
    }
    const bootGeo = new THREE.BoxGeometry(0.12, 0.11, 0.26);
    this.bootL = new THREE.Mesh(bootGeo, boot);
    this.bootR = new THREE.Mesh(bootGeo, boot);
    this.bootL.castShadow = true;
    this.bootR.castShadow = true;
    this.hips.add(this.bootL, this.bootR);
  }

  /** Where the operator should stand, facing the work. */
  place(position: THREE.Vector3, facePoint: THREE.Vector3, crouch: number) {
    this.posTarget.copy(position);
    this.facingTarget = Math.atan2(facePoint.x - position.x, facePoint.z - position.z);
    this.crouchTarget = clamp(crouch, 0, 1);
  }

  snap() {
    this.group.position.copy(this.posTarget);
    this.facing = this.facingTarget;
    this.crouch = this.crouchTarget;
    this.group.rotation.y = this.facing;
  }

  setHandTargets(left: THREE.Vector3, right: THREE.Vector3) {
    this.handTargetL.copy(left);
    this.handTargetR.copy(right);
  }

  setLook(point: THREE.Vector3) {
    this.lookTarget.copy(point);
  }

  update(dt: number, t: number) {
    this.group.position.x = damp(this.group.position.x, this.posTarget.x, 3.0, dt);
    this.group.position.y = damp(this.group.position.y, this.posTarget.y, 4.0, dt);
    this.group.position.z = damp(this.group.position.z, this.posTarget.z, 3.0, dt);

    let d = this.facingTarget - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * (1 - Math.exp(-4.0 * dt));
    this.group.rotation.y = this.facing;

    this.crouch = damp(this.crouch, this.crouchTarget, 3.2, dt);
    this.breathe = t;

    const hipY = lerp(0.94, 0.5, this.crouch) + Math.sin(t * 1.5) * 0.006;
    this.hips.position.y = hipY;
    this.torso.rotation.x = lerp(0.06, 0.42, this.crouch);
    this.torso.position.z = lerp(0, 0.04, this.crouch);

    this.poseLegs();
    this.group.updateMatrixWorld();

    this.solveArm(this.handTargetL, -0.2, this.upperL, this.lowerL, this.gloveL, -1);
    this.solveArm(this.handTargetR, 0.2, this.upperR, this.lowerR, this.gloveR, 1);
    this.poseHead();
  }

  private poseLegs() {
    const c = this.crouch;
    const kneeFwd = lerp(0.06, 0.34, c);
    const kneeY = lerp(-0.46, -0.24, c);
    const footY = -this.hips.position.y + 0.055;
    for (const side of [-1, 1]) {
      const hip = this.hipV.set(side * 0.11, -0.06, 0);
      const knee = this.kneeV.set(side * 0.12, kneeY, kneeFwd);
      const foot = this.footV.set(side * 0.13, footY, kneeFwd * lerp(1.0, 0.45, c));
      const thigh = side < 0 ? this.thighL : this.thighR;
      const shin = side < 0 ? this.shinL : this.shinR;
      const bt = side < 0 ? this.bootL : this.bootR;
      segment(thigh, hip, knee, 1);
      segment(shin, knee, foot, 1);
      bt.position.copy(foot);
      bt.position.z += 0.06;
      bt.rotation.set(0, 0, 0);
    }
  }

  /** Analytic two-bone IK. The pole keeps elbows bending outward and down. */
  private solveArm(
    worldTarget: THREE.Vector3,
    shoulderX: number,
    upper: THREE.Mesh,
    lower: THREE.Mesh,
    glove: THREE.Mesh,
    side: number
  ) {
    const shoulder = this.tmpA.set(shoulderX, 0.46, 0);
    const target = this.tmpB.copy(worldTarget);
    this.torso.worldToLocal(target);

    const toT = this.tmpC.subVectors(target, shoulder);
    const maxLen = (this.armUpper + this.armLower) * 0.995;
    let d = toT.length();
    if (d > maxLen) {
      toT.multiplyScalar(maxLen / d);
      target.copy(shoulder).add(toT);
      d = maxLen;
    }
    d = Math.max(d, Math.abs(this.armUpper - this.armLower) + 0.01);

    const cosA = clamp(
      (this.armUpper * this.armUpper + d * d - this.armLower * this.armLower) / (2 * this.armUpper * d),
      -1,
      1
    );
    const a = Math.acos(cosA);
    const f = this.tmpD.copy(toT).divideScalar(d);
    const pole = this.pole.set(side * 0.8, -0.5, -0.5).normalize();
    const right = this.tmpE.crossVectors(f, pole);
    if (right.lengthSq() < 1e-6) right.set(0, 0, 1);
    right.normalize();
    const bend = this.tmpF.crossVectors(right, f).normalize();

    const elbow = this.tmpG
      .copy(shoulder)
      .addScaledVector(f, this.armUpper * Math.cos(a))
      .addScaledVector(bend, this.armUpper * Math.sin(a));

    segment(upper, shoulder, elbow, 1);
    segment(lower, elbow, target, 1);
    glove.position.copy(target);
    glove.quaternion.setFromUnitVectors(UP, this.tmpE.subVectors(target, elbow).normalize());
  }

  private poseHead() {
    const local = this.tmpA.copy(this.lookTarget);
    this.torso.worldToLocal(local);
    const dir = local.sub(this.tmpB.set(0, 0.62, 0));
    const yaw = clamp(Math.atan2(dir.x, dir.z), -0.9, 0.9);
    const pitch = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.55, 0.85);
    this.head.rotation.set(pitch, yaw, 0);
    void this.breathe;
  }
}
