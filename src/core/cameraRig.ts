import * as THREE from 'three';
import { easeInOutCubic, clamp } from './rng';

export type ShotName = 'cold' | 'pipe' | 'torch' | 'cut' | 'cutFace' | 'hero';

interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
}

/** Portrait keeps the cake high and leaves the lower third for the tool;
 *  landscape pulls the tool to one side and centres the cake. Every shot is
 *  framed on the same bearing (~70 degrees) so the pre-split notch always
 *  opens towards the player. */
const PORTRAIT: Record<ShotName, Shot> = {
  cold: { pos: [1.7, 3.55, 3.6], target: [0, 0.75, 0] },
  pipe: { pos: [1.6, 2.95, 3.9], target: [0, 0.95, 0] },
  torch: { pos: [1.95, 1.95, 4.25], target: [0, 1.0, 0] },
  cut: { pos: [0.8, 1.8, 4.6], target: [0, 0.85, 0] },
  cutFace: { pos: [1.28, 1.75, 3.5], target: [0.48, 0.62, 0.42] },
  hero: { pos: [2.1, 1.5, 5.15], target: [0.5, 0.68, 0.28] },
};

const LANDSCAPE: Record<ShotName, Shot> = {
  cold: { pos: [1.5, 2.7, 2.75], target: [0, 0.72, 0] },
  pipe: { pos: [1.3, 2.25, 3.0], target: [0, 0.9, 0] },
  torch: { pos: [1.65, 1.65, 3.25], target: [0, 0.95, 0] },
  cut: { pos: [0.6, 1.55, 3.6], target: [0, 0.82, 0] },
  cutFace: { pos: [1.05, 1.5, 2.85], target: [0.46, 0.6, 0.4] },
  hero: { pos: [1.75, 1.35, 4.2], target: [0.48, 0.66, 0.26] },
};

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private fromPos = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toPos = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private curTarget = new THREE.Vector3();
  private t = 1;
  private dur = 1;
  private done: (() => void) | null = null;

  /** Slow hero orbit, only enabled on the finished cake. */
  orbit = 0;
  private orbitPhase = 0;
  /** Very small handheld drift so static shots do not feel like a still. */
  private driftPhase = 0;

  current: ShotName = 'cold';
  portrait = true;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    const s = PORTRAIT.cold;
    this.curPos.set(...s.pos);
    this.curTarget.set(...s.target);
    this.toPos.copy(this.curPos);
    this.toTarget.copy(this.curTarget);
    this.apply();
  }

  get moving(): boolean {
    return this.t < 1;
  }

  private shot(name: ShotName): Shot {
    return (this.portrait ? PORTRAIT : LANDSCAPE)[name];
  }

  setOrientation(portrait: boolean): void {
    if (this.portrait === portrait) return;
    this.portrait = portrait;
    // Re-target without a visible move: the framing changes, the beat does not.
    const s = this.shot(this.current);
    this.toPos.set(...s.pos);
    this.toTarget.set(...s.target);
    if (!this.moving) {
      this.curPos.copy(this.toPos);
      this.curTarget.copy(this.toTarget);
    }
  }

  goTo(name: ShotName, duration = 1.1, onDone?: () => void): void {
    const s = this.shot(name);
    this.current = name;
    this.fromPos.copy(this.curPos);
    this.fromTarget.copy(this.curTarget);
    this.toPos.set(...s.pos);
    this.toTarget.set(...s.target);
    this.dur = Math.max(0.001, duration);
    this.t = 0;
    this.done = onDone ?? null;
    if (duration <= 0) this.update(0.001);
  }

  snapTo(name: ShotName): void {
    const s = this.shot(name);
    this.current = name;
    this.curPos.set(...s.pos);
    this.curTarget.set(...s.target);
    this.toPos.copy(this.curPos);
    this.toTarget.copy(this.curTarget);
    this.t = 1;
    this.apply();
  }

  update(dt: number): void {
    if (this.t < 1) {
      this.t = clamp(this.t + dt / this.dur, 0, 1);
      const e = easeInOutCubic(this.t);
      this.curPos.lerpVectors(this.fromPos, this.toPos, e);
      this.curTarget.lerpVectors(this.fromTarget, this.toTarget, e);
      if (this.t >= 1 && this.done) {
        const cb = this.done;
        this.done = null;
        cb();
      }
    }
    this.driftPhase += dt * 0.31;
    if (this.orbit > 0) this.orbitPhase += dt * 0.26;
    this.apply();
  }

  private apply(): void {
    const c = this.camera;
    const drift = 0.012;
    let x = this.curPos.x;
    let z = this.curPos.z;
    if (this.orbit > 0) {
      const a = Math.sin(this.orbitPhase) * 0.3 * this.orbit;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = x * ca - z * sa;
      const nz = x * sa + z * ca;
      x = nx;
      z = nz;
    }
    c.position.set(
      x + Math.sin(this.driftPhase * 0.7) * drift,
      this.curPos.y + Math.sin(this.driftPhase * 1.13) * drift * 0.7,
      z + Math.cos(this.driftPhase * 0.53) * drift,
    );
    c.lookAt(this.curTarget);
  }
}
