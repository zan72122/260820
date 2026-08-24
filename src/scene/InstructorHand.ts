import * as THREE from 'three';
import { damp } from '../util/math';
import { LAYOUT } from './layout';
import type { Materials } from './Materials';

const buildHand = (mats: Materials, mirror: boolean): THREE.Group => {
  const hand = new THREE.Group();
  const s = mirror ? -1 : 1;

  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.031, 0.052, 4, 14), mats.instructorSkin);
  palm.rotation.z = Math.PI / 2;
  palm.scale.set(1, 1, 0.62);
  palm.castShadow = true;
  hand.add(palm);

  // Four fingers with a natural, unequal spread and a slight curl.
  const lengths = [0.052, 0.056, 0.052, 0.043];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    const prox = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0088, lengths[i] * 0.55, 3, 10),
      mats.instructorSkin,
    );
    prox.rotation.z = Math.PI / 2;
    prox.position.x = lengths[i] * 0.32;
    f.add(prox);
    const dist = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0078, lengths[i] * 0.42, 3, 10),
      mats.instructorSkin,
    );
    dist.rotation.z = Math.PI / 2;
    dist.position.set(lengths[i] * 0.82, -0.006, 0);
    dist.rotation.y = 0.0;
    f.add(dist);
    f.position.set(0.032, 0.004 - i * 0.001, s * (-0.026 + i * 0.0175));
    f.rotation.y = s * (-0.1 + i * 0.05);
    f.rotation.z = -0.12 - i * 0.03;
    hand.add(f);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 3, 10), mats.instructorSkin);
  thumb.rotation.z = Math.PI / 2;
  thumb.position.set(0.012, -0.006, s * -0.03);
  thumb.rotation.y = s * 0.85;
  thumb.rotation.x = s * 0.3;
  hand.add(thumb);

  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.09, 4, 12), mats.instructorSkin);
  wrist.rotation.z = Math.PI / 2;
  wrist.scale.set(1, 1, 0.72);
  wrist.position.x = -0.072;
  hand.add(wrist);

  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x66808a, roughness: 0.9 });
  const cuffEdge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.036, 0.03, 16),
    sleeveMat,
  );
  cuffEdge.rotation.z = Math.PI / 2;
  cuffEdge.scale.set(1, 1, 0.78);
  cuffEdge.position.x = -0.118;
  hand.add(cuffEdge);

  // The forearm carries on out of frame; a limb that stops in mid-air reads
  // as a floating prop rather than as a person standing at the couch.
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.05, 0.34, 14),
    sleeveMat,
  );
  sleeve.rotation.z = Math.PI / 2;
  sleeve.scale.set(1, 1, 0.82);
  sleeve.position.set(-0.3, 0.006, 0);
  sleeve.castShadow = true;
  hand.add(sleeve);

  return hand;
};

export type AssistTarget = 'idle' | 'steth' | 'bulb' | 'valve' | 'hold';

/**
 * The adult supervising the exercise. Only hands and a little forearm are ever
 * in frame — the render budget belongs to the equipment, and a face would pull
 * attention away from the sound.
 *
 * The assisting hand is also the whole of the on-screen guidance: it drifts
 * toward whatever comes next, closes the last few millimetres of an imprecise
 * drop, and — the moment the first tapping arrives — goes completely still.
 */
export class InstructorHands {
  readonly group = new THREE.Group();

  private steady: THREE.Group;
  private assist: THREE.Group;
  private pos = new THREE.Vector3();
  private rot = new THREE.Euler();
  private targetPos = new THREE.Vector3();
  private targetRot = new THREE.Euler();
  private stillness = 0;

  /**
   * The hand model points its fingers along local +X, so a Y rotation aims it:
   * 0 reaches away from the camera, -PI/2 reaches in from the right. Every
   * pose keeps the wrist heading off toward the far side of the couch, so what
   * is in frame is a hand and a little forearm — never a floating limb.
   */
  private static readonly POSES: Record<
    AssistTarget,
    { p: [number, number, number]; r: [number, number, number] }
  > = {
    idle: { p: [0.3, LAYOUT.couchTop + 0.042, -0.19], r: [0, 0.15, -0.06] },
    steth: { p: [0.63, LAYOUT.couchTop + 0.06, -0.19], r: [0.1, 0.1, -0.12] },
    bulb: { p: [0.9, LAYOUT.trolleyTop + 0.075, 0.68], r: [0.1, -1.5, -0.2] },
    valve: { p: [0.88, LAYOUT.valveCenter.y + 0.018, 0.83], r: [0.15, -1.5, -0.26] },
    hold: { p: [0.72, LAYOUT.couchTop + 0.05, -0.19], r: [0.04, 0.2, -0.1] },
  };

  constructor(mats: Materials) {
    this.steady = buildHand(mats, false);
    this.steady.position.set(0.17, LAYOUT.couchTop + 0.05, -0.17);
    this.steady.rotation.set(0.12, 0.12, -0.08);
    this.steady.scale.setScalar(0.94);
    this.group.add(this.steady);

    this.assist = buildHand(mats, true);
    this.assist.scale.setScalar(0.94);
    this.group.add(this.assist);

    const pose = InstructorHands.POSES.idle;
    this.pos.set(...pose.p);
    this.rot.set(...pose.r);
    this.targetPos.copy(this.pos);
    this.targetRot.copy(this.rot);
    this.assist.position.copy(this.pos);
    this.assist.rotation.copy(this.rot);
  }

  setTarget(target: AssistTarget, offset?: THREE.Vector3): void {
    const pose = InstructorHands.POSES[target];
    this.targetPos.set(...pose.p);
    if (offset) this.targetPos.add(offset);
    this.targetRot.set(...pose.r);
  }

  /** 1 = frozen. Used the instant the first tapping is heard. */
  setStillness(v: number): void {
    this.stillness = v;
  }

  update(dt: number, time: number): void {
    const rate = 3.2 * (1 - this.stillness * 0.95);
    this.pos.x = damp(this.pos.x, this.targetPos.x, rate, dt);
    this.pos.y = damp(this.pos.y, this.targetPos.y, rate, dt);
    this.pos.z = damp(this.pos.z, this.targetPos.z, rate, dt);
    this.rot.x = damp(this.rot.x, this.targetRot.x, rate, dt);
    this.rot.y = damp(this.rot.y, this.targetRot.y, rate, dt);
    this.rot.z = damp(this.rot.z, this.targetRot.z, rate, dt);

    // A person holding still is not perfectly still — except when listening.
    const breathe = (1 - this.stillness) * 0.0011;
    this.assist.position.set(
      this.pos.x + Math.sin(time * 0.9) * breathe,
      this.pos.y + Math.sin(time * 1.31 + 1) * breathe,
      this.pos.z + Math.cos(time * 0.77) * breathe,
    );
    this.assist.rotation.copy(this.rot);
    this.steady.position.y =
      LAYOUT.couchTop + 0.05 + Math.sin(time * 0.83) * (1 - this.stillness) * 0.0008;
  }
}
