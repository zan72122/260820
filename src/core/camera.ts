import * as THREE from 'three';
import { clamp, damp, easeInOutCubic } from './util';

export interface Framing {
  /** point the shot is built around (world) */
  center: THREE.Vector3;
  /** radius of the sphere that must stay on screen */
  radius: number;
  /** direction from the centre towards the camera (will be normalised) */
  dir: THREE.Vector3;
  /** screen bias: negative lifts the subject towards the top of the frame */
  bias?: number;
  /** extra framing margin */
  margin?: number;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/**
 * The child never drives the camera. Each beat of the game declares a framing
 * and the rig eases there, re-solving the distance whenever the viewport
 * changes so the subject fits in portrait and landscape alike.
 */
export class CameraRig {
  private from: Framing;
  private to: Framing;
  private t = 1;
  private dur = 1;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  reduceMotion = false;

  constructor(private camera: THREE.PerspectiveCamera, start: Framing) {
    this.from = cloneFraming(start);
    this.to = cloneFraming(start);
    this.apply(1, true);
  }

  get current(): Framing {
    return this.to;
  }

  get moving() {
    return this.t < 1;
  }

  goTo(f: Framing, duration = 1.2) {
    this.from = this.sample(this.t);
    this.to = cloneFraming(f);
    this.dur = this.reduceMotion ? Math.min(duration, 0.35) : duration;
    this.t = 0;
  }

  /** Continuously retarget without restarting the easing (used by the hero orbit). */
  track(f: Framing) {
    this.to = cloneFraming(f);
    this.from = cloneFraming(f);
    this.t = 1;
  }

  snap(f: Framing) {
    this.from = cloneFraming(f);
    this.to = cloneFraming(f);
    this.t = 1;
    this.apply(1, true);
  }

  private sample(t: number): Framing {
    const e = easeInOutCubic(clamp(t, 0, 1));
    return {
      center: tmpA.copy(this.from.center).lerp(this.to.center, e).clone(),
      radius: THREE.MathUtils.lerp(this.from.radius, this.to.radius, e),
      dir: tmpB
        .copy(this.from.dir)
        .normalize()
        .lerp(tmpA.copy(this.to.dir).normalize(), e)
        .normalize()
        .clone(),
      bias: THREE.MathUtils.lerp(this.from.bias ?? 0, this.to.bias ?? 0, e),
      margin: THREE.MathUtils.lerp(this.from.margin ?? 1, this.to.margin ?? 1, e),
    };
  }

  /** Solve the distance so a sphere of `radius` fits in both screen axes. */
  private distanceFor(radius: number, margin: number) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * this.camera.aspect);
    const fov = Math.min(vFov, hFov);
    return (radius * margin) / Math.max(0.15, Math.sin(fov * 0.5));
  }

  private apply(t: number, immediate: boolean, dt = 0) {
    const f = this.sample(t);
    const dist = this.distanceFor(f.radius, f.margin ?? 1);
    const dir = f.dir.clone().normalize();
    const wantPos = f.center.clone().addScaledVector(dir, dist);

    // bias shifts the aim along the camera's own up axis
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const wantLook = f.center.clone().addScaledVector(camUp, (f.bias ?? 0) * f.radius);

    if (immediate) {
      this.pos.copy(wantPos);
      this.look.copy(wantLook);
    } else {
      const k = 14;
      this.pos.x = damp(this.pos.x, wantPos.x, k, dt);
      this.pos.y = damp(this.pos.y, wantPos.y, k, dt);
      this.pos.z = damp(this.pos.z, wantPos.z, k, dt);
      this.look.x = damp(this.look.x, wantLook.x, k, dt);
      this.look.y = damp(this.look.y, wantLook.y, k, dt);
      this.look.z = damp(this.look.z, wantLook.z, k, dt);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  update(dt: number) {
    if (this.t < 1) this.t = clamp(this.t + dt / Math.max(this.dur, 0.001), 0, 1);
    this.apply(this.t, false, dt);
  }

  /** Re-solve immediately (used on orientation change). */
  reframe() {
    this.apply(this.t, true);
  }
}

function cloneFraming(f: Framing): Framing {
  return {
    center: f.center.clone(),
    radius: f.radius,
    dir: f.dir.clone().normalize(),
    bias: f.bias ?? 0,
    margin: f.margin ?? 1,
  };
}
