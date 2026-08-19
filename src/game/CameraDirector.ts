import * as THREE from 'three';
import { LAYOUT } from '../scene/Patisserie';
import { damp, dampVec3, lerp } from '../util/math';
import type { Viewport } from '../engine/Renderer';

export type ShotName = 'tools' | 'core' | 'petals' | 'transfer' | 'finish';

interface Shot {
  subject: 'nail' | 'cake' | 'between';
  /** metres from the subject */
  dist: number;
  /** degrees above the horizon */
  elev: number;
  /** degrees around the subject; 0 looks from +Z */
  azim: number;
  fov: number;
  /** framing nudge in metres, applied to the look-at point */
  shiftY: number;
  shiftX: number;
  orbit?: number;
  /** portrait overrides */
  portrait?: Partial<Shot>;
}

/**
 * No free camera. Each act gets a shot that keeps the tip, the petal and the
 * flower core in one readable frame, with portrait framing pushing the work to
 * the lower middle and the cake to the upper back.
 */
const SHOTS: Record<ShotName, Shot> = {
  tools: {
    subject: 'nail',
    dist: 0.34,
    elev: 38,
    azim: 8,
    fov: 34,
    shiftY: -0.012,
    shiftX: 0.01,
    portrait: { dist: 0.4, elev: 40, shiftY: 0.012, shiftX: 0 },
  },
  core: {
    subject: 'nail',
    dist: 0.23,
    elev: 17,
    azim: 12,
    fov: 30,
    shiftY: 0.004,
    shiftX: 0.006,
    portrait: { dist: 0.26, elev: 19, shiftY: 0.016, shiftX: 0 },
  },
  petals: {
    subject: 'nail',
    dist: 0.245,
    elev: 33,
    azim: 10,
    fov: 31,
    shiftY: -0.002,
    shiftX: 0.006,
    portrait: { dist: 0.28, elev: 35, shiftY: 0.014, shiftX: 0 },
  },
  transfer: {
    subject: 'between',
    dist: 0.44,
    elev: 30,
    azim: 6,
    fov: 36,
    shiftY: -0.004,
    shiftX: 0,
    portrait: { dist: 0.46, elev: 34, shiftY: 0.01, shiftX: 0 },
  },
  finish: {
    subject: 'cake',
    dist: 0.36,
    elev: 27,
    azim: -6,
    fov: 34,
    shiftY: -0.008,
    shiftX: 0,
    orbit: 5,
    portrait: { dist: 0.42, elev: 30, shiftY: 0.006, shiftX: 0 },
  },
};

const _v = new THREE.Vector3();

export class CameraDirector {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private targetFov = 32;
  private orbitPhase = 0;
  private current: ShotName = 'tools';
  /** Extra look-at follow while the flower is being carried. */
  readonly follow = new THREE.Vector3();
  followWeight = 0;

  constructor(private camera: THREE.PerspectiveCamera) {}

  get shot() {
    return this.current;
  }

  set(shot: ShotName) {
    this.current = shot;
  }

  private subjectPos(shot: Shot, out: THREE.Vector3) {
    if (shot.subject === 'nail') out.set(LAYOUT.nail.x, LAYOUT.nailHeight + 0.014, LAYOUT.nail.z);
    else if (shot.subject === 'cake') out.set(LAYOUT.cake.x, LAYOUT.cakeTop + 0.012, LAYOUT.cake.z);
    else
      out.set(
        (LAYOUT.nail.x + LAYOUT.cake.x) / 2,
        (LAYOUT.nailHeight + LAYOUT.cakeTop) / 2 + 0.02,
        (LAYOUT.nail.z + LAYOUT.cake.z) / 2,
      );
    return out;
  }

  update(dt: number, vp: Viewport, snap = false) {
    const base = SHOTS[this.current];
    const shot: Shot = vp.portrait ? { ...base, ...(base.portrait ?? {}) } : base;

    // A tighter screen makes everything read smaller: widen a touch when narrow.
    const aspectPad = vp.portrait ? lerp(1.0, 1.14, THREE.MathUtils.clamp((0.62 - vp.aspect) / 0.2, 0, 1)) : 1;

    this.subjectPos(shot, this.targetLook);
    if (this.followWeight > 0) this.targetLook.lerp(this.follow, this.followWeight);

    this.orbitPhase += (shot.orbit ?? 0) * dt;
    const azim = THREE.MathUtils.degToRad(shot.azim + this.orbitPhase);
    const elev = THREE.MathUtils.degToRad(shot.elev);
    const d = shot.dist * aspectPad;
    this.targetPos.set(
      this.targetLook.x + Math.sin(azim) * Math.cos(elev) * d,
      this.targetLook.y + Math.sin(elev) * d,
      this.targetLook.z + Math.cos(azim) * Math.cos(elev) * d,
    );

    // framing offset in camera space so the subject sits off-centre
    _v.subVectors(this.targetLook, this.targetPos).normalize();
    const right = _v.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(_v).normalize();
    this.targetLook.addScaledVector(up, shot.shiftY).addScaledVector(right, shot.shiftX);
    this.targetFov = shot.fov;

    if (snap) {
      this.pos.copy(this.targetPos);
      this.look.copy(this.targetLook);
      this.camera.fov = this.targetFov;
    } else {
      dampVec3(this.pos, this.targetPos, 3.2, dt);
      dampVec3(this.look, this.targetLook, 3.6, dt);
      this.camera.fov = damp(this.camera.fov, this.targetFov, 3, dt);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }
}
