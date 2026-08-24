import { clamp01, damp } from '../util/math';
import { Signal } from './Signals';

/**
 * The rubber bulb. A press, a hold, or an up/down swipe all register as
 * squeezes; the child never has to find a precise gesture.
 */
export class BulbPumpController {
  /** 0 = relaxed, 1 = fully compressed. Drives the mesh deformation. */
  squeeze = 0;
  /** Where the squeeze is being applied, in local bulb space (for the dent). */
  dentBias = 0;

  readonly onStroke = new Signal<number>();
  readonly onRelease = new Signal<void>();

  private target = 0;
  private held = false;
  private peak = 0;
  private strokeArmed = false;

  press(bias = 0): void {
    this.held = true;
    this.target = 1;
    this.dentBias = bias;
    this.strokeArmed = true;
  }

  /** Called while the finger slides; a direction reversal pumps again. */
  drag(bias: number): void {
    this.dentBias = bias;
  }

  /** A swipe that reverses direction counts as another complete stroke. */
  restroke(bias: number): void {
    if (!this.held) return;
    this.finishStroke();
    this.target = 1;
    this.dentBias = bias;
    this.strokeArmed = true;
  }

  release(): void {
    if (!this.held) return;
    this.held = false;
    this.target = 0;
    this.finishStroke();
    this.onRelease.emit();
  }

  private finishStroke(): void {
    if (!this.strokeArmed) return;
    this.strokeArmed = false;
    const strength = clamp01(this.peak);
    this.peak = 0;
    if (strength > 0.12) this.onStroke.emit(strength);
  }

  update(dt: number): void {
    // Compression is quick, elastic recovery is slower — that is what rubber does.
    const rate = this.target > this.squeeze ? 13 : 7.5;
    this.squeeze = damp(this.squeeze, this.target, rate, dt);
    if (this.held) this.peak = Math.max(this.peak, this.squeeze);
    if (!this.held) this.dentBias = damp(this.dentBias, 0, 5, dt);
  }

  /** Back-pressure makes the bulb push back once the cuff is firm. */
  applyBackPressure(pressure: number): void {
    if (pressure > 0.86) this.target = Math.min(this.target, 0.45);
  }

  reset(): void {
    this.squeeze = 0;
    this.target = 0;
    this.held = false;
    this.peak = 0;
    this.strokeArmed = false;
  }

  get isHeld(): boolean {
    return this.held;
  }
}
