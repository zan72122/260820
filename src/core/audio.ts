import { settings } from './settings';
import { clamp01 } from './util';

/**
 * Every sound is synthesised. The brief asks for work noises, not fanfare:
 * filtered noise for soil and leaves, a short low body for anything heavy.
 */
class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private started = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    const ctx: AudioContext = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = settings.state.volume;
    this.master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // a touch of brown for weight
      d[i] = white * 0.72 + last * 3.2 * 0.28;
    }
    this.noise = buf;

    settings.onChange((s) => {
      if (this.master) this.master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.05);
    });
    return ctx;
  }

  /** Must be called from a user gesture on iOS. */
  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.started) {
      this.started = true;
      this.startWind();
    }
  }

  private noiseSource(ctx: AudioContext) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    return src;
  }

  private startWind() {
    const ctx = this.ctx!;
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(this.master!);
    src.start();


    // Slow gusts so the field never sounds frozen.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.035;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.031;
    const lg2 = ctx.createGain();
    lg2.gain.value = 260;
    lfo2.connect(lg2).connect(bp.frequency);
    lfo2.start();
  }

  private burst(opts: {
    dur: number;
    gain: number;
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
    attack?: number;
    rate?: number;
  }) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const src = this.noiseSource(ctx);
    if (opts.rate) src.playbackRate.value = opts.rate;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  private body(freq: number, freqEnd: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* ---------------- work sounds ---------------- */

  leafRustle(intensity = 1) {
    const i = clamp01(intensity);
    this.burst({ dur: 0.16 + i * 0.12, gain: 0.05 + i * 0.09, type: 'bandpass', freq: 2600 + Math.random() * 1400, q: 0.8 });
  }

  vineTense() {
    this.burst({ dur: 0.2, gain: 0.07, type: 'bandpass', freq: 900, freqEnd: 1500, q: 4 });
  }

  forkIn() {
    this.burst({ dur: 0.28, gain: 0.28, type: 'lowpass', freq: 900, freqEnd: 180, q: 0.7 });
    this.body(96, 44, 0.24, 0.16);
  }

  clodCrack(strength = 1) {
    const s = clamp01(strength);
    this.burst({ dur: 0.1 + s * 0.1, gain: 0.13 + s * 0.14, type: 'bandpass', freq: 700 + Math.random() * 500, q: 1.6 });
    this.body(140, 62, 0.15, 0.07 * (0.5 + s));
  }

  soilFall(amount = 1) {
    this.burst({ dur: 0.22 + amount * 0.2, gain: 0.05 + amount * 0.05, type: 'highpass', freq: 1800, q: 0.4, attack: 0.03 });
  }

  grains() {
    this.burst({ dur: 0.14, gain: 0.07, type: 'bandpass', freq: 3800 + Math.random() * 1800, q: 1.2 });
  }

  tuberPop() {
    this.body(150, 46, 0.34, 0.3);
    this.burst({ dur: 0.3, gain: 0.16, type: 'lowpass', freq: 1100, freqEnd: 240, q: 0.8 });
  }

  crateSet() {
    this.body(210, 120, 0.16, 0.12, 'triangle');
    this.burst({ dur: 0.14, gain: 0.08, type: 'bandpass', freq: 460, q: 2.5 });
  }

  digScrape() {
    this.burst({ dur: 0.12, gain: 0.055, type: 'bandpass', freq: 1500 + Math.random() * 900, q: 1.0 });
  }

  /** Short, dull taps only — never a reward jingle. */
  haptic(kind: 'crack' | 'pop') {
    if (!settings.state.haptics) return;
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav.vibrate !== 'function') return;
    try {
      nav.vibrate(kind === 'crack' ? 14 : [10, 30, 18]);
    } catch {
      /* blocked by the platform */
    }
  }
}

export const audio = new AudioBus();
