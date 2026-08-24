import { clamp01, damp } from '../util/math';
import { Signal } from './Signals';

/**
 * Where the chestpiece is and how well it is sitting. The acceptance region
 * over the antecubital fossa is deliberately large — a four-year-old should
 * never have to hit millimetres — and the instructor's hand closes the last
 * few millimetres for them.
 */
export class StethoscopeContact {
  /** 0 = off the arm, 1 = seated with the rim compressed. */
  contact = 0;
  /** Rim compression, lags contact, drives the mesh squash. */
  rimCompression = 0;
  /** True once the chestpiece has ever been seated. */
  placed = false;
  /** True while the child is dragging it. */
  dragging = false;

  readonly onSeated = new Signal<void>();
  readonly onLifted = new Signal<void>();

  private target = 0;

  /**
   * `distance` is metres from the centre of the acceptance region. The whole
   * antecubital area counts: anywhere within about five centimetres is a
   * clean placement, and it stays acceptable out to about thirteen, which on
   * this arm is most of the crook of the elbow.
   */
  evaluate(distance: number): number {
    return clamp01(1 - (distance - 0.05) / 0.1);
  }

  seat(): void {
    this.target = 1;
    if (!this.placed) {
      this.placed = true;
      this.onSeated.emit();
    } else if (this.contact < 0.4) {
      this.onSeated.emit();
    }
  }

  lift(): void {
    if (this.target > 0.5) this.onLifted.emit();
    this.target = 0;
  }

  update(dt: number): void {
    this.contact = damp(this.contact, this.target, 8, dt);
    this.rimCompression = damp(this.rimCompression, this.contact, 5, dt);
  }

  reset(): void {
    this.contact = 0;
    this.rimCompression = 0;
    this.target = 0;
    this.placed = false;
    this.dragging = false;
  }
}
