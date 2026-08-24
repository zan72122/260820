import { Vector3 } from 'three';
import { clamp01, smoothstep } from '../core/mathutil';
import type { AnatomyModel } from '../scene/AnatomyModel';
import { HEART_CENTRE } from '../scene/ChestSurface';
import type { CameraDirector } from './CameraDirector';

type Phase = 'idle' | 'in' | 'hold' | 'out';

const T_IN = 0.95;
const T_HOLD = 2.4;
const T_OUT = 0.95;

/** How far back from the heart the look inside settles. */
const REVEAL_DISTANCE = 0.36;

/**
 * The short look inside — and it only ever happens *after* several cycles have
 * already been heard from that spot.
 *
 * The camera starts at the rim of the chestpiece and slips through the chest
 * wall; the wall itself is what fades, so the relationship between the spot on
 * the skin and the single heart behind the sternum stays visible the whole
 * time. Nothing draws a line from a valve to the skin, because there is no
 * such line.
 */
export class DelayedAnatomyReveal {
  private phase: Phase = 'idle';
  private t = 0;
  private from = new Vector3();
  private inside = new Vector3();
  private rim = new Vector3();
  private onFinish: (() => void) | null = null;
  private posOut = new Vector3();
  private targetOut = new Vector3();

  constructor(
    private director: CameraDirector,
    private anatomy: AnatomyModel,
  ) {}

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** 0 outside, 1 fully inside — the chest wall fades with this. */
  get insideAmount(): number {
    if (this.phase === 'idle') return 0;
    if (this.phase === 'in') return smoothstep(0.25, 1, this.t / T_IN);
    if (this.phase === 'hold') return 1;
    return 1 - smoothstep(0, 0.75, this.t / T_OUT);
  }

  start(surfacePoint: Vector3, surfaceNormal: Vector3, onFinish?: () => void): void {
    if (this.phase !== 'idle') return;
    this.phase = 'in';
    this.t = 0;
    this.onFinish = onFinish ?? null;

    this.rim.copy(surfacePoint).addScaledVector(surfaceNormal, 0.055);
    this.from.copy(this.director.camera.position);

    // Look at the heart from the side the chestpiece is on, but blended with a
    // fixed three-quarter bias so the ribs and the chest wall always read the
    // same way whichever spot the child chose.
    const dir = new Vector3().subVectors(this.rim, HEART_CENTRE).normalize();
    dir.lerp(new Vector3(0.5, 0.66, 0.56).normalize(), 0.45).normalize();
    this.inside.copy(HEART_CENTRE).addScaledVector(dir, REVEAL_DISTANCE);

    this.director.setLocked(false);
    this.director.setDynamic((out) => {
      const k = clamp01(this.t / T_IN);
      const e = smoothstep(0, 1, k);
      if (this.phase === 'in') {
        this.posOut.copy(this.from).lerp(this.rim, smoothstep(0, 0.55, k));
        this.posOut.lerp(this.inside, e * e);
        this.targetOut.copy(HEART_CENTRE);
      } else if (this.phase === 'hold') {
        this.posOut.copy(this.inside);
        this.targetOut.copy(HEART_CENTRE);
      } else {
        const ko = smoothstep(0, 1, clamp01(this.t / T_OUT));
        this.posOut.copy(this.inside).lerp(this.from, ko);
        this.targetOut.copy(HEART_CENTRE).lerp(this.rim, ko);
      }
      out.position.copy(this.posOut);
      out.target.copy(this.targetOut);
      out.fov = this.director.fovForFraming(REVEAL_DISTANCE, 0.24, 0.32);
    }, 6.0);
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'in' && this.t >= T_IN) {
      this.phase = 'hold';
      this.t = 0;
    } else if (this.phase === 'hold' && this.t >= T_HOLD) {
      this.phase = 'out';
      this.t = 0;
    } else if (this.phase === 'out' && this.t >= T_OUT) {
      this.phase = 'idle';
      this.t = 0;
      this.director.setShot('compare');
      this.onFinish?.();
      this.onFinish = null;
    }
    this.anatomy.setOpacity(this.insideAmount);
    this.anatomy.drift(dt, this.insideAmount);
  }
}
