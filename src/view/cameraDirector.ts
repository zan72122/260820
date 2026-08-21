import { PerspectiveCamera, Vector3 } from 'three';
import { clamp, damp, easeInOut, lerp } from '../core/math';
import { LAYOUT } from '../world/layout';

export type CameraMode = 'watch' | 'raised' | 'reveal' | 'free';

interface Framing {
  phi: number;
  fov: number;
  targetY: number;
  halfHeight: number;
  elevation: number;
  followX: number;
  widthFit: number;
}

const tmp = new Vector3();

/**
 * One continuous camera.
 *
 * It never cuts. Every beat is a move of the same rig: a slight lift once several
 * threads exist, then a long pull straight back along the line it was already on
 * so the arcs the child watched being drawn resolve into one figure without ever
 * leaving the viewpoint they were drawn from.
 */
export class CameraDirector {
  readonly camera: PerspectiveCamera;
  mode: CameraMode = 'watch';

  private target = new Vector3(0, 1.5, 0);
  private smoothTarget = new Vector3(0, 1.5, 0);
  private distance = 5.5;
  private smoothDistance = 5.5;
  private phi = 0.34;
  private smoothPhi = 0.34;
  private elev = 0.9;
  private smoothElev = 0.9;
  private aspect = 1;
  private revealT = 0;
  private azimuthDrift = 0;
  private introT = 0;
  /** Development-only tighter framing, used to inspect the rig and the rider. */
  study: { halfHeight: number; targetY: number } | null = null;

  constructor() {
    this.camera = new PerspectiveCamera(44, 1, 0.1, 220);
    this.camera.position.set(-1.6, 2.5, 5.6);
    this.camera.up.set(0, 1, 0);
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Portrait leans end-on and stands back; landscape opens out and comes closer. */
  private framing(): Framing {
    const a = clamp(this.aspect, 0.42, 2.4);
    const k = clamp((a - 0.46) / (1.9 - 0.46), 0, 1);
    return {
      // Off-axis angle from the swing plane's normal. A portrait frame turns
      // further down the length of the arc so its width foreshortens instead of
      // forcing the camera to retreat or the lens to open up.
      phi: lerp(0.82, 0.46, k),
      fov: lerp(48, 45, k),
      targetY: lerp(1.22, 1.06, k),
      halfHeight: lerp(2.16, 1.88, k),
      // Sat at a child's own eye line, so the top of the arc crosses the horizon
      // and the colour reads against haze and treeline, not against the dirt.
      elevation: lerp(-0.14, -0.18, k),
      followX: lerp(0.24, 0.15, k),
      // Portrait deliberately lets the very ends of the widest arcs run past the
      // frame during play rather than opening the lens or retreating further.
      widthFit: lerp(0.68, 1.0, k),
    };
  }

  /** Fit distance from the real extent to cover, never by opening the lens wider. */
  private fitDistance(halfW: number, halfH: number, f: Framing): number {
    const tanV = Math.tan((f.fov * Math.PI) / 360);
    const dH = halfH / tanV;
    // Seen from `phi` off the plane's normal, the arc's width lands on screen
    // foreshortened by cos(phi).
    const dW = (halfW * f.widthFit * Math.cos(f.phi)) / Math.max(0.05, tanV * this.aspect);
    return Math.max(dH, dW);
  }

  update(
    dt: number,
    seatX: number,
    amplitude: number,
    weaveCentre: Vector3 | null,
    weaveRadius: number,
  ): void {
    const f = this.framing();
    this.camera.fov = damp(this.camera.fov, f.fov, 2, dt);

    const arcHalfWidth = Math.sin(Math.max(amplitude, 0.22)) * LAYOUT.chainLength + 0.72;
    let halfW = arcHalfWidth;
    let halfH = this.study ? this.study.halfHeight : f.halfHeight;
    let targetY = this.study ? this.study.targetY : f.targetY;
    let targetX = clamp(seatX * f.followX, -0.85, 0.85);
    let elev = f.elevation;

    if (this.mode === 'raised') {
      elev = f.elevation + 0.62;
      halfH = f.halfHeight * 1.14;
      targetY = f.targetY + 0.12;
    } else if (this.mode === 'reveal') {
      this.revealT = Math.min(1, this.revealT + dt / 7.5);
      const e = easeInOut(this.revealT);
      elev = lerp(f.elevation + 0.62, f.elevation + 2.30, e);
      if (weaveCentre) {
        targetX = lerp(targetX, weaveCentre.x, e);
        targetY = lerp(f.targetY, Math.max(1.35, weaveCentre.y), e);
        halfW = lerp(arcHalfWidth, Math.max(arcHalfWidth * 1.25, weaveRadius * 1.62), e);
        halfH = lerp(f.halfHeight, Math.max(f.halfHeight * 1.2, weaveRadius * 1.34), e);
      } else {
        halfW = arcHalfWidth * lerp(1, 1.5, e);
        halfH = f.halfHeight * lerp(1, 1.45, e);
      }
      // A few degrees of drift only: enough to feel the space open, not enough to
      // move the scattering geometry the colours depend on.
      this.azimuthDrift = damp(this.azimuthDrift, 0.11 * e, 1.2, dt);
    } else if (this.mode === 'free') {
      elev = f.elevation + 1.00;
      halfH = f.halfHeight * 1.12;
      halfW = arcHalfWidth * 1.12;
      this.azimuthDrift = damp(this.azimuthDrift, 0.05, 0.8, dt);
    }

    // The opening seconds ease in from a slightly tighter frame.
    this.introT = Math.min(1, this.introT + dt / 4.5);
    const introK = lerp(0.90, 1.0, easeInOut(this.introT));

    // The pull-back is where portrait finally shows the whole width.
    const fit: Framing =
      this.mode === 'reveal'
        ? { ...f, widthFit: lerp(f.widthFit, 1.0, easeInOut(this.revealT)) }
        : this.mode === 'free'
          ? { ...f, widthFit: lerp(f.widthFit, 1.0, 0.85) }
          : f;
    if (this.study) halfW = 0.1;
    const wanted = this.fitDistance(halfW, halfH, fit) * 1.06 * introK;
    this.distance = wanted;
    this.target.set(targetX, targetY, 0);
    this.phi = f.phi + this.azimuthDrift;
    this.elev = elev;

    const rate = this.mode === 'reveal' ? 1.1 : 1.8;
    this.smoothDistance = damp(this.smoothDistance, this.distance, rate, dt);
    this.smoothPhi = damp(this.smoothPhi, this.phi, 1.4, dt);
    this.smoothElev = damp(this.smoothElev, this.elev, 1.3, dt);
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 1.5, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 1.2, dt);

    const horiz = Math.max(0.5, Math.sqrt(Math.max(0.01, this.smoothDistance ** 2 - this.smoothElev ** 2)));
    this.camera.position.set(
      this.smoothTarget.x - Math.sin(this.smoothPhi) * horiz,
      this.smoothTarget.y + this.smoothElev,
      this.smoothTarget.z + Math.cos(this.smoothPhi) * horiz,
    );
    // Level horizon at all times: no roll is ever introduced.
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.smoothTarget);
    this.camera.updateProjectionMatrix();
    // Keep the view matrix current for projections done outside the render pass.
    this.camera.updateMatrixWorld(true);
  }

  /** Screen-space direction the seat is travelling, for the one-time guide stroke. */
  seatScreenDirection(seat: Vector3, tangent: Vector3, out: { x: number; y: number }): void {
    const a = tmp.copy(seat).project(this.camera);
    const ax = a.x;
    const ay = a.y;
    const b = tmp.copy(seat).addScaledVector(tangent, 0.6).project(this.camera);
    let dx = b.x - ax;
    let dy = -(b.y - ay);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    out.x = dx;
    out.y = dy;
  }

  projectToScreen(p: Vector3, width: number, height: number, out: { x: number; y: number }): void {
    tmp.copy(p).project(this.camera);
    out.x = (tmp.x * 0.5 + 0.5) * width;
    out.y = (-tmp.y * 0.5 + 0.5) * height;
  }

  beginReveal(): void {
    if (this.mode === 'reveal') return;
    this.mode = 'reveal';
    this.revealT = 0;
  }

  get revealProgress(): number {
    return this.revealT;
  }

  resetIntro(): void {
    this.introT = 0;
    this.revealT = 0;
    this.azimuthDrift = 0;
    this.mode = 'watch';
  }
}
