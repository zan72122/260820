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

const POSES: Record<HandPose, PoseSpec> = {
  offstage: { position: new Vector3(0.62, 0.86, 0.72), rotation: new Vector3(-0.5, -0.4, 0.2), curl: 0.2 },
  placing: { position: new Vector3(0.02, 0.94, 0.1), rotation: new Vector3(-1.0, -0.2, 0.1), curl: 0.55 },
  steadying: { position: new Vector3(0.16, 0.92, 0.16), rotation: new Vector3(-0.9, -0.35, 0.1), curl: 0.4 },
  loosenTube: { position: new Vector3(0.1, 0.99, 0.24), rotation: new Vector3(-0.7, -0.5, 0.35), curl: 0.7 },
  showUpper: { position: new Vector3(0.0, 0.95, -0.24), rotation: new Vector3(-1.2, 0.0, 0.0), curl: 0.12 },
  showLower: { position: new Vector3(0.0, 0.95, 0.16), rotation: new Vector3(-1.2, 0.0, 0.0), curl: 0.12 },
  tapRail: { position: new Vector3(-0.33, 0.94, 0.16), rotation: new Vector3(-0.8, 0.3, -0.2), curl: 0.75 },
  resting: { position: new Vector3(0.44, 0.86, 0.5), rotation: new Vector3(-0.6, -0.4, 0.15), curl: 0.3 },
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
    const forearm = new Mesh(new CapsuleGeometry(0.042, 0.2, 6, 14), mats.glove);
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0, 0.008, 0.16);
    forearm.castShadow = true;
    this.root.add(forearm);

    this.palm = new Mesh(new SphereGeometry(0.048, 20, 14), mats.glove);
    this.palm.scale.set(1.0, 0.5, 1.15);
    this.palm.castShadow = true;
    this.root.add(this.palm);

    for (let i = 0; i < 4; i++) {
      const finger = new Group();
      const prox = new Mesh(new CapsuleGeometry(0.0105, 0.036, 4, 10), mats.glove);
      prox.rotation.x = Math.PI / 2;
      prox.position.z = -0.026;
      finger.add(prox);
      const distalPivot = new Group();
      distalPivot.position.z = -0.048;
      const dist = new Mesh(new CapsuleGeometry(0.0095, 0.03, 4, 10), mats.glove);
      dist.rotation.x = Math.PI / 2;
      dist.position.z = -0.021;
      distalPivot.add(dist);
      finger.add(distalPivot);
      finger.userData.distal = distalPivot;
      finger.position.set((i - 1.5) * 0.023, 0.002, -0.042);
      finger.castShadow = true;
      this.root.add(finger);
      this.fingers.push(finger);
    }

    this.thumb = new Group();
    const th = new Mesh(new CapsuleGeometry(0.0125, 0.042, 4, 10), mats.glove);
    th.rotation.x = Math.PI / 2;
    th.position.z = -0.028;
    this.thumb.add(th);
    this.thumb.position.set(0.044, -0.004, -0.012);
    this.thumb.rotation.y = 0.85;
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
      target.set(chestpieceWorld.x + 0.075, chestpieceWorld.y + 0.075, chestpieceWorld.z + 0.09);
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
