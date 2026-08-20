import { clamp, clamp01 } from '../util/math';
import type { VoiceId } from '../physics/params';

/**
 * Impact audio.
 *
 * The sound is part of the result, not decoration: the same ball on two floors
 * must sound like two different materials, and the same floor struck by two
 * balls must differ in overtone and tail. Everything is synthesised at runtime
 * — no audio files to download, and every parameter can be driven from the
 * impact itself (speed, mass, ball hardness).
 */

export interface ImpactSound {
  voice: VoiceId;
  /** 0..1 impact strength. */
  energy: number;
  /** Ball mass in kg. */
  mass: number;
  /** 0 = dull/soft ball, 1 = hard bright ball. */
  brightness: number;
  /** 0 = dead, 1 = long metallic tail. */
  ring: number;
  /** -1 (left) .. 1 (right) in screen space. */
  pan?: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private noise!: AudioBuffer;
  private rollSource: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private motorGain: GainNode | null = null;
  private motorOsc: OscillatorNode | null = null;
  private enabled = false;
  private suspended = false;

  get ready() {
    return this.enabled;
  }

  /** Must be called from inside a user gesture (iOS unlocks audio only then). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.dry.connect(this.master);

    // A short, dark impulse response: a small open-sided shed, not a hall.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(ctx, 0.9, 3.4);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.16;
    this.wet.connect(convolver);
    convolver.connect(this.master);

    this.noise = this.makeNoise(ctx, 2);
    this.enabled = true;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  setSuspended(v: boolean) {
    this.suspended = v;
    if (!this.ctx) return;
    if (v) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private makeNoise(ctx: AudioContext, seconds: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1;
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 1073741823.5 - 1) * 0.9;
    }
    return buf;
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let s = c === 0 ? 7 : 13;
      let lp = 0;
      for (let i = 0; i < len; i++) {
        s = (s * 16807) % 2147483647;
        const n = s / 1073741823.5 - 1;
        // Low-passed noise tail reads as an outdoor space with a roof.
        lp += (n - lp) * 0.22;
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private now() {
    return this.ctx!.currentTime;
  }

  private bus(pan: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      out.connect(p);
      p.connect(this.dry);
      p.connect(this.wet);
    } else {
      out.connect(this.dry);
      out.connect(this.wet);
    }
    return out;
  }

  /** One damped sine partial — the building block of the pitched voices. */
  private partial(dest: AudioNode, freq: number, gain: number, decay: number, t0: number, type: OscillatorType = 'sine') {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + decay + 0.02);
    return osc;
  }

  /** A shaped burst of filtered noise — the building block of the dull voices. */
  private burst(
    dest: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
    gain: number,
    attack: number,
    decay: number,
    t0: number,
    sweepTo?: number
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    const offset = Math.random() * 1.2;
    src.start(t0, offset, attack + decay + 0.05);
    src.stop(t0 + attack + decay + 0.06);
  }

  impact(s: ImpactSound) {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const e = clamp01(s.energy);
    if (e < 0.012) return;
    const out = this.bus(s.pan ?? 0);

    // Heavier balls are louder and lower; light foam is nearly silent.
    const massGain = clamp(Math.pow(s.mass / 0.12, 0.32), 0.32, 2.0);
    const pitch = clamp(Math.pow(0.12 / Math.max(s.mass, 0.005), 0.13), 0.72, 1.35);
    const level = clamp01(0.16 + e * 0.84) * massGain;
    const bright = clamp01(s.brightness);
    out.gain.value = clamp(level, 0, 1.6);

    switch (s.voice) {
      case 'rubber': {
        // "ボン" — a low, fast pitch drop with almost no tail.
        const osc = this.partial(out, 148 * pitch, 0.55, 0.2 + e * 0.1, t, 'triangle');
        osc.frequency.exponentialRampToValueAtTime(74 * pitch, t + 0.085);
        this.burst(out, 'lowpass', 520 + bright * 900, 0.7, 0.2 + e * 0.14, 0.002, 0.05, t);
        break;
      }
      case 'sand': {
        // "サフッ" — pure filtered noise, no pitch at all.
        this.burst(out, 'bandpass', 2400 + bright * 1800, 0.7, 0.34 + e * 0.2, 0.004, 0.1 + e * 0.05, t, 1100);
        this.burst(out, 'bandpass', 780, 1.0, 0.16 + e * 0.12, 0.004, 0.07, t);
        this.burst(out, 'lowpass', 220, 0.6, 0.12 * massGain, 0.003, 0.05, t);
        break;
      }
      case 'clay': {
        // "ベチャ" — a wet slap: a damp low thud plus a mid smack, no ring.
        const osc = this.partial(out, 108 * pitch, 0.4, 0.075, t, 'sine');
        osc.frequency.exponentialRampToValueAtTime(62 * pitch, t + 0.06);
        this.burst(out, 'bandpass', 620 + bright * 500, 1.6, 0.36 + e * 0.2, 0.003, 0.075, t, 300);
        this.burst(out, 'highpass', 2600, 0.6, 0.09 * (0.4 + bright), 0.002, 0.03, t);
        break;
      }
      case 'wood': {
        // "コン" — a small set of harmonic-ish modes, medium decay.
        const f0 = 430 * pitch * (0.85 + bright * 0.3);
        this.partial(out, f0, 0.42, 0.15 + s.ring * 0.12, t);
        this.partial(out, f0 * 2.71, 0.2, 0.1 + s.ring * 0.08, t);
        this.partial(out, f0 * 4.83, 0.09, 0.055, t);
        this.burst(out, 'bandpass', 1800 + bright * 1200, 0.9, 0.16, 0.001, 0.028, t);
        break;
      }
      case 'metal': {
        // "カン" — inharmonic modes with a long tail; the ball's own ring adds.
        const f0 = 1160 * pitch * (0.8 + bright * 0.4);
        const tail = 0.5 + s.ring * 1.15;
        const ratios = [1, 1.73, 2.41, 3.36, 4.22, 5.71];
        const gains = [0.34, 0.24, 0.17, 0.12, 0.08, 0.05];
        for (let i = 0; i < ratios.length; i++) {
          this.partial(out, f0 * ratios[i], gains[i] * (0.5 + e * 0.5), tail * (1 - i * 0.11), t);
        }
        this.burst(out, 'highpass', 3400, 0.6, 0.2, 0.001, 0.035, t);
        break;
      }
      case 'felt': {
        // "フッ" — barely there. The absence of sound is the information.
        this.burst(out, 'lowpass', 300 + bright * 260, 0.6, 0.2 + e * 0.12, 0.006, 0.06, t, 140);
        out.gain.value *= 0.32;
        break;
      }
      case 'water': {
        // "ポチャン" — a rising bubble under a splash.
        const osc = this.partial(out, 210 * pitch, 0.32, 0.16, t, 'sine');
        osc.frequency.exponentialRampToValueAtTime(760 * pitch, t + 0.1);
        this.burst(out, 'bandpass', 2800, 0.8, 0.3 + e * 0.22, 0.003, 0.13, t, 1400);
        this.burst(out, 'lowpass', 160, 0.7, 0.16 * massGain, 0.004, 0.07, t);
        break;
      }
      case 'concrete':
      default: {
        this.partial(out, 250 * pitch, 0.22, 0.05, t);
        this.burst(out, 'bandpass', 1500 + bright * 1400, 0.8, 0.28, 0.001, 0.045, t, 700);
        break;
      }
    }

    // The ball's own body rings on top of whatever the floor did. This is what
    // makes a hollow metal ball recognisable even when it lands on felt.
    if (s.ring > 0.35 && s.voice !== 'metal') {
      const f0 = 900 + s.ring * 700;
      const g = 0.06 * s.ring * (0.3 + e * 0.7);
      this.partial(out, f0 * pitch, g, 0.35 + s.ring * 0.5, t + 0.004);
      this.partial(out, f0 * 2.13 * pitch, g * 0.5, 0.28 + s.ring * 0.4, t + 0.004);
    }
  }

  /** The clamp opening: a small, dry mechanical event. */
  release() {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const out = this.bus(0);
    out.gain.value = 0.5;
    this.burst(out, 'bandpass', 2600, 1.4, 0.3, 0.001, 0.02, t);
    this.burst(out, 'bandpass', 900, 2.0, 0.22, 0.001, 0.045, t + 0.012);
    this.partial(out, 1700, 0.06, 0.09, t + 0.01);
  }

  /** The "ぽとん" nudge used as the third hint. Deliberately tiny. */
  hintTap() {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const out = this.bus(0);
    out.gain.value = 0.34;
    const osc = this.partial(out, 620, 0.3, 0.1, t, 'sine');
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
  }

  /** Turntable indexing to the next sample. */
  motor(on: boolean) {
    if (!this.enabled) return;
    const ctx = this.ctx!;
    const t = this.now();
    if (on) {
      if (this.motorOsc) return;
      const out = this.bus(0);
      out.gain.value = 0.22;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 58;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.08);
      osc.connect(f);
      f.connect(g);
      g.connect(out);
      osc.start(t);
      this.motorOsc = osc;
      this.motorGain = g;
    } else if (this.motorOsc && this.motorGain) {
      this.motorGain.gain.cancelScheduledValues(t);
      this.motorGain.gain.setValueAtTime(this.motorGain.gain.value, t);
      this.motorGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      this.motorOsc.stop(t + 0.2);
      this.motorOsc = null;
      this.motorGain = null;
      // The detent as the next sample locks into place.
      const out = this.bus(0);
      out.gain.value = 0.4;
      this.burst(out, 'bandpass', 1400, 2.2, 0.25, 0.001, 0.05, t + 0.05);
    }
  }

  /** Continuous rolling noise, shaped by the surface under the ball. */
  roll(speed: number, voice: VoiceId, radius: number) {
    if (!this.enabled || this.suspended) return;
    const ctx = this.ctx!;
    const t = this.now();
    if (speed <= 0.02) {
      if (this.rollGain) {
        this.rollGain.gain.cancelScheduledValues(t);
        this.rollGain.gain.setTargetAtTime(0, t, 0.05);
      }
      return;
    }
    if (!this.rollSource) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(this.bus(0));
      src.start(t);
      this.rollSource = src;
      this.rollFilter = f;
      this.rollGain = g;
    }
    const rough: Record<string, number> = {
      rubber: 700,
      sand: 2600,
      clay: 900,
      wood: 1500,
      metal: 3400,
      felt: 380,
      water: 1800,
      concrete: 2000,
    };
    const loud: Record<string, number> = {
      rubber: 0.5,
      sand: 0.9,
      clay: 0.45,
      wood: 0.8,
      metal: 1.0,
      felt: 0.16,
      water: 0.7,
      concrete: 0.85,
    };
    const v = clamp01(speed / 2.2);
    this.rollFilter!.frequency.setTargetAtTime(rough[voice] ?? 1200, t, 0.05);
    this.rollGain!.gain.setTargetAtTime(v * 0.09 * (loud[voice] ?? 0.6) * clamp(radius / 0.07, 0.7, 1.3), t, 0.04);
    this.rollSource!.playbackRate.setTargetAtTime(0.7 + v * 0.7, t, 0.06);
  }

  /** A panel being set down on the ground. */
  place() {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const out = this.bus(0);
    out.gain.value = 0.45;
    this.partial(out, 160, 0.3, 0.09, t, 'sine');
    this.burst(out, 'lowpass', 900, 0.7, 0.24, 0.002, 0.06, t, 300);
  }

  /** The clean-up brush sweeping a surface flat again. */
  sweep(intensity: number) {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const out = this.bus(0);
    out.gain.value = clamp01(intensity) * 0.5;
    this.burst(out, 'bandpass', 3200, 0.6, 0.3, 0.02, 0.16, t, 1600);
  }

  /** Picking a ball off the shelf. */
  pick() {
    if (!this.enabled || this.suspended) return;
    const t = this.now();
    const out = this.bus(0);
    out.gain.value = 0.3;
    this.burst(out, 'bandpass', 1900, 1.2, 0.22, 0.002, 0.05, t, 900);
  }
}
