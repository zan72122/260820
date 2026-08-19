/* All sound is synthesised with WebAudio — no audio files to load.
   iOS needs the context resumed from inside a real touch handler. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this._drill = null;
    this._tension = null;
  }

  /* must be called from a user gesture */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain();
    master.gain.value = 0.85;
    // gentle limiter so nothing ever gets harsh in a child's ear
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 18; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    this.noiseBuf = this._makeNoise(2.5);
    this.ready = true;
    this._startWind();
    if (ctx.state === 'suspended') ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.85 : 0.0, this.ctx.currentTime, 0.05);
  }

  _makeNoise(sec) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _noise(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop;
    return s;
  }
  get t() { return this.ctx.currentTime; }

  /* ---------- ambience: a thin, cold wind ---------- */
  _startWind() {
    const ctx = this.ctx;
    const src = this._noise(true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = ctx.createGain(); g.gain.value = 0.055;
    src.connect(bp).connect(lp).connect(g).connect(this.master);
    // slow gusts
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.038;
    lfo.connect(lfoG).connect(g.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.031;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 260;
    lfo2.connect(lfo2G).connect(bp.frequency);
    src.start(); lfo.start(); lfo2.start();
    this.windGain = g; this.windLp = lp;
  }

  /* muffle the wind while the camera is under the water */
  setUnderwater(amount) {
    if (!this.ready) return;
    const t = this.t;
    this.windLp.frequency.setTargetAtTime(1100 - 950 * amount, t, 0.25);
    this.windGain.gain.setTargetAtTime(0.055 * (1 - 0.75 * amount), t, 0.25);
  }

  /* ---------- ice auger: ギュルギュル ---------- */
  drillOn() {
    if (!this.ready || this._drill) return;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    // grinding = rough saw + scraped noise, both gated by a fast tremolo
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 78;
    const sawF = ctx.createBiquadFilter(); sawF.type = 'lowpass'; sawF.frequency.value = 900; sawF.Q.value = 3;
    const nz = this._noise(true);
    const nzF = ctx.createBiquadFilter(); nzF.type = 'bandpass'; nzF.frequency.value = 1750; nzF.Q.value = 1.4;
    const nzG = ctx.createGain(); nzG.gain.value = 0.5;
    const trem = ctx.createOscillator(); trem.type = 'sawtooth'; trem.frequency.value = 13;
    const tremG = ctx.createGain(); tremG.gain.value = 0.42;
    const body = ctx.createGain(); body.gain.value = 0.6;
    trem.connect(tremG).connect(body.gain);
    saw.connect(sawF).connect(body);
    nz.connect(nzF).connect(nzG).connect(body);
    body.connect(out).connect(this.master);
    saw.start(); nz.start(); trem.start();
    out.gain.setTargetAtTime(0.16, this.t, 0.06);
    this._drill = { out, saw, nzF, trem, nodes: [saw, nz, trem] };
  }
  drillRate(speed) {          // speed 0..1 — how fast the child is turning
    if (!this._drill) return;
    const t = this.t, s = clamp(speed, 0, 1);
    this._drill.saw.frequency.setTargetAtTime(62 + s * 74, t, 0.08);
    this._drill.trem.frequency.setTargetAtTime(7 + s * 17, t, 0.08);
    this._drill.nzF.frequency.setTargetAtTime(1250 + s * 1500, t, 0.08);
    this._drill.out.gain.setTargetAtTime(0.045 + s * 0.16, t, 0.07);
  }
  drillOff() {
    if (!this._drill) return;
    const d = this._drill; this._drill = null;
    const t = this.t;
    d.out.gain.setTargetAtTime(0.0001, t, 0.07);
    d.saw.frequency.setTargetAtTime(40, t, 0.2);
    setTimeout(() => d.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 700);
  }

  /* ---------- the hole opens: crack, chunk, then black water ---------- */
  breakthrough() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    // sharp crack
    for (let i = 0; i < 5; i++) {
      const d = i * 0.035 + Math.random() * 0.02;
      const n = this._noise(); const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 2600; f.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      n.connect(f).connect(g).connect(this.master); n.start(t + d); n.stop(t + d + 0.25);
    }
    // low body thump of the plug letting go
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.42);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t + 0.05);
    og.gain.exponentialRampToValueAtTime(0.38, t + 0.08);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(og).connect(this.master); o.start(t + 0.05); o.stop(t + 0.8);
    this.splash(0.42, t + 0.16);
    // and the hollow "voice" of the water column below
    setTimeout(() => this.holeTone(), 260);
  }

  /* deep resonant hum — the sound of a hole into another world */
  holeTone() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    [58, 87, 146].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 / (i + 1), t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 2.7);
    });
  }

  /* ---------- scooping slush: シャリッ ---------- */
  scoop(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const n = this._noise();
    n.playbackRate.value = 0.9 + Math.random() * 0.35;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.exponentialRampToValueAtTime(2300, t + 0.22);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    const v = 0.1 + 0.12 * strength;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(hp).connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.35);
  }

  /* ---------- water ---------- */
  splash(amount = 0.5, at = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = at ?? this.t;
    const n = this._noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.14);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * amount + 0.04, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    n.connect(bp).connect(g).connect(this.master); n.start(t); n.stop(t + 0.5);
  }
  /* the "ポチャン" of something dropping in */
  plop(pitch = 420, at = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = at ?? this.t;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 2.1, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.55, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.25);
  }
  bubble() {
    if (!this.ready) return;
    this.plop(700 + Math.random() * 500);
  }

  /* ---------- line tension: a small held note that rises ---------- */
  tensionOn() {
    if (!this.ready || this._tension) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 620;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1240;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const g2 = ctx.createGain(); g2.gain.value = 0.28;
    const vib = ctx.createOscillator(); vib.frequency.value = 6.5;
    const vibG = ctx.createGain(); vibG.gain.value = 9;
    vib.connect(vibG).connect(o.frequency);
    o.connect(g); o2.connect(g2).connect(g); g.connect(this.master);
    o.start(); o2.start(); vib.start();
    g.gain.setTargetAtTime(0.07, t, 0.08);
    this._tension = { g, nodes: [o, o2, vib], o };
  }
  tensionPitch(p) {
    if (!this._tension) return;
    this._tension.o.frequency.setTargetAtTime(560 + p * 340, this.t, 0.1);
  }
  tensionOff() {
    if (!this._tension) return;
    const x = this._tension; this._tension = null;
    x.g.gain.setTargetAtTime(0.0001, this.t, 0.06);
    setTimeout(() => x.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 500);
  }

  /* ---------- little nibbles before the take ---------- */
  nibble() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    for (let i = 0; i < 2; i++) {
      const d = i * 0.09;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 300 - i * 40;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.13, t + d + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1);
      o.connect(g).connect(this.master); o.start(t + d); o.stop(t + d + 0.14);
    }
  }

  /* ---------- the fish comes out of the hole: スポン！ ---------- */
  fishOut() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    this.splash(1.0);
    this.plop(300);
    // rising "スポン" pop
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.3);
    this.sparkle(t + 0.1);
  }

  /* bright little arpeggio reward */
  sparkle(at = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = at ?? this.t;
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      const t = t0 + i * 0.075;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
    });
  }

  /* soft UI blip */
  blip(f = 700) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }
}
