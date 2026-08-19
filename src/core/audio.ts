import { clamp } from './rng';

/**
 * Every sound is synthesised at runtime — no audio assets to download, and the
 * whole game stays playable at zero volume (sound only ever reinforces what the
 * picture already says).
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private hiss: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null =
    null;
  private sizzle: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  private lastPipe = 0;
  private lastCrackle = 0;
  enabled = true;

  /** Must be called from inside a user gesture on iOS. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type Win = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as Win).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.enabled ? 0.85 : 0;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.noise = this.makeNoise(ctx, 2.2);
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
    }
    if (!on) this.stopHiss();
  }

  suspend(): void {
    this.stopHiss();
    this.stopSizzle();
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = (s / 2147483648 - 1) * 0.9;
    }
    return buf;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private burst(opts: {
    dur: number;
    gain: number;
    type: BiquadFilterType;
    freq: number;
    q?: number;
    sweepTo?: number;
    delay?: number;
  }): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const t0 = this.now() + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t0);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t0 + opts.dur * 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  private tone(opts: {
    freq: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    to?: number;
    delay?: number;
  }): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t0 = this.now() + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.05);
  }

  /** Silicone mould peeling off the frozen dome. */
  moldRelease(): void {
    this.burst({ dur: 0.34, gain: 0.16, type: 'bandpass', freq: 420, sweepTo: 180, q: 1.2 });
    this.tone({ freq: 620, to: 300, dur: 0.26, gain: 0.06, type: 'triangle', delay: 0.02 });
    this.burst({ dur: 0.2, gain: 0.1, type: 'lowpass', freq: 240, delay: 0.16 });
  }

  /** Short squeeze of the piping bag; throttled so a long drag stays gentle. */
  pipeSqueeze(strength: number): void {
    const t = this.now();
    if (t - this.lastPipe < 0.085) return;
    this.lastPipe = t;
    this.burst({
      dur: 0.13,
      gain: 0.035 + 0.05 * clamp(strength, 0, 1),
      type: 'bandpass',
      freq: 780 + strength * 260,
      sweepTo: 380,
      q: 2.4,
    });
  }

  torchClick(): void {
    this.burst({ dur: 0.05, gain: 0.2, type: 'highpass', freq: 2600, q: 0.8 });
    this.tone({ freq: 1500, to: 900, dur: 0.05, gain: 0.05, type: 'square' });
  }

  startHiss(): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.hiss) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2900;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.now());
    gain.gain.exponentialRampToValueAtTime(0.075, this.now() + 0.12);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    this.hiss = { src, gain, filter };
  }

  stopHiss(): void {
    if (!this.hiss || !this.ctx) return;
    const { src, gain } = this.hiss;
    const t = this.now();
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    try {
      src.stop(t + 0.24);
    } catch {
      /* already stopped */
    }
    this.hiss = null;
    this.stopSizzle();
  }

  /** Tiny surface-browning crackle, kept far under the hiss. */
  setSizzle(amount: number): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const a = clamp(amount, 0, 1);
    if (a <= 0.001) {
      this.stopSizzle();
      return;
    }
    if (!this.sizzle) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4200;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(hp).connect(gain).connect(master);
      src.start();
      this.sizzle = { src, gain };
    }
    this.sizzle.gain.gain.setTargetAtTime(0.026 * a, this.now(), 0.09);

    const t = this.now();
    if (a > 0.35 && t - this.lastCrackle > 0.19) {
      this.lastCrackle = t;
      this.burst({ dur: 0.045, gain: 0.02 * a, type: 'highpass', freq: 5200 });
    }
  }

  private stopSizzle(): void {
    if (!this.sizzle || !this.ctx) return;
    const { src, gain } = this.sizzle;
    const t = this.now();
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.06);
    try {
      src.stop(t + 0.3);
    } catch {
      /* already stopped */
    }
    this.sizzle = null;
  }

  /** Knife through the crisp meringue shell, then the soft sponge. */
  knifeSlice(): void {
    this.burst({ dur: 0.22, gain: 0.12, type: 'bandpass', freq: 3400, sweepTo: 1400, q: 1.1 });
    this.burst({ dur: 0.3, gain: 0.07, type: 'lowpass', freq: 700, delay: 0.14 });
  }

  plateSet(): void {
    this.burst({ dur: 0.14, gain: 0.09, type: 'lowpass', freq: 320 });
  }

  finish(): void {
    this.tone({ freq: 784, dur: 0.5, gain: 0.09, type: 'sine' });
    this.tone({ freq: 1046.5, dur: 0.55, gain: 0.07, type: 'sine', delay: 0.09 });
    this.tone({ freq: 1318.5, dur: 0.7, gain: 0.055, type: 'sine', delay: 0.19 });
  }
}
