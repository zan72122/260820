import { clamp, clamp01 } from '../core/mathutil';
import type { SoundProfile } from './BodySoundField';

/**
 * One "listening position" rendered through the chest wall.
 *
 * The live chestpiece owns one of these; each record tile borrows one when the
 * child taps it. All of them are fed by the *same* scheduled heart sounds from
 * the *same* clock — a channel only re-weights and re-colours them.
 */
export class AuscultationChannel {
  readonly input: GainNode;
  private lowShelf: BiquadFilterNode;
  private presence: BiquadFilterNode;
  private wall: BiquadFilterNode;
  private out: GainNode;
  private ctx: AudioContext;
  private level = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.input.gain.value = 1;

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 120;
    this.lowShelf.gain.value = 0;

    this.presence = ctx.createBiquadFilter();
    this.presence.type = 'peaking';
    this.presence.frequency.value = 155;
    this.presence.Q.value = 1.1;
    this.presence.gain.value = 0;

    // "How far inside the chest the sound started" is mostly how much high
    // frequency survived the trip out — one gentle corner, moved continuously.
    this.wall = ctx.createBiquadFilter();
    this.wall.type = 'lowpass';
    this.wall.frequency.value = 500;
    this.wall.Q.value = 0.72;

    this.out = ctx.createGain();
    this.out.gain.value = 0;

    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.presence);
    this.presence.connect(this.wall);
    this.wall.connect(this.out);
    this.out.connect(destination);
  }

  /**
   * Continuously follow the field. Called every frame while the chestpiece
   * moves, which is what makes the change a slide and never a switch.
   */
  applyProfile(p: SoundProfile, smoothing = 0.09): void {
    const t = this.ctx.currentTime;
    this.wall.frequency.setTargetAtTime(clamp(p.cutoff, 180, 2400), t, smoothing);
    this.lowShelf.gain.setTargetAtTime(clamp(p.lowShelf, -12, 12), t, smoothing);
    this.presence.gain.setTargetAtTime(clamp(p.presence, -12, 12), t, smoothing);
  }

  /** 0 = chestpiece off the skin, 1 = firmly seated. */
  setLevel(v: number, smoothing = 0.05): void {
    this.level = clamp01(v);
    this.out.gain.setTargetAtTime(this.level, this.ctx.currentTime, smoothing);
  }

  getLevel(): number {
    return this.level;
  }

  /** Let a lifted chestpiece die away instead of being cut off. */
  release(seconds = 0.42): void {
    this.level = 0;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.setTargetAtTime(0, t, seconds / 3.5);
  }

  dispose(): void {
    this.out.disconnect();
  }
}
