/**
 * Everything is synthesised — no audio files, and nothing starts until the
 * child touches the screen, which is also what iOS requires.
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);

      // Sea wash: filtered noise, slowly breathing.
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = last * 0.96 + w * 0.04;
        d[i] = last * 3.2;
      }
      this.noiseBuf = buf;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.11;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.085;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.055;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      this.ready = true;
    } catch { this.ready = false; }
  }

  _noise(dur, { f0 = 1800, f1 = 300, q = 0.9, gain = 0.3, type = 'bandpass', delay = 0 } = {}) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.10);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  whoosh(power = 1) { this._noise(0.5 + power * 0.2, { f0: 700, f1: 2600, q: 0.7, gain: 0.10 * power, type: 'bandpass' }); }
  splash(power = 1) {
    this._noise(0.16, { f0: 5200, f1: 1400, q: 0.6, gain: 0.26 * power });
    this._noise(0.85, { f0: 1500, f1: 240, q: 0.4, gain: 0.17 * power, delay: 0.03 });
  }
  drip() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }
  haul() { this._noise(0.7, { f0: 900, f1: 2200, q: 1.2, gain: 0.09 }); }
  release() {
    this._noise(0.35, { f0: 2600, f1: 800, q: 0.8, gain: 0.13 });
  }
}
