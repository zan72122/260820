import * as THREE from 'three';
import { clamp, damp, easeInOut } from './util';
import type { Viewport } from './renderer';

export interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  /** Roll in radians; used sparingly to keep long seams level on screen. */
  roll: number;
  /** Extra pitch after aiming, used to lift the subject clear of the controls. */
  pitch: number;
}

export type ShotFn = (t: number, vp: Viewport, out: Pose) => void;

export function makePose(): Pose {
  return { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 52, roll: 0, pitch: 0 };
}

/**
 * Scripted camera chain.
 *
 * The player never drives the camera. Shots are cut by the game state machine and
 * always blend, so no causal moment is ever interrupted by a hard cut.
 */
export class CameraDirector {
  private cur = makePose();
  private raw = makePose();
  private from = makePose();
  private shot: ShotFn | null = null;
  private blend = 1;
  private dur = 1;
  private time = 0;
  private started = false;
  name = '';

  constructor(private camera: THREE.PerspectiveCamera) {}

  play(shot: ShotFn, duration: number, name = ''): void {
    this.from.pos.copy(this.cur.pos);
    this.from.look.copy(this.cur.look);
    this.from.fov = this.cur.fov;
    this.from.roll = this.cur.roll;
    this.from.pitch = this.cur.pitch;
    this.shot = shot;
    this.dur = Math.max(0.001, duration);
    this.blend = this.started ? 0 : 1;
    this.time = 0;
    this.started = true;
    this.name = name;
  }

  /** True once the current transition has fully arrived. */
  get settled(): boolean {
    return this.blend >= 1;
  }

  get shotTime(): number {
    return this.time;
  }

  update(dt: number, vp: Viewport): void {
    if (!this.shot) return;
    this.time += dt;
    this.shot(this.time, vp, this.raw);

    if (this.blend < 1) {
      this.blend = clamp(this.blend + dt / this.dur, 0, 1);
      const k = easeInOut(this.blend);
      this.cur.pos.lerpVectors(this.from.pos, this.raw.pos, k);
      this.cur.look.lerpVectors(this.from.look, this.raw.look, k);
      this.cur.fov = this.from.fov + (this.raw.fov - this.from.fov) * k;
      this.cur.roll = this.from.roll + (this.raw.roll - this.from.roll) * k;
      this.cur.pitch = this.from.pitch + (this.raw.pitch - this.from.pitch) * k;
    } else {
      const l = 16;
      this.cur.pos.set(
        damp(this.cur.pos.x, this.raw.pos.x, l, dt),
        damp(this.cur.pos.y, this.raw.pos.y, l, dt),
        damp(this.cur.pos.z, this.raw.pos.z, l, dt),
      );
      this.cur.look.set(
        damp(this.cur.look.x, this.raw.look.x, l, dt),
        damp(this.cur.look.y, this.raw.look.y, l, dt),
        damp(this.cur.look.z, this.raw.look.z, l, dt),
      );
      this.cur.fov = damp(this.cur.fov, this.raw.fov, l, dt);
      this.cur.roll = damp(this.cur.roll, this.raw.roll, l, dt);
      this.cur.pitch = damp(this.cur.pitch, this.raw.pitch, l, dt);
    }

    this.camera.position.copy(this.cur.pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.cur.look);
    if (Math.abs(this.cur.pitch) > 1e-4) this.camera.rotateX(this.cur.pitch);
    if (Math.abs(this.cur.roll) > 1e-4) this.camera.rotateZ(this.cur.roll);
    if (Math.abs(this.camera.fov - this.cur.fov) > 1e-3) {
      this.camera.fov = this.cur.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Places the camera immediately, used for the very first frame. */
  snap(shot: ShotFn, vp: Viewport): void {
    this.shot = shot;
    this.time = 0;
    this.blend = 1;
    this.started = true;
    shot(0, vp, this.cur);
    this.update(0, vp);
  }
}
