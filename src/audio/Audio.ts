/**
 * Every sound is synthesised here in the Web Audio graph. Nothing is sampled, nothing is
 * borrowed: the taiko, the kane, the fue, the short hayashi phrase and the children's call
 * are all original and generated at runtime, so there is no festival recording to license.
 *
 * Continuous sounds (brush, cart, lamp hum) are single voices whose gain is ramped, which is
 * also why scrubbing a finger back and forth can never stack duplicate loops.
 */

import { clamp } from '../util/math';

type Bus = 'sfx' | 'music';

const PENTATONIC = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33];
/** Two bars of sixteen eighths. -1 is a rest. Original phrase. */
const FUE_PHRASE = [3, -1, 4, -1, 5, -1, 4, 3, 2, -1, 1, -1, 0, -1, 1, 2];
const TAIKO_PATTERN = [1, 0, 0.45, 0.8, 0, 0.4, 0.9, 0, 1, 0, 0.4, 0.85, 0, 0.4, 0.75, 0.35];
const KANE_PATTERN = [1, 0, 0.5, 0, 0.6, 0, 0.5, 0, 0.9, 0, 0.5, 0, 0.6, 0, 0.5, 0.4];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private brush: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private cart: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private squeal: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private hum: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

  private musicOn = false;
  private nextNoteTime = 0;
  private step = 0;
  private bpm = 104;
  private schedulerId = 0;
  private energy = 0;
  /** 0..1 position inside the current bar, read by the hayashi animation. */
  beat = 0;
  drumHit = 0;
  private lastStepTime = 0;
  private muted = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master.connect(comp).connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.85;
    sfx.connect(this.master);
    const music = ctx.createGain();
    music.gain.value = 0;
    music.connect(this.master);
    this.buses = { sfx, music };

    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // a touch of brown noise gives the cart and the paper some body
      last = (last + 0.02 * white) / 1.02;
      d[i] = white * 0.7 + last * 3.2;
    }
    this.noiseBuffer = buf;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /* ------------------------------------------------------------------ voices */

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  private env(node: AudioParam, t: number, peak: number, attack: number, decay: number): void {
    node.cancelScheduledValues(t);
    node.setValueAtTime(0.0001, t);
    node.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Wide, wooden, with the skin slap on top. */
  taiko(velocity = 1, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const t = when || ctx.currentTime;
    const v = clamp(velocity, 0, 1.4);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(128, t);
    body.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    const bodyGain = ctx.createGain();
    this.env(bodyGain.gain, t, 0.7 * v, 0.004, 0.42);
    body.connect(bodyGain).connect(this.buses.music);
    body.start(t);
    body.stop(t + 0.6);

    const ring = ctx.createOscillator();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(196, t);
    ring.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    const ringGain = ctx.createGain();
    this.env(ringGain.gain, t, 0.16 * v, 0.003, 0.2);
    ring.connect(ringGain).connect(this.buses.music);
    ring.start(t);
    ring.stop(t + 0.4);

    const n = this.noiseSource();
    if (n) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      this.env(g.gain, t, 0.2 * v, 0.002, 0.09);
      n.connect(f).connect(g).connect(this.buses.music);
      n.start(t);
      n.stop(t + 0.16);
    }
    this.drumHit = Math.max(this.drumHit, v);
  }

  /** Small hand gong: inharmonic partials with a long shimmer. */
  kane(velocity = 1, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const t = when || ctx.currentTime;
    const v = clamp(velocity, 0, 1.2);
    const partials = [1046, 1687, 2531, 3822, 4780];
    const amps = [1, 0.55, 0.35, 0.22, 0.12];
    partials.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * (1 + (i % 2 ? 0.0018 : -0.0014)), t);
      const g = ctx.createGain();
      this.env(g.gain, t, 0.075 * v * amps[i], 0.002, 1.1 - i * 0.13);
      o.connect(g).connect(this.buses!.music);
      o.start(t);
      o.stop(t + 1.4);
    });
  }

  /** Breathy bamboo flute with a slow vibrato. */
  fue(noteIndex: number, dur = 0.34, when = 0, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || noteIndex < 0) return;
    const t = when || ctx.currentTime;
    const freq = PENTATONIC[clamp(noteIndex, 0, PENTATONIC.length - 1)] * 2;

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq * 0.995, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.05);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibGain = ctx.createGain();
    vibGain.gain.value = freq * 0.008;
    vib.connect(vibGain).connect(o.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.1);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * velocity, t + 0.05);
    g.gain.setValueAtTime(0.09 * velocity, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    o.connect(lp).connect(g).connect(this.buses.music);
    o.start(t);
    o.stop(t + dur + 0.12);

    const breath = this.noiseSource();
    if (breath) {
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = freq * 2.1;
      bf.Q.value = 1.4;
      const bg = ctx.createGain();
      this.env(bg.gain, t, 0.02 * velocity, 0.04, dur);
      breath.connect(bf).connect(bg).connect(this.buses.music);
      breath.start(t);
      breath.stop(t + dur + 0.1);
    }
  }

  /** A short original call, formant-shaped so it reads as small voices, never a shout. */
  kakegoe(when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const t = when || ctx.currentTime;
    const syllables = [
      { at: 0.0, dur: 0.16, f0: 330 },
      { at: 0.2, dur: 0.13, f0: 360 },
      { at: 0.36, dur: 0.3, f0: 392 },
    ];
    for (const s of syllables) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(s.f0, t + s.at);
      o.frequency.linearRampToValueAtTime(s.f0 * 1.04, t + s.at + s.dur);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t + s.at);
      out.gain.exponentialRampToValueAtTime(0.055, t + s.at + 0.03);
      out.gain.exponentialRampToValueAtTime(0.0001, t + s.at + s.dur);
      // three formants approximate a young voice
      for (const [f, q, a] of [
        [720, 7, 1],
        [1240, 9, 0.6],
        [2680, 11, 0.28],
      ] as [number, number, number][]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = a;
        o.connect(bp).connect(g).connect(out);
      }
      out.connect(this.buses.music);
      o.start(t + s.at);
      o.stop(t + s.at + s.dur + 0.05);
    }
  }

  /* ------------------------------------------------------------------ one-shots */

  private oneShot(
    bus: Bus,
    filterType: BiquadFilterType,
    freq: number,
    q: number,
    peak: number,
    attack: number,
    decay: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const n = this.noiseSource();
    if (!n) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g.gain, t, peak, attack, decay);
    n.connect(f).connect(g).connect(this.buses[bus]);
    n.start(t);
    n.stop(t + attack + decay + 0.05);
  }

  /** The dry "sa" of a sheet settling onto the frame. */
  paperLay(): void {
    this.oneShot('sfx', 'bandpass', 2600, 0.7, 0.16, 0.008, 0.2);
    this.oneShot('sfx', 'highpass', 5200, 0.5, 0.06, 0.004, 0.09);
  }

  paperPick(): void {
    this.oneShot('sfx', 'bandpass', 3400, 0.9, 0.1, 0.006, 0.13);
  }

  /** The switch. Short, mechanical, unmistakable. */
  click(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(on ? 2100 : 1500, t);
    o.frequency.exponentialRampToValueAtTime(on ? 620 : 420, t + 0.02);
    const g = ctx.createGain();
    this.env(g.gain, t, 0.2, 0.001, 0.035);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    o.connect(bp).connect(g).connect(this.buses.sfx);
    o.start(t);
    o.stop(t + 0.06);
    this.oneShot('sfx', 'highpass', 3800, 0.6, 0.12, 0.001, 0.03);
  }

  chime(): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const t = ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      this.env(g.gain, t + i * 0.06, 0.07, 0.01, 0.5);
      o.connect(g).connect(this.buses!.sfx);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.6);
    });
  }

  /* ------------------------------------------------------------------ continuous */

  private ensureLoop(
    key: 'brush' | 'cart' | 'squeal',
    filterType: BiquadFilterType,
    freq: number,
    q: number,
  ): { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return null;
    let voice = this[key];
    if (!voice) {
      const src = this.noiseSource();
      if (!src) return null;
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = freq;
      filt.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filt).connect(gain).connect(this.buses.sfx);
      src.start();
      voice = { src, filt, gain };
      this[key] = voice;
    }
    return voice;
  }

  /** `kind` changes the character: paste is wet and low, sumi is papery, dye is broad. */
  setBrush(level: number, kind: 'glue' | 'ink' | 'dye' | 'finger'): void {
    const v = this.ensureLoop('brush', 'bandpass', 1400, 1);
    if (!v || !this.ctx) return;
    const cfg = {
      glue: { f: 780, q: 0.9, g: 0.12 },
      ink: { f: 2400, q: 1.4, g: 0.09 },
      dye: { f: 1500, q: 0.8, g: 0.1 },
      finger: { f: 1050, q: 0.7, g: 0.07 },
    }[kind];
    v.filt.frequency.setTargetAtTime(cfg.f, this.ctx.currentTime, 0.05);
    v.filt.Q.setTargetAtTime(cfg.q, this.ctx.currentTime, 0.05);
    v.gain.gain.setTargetAtTime(Math.max(0.0001, clamp(level, 0, 1) * cfg.g), this.ctx.currentTime, 0.04);
  }

  setCart(speed: number, turn: number): void {
    const c = this.ensureLoop('cart', 'lowpass', 300, 0.8);
    const s = this.ensureLoop('squeal', 'bandpass', 2200, 6);
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (c) {
      c.filt.frequency.setTargetAtTime(190 + speed * 420, now, 0.08);
      c.gain.gain.setTargetAtTime(Math.max(0.0001, clamp(speed, 0, 1) * 0.16), now, 0.08);
    }
    if (s) {
      s.filt.frequency.setTargetAtTime(1500 + Math.abs(turn) * 2400, now, 0.06);
      s.gain.gain.setTargetAtTime(Math.max(0.0001, clamp(Math.abs(turn), 0, 1) * 0.05), now, 0.09);
    }
  }

  /** Barely-there mains hum from the lamp wiring. */
  setLampHum(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    if (!this.hum) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 118;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 237;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(lp).connect(this.buses.sfx);
      osc.start();
      osc2.start();
      this.hum = { osc, osc2, gain };
    }
    this.hum.gain.gain.setTargetAtTime(Math.max(0.00005, clamp(level, 0, 1) * 0.012), ctx.currentTime, 0.2);
  }

  /* ------------------------------------------------------------------ hayashi */

  startMusic(): void {
    if (!this.ctx || !this.buses || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.buses.music.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.7);
    this.schedulerId = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic(): void {
    if (!this.musicOn) return;
    this.musicOn = false;
    window.clearInterval(this.schedulerId);
    if (this.ctx && this.buses) this.buses.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  /** Loosely follows the parade: faster pulling, brisker hayashi. */
  setEnergy(e: number): void {
    this.energy = clamp(e, 0, 1);
    this.bpm = 96 + this.energy * 34;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    const spb = 60 / this.bpm / 2; // eighth notes
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const i = this.step % 16;
      const t = this.nextNoteTime;
      const drive = 0.45 + this.energy * 0.55;
      if (TAIKO_PATTERN[i] > 0) this.taiko(TAIKO_PATTERN[i] * drive, t);
      if (KANE_PATTERN[i] > 0) this.kane(KANE_PATTERN[i] * 0.5 * drive, t);
      const note = FUE_PHRASE[i];
      if (note >= 0 && this.energy > 0.08) this.fue(note, spb * 1.6, t, 0.55 + this.energy * 0.5);
      if (i === 0 && Math.floor(this.step / 16) % 4 === 3) this.kakegoe(t);
      this.lastStepTime = t;
      this.nextNoteTime += spb;
      this.step++;
    }
  }

  update(dt: number): void {
    this.drumHit = Math.max(0, this.drumHit - dt * 4.5);
    if (this.ctx && this.musicOn) {
      const spb = 60 / this.bpm / 2;
      const since = this.ctx.currentTime - this.lastStepTime;
      this.beat = ((this.step % 16) / 16 + clamp(since / spb, 0, 1) / 16) % 1;
    }
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
