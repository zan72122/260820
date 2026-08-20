// Everything you hear is synthesised here -- no audio files to download.
//
// The shaving sound is deliberately two layers, not one loop with the rate
// changed: a soft low "zaa" that dominates when the handle turns slowly, and a
// fine bright "shari-shari" that takes over when it turns fast. Crossfading the
// two tracks the hand far better than pitch-shifting one ever does.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function noiseBuffer(ctx, seconds, kind) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else if (kind === 'pink') { last = 0.96 * last + 0.04 * w; d[i] = (w * 0.4 + last * 1.6); }
    else d[i] = w;
  }
  return buf;
}

export class Audio {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.muted = false;
  }

  async unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }

    this.white = noiseBuffer(ctx, 2.0, 'white');
    this.brown = noiseBuffer(ctx, 2.0, 'brown');
    this.pink = noiseBuffer(ctx, 2.5, 'pink');

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 26; comp.ratio.value = 3.6;
    comp.attack.value = 0.006; comp.release.value = 0.22;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.4);

    this._ambience();
    this._machine();
    this._shaving();
    this._syrup();
    this.ready = true;
  }

  _loop(buffer, dest, gain = 1, rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = true; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(dest); src.start();
    return { src, gain: g };
  }

  // ---------------------------------------------------------------- ambience
  _ambience() {
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(this.master);
    this.ambienceBus = bus;

    // hot air: a very low, very quiet bed
    const w = this._loop(this.brown, bus, 0.055);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    w.gain.disconnect(); w.gain.connect(lp); lp.connect(bus);
    const windLfo = ctx.createOscillator(); windLfo.frequency.value = 0.07;
    const windAmt = ctx.createGain(); windAmt.gain.value = 0.03;
    windLfo.connect(windAmt); windAmt.connect(w.gain.gain); windLfo.start();

    // cicadas: band-passed noise chopped fast, two voices slightly apart
    this.cicadas = [];
    const voices = [
      { f: 4700, q: 5.5, buzz: 46, pan: -0.55, lvl: 0.055, sway: 0.11 },
      { f: 6100, q: 7.0, buzz: 63, pan: 0.62, lvl: 0.038, sway: 0.077 },
      { f: 3600, q: 4.0, buzz: 38, pan: 0.15, lvl: 0.026, sway: 0.05 },
    ];
    for (const v of voices) {
      const src = ctx.createBufferSource();
      src.buffer = this.white; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = v.f; bp.Q.value = v.q;
      const chop = ctx.createGain(); chop.gain.value = 0.0;
      const lvl = ctx.createGain(); lvl.gain.value = v.lvl;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(bp); bp.connect(chop); chop.connect(lvl);
      if (pan) { pan.pan.value = v.pan; lvl.connect(pan); pan.connect(bus); } else lvl.connect(bus);

      const buzz = ctx.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = v.buzz;
      const buzzAmt = ctx.createGain(); buzzAmt.gain.value = 0.5;
      buzz.connect(buzzAmt); buzzAmt.connect(chop.gain);
      const bias = ctx.createConstantSource(); bias.offset.value = 0.5;
      bias.connect(chop.gain);
      // long swell so the chorus breathes instead of droning
      const sway = ctx.createOscillator(); sway.frequency.value = v.sway;
      const swayAmt = ctx.createGain(); swayAmt.gain.value = v.lvl * 0.8;
      sway.connect(swayAmt); swayAmt.connect(lvl.gain);
      src.start(); buzz.start(); sway.start();
      this.cicadas.push({ lvl, bp });
    }
  }

  // ----------------------------------------------------------------- machine
  _machine() {
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(this.master);
    this.mechBus = bus;

    const src = ctx.createBufferSource(); src.buffer = this.brown; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 135; bp.Q.value = 1.1;
    const g = ctx.createGain(); g.gain.value = 0.0;
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start();
    this.rumble = { g, bp };

    // the whir of the gear teeth: a soft resonant tone that rises with speed
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 60;
    const og = ctx.createGain(); og.gain.value = 0;
    const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 900;
    osc.connect(og); og.connect(olp); olp.connect(bus); osc.start();
    this.whir = { osc, g: og };
  }

  _shaving() {
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 1.0; bus.connect(this.master);
    this.shaveBus = bus;

    const lowSrc = ctx.createBufferSource(); lowSrc.buffer = this.pink; lowSrc.loop = true;
    const lowBp = ctx.createBiquadFilter(); lowBp.type = 'bandpass'; lowBp.frequency.value = 640; lowBp.Q.value = 0.8;
    const lowG = ctx.createGain(); lowG.gain.value = 0;
    lowSrc.connect(lowBp); lowBp.connect(lowG); lowG.connect(bus); lowSrc.start();

    const hiSrc = ctx.createBufferSource(); hiSrc.buffer = this.white; hiSrc.loop = true;
    const hiHp = ctx.createBiquadFilter(); hiHp.type = 'highpass'; hiHp.frequency.value = 3400;
    const hiBp = ctx.createBiquadFilter(); hiBp.type = 'bandpass'; hiBp.frequency.value = 7200; hiBp.Q.value = 0.5;
    const hiG = ctx.createGain(); hiG.gain.value = 0;
    hiSrc.connect(hiHp); hiHp.connect(hiBp); hiBp.connect(hiG); hiG.connect(bus); hiSrc.start();

    this.shaveLow = { g: lowG, f: lowBp };
    this.shaveHigh = { g: hiG, f: hiBp };

    // snow settling in the bowl: a whisper that follows how much is falling
    const fallSrc = ctx.createBufferSource(); fallSrc.buffer = this.white; fallSrc.loop = true;
    const fallHp = ctx.createBiquadFilter(); fallHp.type = 'highpass'; fallHp.frequency.value = 5200;
    const fallG = ctx.createGain(); fallG.gain.value = 0;
    fallSrc.connect(fallHp); fallHp.connect(fallG); fallG.connect(bus); fallSrc.start();
    this.fall = { g: fallG };
  }

  _syrup() {
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 1.0; bus.connect(this.master);
    this.syrupBus = bus;
    const src = ctx.createBufferSource(); src.buffer = this.white; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5.5;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(bus); src.start();
    // a thin liquid line wobbles; a steady one sounds like a hiss
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.4;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 420;
    lfo.connect(lfoAmt); lfoAmt.connect(bp.frequency); lfo.start();
    this.syrupNode = { g, bp };
  }

  // ------------------------------------------------------------------ frame
  /**
   * @param speed  |crank angular velocity| in rad/s
   * @param shave  0..1 how hard the blade is cutting right now
   * @param fall   0..1 how much snow is in the air
   */
  setMachine(speed, shave, fall) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const s = clamp(speed / 9, 0, 1.3);
    const set = (p, v, tc = 0.05) => p.setTargetAtTime(v, t, tc);

    set(this.rumble.g.gain, s > 0.02 ? 0.11 + s * 0.20 : 0.0, 0.06);
    this.rumble.bp.frequency.setTargetAtTime(115 + s * 95, t, 0.08);
    set(this.whir.g.gain, s * 0.035, 0.07);
    this.whir.osc.frequency.setTargetAtTime(52 + s * 150, t, 0.06);

    const sh = clamp(shave, 0, 1);
    // slow = broad and soft, fast = fine and bright
    set(this.shaveLow.g.gain, sh * (0.30 - s * 0.14), 0.035);
    set(this.shaveHigh.g.gain, sh * (0.035 + s * 0.20), 0.035);
    this.shaveLow.f.frequency.setTargetAtTime(520 + s * 420, t, 0.09);
    this.shaveHigh.f.frequency.setTargetAtTime(6200 + s * 2600, t, 0.09);
    set(this.fall.g.gain, clamp(fall, 0, 1) * 0.055, 0.10);
  }

  setSyrup(flow) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.syrupNode.g.gain.setTargetAtTime(clamp(flow, 0, 1) * 0.10, t, 0.04);
    this.syrupNode.bp.Q.setTargetAtTime(4 + (1 - clamp(flow, 0, 1)) * 5, t, 0.1);
  }

  // ------------------------------------------------------------- transients
  _burst({ buffer, freq, q, type = 'bandpass', dur = 0.06, gain = 0.2, bus }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // a fast crank can ask for a click every few milliseconds; don't build a
    // node graph faster than the ear can tell the clicks apart
    if (t - (this._lastBurst || 0) < 0.022) return;
    this._lastBurst = t;
    const src = ctx.createBufferSource();
    src.buffer = buffer || this.white;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || this.mechBus);
    src.start(t, Math.random() * 1.2);
    src.stop(t + dur + 0.02);
  }

  tick(strength = 1) {
    this._burst({ freq: 1500 + Math.random() * 500, q: 7, dur: 0.045, gain: 0.075 * strength });
    this._burst({ freq: 320, q: 4, dur: 0.07, gain: 0.045 * strength });
  }

  clunk() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this._burst({ freq: 190, q: 5, dur: 0.16, gain: 0.24 });
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(72, t + 0.14);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.mechBus); o.start(t); o.stop(t + 0.25);
  }

  firstFlake() {
    this._burst({ freq: 5200, q: 1.2, dur: 0.20, gain: 0.15, bus: this.shaveBus });
    this._burst({ freq: 900, q: 1.0, dur: 0.13, gain: 0.09, bus: this.shaveBus });
  }

  sprinkle() {
    this._burst({ freq: 7000 + Math.random() * 3000, q: 0.9, dur: 0.05, gain: 0.028, bus: this.shaveBus });
  }

  plip() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const f0 = 700 + Math.random() * 500;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.syrupBus); o.start(t); o.stop(t + 0.1);
  }

  chime() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [1318.5, 1975.5, 2637].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.015);
      g.gain.linearRampToValueAtTime(0.075 / (i + 1), t + i * 0.015 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5 + i * 0.2);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.015); o.stop(t + 2.0);
    });
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
