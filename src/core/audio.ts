/**
 * Small synthesized sound set — no assets, unlocked on first gesture.
 * Materials get distinct voices so a child can hear rubber vs wood vs steel.
 */
import type { BallKind } from '../glyph/spec';

export class LabAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rollNoise: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private lastTick = 0;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.startRollLoop();
    } catch {
      this.ctx = null;
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.max(1, (seconds * ctx.sampleRate) | 0), ctx.sampleRate);
    const data = buf.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < data.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 2147483648 - 1) * 0.6;
    }
    return buf;
  }

  private startRollLoop() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.2);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    this.rollNoise = src;
    this.rollGain = gain;
    this.rollFilter = filter;
  }

  /** Continuous rolling loudness, call every frame. speed m/s. */
  setRolling(speed: number, kind: BallKind = 'rubber') {
    if (!this.ctx || !this.rollGain || this.muted) return;
    const t = this.ctx.currentTime;
    const g = Math.min(0.4, speed * (kind === 'steel' ? 0.34 : kind === 'wood' ? 0.26 : 0.14));
    this.rollGain.gain.setTargetAtTime(g, t, 0.06);
    this.rollFilter!.frequency.setTargetAtTime(
      kind === 'steel' ? 900 : kind === 'wood' ? 600 : 260,
      t,
      0.08,
    );
  }

  private blip(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private thudNoise(cutoff: number, dur: number, gain: number) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  impact(kind: BallKind, velocity: number, surface: 'steel' | 'granite' | 'felt' | 'aluminum' = 'steel') {
    const v = Math.min(1, velocity / 3);
    if (v < 0.05) return;
    if (surface === 'felt') {
      this.thudNoise(180, 0.09, 0.18 * v);
      return;
    }
    switch (kind) {
      case 'rubber':
        this.blip(110 + v * 40, 0.1, 0.3 * v, 'sine');
        this.thudNoise(240, 0.06, 0.12 * v);
        break;
      case 'wood':
        this.blip(420, 0.06, 0.26 * v, 'triangle');
        this.blip(640, 0.045, 0.14 * v, 'sine');
        this.thudNoise(900, 0.04, 0.1 * v);
        break;
      case 'steel':
        this.blip(1250, 0.28, 0.2 * v, 'sine');
        this.blip(2210, 0.16, 0.08 * v, 'sine');
        this.thudNoise(2400, 0.05, 0.14 * v);
        break;
    }
  }

  /** Mechanism ratchet while a handle moves; rate-limited. */
  tick() {
    const now = performance.now();
    if (now - this.lastTick < 70) return;
    this.lastTick = now;
    this.thudNoise(1700, 0.02, 0.05);
    this.blip(880, 0.02, 0.03, 'square');
  }

  gate() {
    this.thudNoise(700, 0.05, 0.16);
    this.blip(220, 0.07, 0.12, 'triangle');
  }

  leverClack() {
    this.thudNoise(500, 0.05, 0.14);
  }

  success() {
    // Soft marimba-ish rising triad — warm, no slot machine.
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      this.blip(f, 0.5, 0.16, 'sine', i * 0.12);
      this.blip(f * 2, 0.25, 0.05, 'sine', i * 0.12);
    });
  }

  stationDone() {
    this.blip(392, 0.6, 0.18, 'sine');
    this.blip(523.25, 0.8, 0.16, 'sine', 0.16);
  }
}
