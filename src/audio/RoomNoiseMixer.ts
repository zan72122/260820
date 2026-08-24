import { clamp01 } from '../core/mathutil';
import { renderContactThud, renderKnock, renderNoiseBed, toAudioBuffer } from './synth';

/**
 * Everything the diaphragm shuts out: the skills lab itself, the tubing
 * rubbing across synthetic skin, the vinyl of the exam table.
 *
 * These live on their own bus so that pressing the chestpiece down can duck
 * them — which is the single strongest cue that you are now listening *inside*
 * rather than *in the room*.
 */
export class RoomNoiseMixer {
  private ctx: AudioContext;
  private bus: GainNode;
  private roomGain: GainNode;
  private frictionGain: GainNode;
  private frictionFilter: BiquadFilterNode;
  private roomSource: AudioBufferSourceNode | null = null;
  private frictionSource: AudioBufferSourceNode | null = null;
  private knockBuffer: AudioBuffer;
  private softKnockBuffer: AudioBuffer;
  private thudBuffer: AudioBuffer;
  private duck = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    const sr = ctx.sampleRate;

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(destination);

    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0.0;
    this.roomGain.connect(this.bus);

    this.frictionFilter = ctx.createBiquadFilter();
    this.frictionFilter.type = 'bandpass';
    this.frictionFilter.frequency.value = 2100;
    this.frictionFilter.Q.value = 0.6;
    this.frictionGain = ctx.createGain();
    this.frictionGain.gain.value = 0;
    this.frictionFilter.connect(this.frictionGain);
    this.frictionGain.connect(this.bus);

    const roomBed = renderNoiseBed(sr, 4.0, 77001, 360, 0.45, 0.06);
    const roomBuf = toAudioBuffer(ctx, roomBed);
    this.roomSource = ctx.createBufferSource();
    this.roomSource.buffer = roomBuf;
    this.roomSource.loop = true;
    this.roomSource.connect(this.roomGain);
    this.roomSource.start();

    const frictionBed = renderNoiseBed(sr, 2.4, 90210, 2400, 0.5, 0.5);
    const fricBuf = toAudioBuffer(ctx, frictionBed);
    this.frictionSource = ctx.createBufferSource();
    this.frictionSource.buffer = fricBuf;
    this.frictionSource.loop = true;
    this.frictionSource.connect(this.frictionFilter);
    this.frictionSource.start();

    this.knockBuffer = toAudioBuffer(ctx, renderKnock(sr, 5150, 210, 0.5));
    this.softKnockBuffer = toAudioBuffer(ctx, renderKnock(sr, 6180, 168, 0.32));
    this.thudBuffer = toAudioBuffer(ctx, renderContactThud(ctx.sampleRate, 8442, 0.42));

    this.roomGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
  }

  /** 0 = free field, 1 = chestpiece pressed and the room falls away. */
  setDuck(amount: number): void {
    this.duck = clamp01(amount);
    const g = 1 - 0.78 * this.duck;
    this.bus.gain.setTargetAtTime(g, this.ctx.currentTime, 0.12);
  }

  getDuck(): number {
    return this.duck;
  }

  /** Chestpiece sliding across synthetic skin — amount tracks drag speed. */
  setFriction(amount: number): void {
    const a = clamp01(amount);
    this.frictionGain.gain.setTargetAtTime(a * 0.16, this.ctx.currentTime, 0.05);
    this.frictionFilter.frequency.setTargetAtTime(
      1500 + a * 1500,
      this.ctx.currentTime,
      0.08,
    );
  }

  /** The instructor's knuckle on the table rail, marking one beat. */
  knock(when: number, soft = false): void {
    const src = this.ctx.createBufferSource();
    src.buffer = soft ? this.softKnockBuffer : this.knockBuffer;
    const g = this.ctx.createGain();
    // The knock is a gesture, not a metronome — it stays under the heart sound.
    g.gain.value = 0.55;
    src.connect(g);
    g.connect(this.bus);
    src.start(Math.max(when, this.ctx.currentTime));
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  /** Rim meeting synthetic skin. */
  contact(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.thudBuffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.7;
    src.connect(g);
    g.connect(this.bus);
    src.start(this.ctx.currentTime);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}
