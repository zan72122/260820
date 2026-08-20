import { clamp, lerp } from './math';

/**
 * All of the sound in this game is synthesised at run time — there are no
 * recordings to licence and nothing to download. Each cue is an isolated
 * function so a recorded sample can be dropped in later without touching the
 * callers.
 */

export type MaterialVoice = 'steel' | 'wood' | 'felt' | 'rubber' | 'tyre' | 'ice' | 'leaf' | 'sponge';

export interface SurfaceMix {
  dry: number;
  wet: number;
  sand: number;
  rubber: number;
}

const NOISE_SECONDS = 2.5;

function makeNoiseBuffer(ctx: AudioContext, brown = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

interface VoiceParts {
  src: AudioBufferSourceNode;
  bp1: BiquadFilterNode;
  bp2: BiquadFilterNode;
  g1: GainNode;
  g2: GainNode;
  amGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  tone: OscillatorNode;
  toneGain: GainNode;
  out: GainNode;
}

/** A continuous contact sound whose pitch and level follow the object. */
class SlidingVoice {
  private p: VoiceParts;
  private started = false;

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
    noise: AudioBuffer,
    private kind: MaterialVoice,
  ) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const amGain = ctx.createGain();
    amGain.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain).connect(amGain.gain);

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0;
    g2.gain.value = 0;

    const tone = ctx.createOscillator();
    tone.type = 'sine';
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0;

    const out = ctx.createGain();
    out.gain.value = 1;

    src.connect(amGain);
    amGain.connect(bp1).connect(g1).connect(out);
    amGain.connect(bp2).connect(g2).connect(out);
    tone.connect(toneGain).connect(out);
    out.connect(dest);

    this.p = { src, bp1, bp2, g1, g2, amGain, lfo, lfoGain, tone, toneGain, out };
    this.applyKind();
  }

  private applyKind(): void {
    const { bp1, bp2, tone } = this.p;
    switch (this.kind) {
      case 'steel':
        bp1.frequency.value = 2600;
        bp1.Q.value = 5;
        bp2.frequency.value = 5400;
        bp2.Q.value = 13;
        tone.frequency.value = 3200;
        break;
      case 'wood':
        bp1.frequency.value = 520;
        bp1.Q.value = 7;
        bp2.frequency.value = 1180;
        bp2.Q.value = 11;
        tone.frequency.value = 300;
        break;
      case 'felt':
        bp1.frequency.value = 620;
        bp1.Q.value = 1.1;
        bp2.frequency.value = 1500;
        bp2.Q.value = 1.4;
        tone.frequency.value = 200;
        break;
      case 'rubber':
        bp1.frequency.value = 900;
        bp1.Q.value = 2.4;
        bp2.frequency.value = 2100;
        bp2.Q.value = 3;
        tone.frequency.value = 420;
        break;
      case 'tyre':
        bp1.frequency.value = 1300;
        bp1.Q.value = 2;
        bp2.frequency.value = 3000;
        bp2.Q.value = 4;
        tone.frequency.value = 540;
        break;
      case 'ice':
        bp1.frequency.value = 3800;
        bp1.Q.value = 3.4;
        bp2.frequency.value = 7200;
        bp2.Q.value = 8;
        tone.frequency.value = 1500;
        break;
      case 'leaf':
        bp1.frequency.value = 3000;
        bp1.Q.value = 1.6;
        bp2.frequency.value = 6200;
        bp2.Q.value = 2.4;
        tone.frequency.value = 900;
        break;
      case 'sponge':
        bp1.frequency.value = 420;
        bp1.Q.value = 1;
        bp2.frequency.value = 1000;
        bp2.Q.value = 1.6;
        tone.frequency.value = 180;
        break;
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.src.start();
    this.p.lfo.start();
    this.p.tone.start();
  }

  /** speed in m/s, cov = live surface coverage under the object. */
  set(speed: number, cov: SurfaceMix, now: number): void {
    const v = clamp(speed, 0, 6);
    const drive = clamp(v / 3.2, 0, 1.35);
    const p = this.p;
    const t = now + 0.02;

    let g1 = 0;
    let g2 = 0;
    let am = 0;
    let amRate = 10;
    let toneG = 0;
    let toneF = 400;

    switch (this.kind) {
      case 'steel':
        g1 = drive * 0.16;
        g2 = drive * 0.1;
        am = 0.55;
        amRate = 14 + v * 26;
        toneG = drive * 0.012;
        toneF = 2600 + v * 260;
        break;
      case 'wood':
        g1 = drive * 0.2;
        g2 = drive * 0.13;
        am = 0.95;
        amRate = 8 + v * 13;
        toneG = drive * 0.02;
        toneF = 260 + v * 40;
        break;
      case 'felt':
        g1 = Math.pow(drive, 1.4) * 0.13;
        g2 = Math.pow(drive, 1.4) * 0.05;
        am = 0.2;
        amRate = 6 + v * 7;
        break;
      case 'rubber':
        g1 = drive * 0.14;
        g2 = drive * 0.06;
        am = 0.3;
        amRate = 9 + v * 18;
        // The squeak only appears on dry grip, and dies away when wet.
        toneG = clamp(drive - 0.35, 0, 1) * cov.dry * 0.05;
        toneF = 380 + v * 190;
        break;
      case 'tyre':
        g1 = drive * 0.12;
        g2 = drive * 0.09;
        am = 0.25;
        amRate = 20 + v * 30;
        toneG = clamp(drive - 0.5, 0, 1) * cov.dry * 0.045;
        toneF = 520 + v * 240;
        break;
      case 'ice':
        g1 = drive * 0.17;
        g2 = drive * 0.13;
        am = 0.1;
        amRate = 30;
        toneG = drive * 0.022;
        toneF = 1200 + v * 420;
        break;
      case 'leaf':
        g1 = Math.pow(drive, 1.2) * 0.1;
        g2 = Math.pow(drive, 1.2) * 0.07;
        am = 0.9;
        amRate = 16 + v * 34;
        break;
      case 'sponge':
        g1 = Math.pow(drive, 1.3) * 0.14;
        g2 = Math.pow(drive, 1.3) * 0.04;
        am = 0.35;
        amRate = 5 + v * 9;
        break;
    }

    // Wet steel hisses, loose sand rasps: the bed has a voice of its own.
    const wetLift = cov.wet * drive * 0.09;
    const sandLift = cov.sand * drive * 0.16;
    p.bp1.frequency.setTargetAtTime(
      lerp(p.bp1.frequency.value, baseFreq(this.kind) * (1 + v * 0.075) + cov.wet * 900, 0.5),
      t,
      0.05,
    );
    p.g1.gain.setTargetAtTime(g1 + wetLift, t, 0.05);
    p.g2.gain.setTargetAtTime(g2 + sandLift, t, 0.05);
    p.lfoGain.gain.setTargetAtTime(am * (1 + cov.sand * 0.8), t, 0.06);
    p.lfo.frequency.setTargetAtTime(clamp(amRate * (1 + cov.sand * 0.6), 2, 220), t, 0.06);
    p.toneGain.gain.setTargetAtTime(toneG, t, 0.06);
    p.tone.frequency.setTargetAtTime(toneF, t, 0.06);
  }

  silence(now: number): void {
    const t = now + 0.01;
    this.p.g1.gain.setTargetAtTime(0, t, 0.04);
    this.p.g2.gain.setTargetAtTime(0, t, 0.04);
    this.p.toneGain.gain.setTargetAtTime(0, t, 0.04);
  }

  stop(): void {
    const now = this.ctx.currentTime;
    this.silence(now);
    const p = this.p;
    setTimeout(() => {
      try {
        p.src.stop();
        p.lfo.stop();
        p.tone.stop();
      } catch {
        /* already stopped */
      }
      p.out.disconnect();
    }, 260);
  }
}

function baseFreq(kind: MaterialVoice): number {
  switch (kind) {
    case 'steel':
      return 2600;
    case 'wood':
      return 520;
    case 'felt':
      return 620;
    case 'rubber':
      return 900;
    case 'tyre':
      return 1300;
    case 'ice':
      return 3800;
    case 'leaf':
      return 3000;
    default:
      return 420;
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private voice: SlidingVoice | null = null;
  private voiceKind: MaterialVoice | null = null;
  private birdTimer = 0;
  private started = false;
  enabled = true;

  /** Must be called from inside a user gesture. */
  unlock(): void {
    if (this.started) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.noise = makeNoiseBuffer(ctx);
    this.brown = makeNoiseBuffer(ctx, true);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this.master = master;

    // Quiet morning air: a slow breeze under everything.
    const amb = ctx.createGain();
    amb.gain.value = 0.055;
    amb.connect(master);
    const wind = ctx.createBufferSource();
    wind.buffer = this.brown;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.35;
    lfo.connect(lfoG).connect(swell.gain);
    wind.connect(lp).connect(swell).connect(amb);
    wind.start();
    lfo.start();
    void ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get time(): number {
    return this.ctx?.currentTime ?? 0;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  setMuted(muted: boolean): void {
    this.enabled = !muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  /** Start (or switch) the continuous contact voice. */
  useVoice(kind: MaterialVoice | null): void {
    if (!this.ctx || !this.master || !this.noise) return;
    if (this.voiceKind === kind) return;
    this.voice?.stop();
    this.voice = null;
    this.voiceKind = kind;
    if (!kind) return;
    this.voice = new SlidingVoice(this.ctx, this.master, this.noise, kind);
    this.voice.start();
  }

  driveVoice(speed: number, cov: SurfaceMix): void {
    if (!this.ctx || !this.voice) return;
    this.voice.set(speed, cov, this.ctx.currentTime);
  }

  silenceVoice(): void {
    if (!this.ctx || !this.voice) return;
    this.voice.silence(this.ctx.currentTime);
  }

  private burst(
    opts: {
      freq: number;
      freqEnd?: number;
      type?: OscillatorType;
      gain: number;
      decay: number;
      noiseGain?: number;
      noiseFreq?: number;
      noiseQ?: number;
    },
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.enabled) return;
    const t = ctx.currentTime;
    if (opts.gain > 0) {
      const o = ctx.createOscillator();
      o.type = opts.type ?? 'sine';
      o.frequency.setValueAtTime(opts.freq, t);
      if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + opts.decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + opts.decay + 0.05);
    }
    if (opts.noiseGain && this.noise) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = opts.noiseFreq ?? 2000;
      f.Q.value = opts.noiseQ ?? 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(opts.noiseGain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay * 0.9);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random() * 1.5);
      s.stop(t + opts.decay + 0.05);
    }
  }

  impact(kind: MaterialVoice, strength: number, soft = false): void {
    const v = clamp(strength, 0, 1);
    if (v < 0.02) return;
    const damp = soft ? 0.45 : 1;
    switch (kind) {
      case 'steel':
        this.burst({ freq: 2350, freqEnd: 2100, gain: 0.16 * v * damp, decay: 0.42 * damp, noiseGain: 0.1 * v, noiseFreq: 5200, noiseQ: 3 });
        break;
      case 'wood':
        this.burst({ freq: 430, freqEnd: 380, gain: 0.2 * v * damp, decay: 0.14, noiseGain: 0.09 * v, noiseFreq: 1500, noiseQ: 2 });
        this.burst({ freq: 780, gain: 0.07 * v * damp, decay: 0.09 });
        break;
      case 'rubber':
        this.burst({ freq: 210, freqEnd: 96, gain: 0.24 * v * damp, decay: 0.2, noiseGain: 0.04 * v, noiseFreq: 700 });
        break;
      case 'tyre':
        this.burst({ freq: 150, freqEnd: 90, gain: 0.16 * v * damp, decay: 0.13, noiseGain: 0.07 * v, noiseFreq: 1100 });
        break;
      case 'felt':
        this.burst({ freq: 120, gain: 0.05 * v * damp, decay: 0.1, noiseGain: 0.11 * v, noiseFreq: 520, noiseQ: 0.9 });
        break;
      case 'ice':
        this.burst({ freq: 3400, freqEnd: 3100, gain: 0.12 * v * damp, decay: 0.11, noiseGain: 0.1 * v, noiseFreq: 6800, noiseQ: 4 });
        this.burst({ freq: 900, gain: 0.02 * v, decay: 0.22, noiseGain: 0.05 * v, noiseFreq: 1800, noiseQ: 1.5 });
        break;
      case 'leaf':
        this.burst({ freq: 0, gain: 0, decay: 0.16, noiseGain: 0.09 * v, noiseFreq: 4200, noiseQ: 1.1 });
        break;
      case 'sponge':
        this.burst({ freq: 96, freqEnd: 70, gain: 0.09 * v * damp, decay: 0.13, noiseGain: 0.09 * v, noiseFreq: 380, noiseQ: 0.8 });
        break;
    }
  }

  /** The gate settling against its catch. */
  gateClick(strength = 1): void {
    this.burst({ freq: 1750, freqEnd: 1400, gain: 0.05 * strength, decay: 0.06, noiseGain: 0.07 * strength, noiseFreq: 3400, noiseQ: 4 });
  }

  gateOpen(): void {
    this.burst({ freq: 620, freqEnd: 900, gain: 0.05, decay: 0.16, noiseGain: 0.07, noiseFreq: 1800, noiseQ: 2 });
  }

  leverCreak(): void {
    this.burst({ freq: 300, freqEnd: 420, gain: 0.02, decay: 0.2, noiseGain: 0.03, noiseFreq: 900, noiseQ: 6 });
  }

  /** A short spoken-ish "すーっ": the third-stage hint. */
  whoosh(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise || !this.enabled) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.6;
    f.frequency.setValueAtTime(5200, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.07);
    g.gain.setValueAtTime(0.11, t + 0.26);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random());
    s.stop(t + 0.65);
  }

  /** Something new has appeared in the world. Two soft partials, no fanfare. */
  reveal(): void {
    this.burst({ freq: 784, gain: 0.05, decay: 0.5 });
    setTimeout(() => this.burst({ freq: 1175, gain: 0.035, decay: 0.6 }), 110);
  }

  waterDrop(): void {
    this.burst({ freq: 900, freqEnd: 1700, gain: 0.06, decay: 0.13, noiseGain: 0.02, noiseFreq: 2600 });
  }

  sandPour(): void {
    this.burst({ freq: 0, gain: 0, decay: 0.4, noiseGain: 0.09, noiseFreq: 4200, noiseQ: 0.7 });
  }

  wipe(): void {
    this.burst({ freq: 0, gain: 0, decay: 0.26, noiseGain: 0.07, noiseFreq: 1800, noiseQ: 0.9 });
  }

  /** Occasional birdsong so the park is not silent between experiments. */
  ambient(dt: number): void {
    if (!this.ctx || !this.enabled) return;
    this.birdTimer -= dt;
    if (this.birdTimer > 0) return;
    this.birdTimer = 7 + Math.random() * 16;
    const base = 2400 + Math.random() * 900;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      setTimeout(
        () =>
          this.burst({
            freq: base * (1 + i * 0.06),
            freqEnd: base * (1.25 + i * 0.05),
            gain: 0.018,
            decay: 0.13,
          }),
        i * (90 + Math.random() * 60),
      );
    }
  }
}
