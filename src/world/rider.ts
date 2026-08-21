import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Settings } from '../core/settings';
import { clamp, damp, lerp } from '../core/math';
import { clothTexture } from './textures';
import type { SwingRig } from './swingRig';

function boneMesh(radius: number, length: number, mat: MeshStandardMaterial, shadows: boolean): Mesh {
  const geo = new CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 3, 7);
  geo.translate(0, -length / 2, 0);
  const m = new Mesh(geo, mat);
  m.castShadow = shadows;
  return m;
}

/** Point a bone whose local origin is its root and whose length runs down -Y. */
function aim(mesh: Object3D, from: Vector3, to: Vector3): void {
  mesh.position.copy(from);
  const d = new Vector3().subVectors(to, from);
  if (d.lengthSq() < 1e-9) return;
  mesh.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), d.normalize());
}

/** Analytic two-bone IK. `pole` biases which way the joint breaks. */
function solveIk(
  root: Vector3,
  target: Vector3,
  l1: number,
  l2: number,
  pole: Vector3,
  out: Vector3,
): void {
  const axis = new Vector3().subVectors(target, root);
  let d = axis.length();
  if (d < 1e-5) {
    out.copy(root).addScaledVector(pole, l1);
    return;
  }
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  axis.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = pole.clone().addScaledVector(axis, -pole.dot(axis));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  out.copy(root).addScaledVector(axis, a).addScaledVector(perp, h);
}

/**
 * A child on the seat, driven by the same phase the pendulum runs on.
 *
 * The pump is the real one: legs drive out and the chest opens as the swing runs
 * up to the forward extreme, knees fold and the chest closes coming back. The
 * hands stay on the chains through an IK pass, so the arms never let go and the
 * seat contact never slides.
 */
export class Rider {
  readonly group = new Group();

  private torso = new Group();
  private head = new Group();
  private hairStrands: Object3D[] = [];
  private hem: Mesh;
  private upperArms: Mesh[] = [];
  private foreArms: Mesh[] = [];
  private thighs: Mesh[] = [];
  private shins: Mesh[] = [];
  private shoes: Mesh[] = [];
  private rig: SwingRig;

  private lean = 0;
  private legPose = 0.35;
  private hairLag = new Vector3();
  private hemLag = 0;
  private prevSeat = new Vector3();
  private prevVel = new Vector3();

  constructor(rig: SwingRig, settings: Settings) {
    this.rig = rig;
    const shadows = settings.shadows;

    const skin = new MeshStandardMaterial({
      color: new Color(0.86, 0.68, 0.58),
      roughness: 0.68,
      metalness: 0,
    });
    const shirt = new MeshStandardMaterial({
      map: clothTexture([196, 208, 214]),
      color: new Color(0.92, 0.95, 1.0),
      roughness: 0.88,
      metalness: 0,
    });
    const shorts = new MeshStandardMaterial({
      map: clothTexture([96, 108, 132]),
      color: new Color(0.78, 0.82, 0.94),
      roughness: 0.9,
      metalness: 0,
    });
    const hair = new MeshStandardMaterial({
      color: new Color(0.19, 0.13, 0.10),
      roughness: 0.52,
      metalness: 0,
    });
    const rubber = new MeshStandardMaterial({
      color: new Color(0.85, 0.36, 0.28),
      roughness: 0.72,
      metalness: 0,
    });

    // Pelvis sits on the belt, and stays there.
    const pelvis = new Mesh(new BoxGeometry(0.17, 0.10, 0.23), shorts);
    pelvis.position.set(0.005, 0.075, 0);
    pelvis.castShadow = shadows;
    this.group.add(pelvis);

    // Torso pivots at the hips.
    this.torso.position.set(0.005, 0.11, 0);
    const chest = new Mesh(new CapsuleGeometry(0.098, 0.14, 3, 9), shirt);
    chest.scale.set(0.82, 1, 1.05);
    chest.position.y = 0.145;
    chest.castShadow = shadows;
    this.torso.add(chest);

    this.hem = new Mesh(new BoxGeometry(0.20, 0.09, 0.235), shirt);
    this.hem.position.set(0, 0.035, 0);
    this.hem.castShadow = shadows;
    this.torso.add(this.hem);

    // Head and hair.
    this.head.position.set(0, 0.30, 0);
    const skull = new Mesh(new SphereGeometry(0.088, 14, 11), skin);
    skull.scale.set(0.95, 1.05, 1);
    skull.castShadow = shadows;
    this.head.add(skull);
    const cap = new Mesh(new SphereGeometry(0.093, 14, 11, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    cap.position.y = 0.006;
    cap.castShadow = shadows;
    this.head.add(cap);
    const neck = new Mesh(new CapsuleGeometry(0.032, 0.04, 2, 7), skin);
    neck.position.y = 0.24;
    this.torso.add(neck);

    for (let i = 0; i < 3; i++) {
      const pivot = new Object3D();
      const a = (i / 2 - 0.5) * 1.5;
      pivot.position.set(-0.055, 0.035, Math.sin(a) * 0.062);
      const strand = new Mesh(new CapsuleGeometry(0.021, 0.10, 2, 6), hair);
      strand.position.y = -0.055;
      strand.scale.set(1, 1, 0.7);
      strand.castShadow = shadows;
      pivot.add(strand);
      this.head.add(pivot);
      this.hairStrands.push(pivot);
    }
    this.torso.add(this.head);
    this.group.add(this.torso);

    for (let s = 0; s < 2; s++) {
      const ua = boneMesh(0.031, 0.155, skin, shadows);
      const fa = boneMesh(0.027, 0.145, skin, shadows);
      this.upperArms.push(ua);
      this.foreArms.push(fa);
      this.group.add(ua, fa);

      const th = boneMesh(0.045, 0.20, shorts, shadows);
      const sh = boneMesh(0.033, 0.20, skin, shadows);
      const shoe = new Mesh(new BoxGeometry(0.055, 0.045, 0.115), rubber);
      shoe.castShadow = shadows;
      this.thighs.push(th);
      this.shins.push(sh);
      this.shoes.push(shoe);
      this.group.add(th, sh, shoe);
    }

    rig.seat.add(this.group);
    this.group.position.set(0, 0.012, 0);
  }

  update(
    theta: number,
    omega: number,
    amplitude: number,
    phase: number,
    playerEnergy: number,
    dt: number,
  ): void {
    const drive = clamp(0.24 + playerEnergy * 0.62, 0.18, 1);
    const ampK = clamp(amplitude / 0.7, 0.1, 1);

    // `ext` = 1 at the forward extreme, 0 at the back extreme, with a small lead
    // so the body acts just before the swing gets there.
    const ext = 0.5 + 0.5 * Math.cos(phase - 0.42);

    const targetLegs = lerp(0.30, 0.30 + 0.62 * drive, ext) * (0.55 + 0.45 * ampK);
    this.legPose = damp(this.legPose, targetLegs, 11, dt);

    const targetLean = (0.30 - 0.72 * ext) * drive * (0.4 + 0.6 * ampK);
    this.lean = damp(this.lean, targetLean, 9, dt);

    this.torso.rotation.z = -this.lean;
    this.head.rotation.z = this.lean * 0.55;

    // Secondary motion for hair and shirt hem: they chase the seat's acceleration.
    const seatPos = this.rig.seat.position;
    const vel = new Vector3().subVectors(seatPos, this.prevSeat).divideScalar(Math.max(dt, 1e-4));
    const acc = new Vector3().subVectors(vel, this.prevVel).divideScalar(Math.max(dt, 1e-4));
    this.prevSeat.copy(seatPos);
    this.prevVel.copy(vel);

    // Into the seat's own frame: X forward, Y up the chain.
    const c = Math.cos(-theta);
    const s = Math.sin(-theta);
    const localAccX = acc.x * c - acc.y * s;
    const targetHair = clamp(-localAccX * 0.012 - 0.25, -1.3, 0.9);
    this.hairLag.x = damp(this.hairLag.x, targetHair, 7, dt);
    for (let i = 0; i < this.hairStrands.length; i++) {
      const k = 0.72 + i * 0.07;
      this.hairStrands[i].rotation.z = this.hairLag.x * k;
      this.hairStrands[i].rotation.x = Math.sin(i * 2.1 + omega * 1.4) * 0.10;
    }
    this.hemLag = damp(this.hemLag, clamp(-localAccX * 0.006, -0.4, 0.4), 8, dt);
    this.hem.rotation.z = this.hemLag;

    // Legs: hip -> knee -> ankle, posed straight from the pump variable.
    const hipY = 0.085;
    const thighL = 0.20;
    const shinL = 0.20;
    const knee = new Vector3();
    const ankle = new Vector3();
    for (let i = 0; i < 2; i++) {
      const z = i === 0 ? -0.062 : 0.062;
      const hip = new Vector3(0.035, hipY, z);
      const spread = (i === 0 ? -1 : 1) * 0.018;
      // Angles measured from straight down, positive forward. Seated, the thighs
      // are near horizontal; the pump swings them from tucked to driven out.
      const thighAngle = lerp(1.14, 1.72, this.legPose);
      const kneeBend = lerp(1.48, 0.14, this.legPose);
      knee.set(
        hip.x + Math.sin(thighAngle) * thighL,
        hip.y - Math.cos(thighAngle) * thighL,
        z + spread,
      );
      // The knee folds the shin back under the seat, never forward through it.
      const shinAngle = thighAngle - kneeBend;
      ankle.set(
        knee.x + Math.sin(shinAngle) * shinL,
        knee.y - Math.cos(shinAngle) * shinL,
        knee.z + spread * 0.4,
      );
      aim(this.thighs[i], hip, knee);
      aim(this.shins[i], knee, ankle);
      this.shoes[i].position.copy(ankle).add(new Vector3(0.018, -0.028, 0));
      this.shoes[i].rotation.set(0, 0, -(shinAngle + 0.35));
    }

    // Everything above moved joints, so refresh the seat's subtree before the IK
    // pass reads world positions from it.
    this.rig.seat.updateMatrixWorld(true);

    // Arms: shoulders are fixed to the chest, hands are locked onto the chains.
    const shoulderWorld = new Vector3();
    const handWorld = new Vector3();
    const elbow = new Vector3();
    const handLocal = new Vector3();
    const pole = new Vector3();
    for (let i = 0; i < 2; i++) {
      const zSign = i === 0 ? -1 : 1;
      shoulderWorld.set(0.0, 0.255, zSign * 0.088);
      this.torso.localToWorld(shoulderWorld);
      this.group.worldToLocal(shoulderWorld);

      // Hands grip the chain at chest height, not above the head.
      const grip = 0.30 + 0.07 * (1 - this.legPose);
      this.rig.chainPoint(zSign, grip, handWorld);
      handLocal.copy(handWorld);
      this.group.worldToLocal(handLocal);

      pole.set(-0.45, -0.75, zSign * 1.0).normalize();
      solveIk(shoulderWorld, handLocal, 0.155, 0.145, pole, elbow);
      aim(this.upperArms[i], shoulderWorld, elbow);
      aim(this.foreArms[i], elbow, handLocal);
    }
  }
}
