import { CapsuleGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { clamp01, damp, lerp } from '../core/mathutil';
import type { MaterialLibrary } from './materials';

export type HandPose =
  | 'offstage'
  | 'placing'
  | 'steadying'
  | 'loosenTube'
  | 'showUpper'
  | 'showLower'
  | 'tapRail'
  | 'resting';

interface PoseSpec {
  position: Vector3;
  rotation: Vector3;
  /** Curl of the fingers, 0 = open, 1 = closed. */
  curl: number;
}

/**
 * The instructor works from the manikin's right, so the forearm always leaves
 * frame to that side instead of lying across the chest between the camera and
 * the thing the child is trying to see.
 * rotation is (pitch, yaw, roll) applied in YXZ order.
 */
const POSES: Record<HandPose, PoseSpec> = {
  offstage: { position: new Vector3(0.16, 0.86, -0.92), rotation: new Vector3(-0.2, 1.5, 0), curl: 0.2 },
  placing: { position: new Vector3(0.2, 0.94, 0.06), rotation: new Vector3(-0.5, 1.35, 0), curl: 0.5 },
  steadying: { position: new Vector3(0.22, 0.93, 0.1), rotation: new Vector3(-0.42, 1.3, 0), curl: 0.38 },
  loosenTube: { position: new Vector3(0.28, 0.97, 0.2), rotation: new Vector3(-0.38, 1.12, 0.18), curl: 0.7 },
  showUpper: { position: new Vector3(0.27, 0.95, -0.2), rotation: new Vector3(-0.6, 1.42, 0), curl: 0.1 },
  showLower: { position: new Vector3(0.27, 0.95, 0.12), rotation: new Vector3(-0.6, 1.42, 0), curl: 0.1 },
  tapRail: { position: new Vector3(-0.52, 0.95, 0.16), rotation: new Vector3(-0.45, -1.35, 0), curl: 0.72 },
  resting: { position: new Vector3(0.33, 0.89, -0.6), rotation: new Vector3(-0.25, 1.45, 0), curl: 0.28 },
};

/**
 * The adult instructor's hand.
 *
 * It does the things an adult does in a skills lab — sets the chestpiece down,
 * takes the slack out of the tubing, sweeps a hand over the upper or lower half
 * of the chest, knocks once on the rail — and then gets out of the way. It never
 * points at an answer, and it stops moving when the child should be listening.
 */
export class InstructorHand {
  readonly root = new Group();
  private palm: Mesh;
  private fingers: Group[] = [];
  private thumb: Group;
  private pose: HandPose = 'offstage';
  private curl = 0.2;
  private tapImpulse = 0;
  private visibleAmount = 0;

  constructor(mats: MaterialLibrary) {
    this.root.rotation.order = 'YXZ';

    const forearm = new Mesh(new CapsuleGeometry(0.036, 0.15, 6, 14), mats.glove);
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0, 0.006, 0.155);
    forearm.castShadow = true;
    this.root.add(forearm);

    this.palm = new Mesh(new SphereGeometry(0.046, 20, 14), mats.glove);
    this.palm.scale.set(1.0, 0.34, 1.05);
    this.palm.castShadow = true;
    this.root.add(this.palm);

    for (let i = 0; i < 4; i++) {
      const finger = new Group();
      const prox = new Mesh(new CapsuleGeometry(0.0092, 0.042, 4, 10), mats.glove);
      prox.rotation.x = Math.PI / 2;
      prox.position.z = -0.029;
      finger.add(prox);
      const distalPivot = new Group();
      distalPivot.position.z = -0.054;
      const dist = new Mesh(new CapsuleGeometry(0.0082, 0.034, 4, 10), mats.glove);
      dist.rotation.x = Math.PI / 2;
      dist.position.z = -0.023;
      distalPivot.add(dist);
      finger.add(distalPivot);
      finger.userData.distal = distalPivot;
      // Middle fingers sit slightly proud, as a real hand does.
      const spread = (i - 1.5) * 0.0215;
      finger.position.set(spread, 0.001, -0.05 - Math.cos((i - 1.5) * 1.1) * 0.004);
      finger.castShadow = true;
      this.root.add(finger);
      this.fingers.push(finger);
    }

    this.thumb = new Group();
    const th = new Mesh(new CapsuleGeometry(0.0112, 0.046, 4, 10), mats.glove);
    th.rotation.x = Math.PI / 2;
    th.position.z = -0.03;
    this.thumb.add(th);
    this.thumb.position.set(0.041, -0.003, -0.014);
    this.thumb.rotation.y = 0.8;
    this.root.add(this.thumb);

    this.root.position.copy(POSES.offstage.position);
    this.root.visible = false;
  }

  setPose(pose: HandPose): void {
    this.pose = pose;
    if (pose === 'tapRail') this.tapImpulse = 1;
  }

  getPose(): HandPose {
    return this.pose;
  }

  /** A single knock, synchronised to the beat the instructor is marking. */
  tap(): void {
    this.tapImpulse = 1;
  }

  update(dt: number, chestpieceWorld: Vector3 | null): void {
    const spec = POSES[this.pose];
    const target = spec.position.clone();

    // While placing or steadying, the hand follows the chestpiece rather than
    // sitting at a fixed spot — and stays behind it so it never covers it.
    if ((this.pose === 'placing' || this.pose === 'steadying') && chestpieceWorld) {
      // Beside the chestpiece on the instructor's side, never on top of it.
      target.set(chestpieceWorld.x + 0.155, chestpieceWorld.y + 0.045, chestpieceWorld.z + 0.055);
    }

    const wanted = this.pose !== 'offstage';
    this.visibleAmount = damp(this.visibleAmount, wanted ? 1 : 0, 4.5, dt);
    this.root.visible = this.visibleAmount > 0.02;
    if (!this.root.visible) return;

    const lift = (1 - this.visibleAmount) * 0.24;
    this.root.position.x = damp(this.root.position.x, target.x, 5.5, dt);
    this.root.position.y = damp(this.root.position.y, target.y + lift, 5.5, dt);
    this.root.position.z = damp(this.root.position.z, target.z + lift * 0.6, 5.5, dt);
    this.root.rotation.x = damp(this.root.rotation.x, spec.rotation.x, 5, dt);
    this.root.rotation.y = damp(this.root.rotation.y, spec.rotation.y, 5, dt);
    this.root.rotation.z = damp(this.root.rotation.z, spec.rotation.z, 5, dt);

    if (this.tapImpulse > 0) {
      this.tapImpulse = Math.max(0, this.tapImpulse - dt * 6.5);
      const swing = Math.sin((1 - this.tapImpulse) * Math.PI) * 0.055;
      this.root.position.y -= swing;
    }

    this.curl = damp(this.curl, spec.curl, 6, dt);
    for (const f of this.fingers) {
      f.rotation.x = lerp(0.05, 1.15, clamp01(this.curl));
      (f.userData.distal as Group).rotation.x = lerp(0.02, 1.0, clamp01(this.curl));
    }
    this.thumb.rotation.z = lerp(0.0, -0.55, clamp01(this.curl));
  }
}
