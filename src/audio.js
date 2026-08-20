/**
 * WebAudio による簡易合成。素材ファイルなしで、
 * ナイアガラの燃える音・号砲・昇りのヒュー・開発のドンを鳴らす。
 * モバイルの自動再生制限があるので、最初のタップで resume する。
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.on = true;
    this.master = null;
    this.noiseBuf = null;
    this.niagara = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      // 2秒のホワイトノイズ
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }
      this.noiseBuf = buf;
      this.ok = true;
    } catch { this.ok = false; }
  }

  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  setEnabled(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  _noise(dur, loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    return src;
  }

  /** 川に落ちる火薬の、絶え間ない「ざぁぁ」 */
  startNiagara() {
    if (!this.ok || this.niagara) return;
    const c = this.ctx;
    const src = this._noise(0, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.55;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.niagara = { src, g, bp };
  }
  setNiagara(level) {
    if (!this.niagara) return;
    this.niagara.g.gain.setTargetAtTime(Math.max(0, level) * 0.30, this.t, 0.18);
    this.niagara.bp.frequency.setTargetAtTime(1100 + level * 900, this.t, 0.3);
  }
  stopNiagara() {
    if (!this.niagara) return;
    const n = this.niagara; this.niagara = null;
    try { n.g.gain.setTargetAtTime(0, this.t, 0.5); n.src.stop(this.t + 3); } catch {}
  }

  /** 打ち上げ前の号砲＋サイレン。視線を上へ引っ張るための合図 */
  cue() {
    if (!this.ok) return;
    const c = this.ctx, t = this.t;
    // 号砲
    this.boom(0.55, 0.9, 70);
    // サイレン（ゆっくり上がって下がる）
    const o = c.createOscillator(); o.type = 'sawtooth';
    const g = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    o.frequency.setValueAtTime(330, t + 0.15);
    o.frequency.linearRampToValueAtTime(560, t + 1.5);
    o.frequency.linearRampToValueAtTime(330, t + 3.0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.4);
    g.gain.setValueAtTime(0.055, t + 2.4);
    g.gain.linearRampToValueAtTime(0, t + 3.3);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t + 0.1); o.stop(t + 3.4);
  }

  boom(amp = 1, dur = 1.6, freq = 46) {
    if (!this.ok) return;
    const c = this.ctx, t = this.t;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.4, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(18, freq * 0.55), t + dur * 0.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** ヒュ〜ッと昇る音 */
  rise(dur) {
    if (!this.ok) return;
    const c = this.ctx, t = this.t;
    this.boom(0.5, 0.35, 60);
    const src = this._noise(dur, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1500, t + dur * 0.75);
    bp.frequency.linearRampToValueAtTime(1150, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.25);
    g.gain.setValueAtTime(0.13, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  /** 正三尺玉の開発。腹に来る低音＋長い残響＋芯のパチパチ */
  burst(delay = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = this.t + delay;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.5);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.95, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 2.7);

    const src = this._noise(3, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 2.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 2.5);

    // 芯のパチパチ
    for (let i = 0; i < 22; i++) {
      const tt = t + 0.25 + Math.random() * 1.9;
      const s2 = this._noise(0.05);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, tt);
      g2.gain.exponentialRampToValueAtTime(0.05, tt + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
      s2.connect(hp); hp.connect(g2); g2.connect(this.master);
      s2.start(tt); s2.stop(tt + 0.12);
    }
  }
}
