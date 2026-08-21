import { clamp } from '../core/math';
import { Rng } from '../core/rng';

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, seconds: number, brown: boolean, rng: Rng): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.next() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

/**
 * Everything is synthesised: chain, belt, wind, nozzle hiss, water and birds.
 *
 * There is no permanent sparkle layer for the colour. A finished thread gets one
 * short, water-and-glass shaped event and then the park is quiet again.
 */
export class Audio {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private nozzleGain!: GainNode;
  private ambienceGain!: GainNode;
  private whoosh!: GainNode;
  private rng = new Rng(9931);
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private nextBird = 5;
  private nextDrip = 1.4;
  private voices = 0;
  private enabled = true;
  private started = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from inside a user gesture on iOS. */
  async start(): Promise<void> {
    if (this.started) {
      await this.ctx?.resume();
      return;
    }
    this.started = true;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.white = noiseBuffer(ctx, 2, false, this.rng);
    this.brown = noiseBuffer(ctx, 3, true, this.rng);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.006;
    comp.release.value = 0.24;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(comp);
    this.master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 2.2);

    // Evening park bed.
    const amb = ctx.createBufferSource();
    amb.buffer = this.brown;
    amb.loop = true;
    const ambF = ctx.createBiquadFilter();
    ambF.type = 'lowpass';
    ambF.frequency.value = 420;
    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.value = 0.10;
    amb.connect(ambF).connect(this.ambienceGain).connect(this.master);
    amb.start();

    // Wind past the ears, tied to how fast the seat is moving.
    const wind = ctx.createBufferSource();
    wind.buffer = this.white;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 520;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    // Thin, constant nozzle atomisation from the arch.
    const noz = ctx.createBufferSource();
    noz.buffer = this.white;
    noz.loop = true;
    const nozF = ctx.createBiquadFilter();
    nozF.type = 'highpass';
    nozF.frequency.value = 4200;
    const nozP = ctx.createBiquadFilter();
    nozP.type = 'peaking';
    nozP.frequency.value = 6800;
    nozP.gain.value = 5;
    nozP.Q.value = 1.4;
    this.nozzleGain = ctx.createGain();
    this.nozzleGain.gain.value = 0.018;
    const nozPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (nozPan) {
      nozPan.pan.value = 0.45;
      noz.connect(nozF).connect(nozP).connect(this.nozzleGain).connect(nozPan).connect(this.master);
    } else {
      noz.connect(nozF).connect(nozP).connect(this.nozzleGain).connect(this.master);
    }
    noz.start();

    this.whoosh = ctx.createGain();
    this.whoosh.gain.value = 1;
    this.whoosh.connect(this.master);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.2);
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private canPlay(): boolean {
    return this.ctx !== null && this.enabled && this.voices < 22;
  }

  private voice(node: AudioNode, seconds: number): void {
    this.voices++;
    window.setTimeout(() => {
      this.voices--;
      try {
        node.disconnect();
      } catch {
        /* already gone */
      }
    }, seconds * 1000 + 60);
  }

  /** Steel links shifting as the chain goes slack at the top of the arc. */
  chainClink(intensity: number): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = clamp(intensity, 0, 1) * 0.07;
    out.connect(this.master);

    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.playbackRate.value = 1 + this.rng.spread(0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100 + this.rng.spread(500);
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.16);

    for (const f of [1840, 2760, 4310]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * (1 + this.rng.spread(0.02));
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.28, t);
      og.gain.exponentialRampToValueAtTime(0.0008, t + 0.09 + this.rng.next() * 0.06);
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + 0.2);
    }
    this.voice(out, 0.25);
  }

  /** Rubber belt and the fittings taking the load at the extremes. */
  seatCreak(intensity: number): void {
    if (!this.canPlay() || intensity < 0.12) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = clamp(intensity, 0, 1) * 0.05;
    out.connect(this.master);
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 14;
    const f0 = 250 + this.rng.spread(60);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f0 * 0.72, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.3);
    this.voice(out, 0.35);
  }

  /** Air past the seat at the bottom of the arc. */
  setMotion(speed: number, mistDensity: number): void {
    if (!this.ctx) return;
    const s = clamp(speed / 4.2, 0, 1);
    this.windGain.gain.setTargetAtTime(0.006 + s * s * 0.075, this.ctx.currentTime, 0.08);
    this.windFilter.frequency.setTargetAtTime(380 + s * 900, this.ctx.currentTime, 0.1);
    this.nozzleGain.gain.setTargetAtTime(0.012 + mistDensity * 0.020, this.ctx.currentTime, 0.3);
  }

  /**
   * One short event as a thread finishes: struck water, not a chime pad.
   * Bigger arcs ring lower and longer, so the sound tracks what was drawn.
   */
  trailFormed(size: number, seedIndex: number): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.11;
    out.connect(this.master);

    const scale = [0, 2, 4, 7, 9, 12, 14];
    const step = scale[(seedIndex * 3 + Math.floor(size * 5)) % scale.length];
    const base = 392 * Math.pow(2, (step - Math.floor(size * 9)) / 12);

    // A wet, hollow partial stack: two near-harmonic modes plus a soft inharmonic.
    const partials: [number, number, number][] = [
      [1.0, 0.55, 1.35],
      [2.02, 0.24, 0.95],
      [3.41, 0.11, 0.62],
    ];
    for (const [mult, amp, dur] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mult * (1 + this.rng.spread(0.004));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0004, t + dur * (0.7 + size * 0.6));
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur * 1.6 + 0.2);
    }

    // The plip of displaced water, giving the event a physical onset.
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(1500, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.09);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);
    src.connect(bp).connect(g2).connect(out);
    src.start(t);
    src.stop(t + 0.14);

    this.voice(out, 2.4);
  }

  private drip(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.035;
    out.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 900 + this.rng.next() * 900;
    o.frequency.setValueAtTime(f * 0.55, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.13);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.16);
    this.voice(out, 0.2);
  }

  private bird(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.045;
    out.connect(this.master);
    const notes = 2 + Math.floor(this.rng.next() * 2);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.11 + this.rng.next() * 0.09);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = 2400 + this.rng.next() * 1500;
      o.frequency.setValueAtTime(f * 0.8, t);
      o.frequency.exponentialRampToValueAtTime(f * (1 + this.rng.spread(0.25)), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.7, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.14);
    }
    this.voice(out, 1.2);
  }

  update(dt: number): void {
    if (!this.ctx || !this.enabled) return;
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.bird();
      this.nextBird = 6 + this.rng.next() * 13;
    }
    this.nextDrip -= dt;
    if (this.nextDrip <= 0) {
      this.drip();
      this.nextDrip = 0.5 + this.rng.next() * 2.2;
    }
  }
}
