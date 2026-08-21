import { PerspectiveCamera, Vector3 } from 'three';

export interface Pose {
  pos: Vector3;
  target: Vector3;
}

export type PoseProvider = (out: Pose, t: number) => void;

function smoother(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * The camera only ever moves on authored rails and only ever blends between
 * them, so the link between "the ring outside" and "the light inside" is
 * never cut by an edit.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly cur: Pose = { pos: new Vector3(), target: new Vector3() };
  private readonly from: Pose = { pos: new Vector3(), target: new Vector3() };
  private readonly desired: Pose = { pos: new Vector3(), target: new Vector3() };
  private provider: PoseProvider | null = null;
  blend = 1;
  private duration = 1;
  private shotTime = 0;
  private baseFov = 46;
  private aspect = 1.6;
  private dolly = 1;
  private shake = 0;
  name = '';

  constructor() {
    this.camera = new PerspectiveCamera(46, 1.6, 0.1, 900);
    this.cur.pos.set(9, 5, -8);
    this.cur.target.set(0, 2.4, 0);
  }

  setShot(name: string, provider: PoseProvider, duration = 1.6, fov = 46): void {
    if (this.name === name) {
      this.provider = provider;
      this.baseFov = fov;
      return;
    }
    this.name = name;
    if (fov !== this.baseFov) {
      this.baseFov = fov;
      this.applyFov();
    }
    this.from.pos.copy(this.cur.pos);
    this.from.target.copy(this.cur.target);
    this.provider = provider;
    this.blend = duration <= 0 ? 1 : 0;
    this.duration = Math.max(0.0001, duration);
    this.shotTime = 0;
    this.baseFov = fov;
  }

  nudge(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  get transitioning(): boolean {
    return this.blend < 1;
  }

  update(dt: number): void {
    this.shotTime += dt;
    if (this.provider) this.provider(this.desired, this.shotTime);
    // portrait keeps the same horizontal framing by standing further back,
    // then spends the extra screen height on the tunnel below the port
    if (this.dolly !== 1) {
      this.desired.pos.sub(this.desired.target).multiplyScalar(this.dolly).add(this.desired.target);
      // spend the extra height on the flume and the sky, not on more apron
      this.desired.target.y += (this.dolly - 1) * 1.55;
    }
    this.blend = Math.min(1, this.blend + dt / this.duration);
    const k = smoother(this.blend);
    this.cur.pos.lerpVectors(this.from.pos, this.desired.pos, k);
    this.cur.target.lerpVectors(this.from.target, this.desired.target, k);
    if (this.blend >= 1) {
      this.from.pos.copy(this.cur.pos);
      this.from.target.copy(this.cur.target);
    }

    this.camera.position.copy(this.cur.pos);
    if (this.shake > 0.0001) {
      const t = this.shotTime * 22;
      this.camera.position.x += Math.sin(t) * this.shake * 0.02;
      this.camera.position.y += Math.sin(t * 1.7 + 1.1) * this.shake * 0.017;
      this.shake *= Math.exp(-dt * 3.4);
    }
    // lookAt with world up keeps camera roll at zero: the flume's own
    // curvature carries the sense of speed, not a rolling horizon.
    this.camera.lookAt(this.cur.target);
  }

  /** Portrait keeps the horizontal framing and gains height. */
  setViewport(width: number, height: number): void {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.applyFov();
  }

  private static readonly REF_ASPECT = 1.62;

  private applyFov(): void {
    const base = this.baseFov;
    const ref = CameraRig.REF_ASPECT;
    const hRef = 2 * Math.atan(Math.tan((base * Math.PI) / 360) * ref);
    if (this.aspect >= ref) {
      this.camera.fov = base;
      this.dolly = 1;
    } else {
      const wanted = (2 * Math.atan(Math.tan(hRef * 0.5) / this.aspect) * 180) / Math.PI;
      this.camera.fov = Math.min(72, wanted);
      const hNow = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.aspect);
      this.dolly = Math.min(2.6, Math.max(1, Math.tan(hRef * 0.5) / Math.tan(hNow * 0.5)));
    }
    this.camera.updateProjectionMatrix();
  }

  get pose(): Pose {
    return this.cur;
  }
}
