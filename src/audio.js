// Everything is synthesised with WebAudio: snow, water, steel, wet ground.
// No audio files, and nothing starts until the child taps (iOS requires that).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function noiseBuffer(ctx, seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;                 // a touch of brown for body
    d[i] = w * 0.7 + last * 3.2;
  }
  return buf;
}

export class Audio {
  constructor() {
    this.ready = false;
    this.enabled = true;
    this.ctx = null;
    this.waterAmount = 0;      // 0..1 target, driven by the camera / lid state
    this._water = null;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.noise = noiseBuffer(ctx, 3);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // gentle room: a short feedback-delay reverb keeps the culvert sounding hollow
    this.wetBus = ctx.createGain();
    this.wetBus.gain.value = 0.32;
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.055;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass'; damp.frequency.value = 2200;
    this.wetBus.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay);
    damp.connect(this.master);

    this._buildWater();
    this._buildWind();
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0.0, this.ctx.currentTime, 0.08);
  }

  // ------------------------------------------------------------ continuous
  _buildWater() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;

    // the sheet of running water: band-passed noise, slowly wandering
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.55;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 420;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200;

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 380;
    lfo.connect(lfoGain); lfoGain.connect(bp.frequency); lfo.start();

    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(g);
    g.connect(this.master); g.connect(this.wetBus);
    src.start();

    // a low rumble underneath so the channel feels like it has volume
    const src2 = ctx.createBufferSource();
    src2.buffer = this.noise; src2.loop = true;
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 260; lp2.Q.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0;
    src2.connect(lp2); lp2.connect(g2); g2.connect(this.master);
    src2.start();

    this._water = { g, g2 };
    this._burbleAt = 0;
  }

  _buildWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.value = 0.02;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.014;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
  }

  /** Called every frame; `amount` 0..1 is how open/close the water is. */
  update(dt, amount) {
    if (!this.ready) return;
    this.waterAmount += (amount - this.waterAmount) * clamp(dt * 2.4, 0, 1);
    const a = this.waterAmount;
    const t = this.ctx.currentTime;
    this._water.g.gain.setTargetAtTime(0.085 * a, t, 0.12);
    this._water.g2.gain.setTargetAtTime(0.05 * a, t, 0.2);

    // sparse burbles so the current never sounds like static
    if (a > 0.25 && t > this._burbleAt) {
      this._burbleAt = t + 0.12 + Math.random() * 0.5;
      this._burble(a);
    }
  }

  _burble(a) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 380 + Math.random() * 900;
    o.frequency.setValueAtTime(f * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02 * a, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.master); g.connect(this.wetBus);
    o.start(t); o.stop(t + 0.12);
  }

  // ------------------------------------------------------------- one-shots
  _noiseHit({ dur = 0.3, type = 'lowpass', f0 = 800, f1 = 300, q = 1, vol = 0.3, wet = 0.2, delay = 0 }) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.wetBus); }
    src.start(t); src.stop(t + dur + 0.05);
  }

  _tone({ f = 220, f2 = null, dur = 0.3, vol = 0.2, type = 'sine', delay = 0, wet = 0.2 }) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.wetBus); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** Steel cover being levered up: scrape, then the heavy GA-KON. */
  lidOpen() {
    this._noiseHit({ dur: 0.22, type: 'bandpass', f0: 2600, f1: 1500, q: 1.4, vol: 0.16, wet: 0.15 });
    this._noiseHit({ dur: 0.5, type: 'lowpass', f0: 420, f1: 90, q: 1.2, vol: 0.5, wet: 0.3, delay: 0.16 });
    this._tone({ f: 96, f2: 54, dur: 0.42, vol: 0.3, type: 'triangle', delay: 0.16 });
    // inharmonic ring of a thick steel plate
    [1180, 1637, 2290].forEach((f, i) =>
      this._tone({ f, f2: f * 0.985, dur: 0.5 - i * 0.1, vol: 0.045 - i * 0.008, type: 'sine', delay: 0.17, wet: 0.4 }));
  }

  /** Cover dropped back into its frame. */
  lidClose() {
    this._noiseHit({ dur: 0.35, type: 'lowpass', f0: 500, f1: 80, q: 1.2, vol: 0.5, wet: 0.28 });
    this._tone({ f: 118, f2: 46, dur: 0.3, vol: 0.32, type: 'triangle' });
    this._tone({ f: 1420, f2: 1390, dur: 0.34, vol: 0.05, type: 'sine', delay: 0.01, wet: 0.4 });
    this._noiseHit({ dur: 0.14, type: 'bandpass', f0: 1900, f1: 1200, q: 2, vol: 0.1, delay: 0.09 });
  }

  /** Scooping powder off the road. */
  scoop() {
    this._noiseHit({ dur: 0.26, type: 'bandpass', f0: 1700, f1: 700, q: 0.8, vol: 0.16, wet: 0.06 });
  }

  /** Soft "bosa" of a snow load leaving the shovel. */
  snowDrop() {
    this._noiseHit({ dur: 0.2, type: 'lowpass', f0: 900, f1: 220, q: 0.9, vol: 0.3, wet: 0.1 });
    this._noiseHit({ dur: 0.34, type: 'bandpass', f0: 500, f1: 180, q: 0.6, vol: 0.16, wet: 0.12, delay: 0.02 });
  }

  /** Snow hitting the current: a wet plop plus the splash. */
  splash() {
    this._tone({ f: 300, f2: 780, dur: 0.14, vol: 0.16, type: 'sine', wet: 0.4 });
    this._noiseHit({ dur: 0.34, type: 'highpass', f0: 900, f1: 2600, q: 0.7, vol: 0.22, wet: 0.45 });
    this._noiseHit({ dur: 0.5, type: 'lowpass', f0: 700, f1: 200, q: 0.8, vol: 0.14, wet: 0.4, delay: 0.02 });
  }

  /** A floating lump losing its edges. */
  crumble(strength = 1) {
    this._noiseHit({ dur: 0.24, type: 'bandpass', f0: 3200, f1: 1500, q: 0.9, vol: 0.05 * strength, wet: 0.5 });
  }

  /** All the snow around one inlet is gone. */
  chime() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._tone({ f, dur: 1.1 - i * 0.12, vol: 0.11, type: 'sine', delay: i * 0.11, wet: 0.5 });
      this._tone({ f: f * 2, dur: 0.5, vol: 0.03, type: 'sine', delay: i * 0.11, wet: 0.5 });
    });
  }

  /** The moment the water first shows itself. */
  reveal() {
    this._tone({ f: 392, dur: 1.3, vol: 0.075, type: 'sine', wet: 0.6 });
    this._tone({ f: 587.33, dur: 1.5, vol: 0.06, type: 'sine', delay: 0.09, wet: 0.6 });
    this._tone({ f: 783.99, dur: 1.7, vol: 0.045, type: 'sine', delay: 0.18, wet: 0.6 });
  }

  tick() {
    this._tone({ f: 880, dur: 0.09, vol: 0.05, type: 'triangle', wet: 0.2 });
  }
}
