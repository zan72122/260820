import { clamp01, damp } from '../util/math';
import { Signal } from './Signals';

/** Rotation needed to go from shut to fully open, in radians of finger arc. */
const FULL_OPEN_ARC = 2.5;

/**
 * The brass release valve. The child turns it with one finger; a complete
 * circle is never required, only the intent to rotate, so partial arcs and
 * short tangential drags both count.
 */
export class ValveController {
  /** 0 = shut, 1 = wide open. */
  openness = 0;
  /** Visual spindle angle in radians (turns several times over the range). */
  angle = 0;
  /** Smoothed |d openness / dt|, drives the air hiss and the guidance model. */
  speed = 0;

  readonly onFirstTurn = new Signal<void>();

  private arc = 0;
  private everTurned = false;
  private rawSpeed = 0;

  /** `delta` is the signed finger arc in radians; positive opens. */
  applyArc(delta: number): void {
    if (Math.abs(delta) < 1e-5) return;
    this.arc = Math.max(0, Math.min(FULL_OPEN_ARC * 1.05, this.arc + delta));
    this.openness = clamp01(this.arc / FULL_OPEN_ARC);
    this.angle += delta * 2.2;
    this.rawSpeed += Math.abs(delta) / FULL_OPEN_ARC;
    if (!this.everTurned && this.openness > 0.012) {
      this.everTurned = true;
      this.onFirstTurn.emit();
    }
  }

  update(dt: number): void {
    const instant = dt > 0 ? this.rawSpeed / dt : 0;
    this.rawSpeed = 0;
    this.speed = damp(this.speed, instant, 8, dt);
  }

  /** The instructor resets the valve between runs. */
  reset(): void {
    this.arc = 0;
    this.openness = 0;
    this.speed = 0;
    this.everTurned = false;
    this.rawSpeed = 0;
  }

  get hasBeenTurned(): boolean {
    return this.everTurned;
  }
}
