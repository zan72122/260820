import { clamp01, damp } from '../util/math';
import { Signal } from './Signals';

/**
 * Cuff pressure is a normalised 0..1 quantity. It is deliberately *not* mmHg:
 * nothing in this game reads out a blood-pressure value, and the number never
 * reaches the screen. Everything visual and audible hangs off this one value so
 * the cuff, the needle, the sound stage and the cutaway can never disagree.
 */

/** At or above this the vessel stays shut for the whole cycle: no sound. */
export const PRESSURE_WINDOW_TOP = 0.64;
/** Below this the flow runs smooth again: sound is gone. */
export const PRESSURE_WINDOW_BOTTOM = 0.27;
/** Enough squeeze to have shut the vessel with margin to spare. */
export const PRESSURE_READY = 0.78;

export type SoundStage = 'silent-high' | 'crisp' | 'soft' | 'faint' | 'silent-low';

export class CuffPressureModel {
  /** Normalised cuff pressure, 0..1. */
  pressure = 0;
  /** Fabric tension the cuff mesh reads, lags pressure slightly. */
  tension = 0;
  /** Smoothed needle value so the aneroid movement never snaps. */
  needle = 0;

  readonly onPumpAccepted = new Signal<number>();
  readonly onOverPressure = new Signal<void>();

  private lastPressure = 0;

  /** Delivered by one bulb stroke. Returns how much actually went in. */
  pump(strength: number): number {
    const headroom = clamp01((1 - this.pressure) / 0.35);
    // The bulb gets stiff near the top: the child cannot force it dangerously.
    const delivered = strength * 0.16 * (0.25 + 0.75 * headroom);
    if (headroom < 0.16) this.onOverPressure.emit();
    this.pressure = clamp01(this.pressure + delivered);
    this.onPumpAccepted.emit(delivered);
    return delivered;
  }

  /** Continuous bleed through the release valve plus a small system leak. */
  bleed(dt: number, valveOpenness: number): void {
    if (this.pressure <= 0) return;
    const through = Math.pow(valveOpenness, 1.5) * 0.34;
    const seep = 0.004;
    this.pressure = clamp01(this.pressure - (through + seep) * dt);
  }

  /** Dump the rest of the cuff at the end of a run. */
  release(dt: number): void {
    this.pressure = clamp01(this.pressure - 0.85 * dt);
  }

  reset(): void {
    this.pressure = 0;
    this.tension = 0;
    this.needle = 0;
    this.lastPressure = 0;
  }

  update(dt: number): void {
    this.tension = damp(this.tension, this.pressure, 14, dt);
    this.needle = damp(this.needle, this.pressure, 9, dt);
    this.lastPressure = this.pressure;
  }

  get falling(): boolean {
    return this.pressure < this.lastPressure - 1e-5;
  }

  /** 1 at the top of the sound window, 0 at the bottom, clamped outside. */
  static windowPhase(pressure: number): number {
    return clamp01(
      (pressure - PRESSURE_WINDOW_BOTTOM) /
        (PRESSURE_WINDOW_TOP - PRESSURE_WINDOW_BOTTOM),
    );
  }

  static stageFor(pressure: number): SoundStage {
    if (pressure >= PRESSURE_WINDOW_TOP) return 'silent-high';
    if (pressure <= PRESSURE_WINDOW_BOTTOM) return 'silent-low';
    const p = CuffPressureModel.windowPhase(pressure);
    if (p > 0.66) return 'crisp';
    if (p > 0.3) return 'soft';
    return 'faint';
  }

  get stage(): SoundStage {
    return CuffPressureModel.stageFor(this.pressure);
  }

  get inWindow(): boolean {
    return (
      this.pressure < PRESSURE_WINDOW_TOP && this.pressure > PRESSURE_WINDOW_BOTTOM
    );
  }
}
