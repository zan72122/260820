import * as THREE from 'three';
import { Phase } from './state';
import { SAND_Y } from './foundry';

/**
 * The camera is directed, never free. One pose per phase, chosen so the
 * causal chain (press -> cavity + islands -> pour -> holes) is always
 * readable, with portrait / landscape variants. Transitions are smooth
 * moves - no cuts while a causal step is happening.
 */

export interface CamPose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function poseFor(phase: Phase, portrait: boolean): CamPose {
  const S = SAND_Y;
  switch (phase) {
    case Phase.TITLE:
    case Phase.ALIGN:
      // mid shot: sand centre-left, pattern + lever right, crucible far left
      return portrait
        ? { pos: V(0.5, 1.5, 1.95), target: V(0.18, 1.05, -0.05), fov: 56 }
        : { pos: V(0.55, 1.42, 1.7), target: V(0.12, 1.02, -0.05), fov: 47 };
    case Phase.PRESS:
      // 3/4 view, above the pattern: ring shape + thickness + sinking + lever
      return portrait
        ? { pos: V(0.62, 1.68, 1.34), target: V(0.08, 1.0, -0.02), fov: 52 }
        : { pos: V(0.68, 1.6, 1.2), target: V(0.06, 0.99, -0.02), fov: 45 };
    case Phase.RAISE:
      // slightly higher: cavity + islands revealed while the pattern lifts
      return portrait
        ? { pos: V(0.3, 1.62, 0.98), target: V(0, S + 0.06, -0.03), fov: 48 }
        : { pos: V(0.36, 1.55, 0.94), target: V(0, S + 0.05, -0.03), fov: 43 };
    case Phase.BRUSH:
      return portrait
        ? { pos: V(0.1, 1.6, 0.8), target: V(0, S - 0.02, -0.03), fov: 46 }
        : { pos: V(0.16, 1.52, 0.78), target: V(0, S - 0.02, -0.03), fov: 42 };
    case Phase.POUR:
      // one frame holds: crucible + gate + groove + islands
      return portrait
        ? { pos: V(-0.42, 1.62, 1.1), target: V(-0.3, S + 0.06, -0.02), fov: 54 }
        : { pos: V(-0.52, 1.5, 1.02), target: V(-0.26, S + 0.05, -0.02), fov: 48 };
    case Phase.COOL:
      return portrait
        ? { pos: V(-0.1, 1.58, 0.84), target: V(-0.04, S - 0.02, -0.02), fov: 46 }
        : { pos: V(-0.14, 1.5, 0.82), target: V(-0.04, S - 0.02, -0.02), fov: 42 };
    case Phase.BREAK:
      // close on the flask: sand collapsing and the new letter
      return portrait
        ? { pos: V(0.2, 1.42, 0.94), target: V(0, S, 0.02), fov: 48 }
        : { pos: V(0.24, 1.36, 0.88), target: V(0, S, 0.02), fov: 43 };
    case Phase.REVEAL:
      // frontal: silhouette + counter holes, workshop visible through them
      return portrait
        ? { pos: V(0, 1.32, 1.35), target: V(0, 1.3, -0.2), fov: 40 }
        : { pos: V(0, 1.3, 1.25), target: V(0, 1.28, -0.2), fov: 37 };
    case Phase.DONE:
      return portrait
        ? { pos: V(0.05, 1.35, 1.5), target: V(0, 1.25, -0.2), fov: 44 }
        : { pos: V(0.08, 1.32, 1.4), target: V(0, 1.22, -0.2), fov: 40 };
  }
}

export class CameraDirector {
  camera: THREE.PerspectiveCamera;
  private from: CamPose;
  private to: CamPose;
  private t = 1;
  private dur = 1.6;
  private curTarget = new THREE.Vector3();
  private idleT = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.05, 30);
    const p = poseFor(Phase.TITLE, aspect < 1);
    this.from = this.clonePose(p);
    this.to = this.clonePose(p);
    this.apply(p, 1);
  }

  private clonePose(p: CamPose): CamPose {
    return { pos: p.pos.clone(), target: p.target.clone(), fov: p.fov };
  }

  moveTo(phase: Phase, portrait: boolean, dur = 1.6) {
    const next = poseFor(phase, portrait);
    this.from = {
      pos: this.camera.position.clone(),
      target: this.curTarget.clone(),
      fov: this.camera.fov,
    };
    this.to = this.clonePose(next);
    this.t = 0;
    this.dur = Math.max(0.15, dur);
  }

  /** instant-ish reframe on rotation - keep the same phase, quick move */
  reframe(phase: Phase, portrait: boolean) {
    this.moveTo(phase, portrait, 0.5);
  }

  update(dt: number) {
    this.idleT += dt;
    if (this.t < 1) this.t = Math.min(1, this.t + dt / this.dur);
    const k = this.t * this.t * (3 - 2 * this.t);
    const pose: CamPose = {
      pos: this.from.pos.clone().lerp(this.to.pos, k),
      target: this.from.target.clone().lerp(this.to.target, k),
      fov: this.from.fov + (this.to.fov - this.from.fov) * k,
    };
    this.apply(pose, k);
  }

  private apply(p: CamPose, _k: number) {
    // gentle handheld-free breathing, small enough to never break framing
    const b = 0.006;
    const bx = Math.sin(this.idleT * 0.5) * b;
    const by = Math.sin(this.idleT * 0.37 + 1.7) * b * 0.6;
    this.camera.position.set(p.pos.x + bx, p.pos.y + by, p.pos.z);
    this.curTarget.copy(p.target);
    this.camera.lookAt(p.target);
    if (Math.abs(this.camera.fov - p.fov) > 0.01) {
      this.camera.fov = p.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
