// 音 -- すべて WebAudio で合成 (外部音源なし)
// ペッタン / 湯気 / 米がまとまる音 / 餅が伸びるねっとり音 / 丸める音
export class Sound {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // 全体を軽く整える
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.004;
    this.master.connect(this.comp).connect(ctx.destination);

    // 残響 (土間の反射)
    this.rev = ctx.createConvolver();
    this.rev.buffer = this._impulse(1.15, 2.6);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.30;
    this.revGain.connect(this.master);
    this.rev.connect(this.revGain);

    this.noiseBuf = this._noise(2.0);
    this._ambient();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  }
  _noise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _impulse(sec, decay) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return b;
  }
  _src(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop; return s;
  }
  get t() { return this.ctx.currentTime; }

  /* ---------- 環境音 ---------- */
  _ambient() {
    const ctx = this.ctx;
    // 冬の風
    const w = this._src(); const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass'; wf.frequency.value = 340; wf.Q.value = 0.9;
    const wg = ctx.createGain(); wg.gain.value = 0.030;
    w.connect(wf).connect(wg).connect(this.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.024;
    lfo.connect(lg).connect(wg.gain); lfo.start();
    w.start();
    this.windGain = wg;

    // 蒸気 (蒸籠)
    const s = this._src(); const sf = ctx.createBiquadFilter();
    sf.type = 'bandpass'; sf.frequency.value = 4200; sf.Q.value = 0.55;
    const sh = ctx.createBiquadFilter(); sh.type = 'highpass'; sh.frequency.value = 1800;
    this.steamGain = ctx.createGain(); this.steamGain.gain.value = 0.020;
    s.connect(sf).connect(sh).connect(this.steamGain).connect(this.master);
    const slfo = ctx.createOscillator(); slfo.frequency.value = 0.23;
    const slg = ctx.createGain(); slg.gain.value = 0.010;
    slfo.connect(slg).connect(this.steamGain.gain); slfo.start();
    s.start();

    // 熾火のはぜる音
    this.fireOn = true;
    const crackle = () => {
      if (!this.ctx) return;
      if (this.fireOn && !this.muted) this._crack();
      setTimeout(crackle, 300 + Math.random() * 1400);
    };
    setTimeout(crackle, 900);
  }
  _crack() {
    const ctx = this.ctx, t = this.t;
    const s = this._src(false);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 2600; f.Q.value = 6;
    const g = ctx.createGain();
    const v = 0.010 + Math.random() * 0.022;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.08);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.2);
  }
  setSteam(level) { if (this.steamGain) this.steamGain.gain.setTargetAtTime(0.014 + level * 0.055, this.t, 0.3); }

  /* ---------- ペッタン ---------- */
  pettan(power = 1, wetness = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = this.t;
    const out = ctx.createGain(); out.gain.value = 1;
    out.connect(this.master); out.connect(this.rev);

    // 1) 臼が鳴る低音
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.62 * power, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(og).connect(out); o.start(t); o.stop(t + 0.4);

    // 2) 木のアタック
    const s = this._src(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.07);
    bp.Q.value = 1.6;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.34 * power * (1 - wetness * 0.45), t + 0.003);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    s.connect(bp).connect(sg).connect(out); s.start(t); s.stop(t + 0.25);

    // 3) 濡れた餅の「ぺた」
    const w = this._src(false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.10);
    lp.Q.value = 3.5;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.linearRampToValueAtTime(0.30 * (0.3 + wetness), t + 0.006);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    w.connect(lp).connect(wg).connect(out); w.start(t); w.stop(t + 0.3);

    // 4) 木のボディ共鳴
    const r = ctx.createOscillator(); r.type = 'sine'; r.frequency.value = 196;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.10 * power, t + 0.008);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    r.connect(rg).connect(out); r.start(t); r.stop(t + 0.55);
  }

  /* ---------- 米粒がまとまる湿った音 ---------- */
  riceSettle(power = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = this.t;
    const n = 14 + Math.floor(power * 12);
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * 0.22;
      const s = this._src(false);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 1400 + Math.random() * 4200; f.Q.value = 7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.068 * power, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
      s.connect(f).connect(g).connect(this.master);
      s.start(t); s.stop(t + 0.12);
    }
  }

  /* ---------- 餅が伸びる (びよーん) ---------- */
  stretchStart() {
    if (!this.ready || this.muted || this.stretchVoice) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 96;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 192;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 7.5;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2.2;
    // ねばりのざらつき
    const nz = this._src(); const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 1.4;
    const ng = ctx.createGain(); ng.gain.value = 0.0;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const g2 = ctx.createGain(); g2.gain.value = 0.30;
    // わずかな揺れ
    const vib = ctx.createOscillator(); vib.frequency.value = 6.2;
    const vibg = ctx.createGain(); vibg.gain.value = 3.2;
    vib.connect(vibg).connect(o.frequency); vib.start();
    o.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(bp).connect(g).connect(this.master);
    g.connect(this.rev);
    nz.connect(nf).connect(ng).connect(g);
    o.start(t); o2.start(t); nz.start(t);
    g.gain.setTargetAtTime(0.0, t, 0.05);
    this.stretchVoice = { o, o2, lp, bp, g, ng, vib, nf };
  }
  stretchUpdate(amount, speed) {
    const v = this.stretchVoice; if (!v) return;
    const t = this.t;
    const f = 82 + amount * 210;
    v.o.frequency.setTargetAtTime(f, t, 0.05);
    v.o2.frequency.setTargetAtTime(f * 2.02, t, 0.05);
    v.lp.frequency.setTargetAtTime(360 + amount * 1500, t, 0.05);
    v.bp.frequency.setTargetAtTime(700 + amount * 1300, t, 0.06);
    v.nf.frequency.setTargetAtTime(900 + amount * 2600, t, 0.06);
    const lvl = Math.min(1, Math.abs(speed) * 1.4) * (0.16 + amount * 0.20);
    v.g.gain.setTargetAtTime(lvl, t, 0.045);
    v.ng.gain.setTargetAtTime(Math.min(1, Math.abs(speed) * 1.2) * 0.055, t, 0.05);
  }
  stretchEnd(snapBack = true) {
    const v = this.stretchVoice; if (!v) return;
    this.stretchVoice = null;
    const t = this.t;
    if (snapBack) {
      v.o.frequency.setTargetAtTime(58, t, 0.07);
      v.lp.frequency.setTargetAtTime(220, t, 0.08);
    }
    v.g.gain.setTargetAtTime(0.0001, t, 0.09);
    setTimeout(() => { try { v.o.stop(); v.o2.stop(); v.vib.stop(); } catch (e) { } }, 700);
    if (snapBack) this.plop();
  }
  plop() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master); o.connect(this.rev);
    o.start(t); o.stop(t + 0.35);
    const s = this._src(false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.20, t + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    s.connect(lp).connect(sg).connect(this.master); s.start(t); s.stop(t + 0.25);
  }

  /* ---------- ちぎる ---------- */
  cut() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = this.t;
    const s = this._src(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    bp.Q.value = 3.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.02);
    g.gain.setValueAtTime(0.20, t + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.4);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.14, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.3);
  }

  /* ---------- 丸める (連続) ---------- */
  rollStart() {
    if (!this.ready || this.muted || this.rollVoice) return;
    const ctx = this.ctx;
    const s = this._src();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3.2;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 240; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    s.connect(lp).connect(bp).connect(g).connect(this.master);
    s.start();
    this.rollVoice = { s, lp, g };
  }
  rollUpdate(speed) {
    const v = this.rollVoice; if (!v) return;
    const t = this.t;
    v.g.gain.setTargetAtTime(Math.min(1, speed) * 0.15, t, 0.06);
    v.lp.frequency.setTargetAtTime(430 + Math.min(1, speed) * 900, t, 0.08);
  }
  rollEnd() {
    const v = this.rollVoice; if (!v) return;
    this.rollVoice = null;
    v.g.gain.setTargetAtTime(0.0001, this.t, 0.08);
    setTimeout(() => { try { v.s.stop(); } catch (e) { } }, 500);
  }

  /* ---------- 小さな合図音 ---------- */
  blip(freq = 660, vol = 0.16, dur = 0.3, type = 'sine') {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); g.connect(this.rev);
    o.start(t); o.stop(t + dur + 0.05);
  }
  chime() {
    if (!this.ready || this.muted) return;
    const base = 523.25;
    [1, 1.5, 2, 3].forEach((r, i) => {
      setTimeout(() => this.blip(base * r, 0.14 - i * 0.02, 1.8 + i * 0.4, 'sine'), i * 110);
    });
    setTimeout(() => this.blip(261.6, 0.10, 2.6, 'sine'), 60);
  }
  pour() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = this.t;
    const s = this._src(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.12);
    g.gain.setValueAtTime(0.16, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t); s.stop(t + 1.6);
    this.riceSettle(1.2);
    setTimeout(() => this.riceSettle(1.0), 380);
    setTimeout(() => this.riceSettle(0.8), 760);
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.t, 0.05);
  }
}
