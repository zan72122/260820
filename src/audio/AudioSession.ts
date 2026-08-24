import { clamp01 } from '../core/mathutil';

export type OutputMode = 'speaker' | 'headphone';

type AudioContextCtor = typeof AudioContext;

/**
 * Owns the one and only AudioContext.
 *
 * It is created (or resumed) by the very first thing the child does — pushing
 * the eartips into the training listening head — so there is no separate
 * "tap to enable sound" screen. If the browser refuses, everything else in the
 * game keeps working silently.
 */
export class AudioSession {
  ctx: AudioContext | null = null;
  master!: GainNode;
  /** Everything that is heard *through* the stethoscope. */
  auscultationBus!: GainNode;
  /** Room, cloth, tubing — the things the diaphragm shuts out. */
  ambientBus!: GainNode;

  private limiter!: DynamicsCompressorNode;
  private speakerTilt!: BiquadFilterNode;
  private speakerBody!: BiquadFilterNode;
  private volume = 1;
  private muted = false;
  private mode: OutputMode = 'speaker';
  private failed = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get unavailable(): boolean {
    return this.failed;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** Must be called from inside a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<boolean> {
    if (this.failed) return false;
    try {
      if (!this.ctx) {
        const Ctor: AudioContextCtor | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return false;
        }
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.buildGraph();
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      // iOS only truly starts the clock once something has played.
      const silent = this.ctx.createBufferSource();
      silent.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      silent.connect(this.ctx.destination);
      silent.start(0);
      return this.ctx.state === 'running';
    } catch {
      this.failed = true;
      return false;
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    // A gentle limiter, not a loudness war: heart sounds are quiet and peaky,
    // and phone speakers need the peaks tamed rather than the body squashed.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 4;
    this.limiter.attack.value = 0.006;
    this.limiter.release.value = 0.18;

    // Small-speaker help: real S1/S2 energy sits below 120 Hz where a phone
    // reproduces almost nothing, so a little of it is carried up into the
    // range the speaker can actually move. Deliberately modest.
    this.speakerBody = ctx.createBiquadFilter();
    this.speakerBody.type = 'peaking';
    this.speakerBody.frequency.value = 190;
    this.speakerBody.Q.value = 0.85;
    this.speakerTilt = ctx.createBiquadFilter();
    this.speakerTilt.type = 'highshelf';
    this.speakerTilt.frequency.value = 900;
    this.applyMode();

    this.auscultationBus = ctx.createGain();
    this.ambientBus = ctx.createGain();
    this.auscultationBus.gain.value = 1;
    this.ambientBus.gain.value = 1;

    this.auscultationBus.connect(this.speakerBody);
    this.speakerBody.connect(this.speakerTilt);
    this.speakerTilt.connect(this.limiter);
    this.ambientBus.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(ctx.destination);
  }

  private applyMode(): void {
    if (!this.ctx) return;
    if (this.mode === 'speaker') {
      this.speakerBody.gain.value = 7.5;
      this.speakerTilt.gain.value = 2.0;
    } else {
      this.speakerBody.gain.value = 2.0;
      this.speakerTilt.gain.value = -0.5;
    }
  }

  setOutputMode(mode: OutputMode): void {
    this.mode = mode;
    this.applyMode();
  }

  getOutputMode(): OutputMode {
    return this.mode;
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.pushMaster();
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.pushMaster();
  }

  isMuted(): boolean {
    return this.muted;
  }

  private pushMaster(): void {
    if (!this.ctx) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
  }

  suspendForBackground(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  async resumeFromBackground(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* the next user gesture will retry */
      }
    }
  }
}
