// Procedural audio: wind through dry grass, the knot's low held tension,
// soft friction when the horn catches a strand, drips, and a rain bed
// that thickens as the sky lets go. No constant magic sparkle.

import { clamp } from './util';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private droneOsc1!: OscillatorNode;
  private droneOsc2!: OscillatorNode;
  private frictionGain!: GainNode;
  private rainGain!: GainNode;
  private rainFilter!: BiquadFilterNode;
  private streamGain!: GainNode;
  enabled = false;

  /** iOS can leave a context 'suspended' or 'interrupted' — nudge it on any touch */
  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  start() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.resume();
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    const noiseBuf = makeNoise(ctx);

    // wind: filtered noise, slowly wandering
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf; windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 480;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.12;
    windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
    windSrc.start();

    // knot drone: two detuned low tones — tension you can feel
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc1.type = 'sine'; this.droneOsc1.frequency.value = 55;
    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc2.type = 'triangle'; this.droneOsc2.frequency.value = 57.5;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    const droneLP = ctx.createBiquadFilter();
    droneLP.type = 'lowpass'; droneLP.frequency.value = 220;
    this.droneOsc1.connect(droneLP);
    this.droneOsc2.connect(droneLP);
    droneLP.connect(this.droneGain).connect(this.master);
    this.droneOsc1.start(); this.droneOsc2.start();

    // friction: bandpassed noise, gated by gesture speed
    const fricSrc = ctx.createBufferSource();
    fricSrc.buffer = noiseBuf; fricSrc.loop = true;
    const fricBP = ctx.createBiquadFilter();
    fricBP.type = 'bandpass'; fricBP.frequency.value = 1400; fricBP.Q.value = 2.2;
    this.frictionGain = ctx.createGain();
    this.frictionGain.gain.value = 0;
    fricSrc.connect(fricBP).connect(this.frictionGain).connect(this.master);
    fricSrc.start();

    // rain bed
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuf; rainSrc.loop = true;
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'highpass'; this.rainFilter.frequency.value = 2400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
    rainSrc.start();

    // distant stream returning (very low, appears late)
    const stSrc = ctx.createBufferSource();
    stSrc.buffer = noiseBuf; stSrc.loop = true;
    const stBP = ctx.createBiquadFilter();
    stBP.type = 'bandpass'; stBP.frequency.value = 900; stBP.Q.value = 1.1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(stBP.frequency);
    lfo.start();
    this.streamGain = ctx.createGain();
    this.streamGain.gain.value = 0;
    stSrc.connect(stBP).connect(this.streamGain).connect(this.master);
    stSrc.start();

    this.enabled = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  /** drip: one drop landing on a leaf */
  drip(pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(650 * pitch, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** short soft release as a loop lets go: tension resolving downward */
  loopRelease() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 1);
  }

  /**
   * Continuous state. tension: 0..1 knot remaining; friction: gesture speed;
   * rain: 0..1 density; wind: 0..1; stream: 0..1.
   */
  setState(tension: number, friction: number, rain: number, wind: number, stream: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number, tc = 0.25) => p.setTargetAtTime(v, t, tc);
    ramp(this.windGain.gain, 0.05 + wind * 0.11);
    ramp(this.windFilter.frequency, 380 + wind * 420, 0.6);
    ramp(this.droneGain.gain, tension * 0.075);
    ramp(this.droneOsc2.frequency, 57.5 - (1 - tension) * 2.2, 0.5);
    ramp(this.frictionGain.gain, clamp(friction, 0, 1) * 0.05, 0.08);
    ramp(this.rainGain.gain, clamp(rain, 0, 1) * 0.14);
    ramp(this.rainFilter.frequency, 2600 - clamp(rain, 0, 1) * 900, 0.5);
    ramp(this.streamGain.gain, stream * 0.035, 1.2);
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // pinkish: one-pole lowpassed white mixed with white
    const w = Math.random() * 2 - 1;
    last = last * 0.94 + w * 0.06;
    d[i] = last * 6 * 0.5 + w * 0.18;
  }
  return buf;
}
