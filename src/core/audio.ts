/**
 * Tiny procedural audio: soft sine chimes and filtered-noise water.
 * No assets. Starts only after a user gesture (iOS requirement).
 * All levels kept low and gentle for a small child.
 */
export class SoftAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private waterSrc: AudioBufferSourceNode | null = null;
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Call from a pointerdown handler. */
  unlock(): void {
    if (!this.enabled || this.ctx) return;
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Soft bell — used sparingly: discovery glints, light advancing, completion. */
  chime(freq: number, dur = 0.9, vol = 0.16): void {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g);
    osc2.connect(g2).connect(g);
    g.connect(this.master);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /** Rising three-note figure when the light passes a repaired stretch. */
  lightAdvance(step: number): void {
    const base = 523.25 * Math.pow(1.122, Math.min(step, 6));
    this.chime(base, 0.7, 0.12);
  }

  success(): void {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => setTimeout(() => this.chime(f, 1.4, 0.13), i * 190));
  }

  /** Continuous gentle water while brushing/rinsing; call setWater(0..1). */
  setWater(level: number): void {
    if (!this.ctx || !this.master) return;
    if (!this.waterSrc) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.94 + white * 0.06; // brownish
        d[i] = last * 3.2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600;
      bp.Q.value = 0.6;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.waterSrc = src;
      this.waterGain = g;
    }
    if (this.waterGain) {
      const t = this.now();
      this.waterGain.gain.cancelScheduledValues(t);
      this.waterGain.gain.linearRampToValueAtTime(Math.min(1, level) * 0.09, t + 0.12);
    }
  }

  /** Soft cloth swish while polishing. */
  swish(): void {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const len = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
  }
}
