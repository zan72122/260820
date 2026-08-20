import * as THREE from 'three';
import { clamp, damp, lerp } from './mathx';

/** 35mm-equivalent focal length -> vertical field of view in degrees. */
export function fovForFocalMm(focalMm: number): number {
  return (2 * Math.atan(12 / focalMm) * 180) / Math.PI;
}

export interface Viewport {
  width: number;
  height: number;
  /** CSS-pixel safe-area insets. */
  safe: { top: number; right: number; bottom: number; left: number };
}

export interface Shot {
  /** What the shot is about. */
  target: THREE.Vector3;
  /** Radius of the sphere that must stay fully on screen. */
  radius: number;
  focalMm: number;
  /** Orbit angles in degrees: yaw around Y, pitch above the horizon. */
  yaw: number;
  pitch: number;
  /**
   * Where the subject sits on screen, -1..1 (y: +1 top, x: +1 right).
   * Portrait pushes the subject up so the playing hand never covers it.
   */
  anchorPortrait?: { x: number; y: number };
  anchorLandscape?: { x: number; y: number };
  /** Extra breathing room around the subject, 1 = tight. */
  margin?: number;
}

export function makeShot(s: Shot): Required<Shot> {
  return {
    anchorPortrait: { x: 0, y: 0.22 },
    anchorLandscape: { x: 0, y: 0.14 },
    margin: 1.18,
    ...s,
  };
}

export interface SolvedShot {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

const _dir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _screenRight = new THREE.Vector3();
const _screenUp = new THREE.Vector3();

/**
 * Solves a shot for the current viewport. Called every frame, so an
 * orientation change simply reframes: no state anywhere is touched, and the
 * child's progress cannot rewind.
 */
export function solveShot(shot: Required<Shot>, vp: Viewport): SolvedShot {
  const portrait = vp.height >= vp.width;
  const fov = fovForFocalMm(shot.focalMm);
  const halfFovRad = (fov * Math.PI) / 360;

  // Safe area eats usable screen, so the subject must fit the smaller box.
  const usableH = Math.max(120, vp.height - vp.safe.top - vp.safe.bottom);
  const usableW = Math.max(120, vp.width - vp.safe.left - vp.safe.right);
  const safeScaleY = usableH / Math.max(1, vp.height);
  const safeScaleX = usableW / Math.max(1, vp.width);
  const aspect = vp.width / Math.max(1, vp.height);

  const requested = portrait ? shot.anchorPortrait : shot.anchorLandscape;
  // Recentre on the usable box: with a notch above and a home indicator below,
  // the optical centre of the screen is not the centre of the usable area.
  const anchor = {
    x: clamp(requested.x + (vp.safe.left - vp.safe.right) / Math.max(1, vp.width), -0.8, 0.8),
    y: clamp(requested.y + (vp.safe.bottom - vp.safe.top) / Math.max(1, vp.height), -0.8, 0.8),
  };

  // Distance so the subject sphere fits both axes, with the anchor offset
  // costing extra room on the side it moves toward.
  const tan = Math.tan(halfFovRad);
  const needY = (shot.radius * shot.margin) / (tan * safeScaleY * (1 - Math.abs(anchor.y) * 0.55));
  const needX =
    (shot.radius * shot.margin) / (tan * aspect * safeScaleX * (1 - Math.abs(anchor.x) * 0.55));
  const dist = Math.max(needY, needX);

  const yaw = (shot.yaw * Math.PI) / 180;
  const pitch = (shot.pitch * Math.PI) / 180;
  _dir.set(
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw),
  );

  const position = shot.target.clone().addScaledVector(_dir, dist);
  const lookAt = shot.target.clone();

  // Screen basis for a camera looking back along -_dir. Getting these two
  // vectors the wrong way round silently flips every anchor in the game, so
  // they are derived from the view direction rather than assumed.
  _forward.copy(_dir).multiplyScalar(-1);
  _screenRight.crossVectors(_forward, _up).normalize();
  _screenUp.crossVectors(_screenRight, _forward).normalize();

  // Slide the whole camera so the subject lands on the requested anchor,
  // without changing the perspective at all.
  const halfH = dist * tan;
  const halfW = halfH * aspect;
  const offUp = -anchor.y * halfH;
  const offRight = -anchor.x * halfW;
  position.addScaledVector(_screenUp, offUp).addScaledVector(_screenRight, offRight);
  lookAt.addScaledVector(_screenUp, offUp).addScaledVector(_screenRight, offRight);

  return { position, lookAt, fov };
}

/**
 * Holds the live camera and eases it between shots. Never cuts: the brief
 * requires the causal moments to stay in one continuous view.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private shot: Required<Shot>;
  private prevShot: Required<Shot> | null = null;
  private blend = 1;
  private blendSpeed = 1;
  private lookTarget = new THREE.Vector3();
  private breathe = 0;

  constructor(shot: Shot) {
    this.shot = makeShot(shot);
    this.camera = new THREE.PerspectiveCamera(fovForFocalMm(this.shot.focalMm), 1, 0.05, 220);
  }

  get currentShot(): Required<Shot> {
    return this.shot;
  }

  /** `seconds` 0 snaps; anything else is a slow, deliberate move. */
  setShot(shot: Shot, seconds = 1.6): void {
    const next = makeShot(shot);
    if (seconds <= 0) {
      this.shot = next;
      this.prevShot = null;
      this.blend = 1;
      return;
    }
    this.prevShot = this.blend >= 1 ? this.shot : this.prevShot ?? this.shot;
    this.shot = next;
    this.blend = 0;
    this.blendSpeed = 1 / Math.max(0.05, seconds);
  }

  /** Nudge the current shot without restarting the blend (free-play framing). */
  retarget(mutate: (s: Required<Shot>) => void): void {
    mutate(this.shot);
  }

  update(dt: number, vp: Viewport, immediate = false): void {
    this.blend = Math.min(1, this.blend + dt * this.blendSpeed);
    const t = this.blend * this.blend * (3 - 2 * this.blend);

    const a = this.prevShot ? solveShot(this.prevShot, vp) : null;
    const b = solveShot(this.shot, vp);

    const pos = a ? a.position.clone().lerp(b.position, t) : b.position;
    const look = a ? a.lookAt.clone().lerp(b.lookAt, t) : b.lookAt;
    const fov = a ? lerp(a.fov, b.fov, t) : b.fov;

    // A very small idle drift keeps the frame alive without ever shaking.
    this.breathe += dt * 0.22;
    const bx = Math.sin(this.breathe) * 0.004 * this.shot.radius;
    const by = Math.cos(this.breathe * 0.77) * 0.003 * this.shot.radius;

    const lambda = immediate ? 1e6 : 5.5;
    this.camera.position.set(
      damp(this.camera.position.x, pos.x + bx, lambda, dt),
      damp(this.camera.position.y, pos.y + by, lambda, dt),
      damp(this.camera.position.z, pos.z, lambda, dt),
    );
    this.lookTarget.set(
      damp(this.lookTarget.x, look.x, lambda, dt),
      damp(this.lookTarget.y, look.y, lambda, dt),
      damp(this.lookTarget.z, look.z, lambda, dt),
    );
    this.camera.lookAt(this.lookTarget);

    const aspect = vp.width / Math.max(1, vp.height);
    if (Math.abs(this.camera.aspect - aspect) > 1e-4 || Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.aspect = aspect;
      this.camera.fov = clamp(fov, 8, 75);
      this.camera.updateProjectionMatrix();
    }
  }

  snap(vp: Viewport): void {
    this.blend = 1;
    this.prevShot = null;
    const s = solveShot(this.shot, vp);
    this.camera.position.copy(s.position);
    this.lookTarget.copy(s.lookAt);
    this.camera.lookAt(this.lookTarget);
    this.camera.aspect = vp.width / Math.max(1, vp.height);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
  }
}
