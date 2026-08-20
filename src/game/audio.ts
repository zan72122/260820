/**
 * Everything you hear is synthesised: dry leaf rustle, the clack of the clamp,
 * the creak of a loaded lever, the low crack of a clod letting go, the tacky
 * sound of a root pulling out of wet ground, and the tick of falling grains.
 * Birds and wind sit far back. There are no electronic tones and no fanfare
 * when a plant comes up — the plant is the reward.
 */
export class SoundField {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private creak: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private birdTimer = 0;
  private started = false;
  muted = false;

  /** Must be called from a user gesture; iOS will not start audio otherwise. */
  unlock(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.started = true;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    // Two seconds of white noise, reused as the source for every earth sound.
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    this.startAmbience();
    void this.ctx.resume();
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    return src;
  }

  private startAmbience(): void {
    if (!this.ctx || !this.master) return;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.055;
    this.ambientGain.connect(this.master);

    // Warm, slow air. Low-passed noise with a wandering cutoff.
    const src = this.noiseSource();
    if (!src) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.4;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    src.connect(lp).connect(this.ambientGain);
    src.start();
  }

  /** A distant bird, sparsely. */
  private bird(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.028, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.28);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = 2100 + Math.random() * 1400;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), t + 0.16);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  update(dt: number): void {
    if (!this.ctx) return;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 5 + Math.random() * 11;
      if (Math.random() < 0.7) this.bird();
    }
  }

  private burst(
    opts: {
      duration: number;
      attack: number;
      gain: number;
      type: BiquadFilterType;
      from: number;
      to: number;
      q: number;
    },
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const src = this.noiseSource();
    if (!src) return;
    const t = this.now();
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.Q.value = opts.q;
    filter.frequency.setValueAtTime(opts.from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t + opts.duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + opts.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + opts.duration + 0.05);
  }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'triangle', bend = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Steel jaws closing on the stem: a bright clack over a dull thunk. */
  clampBite(): void {
    this.burst({ duration: 0.13, attack: 0.002, gain: 0.30, type: 'bandpass', from: 3200, to: 1500, q: 2.2 });
    this.tone(1180, 0.10, 0.16, 'triangle', 0.86);
    this.tone(1760, 0.07, 0.09, 'triangle', 0.9);
    this.tone(196, 0.16, 0.12, 'sine', 0.7);
  }

  /** A lighter tap while the clamp is still being carried. */
  clampKnock(): void {
    this.burst({ duration: 0.07, attack: 0.002, gain: 0.11, type: 'bandpass', from: 2400, to: 1400, q: 3 });
  }

  /** Sustained creak while the lever is under load. `load` is 0..1. */
  setCreak(load: number): void {
    if (!this.ctx || !this.master) return;
    if (load <= 0.01) {
      if (this.creak) {
        this.creak.gain.gain.setTargetAtTime(0, this.now(), 0.12);
      }
      return;
    }
    if (!this.creak) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 96;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 340;
      filter.Q.value = 7;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      this.creak = { osc, gain, filter };
    }
    const t = this.now();
    this.creak.gain.gain.setTargetAtTime(this.muted ? 0 : 0.035 * load, t, 0.06);
    this.creak.osc.frequency.setTargetAtTime(88 + load * 46, t, 0.1);
    this.creak.filter.frequency.setTargetAtTime(300 + load * 260, t, 0.1);
  }

  /** A clod breaking: low body, short mid crackle. */
  soilCrack(strength = 1): void {
    this.burst({ duration: 0.34, attack: 0.006, gain: 0.30 * strength, type: 'lowpass', from: 260, to: 70, q: 0.9 });
    this.burst({ duration: 0.14, attack: 0.003, gain: 0.13 * strength, type: 'bandpass', from: 900, to: 380, q: 1.4 });
  }

  /** Roots peeling out of damp ground: slow, tacky, no snap. */
  rootPull(strength = 1): void {
    this.burst({ duration: 0.62, attack: 0.14, gain: 0.24 * strength, type: 'bandpass', from: 620, to: 170, q: 4.5 });
    this.burst({ duration: 0.45, attack: 0.10, gain: 0.14 * strength, type: 'lowpass', from: 300, to: 95, q: 0.8 });
  }

  /** Fine grains hitting the ground. */
  grainFall(strength = 1): void {
    this.burst({ duration: 0.26, attack: 0.004, gain: 0.10 * strength, type: 'highpass', from: 2600, to: 4200, q: 0.7 });
  }

  /** Dry leaves and stalks moving. */
  dryLeaves(strength = 1): void {
    this.burst({ duration: 0.30, attack: 0.02, gain: 0.09 * strength, type: 'bandpass', from: 2800, to: 1700, q: 1.1 });
  }

  /** Tool set down on the soil. */
  toolSeat(): void {
    this.burst({ duration: 0.22, attack: 0.004, gain: 0.16, type: 'lowpass', from: 420, to: 120, q: 0.8 });
    this.burst({ duration: 0.09, attack: 0.002, gain: 0.07, type: 'bandpass', from: 1900, to: 1100, q: 2 });
  }

  /** Cluster dropped into the basket: cane weave and a soft thud. */
  basketDrop(): void {
    this.burst({ duration: 0.30, attack: 0.004, gain: 0.20, type: 'bandpass', from: 1500, to: 520, q: 1.2 });
    this.burst({ duration: 0.24, attack: 0.006, gain: 0.15, type: 'lowpass', from: 220, to: 80, q: 0.8 });
  }

  dispose(): void {
    this.creak?.osc.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}
