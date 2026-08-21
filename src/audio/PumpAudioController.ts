import { clamp } from '../core/Rng';

interface Voice {
  gain: GainNode;
  filter: BiquadFilterNode;
  source: AudioBufferSourceNode;
}

/**
 * All sound is synthesised: the pump's rise, the water leaving the bores, the
 * rush under a moving raft, and the landing. Loudness and colour follow the
 * lever continuously, because the sound is half of the causal story.
 */
export class PumpAudioController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pumpOsc: OscillatorNode[] = [];
  private pumpGain: GainNode | null = null;
  private pumpFilter: BiquadFilterNode | null = null;
  private jet: Voice | null = null;
  private rush: Voice | null = null;
  private ambient: Voice | null = null;
  private started = false;
  private muted = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    this.master = master;
    master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.85, ctx.currentTime, 0.6);

    const len = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Slight pinking keeps the water from sounding like radio static.
      last = 0.94 * last + 0.06 * white;
      data[i] = clamp(last * 3.2, -1, 1);
    }
    this.noiseBuffer = buffer;

    // Pump: two detuned saws under a moving low-pass.
    const pumpGain = ctx.createGain();
    pumpGain.gain.value = 0;
    const pumpFilter = ctx.createBiquadFilter();
    pumpFilter.type = 'lowpass';
    pumpFilter.frequency.value = 180;
    pumpFilter.Q.value = 3.5;
    pumpGain.connect(pumpFilter);
    pumpFilter.connect(master);
    for (const f of [41, 57.5, 83]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(pumpGain);
      osc.start();
      this.pumpOsc.push(osc);
    }
    this.pumpGain = pumpGain;
    this.pumpFilter = pumpFilter;

    this.jet = this.makeNoiseVoice(master, 'bandpass', 1150, 0.9);
    this.rush = this.makeNoiseVoice(master, 'lowpass', 700, 0.7);
    this.ambient = this.makeNoiseVoice(master, 'lowpass', 340, 0.4);
    if (this.ambient) this.ambient.gain.gain.value = 0.02;
  }

  private makeNoiseVoice(
    dest: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
  ): Voice | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start();
    return { gain, filter, source: src };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.85, this.ctx.currentTime, 0.2);
    }
  }

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * @param charge  hydraulic pressure behind the lever, 0..1
   * @param flow    water actually leaving the bores, 0..1
   * @param speed   raft speed, m/s
   * @param contact how much water is landing on the raft, 0..1
   */
  update(charge: number, flow: number, speed: number, contact: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.pumpGain || !this.pumpFilter) return;
    const t = ctx.currentTime;
    const smooth = 0.09;

    this.pumpGain.gain.setTargetAtTime(0.055 * charge, t, smooth);
    this.pumpFilter.frequency.setTargetAtTime(150 + charge * 520, t, smooth);
    for (let i = 0; i < this.pumpOsc.length; i++) {
      const base = [41, 57.5, 83][i];
      this.pumpOsc[i].frequency.setTargetAtTime(base * (0.86 + charge * 0.2), t, 0.25);
    }

    if (this.jet) {
      this.jet.gain.gain.setTargetAtTime(0.16 * flow, t, smooth);
      this.jet.filter.frequency.setTargetAtTime(900 + flow * 2600 + contact * 900, t, smooth);
      this.jet.filter.Q.setTargetAtTime(0.7 + contact * 1.4, t, smooth);
    }
    if (this.rush) {
      const v = clamp(speed / 9, 0, 1);
      this.rush.gain.gain.setTargetAtTime(0.1 * v, t, 0.12);
      this.rush.filter.frequency.setTargetAtTime(320 + v * 1500, t, 0.12);
    }
  }

  /** Water arriving in the runout. */
  splash(strength: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.master) return;
    const s = clamp(strength / 9, 0.25, 1.3);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(2600 * s, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5 * s, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 1.2);
  }

  /** A single drop falling back into a bore - the quietest hint in the game. */
  drip(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(1250, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /** Mechanical noises: the launch dog, the lever interlock. */
  clunk(pitch = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 * pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70 * pitch, ctx.currentTime + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  /** Warm little three-note figure when a raft gets over the top. */
  chime(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const at = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const partial = ctx.createOscillator();
      partial.type = 'sine';
      partial.frequency.value = f * 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.16, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      const partialGain = ctx.createGain();
      partialGain.gain.value = 0.25;
      osc.connect(gain);
      partial.connect(partialGain);
      partialGain.connect(gain);
      gain.connect(this.master!);
      osc.start(at);
      partial.start(at);
      osc.stop(at + 1);
      partial.stop(at + 1);
    });
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }
}
