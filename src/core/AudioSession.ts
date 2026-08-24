import { clamp01, makeRng } from '../util/math';
import { Signal } from './Signals';

export type OutputMode = 'speaker' | 'headphone';

/**
 * One AudioContext for the whole game, created or resumed by the child's very
 * first touch on the stethoscope — there is no separate "enable sound" screen.
 *
 * Buses: ambience (room tone), mechanical (bulb, valve, needle) and body
 * (the manikin's pulse module and the Korotkoff sounds). The body bus only
 * opens when the chestpiece is on the arm, and opening it ducks the room.
 */
export class AudioSession {
  ctx: AudioContext | null = null;

  readonly onUnlocked = new Signal<AudioContext>();
  readonly onStateChange = new Signal<void>();

  master!: GainNode;
  ambienceBus!: GainNode;
  mechanicalBus!: GainNode;
  bodyBus!: GainNode;
  /** Post-bus voicing that keeps the tapping audible on a phone speaker. */
  private voicing!: BiquadFilterNode;
  private voicingLow!: BiquadFilterNode;
  private noiseBuffer: AudioBuffer | null = null;

  private ambienceNodes: AudioNode[] = [];
  private _volume = 0.85;
  private _muted = false;
  private _mode: OutputMode = 'speaker';

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get volume(): number {
    return this._volume;
  }

  get muted(): boolean {
    return this._muted;
  }

  get outputMode(): OutputMode {
    return this._mode;
  }

  /** Must be called synchronously inside a user-gesture handler. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buildGraph();
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* Safari occasionally rejects a resume outside a gesture; retried next touch. */
      }
    }
    if (this.ctx.state === 'running') {
      this.startAmbience();
      this.onUnlocked.emit(this.ctx);
      this.onStateChange.emit();
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;

    // Gentle presence lift so a small phone speaker still carries the taps.
    this.voicing = ctx.createBiquadFilter();
    this.voicing.type = 'peaking';
    this.voicingLow = ctx.createBiquadFilter();
    this.voicingLow.type = 'lowshelf';
    this.applyVoicing();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;

    this.voicing.connect(this.voicingLow);
    this.voicingLow.connect(limiter);
    limiter.connect(this.master);
    this.master.connect(ctx.destination);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 0;
    this.mechanicalBus = ctx.createGain();
    this.mechanicalBus.gain.value = 1;
    this.bodyBus = ctx.createGain();
    this.bodyBus.gain.value = 0;

    this.ambienceBus.connect(this.voicing);
    this.mechanicalBus.connect(this.voicing);
    this.bodyBus.connect(this.voicing);
  }

  private applyVoicing(): void {
    if (!this.ctx) return;
    if (this._mode === 'speaker') {
      // Phone speakers roll off below ~400 Hz, so bring the tap's body upward.
      this.voicing.frequency.value = 900;
      this.voicing.Q.value = 0.8;
      this.voicing.gain.value = 5.5;
      this.voicingLow.frequency.value = 180;
      this.voicingLow.gain.value = -3;
    } else {
      this.voicing.frequency.value = 620;
      this.voicing.Q.value = 0.7;
      this.voicing.gain.value = 1.5;
      this.voicingLow.frequency.value = 140;
      this.voicingLow.gain.value = 2.5;
    }
  }

  setOutputMode(mode: OutputMode): void {
    this._mode = mode;
    if (this.ctx) this.applyVoicing();
    this.onStateChange.emit();
  }

  setVolume(v: number): void {
    this._volume = clamp01(v);
    if (this.ctx) {
      this.master.gain.setTargetAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime,
        0.02,
      );
    }
    this.onStateChange.emit();
  }

  setMuted(m: boolean): void {
    this._muted = m;
    this.setVolume(this._volume);
  }

  /** Deterministic noise: the same seed every session, so nothing is random. */
  getNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      const rng = makeRng(20260824);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = rng() * 2 - 1;
        // Mildly pink: closer to room tone and to fluid noise than white.
        last = 0.965 * last + 0.035 * white;
        data[i] = last * 4.2 + white * 0.28;
      }
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /** A steady bed of ventilation and distant corridor noise. */
  private startAmbience(): void {
    if (this.ambienceNodes.length || !this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.4;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;

    const g = ctx.createGain();
    g.gain.value = 0.16;

    // A slow breathing motion in the ventilation, deterministic in period.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.ambienceBus);
    src.start();
    lfo.start();

    this.ambienceBus.gain.setValueAtTime(0, ctx.currentTime);
    this.ambienceBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4);
    this.ambienceNodes.push(src, lfo, g, lp, hp, lfoGain);
  }

  /** Duck the room down as the child starts to listen. */
  setRoomLevel(level: number, timeConstant = 0.35): void {
    if (!this.ctx) return;
    this.ambienceBus.gain.setTargetAtTime(
      clamp01(level),
      this.ctx.currentTime,
      timeConstant,
    );
  }

  setBodyLevel(level: number, timeConstant = 0.25): void {
    if (!this.ctx) return;
    this.bodyBus.gain.setTargetAtTime(
      clamp01(level),
      this.ctx.currentTime,
      timeConstant,
    );
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
