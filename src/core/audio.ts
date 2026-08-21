import { clamp, lerp, Rng } from './util';

type Ctx = AudioContext;

/** A looping filtered-noise voice whose level and colour are steered every frame. */
class NoiseVoice {
  private src: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private started = false;

  constructor(
    private ctx: Ctx,
    private buffer: AudioBuffer,
    dest: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
  ) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = freq;
    this.filter.Q.value = q;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter.connect(this.gain);
    this.gain.connect(dest);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.playbackRate.value = 1;
    src.connect(this.filter);
    src.start();
    this.src = src;
  }

  set(level: number, freq?: number, rate?: number): void {
    if (!this.started) this.start();
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(clamp(level, 0, 1), t, 0.045);
    if (freq !== undefined) this.filter.frequency.setTargetAtTime(freq, t, 0.06);
    if (rate !== undefined && this.src) this.src.playbackRate.setTargetAtTime(rate, t, 0.08);
  }

  silence(): void {
    if (!this.started) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }
}

/**
 * Every sound in the game is synthesised here at runtime, so the build ships no
 * audio files and nothing needs third-party licensing.
 *
 * The room tone is modelled as one bus that is split between a dry path and a
 * convolution path; driving into the slide simply crossfades those two, which is
 * what sells "the outside world went quiet and the pipe took over".
 */
export class AudioEngine {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private bus!: GainNode;
  private outdoor!: GainNode;
  private noise!: AudioBuffer;
  private rng = new Rng(7);
  private birdTimer = 0;
  private inside = 0;
  private targetInside = 0;
  private ready = false;
  private muted = false;

  loops: Record<string, NoiseVoice> = {};

  /** Must be called from a real user gesture for iOS Safari. */
  async unlock(): Promise<void> {
    if (this.ready) {
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      await ctx.resume();

      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(ctx.destination);

      this.dry = ctx.createGain();
      this.dry.gain.value = 1;
      this.dry.connect(this.master);

      const conv = ctx.createConvolver();
      conv.buffer = this.makeImpulse(ctx, 1.9, 2.6);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0;
      this.wet.connect(conv);
      conv.connect(this.master);

      this.bus = ctx.createGain();
      this.bus.connect(this.dry);
      this.bus.connect(this.wet);

      this.noise = this.makeNoise(ctx, 2.2);

      this.outdoor = ctx.createGain();
      this.outdoor.gain.value = 0;
      this.outdoor.connect(this.master);
      const breeze = new NoiseVoice(ctx, this.noise, this.outdoor, 'lowpass', 620, 0.7);
      breeze.set(0.16);
      this.loops.breeze = breeze;

      this.loops.peel = new NoiseVoice(ctx, this.noise, this.bus, 'bandpass', 1500, 2.2);
      this.loops.brush = new NoiseVoice(ctx, this.noise, this.bus, 'bandpass', 900, 1.1);
      this.loops.extrude = new NoiseVoice(ctx, this.noise, this.bus, 'lowpass', 340, 0.9);
      this.loops.polish = new NoiseVoice(ctx, this.noise, this.bus, 'bandpass', 1800, 3.2);
      this.loops.wheels = new NoiseVoice(ctx, this.noise, this.bus, 'bandpass', 260, 1.6);
      this.loops.flow = new NoiseVoice(ctx, this.noise, this.bus, 'bandpass', 2100, 1.4);
      this.loops.raft = new NoiseVoice(ctx, this.noise, this.bus, 'lowpass', 240, 0.8);

      this.ready = true;
      this.setOutdoor(1);
    } catch {
      this.ready = false;
    }
  }

  get active(): boolean {
    return this.ready && !this.muted;
  }

  private makeNoise(ctx: Ctx, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = this.rng.next() * 2 - 1;
      // light pinking so the noise beds do not hiss
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.24;
    }
    // fade the seam so the loop point is inaudible
    const fade = Math.floor(ctx.sampleRate * 0.01);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[i] *= k;
      d[len - 1 - i] *= k;
    }
    return buf;
  }

  private makeImpulse(ctx: Ctx, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (this.rng.next() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.004 ? t / 0.004 : 1);
      }
    }
    return buf;
  }

  /** 0 = open air, 1 = fully inside the pipe. */
  setOutdoor(open: number): void {
    this.targetInside = 1 - clamp(open, 0, 1);
  }

  update(dt: number): void {
    if (!this.ready || !this.ctx) return;
    this.inside = lerp(this.inside, this.targetInside, 1 - Math.exp(-2.4 * dt));
    const t = this.ctx.currentTime;
    this.dry.gain.setTargetAtTime(lerp(1, 0.42, this.inside), t, 0.1);
    this.wet.gain.setTargetAtTime(lerp(0.05, 0.72, this.inside), t, 0.1);
    this.outdoor.gain.setTargetAtTime(lerp(0.5, 0.06, this.inside), t, 0.15);

    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = this.rng.range(3.4, 8.2);
      if (this.inside < 0.55) this.bird();
    }
  }

  private env(node: AudioNode, gain: number, attack: number, decay: number): GainNode {
    const ctx = this.ctx as Ctx;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    return g;
  }

  /** One short filtered noise transient — clicks, ticks, scuffs. */
  private burst(
    freq: number,
    q: number,
    gain: number,
    decay: number,
    type: BiquadFilterType = 'bandpass',
    dest?: AudioNode,
  ): void {
    if (!this.ready || !this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    const g = this.env(f, gain, 0.004, decay);
    g.connect(dest ?? this.bus);
    src.start();
    src.stop(ctx.currentTime + decay + 0.06);
  }

  private tone(
    freq: number,
    gain: number,
    dur: number,
    type: OscillatorType = 'sine',
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ready || !this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t0 = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private bird(): void {
    const base = this.rng.range(1750, 2500);
    this.tone(base, 0.028, 0.1, 'sine', base * 1.25);
    this.tone(base * 1.1, 0.022, 0.09, 'sine', base * 0.92, 0.14);
  }

  // ---- one shots -------------------------------------------------------

  dropRelease(): void {
    this.burst(1400, 1.2, 0.14, 0.09);
    this.tone(680, 0.05, 0.12, 'sine', 420);
  }

  /** The tiny "kah, kah" of a droplet catching on a lifted seam. */
  snag(): void {
    this.burst(2600, 9, 0.2, 0.045);
    window.setTimeout(() => this.burst(2400, 9, 0.16, 0.05), 135);
  }

  discovery(): void {
    this.tone(587.33, 0.06, 0.42, 'sine');
    this.tone(880, 0.05, 0.5, 'sine', undefined, 0.13);
    this.tone(1174.66, 0.035, 0.6, 'sine', undefined, 0.27);
  }

  peelPop(): void {
    this.burst(900, 3, 0.22, 0.14, 'bandpass');
    this.tone(210, 0.05, 0.18, 'triangle', 120);
  }

  stepDone(): void {
    this.tone(659.25, 0.05, 0.28, 'sine');
    this.tone(987.77, 0.04, 0.34, 'sine', undefined, 0.1);
  }

  roundDone(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, 0.055, 0.5, 'sine', undefined, i * 0.14));
  }

  tap(): void {
    this.burst(1700, 4, 0.14, 0.05);
  }

  nope(): void {
    this.tone(196, 0.05, 0.16, 'triangle', 150);
  }

  splash(): void {
    this.burst(1200, 0.8, 0.2, 0.34, 'bandpass');
    this.burst(2600, 1.4, 0.12, 0.2, 'bandpass');
  }

  latch(): void {
    this.burst(520, 5, 0.13, 0.09);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ready) this.master.gain.value = m ? 0 : 0.85;
  }

  loop(name: string): NoiseVoice | null {
    return this.loops[name] ?? null;
  }

  silenceTools(): void {
    for (const k of ['peel', 'brush', 'extrude', 'polish']) this.loops[k]?.silence();
  }

  silenceAll(): void {
    for (const k of Object.keys(this.loops)) {
      if (k !== 'breeze') this.loops[k]?.silence();
    }
  }
}
