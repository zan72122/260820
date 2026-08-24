// All audio is synthesized with WebAudio: no assets, no network.
// Design rule: quiet, damp, close-mic'd forest morning. No chimes, no fanfare.
import { clamp } from './util/rng';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windAM: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private ambientOn = false;
  private dripTimer = 0;
  private birdTimer = 999;
  birdsEnabled = false;
  muted = false;

  ensure(): boolean {
    if (this.ctx) return true;
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startBreeze();
      return true;
    } catch {
      return false;
    }
  }

  resume() {
    if (this.ensure() && this.ctx!.state !== 'running') void this.ctx!.resume();
  }

  private noiseSource(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  private env(peak: number, a: number, d: number, when = 0): GainNode {
    const g = this.ctx!.createGain();
    const t = this.ctx!.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }

  private startBreeze() {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0.016;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.008;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
    this.ambientOn = true;
  }

  // Single drip: short sine ping through bandpass, with one soft echo.
  drip() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const f0 = 900 + Math.random() * 1400;
    for (let echo = 0; echo < 2; echo++) {
      const when = echo * 0.19;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, ctx.currentTime + when);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, ctx.currentTime + when + 0.06);
      const g = this.env(echo === 0 ? 0.05 : 0.016, 0.004, 0.1, when);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.4 - 0.7;
      o.connect(g);
      g.connect(p);
      p.connect(this.master);
      o.start(ctx.currentTime + when);
      o.stop(ctx.currentTime + when + 0.2);
    }
  }

  hoof(soft = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(85, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.09);
    const og = this.env(soft ? 0.1 : 0.2, 0.003, 0.1);
    o.connect(og);
    og.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.15);
    // wet squish
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const ng = this.env(soft ? 0.04 : 0.08, 0.008, 0.12);
    n.connect(f);
    f.connect(ng);
    ng.connect(this.master);
    n.start();
    n.stop(ctx.currentTime + 0.16);
  }

  touchWater() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 1.4;
    const g = this.env(0.09, 0.004, 0.09);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start();
    n.stop(ctx.currentTime + 0.14);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(640, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(210, ctx.currentTime + 0.08);
    const og = this.env(0.05, 0.004, 0.09);
    o.connect(og);
    og.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.14);
  }

  // Continuous winding voice; rate 0..1 follows angular speed, activity gates level.
  setWinding(activity: number, rate: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.windGain) {
      const n = this.noiseSource();
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.Q.value = 2.2;
      this.windFilter.frequency.value = 600;
      this.windAM = ctx.createGain();
      this.windAM.gain.value = 1;
      this.windLfo = ctx.createOscillator();
      this.windLfo.frequency.value = 20;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.4;
      this.windLfo.connect(lfoDepth);
      lfoDepth.connect(this.windAM.gain);
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      n.connect(this.windFilter);
      this.windFilter.connect(this.windAM);
      this.windAM.connect(this.windGain);
      this.windGain.connect(this.master);
      n.start();
      this.windLfo.start();
    }
    const t = ctx.currentTime;
    this.windGain.gain.setTargetAtTime(clamp(activity, 0, 1) * 0.11, t, 0.08);
    this.windFilter!.frequency.setTargetAtTime(420 + rate * 1300, t, 0.1);
    this.windLfo!.frequency.setTargetAtTime(12 + rate * 26, t, 0.1);
  }

  // Water returning where cleared: low bubbly swell, deliberately not a chord.
  clearBloom() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, ctx.currentTime);
    f.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.5);
    const g = this.env(0.07, 0.25, 0.7);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start();
    n.stop(ctx.currentTime + 1.1);
    for (let i = 0; i < 5; i++) {
      const when = 0.08 + i * 0.09 + Math.random() * 0.05;
      const o = ctx.createOscillator();
      const fr = 260 + Math.random() * 420;
      o.frequency.setValueAtTime(fr, ctx.currentTime + when);
      o.frequency.exponentialRampToValueAtTime(fr * 1.6, ctx.currentTime + when + 0.05);
      const og = this.env(0.028, 0.008, 0.07, when);
      o.connect(og);
      og.connect(this.master);
      o.start(ctx.currentTime + when);
      o.stop(ctx.currentTime + when + 0.14);
    }
  }

  loosen() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1300, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.4);
    f.Q.value = 2;
    const g = this.env(0.06, 0.03, 0.4);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start();
    n.stop(ctx.currentTime + 0.5);
  }

  // Dry mineral powder onto the purification stone.
  transferPowder() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < 22; i++) {
      const when = i * 0.045 + Math.random() * 0.02;
      const n = this.noiseSource();
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2600 + Math.random() * 1800;
      const g = this.env(0.025, 0.002, 0.03, when);
      n.connect(f);
      f.connect(g);
      g.connect(this.master);
      n.start(ctx.currentTime + when);
      n.stop(ctx.currentTime + when + 0.05);
    }
  }

  lap() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const when = i * 0.22;
      const n = this.noiseSource();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      const g = this.env(0.03, 0.01, 0.09, when);
      n.connect(f);
      f.connect(g);
      g.connect(this.master);
      n.start(ctx.currentTime + when);
      n.stop(ctx.currentTime + when + 0.14);
    }
  }

  private bird() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const base = 2100 + Math.random() * 900;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const when = i * 0.13 + Math.random() * 0.04;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), ctx.currentTime + when);
      o.frequency.exponentialRampToValueAtTime(base * 0.7, ctx.currentTime + when + 0.08);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3400;
      const g = this.env(0.016, 0.01, 0.09, when);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(f);
      f.connect(g);
      g.connect(p);
      p.connect(this.master);
      o.start(ctx.currentTime + when);
      o.stop(ctx.currentTime + when + 0.16);
    }
  }

  update(dt: number) {
    if (!this.ctx || !this.ambientOn) return;
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.drip();
      this.dripTimer = 1.8 + Math.random() * 5;
    }
    if (this.birdsEnabled) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.bird();
        this.birdTimer = 3 + Math.random() * 7;
      }
    } else {
      this.birdTimer = 2 + Math.random() * 3;
    }
  }
}
