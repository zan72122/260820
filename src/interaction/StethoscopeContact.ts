import type { ChestCoord } from '../audio/BodySoundField';
import { clamp01, damp, smoothstep } from '../core/mathutil';

/**
 * How well the diaphragm is actually sitting on the synthetic skin.
 *
 * Contact is what turns the room off and the chest on. It builds while the
 * finger stays down, drops when it lifts, and is a little worse out towards
 * the flank where the rim cannot seat flat — which is a real reason for a
 * sound to become vague, not a punishment for missing a target.
 */
export class StethoscopeContact {
  private quality = 0;
  private pressed = false;
  private releasing = false;

  setPressed(v: boolean): void {
    if (this.pressed && !v) this.releasing = true;
    if (v) this.releasing = false;
    this.pressed = v;
  }

  isPressed(): boolean {
    return this.pressed;
  }

  /** True while the sound is still dying away after the chestpiece lifted. */
  isReleasing(): boolean {
    return this.releasing && this.quality > 0.01;
  }

  seatingAt(coord: ChestCoord, dragSpeed: number): number {
    // Flatter over the sternum and the pectoral plate, worse over the flank.
    const flank = smoothstep(0.62, 1.05, Math.abs(coord.lat));
    const belly = smoothstep(0.7, 1.0, -coord.sup);
    // Sliding fast lifts the rim slightly; resting settles it.
    const slide = smoothstep(0.25, 0.9, dragSpeed) * 0.3;
    return clamp01(1 - flank * 0.42 - belly * 0.3 - slide);
  }

  update(dt: number, coord: ChestCoord, dragSpeed: number): number {
    const target = this.pressed ? this.seatingAt(coord, dragSpeed) : 0;
    // Presses settle quickly; releases fade rather than cut.
    const rate = this.pressed ? 6.5 : 3.4;
    this.quality = damp(this.quality, target, rate, dt);
    if (this.releasing && this.quality < 0.01) this.releasing = false;
    return this.quality;
  }

  get value(): number {
    return this.quality;
  }
}
