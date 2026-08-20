/**
 * Everything you hear is synthesised here — no audio files, nothing to
 * download, and it works offline on a phone in a field.
 *
 * The mix has one rule: water is the lead instrument. The festival (crowd,
 * night insects, a far-off flute) sits well behind it, and the paper tearing
 * is a small pleasant physical sound, never an alarm.
 */

import { clamp } from './Rng.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this._lastDrop = 0;
    this._lastStress = 0;
    this._nodes = {};
    this._timers = [];
  }

  /** Must be called from inside a user gesture (iOS Safari requirement). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    let ctx;
    try {
      ctx = new Ctx({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    const amb = ctx.createGain();
    amb.gain.value = 0.0001;
    amb.connect(master);

    // A short synthetic room so droplets and the bowl sit in a space.
    const conv = ctx.createConvolver();
    conv.buffer = this._impulse(1.15, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    conv.connect(wet).connect(master);

    this._nodes = { master, sfx, amb, conv };
    this.noise = this._noiseBuffer(2.2);

    this._buildAmbience();
    this.ready = true;

    master.gain.setTargetAtTime(0.92, ctx.currentTime, 0.6);
    amb.gain.setTargetAtTime(1, ctx.currentTime, 2.5);

    if (ctx.state === 'suspended') ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready) return;
    this._nodes.master.gain.setTargetAtTime(m ? 0.0001 : 0.92, this.ctx.currentTime, 0.12);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---------------------------------------------------------------- helpers

  _noiseBuffer(sec) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // a little brown tilt
      d[i] = white * 0.68 + last * 3.2;
    }
    return buf;
  }

  _impulse(sec, decay) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return buf;
  }

  _noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  _env(node, t, peak, attack, decay) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // -------------------------------------------------------------- ambience

  _buildAmbience() {
    const ctx = this.ctx;
    const amb = this._nodes.amb;

    // Distant crowd: brown noise, heavily low-passed, breathing slowly.
    const crowd = this._noiseSource(true);
    const cf = ctx.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 430;
    cf.Q.value = 0.5;
    const cg = ctx.createGain();
    cg.gain.value = 0.052;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(cg.gain);
    crowd.connect(cf).connect(cg).connect(amb);
    crowd.start();
    lfo.start();

    // A second, brighter layer for the "many voices" texture.
    const voices = this._noiseSource(true);
    const vf = ctx.createBiquadFilter();
    vf.type = 'bandpass';
    vf.frequency.value = 1050;
    vf.Q.value = 0.8;
    const vg = ctx.createGain();
    vg.gain.value = 0.016;
    voices.connect(vf).connect(vg).connect(amb);
    voices.start();

    this._insects();
    this._festivalMusic();
  }

  /** Night insects: short chirps, irregular enough not to sound like a loop. */
  _insects() {
    if (!this.ready && !this.ctx) return;
    const ctx = this.ctx;
    const amb = this._nodes.amb;
    const chirp = (t, base) => {
      const src = this._noiseSource();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(base, t);
      bp.Q.value = 26;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      // Amplitude-modulated buzz, the way a suzumushi actually sounds.
      const am = ctx.createOscillator();
      am.type = 'square';
      am.frequency.value = 58 + Math.random() * 22;
      const amG = ctx.createGain();
      amG.gain.value = 0.5;
      am.connect(amG).connect(g.gain);
      src.connect(bp).connect(g).connect(amb);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.05);
      g.gain.setValueAtTime(0.03, t + 0.34);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
      src.start(t);
      src.stop(t + 0.7);
      am.start(t);
      am.stop(t + 0.7);
    };
    const schedule = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      chirp(t, 4200 + Math.random() * 1400);
      if (Math.random() < 0.5) chirp(t + 0.7 + Math.random() * 0.5, 3400 + Math.random() * 900);
      const id = setTimeout(schedule, 1800 + Math.random() * 3600);
      this._timers.push(id);
    };
    schedule();
  }

  /** A flute and a small bell, far away, in a plain pentatonic. */
  _festivalMusic() {
    const ctx = this.ctx;
    const amb = this._nodes.amb;
    const scale = [0, 2, 4, 7, 9, 12, 14];
    let step = 0;
    const play = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime + 0.05;
      const semi = scale[Math.floor(Math.random() * scale.length)];
      const f = 392 * Math.pow(2, semi / 12);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.004, t + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1300;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(0.02, t + 0.12);
      g.gain.setTargetAtTime(0.0001, t + 0.3, 0.22);
      osc.connect(lp).connect(g).connect(amb);
      g.connect(this._nodes.conv);
      osc.start(t);
      osc.stop(t + 1.4);

      step++;
      if (step % 8 === 0) {
        // a low drum, felt more than heard
        const d = ctx.createOscillator();
        d.type = 'sine';
        d.frequency.setValueAtTime(96, t);
        d.frequency.exponentialRampToValueAtTime(52, t + 0.24);
        const dg = ctx.createGain();
        dg.gain.value = 0.0001;
        dg.gain.linearRampToValueAtTime(0.055, t + 0.012);
        dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        d.connect(dg).connect(amb);
        d.start(t);
        d.stop(t + 0.5);
      }
      const id = setTimeout(play, 620 + Math.random() * 900);
      this._timers.push(id);
    };
    const id = setTimeout(play, 2500);
    this._timers.push(id);
  }

  // ------------------------------------------------------------------- sfx

  /** Paper meeting the surface. Strength 0..1 = how hard it went in. */
  waterEnter(strength = 0.5) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = clamp(strength, 0.05, 1);

    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 + 900 * s, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.19);
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    this._env(g, t, 0.2 * s + 0.04, 0.008, 0.24);
    src.connect(bp).connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    src.start(t);
    src.stop(t + 0.4);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520 - 120 * s, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
    const og = ctx.createGain();
    this._env(og, t, 0.13 * s, 0.006, 0.18);
    o.connect(og).connect(this._nodes.sfx);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** The surface letting go of the paper as it comes up. */
  waterExit(strength = 0.5) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = clamp(strength, 0.05, 1);
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    this._env(g, t, 0.15 * s + 0.03, 0.05, 0.34);
    src.connect(bp).connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    src.start(t);
    src.stop(t + 0.55);
  }

  /** A single drop falling back. Rate limited — dozens land at once. */
  droplet(pitch = 1) {
    if (!this.ready || this.muted) return;
    const n = now();
    if (n - this._lastDrop < 45) return;
    this._lastDrop = n;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = (1150 + Math.random() * 700) * pitch;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.48, t + 0.055);
    const g = ctx.createGain();
    this._env(g, t, 0.06, 0.003, 0.075);
    o.connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    o.start(t);
    o.stop(t + 0.13);
  }

  /** Tail slapping the surface. */
  tailFlick(strength = 0.5) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = clamp(strength, 0.1, 1);
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.1);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    this._env(g, t, 0.17 * s, 0.004, 0.15);
    src.connect(bp).connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    src.start(t);
    src.stop(t + 0.28);
  }

  /** Fibres letting go, one at a time. Very quiet, high, and dry. */
  paperStress(level = 0.5) {
    if (!this.ready || this.muted) return;
    const n = now();
    if (n - this._lastStress < 90) return;
    this._lastStress = n;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this._noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200 + Math.random() * 2600;
    bp.Q.value = 7;
    const g = ctx.createGain();
    this._env(g, t, 0.028 * clamp(level, 0.2, 1), 0.002, 0.045);
    src.connect(hp).connect(bp).connect(g).connect(this._nodes.sfx);
    src.start(t);
    src.stop(t + 0.09);
  }

  /**
   * A hole opening. Deliberately soft and round: this is not a buzzer, it is
   * the sound of wet paper giving up, and it should feel good.
   */
  paperTear(size = 0.4) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = clamp(size, 0.15, 1);
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.16 + 0.12 * s);
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    this._env(g, t, 0.1 * s + 0.02, 0.007, 0.2 + 0.15 * s);
    src.connect(bp).connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    src.start(t);
    src.stop(t + 0.5);
  }

  /** The whole sheet dropping into the tub — a fat, friendly "pochan". */
  paperDrop() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(105, t + 0.2);
    const g = ctx.createGain();
    this._env(g, t, 0.22, 0.006, 0.28);
    o.connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    o.start(t);
    o.stop(t + 0.45);
    this.waterEnter(0.55);
  }

  /** Into the bowl: "chapun". */
  bowlPlop() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.13);
    const g = ctx.createGain();
    this._env(g, t, 0.19, 0.005, 0.2);
    o.connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    o.start(t);
    o.stop(t + 0.36);

    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1700, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.14);
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    this._env(ng, t, 0.13, 0.004, 0.17);
    src.connect(bp).connect(ng).connect(this._nodes.sfx);
    ng.connect(this._nodes.conv);
    src.start(t);
    src.stop(t + 0.3);
  }

  /** The stall keeper setting a fresh poi down: a light wooden tap. */
  newPoi() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(760, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.06);
    const g = ctx.createGain();
    this._env(g, t, 0.1, 0.003, 0.09);
    o.connect(g).connect(this._nodes.sfx);
    g.connect(this._nodes.conv);
    o.start(t);
    o.stop(t + 0.2);
  }

  dispose() {
    this._timers.forEach(clearTimeout);
    this._timers.length = 0;
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.ready = false;
  }
}
