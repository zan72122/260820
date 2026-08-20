// すべて WebAudio による自前合成。既存の楽曲・音源は一切使っていない。
// 狙いは「復興祈願の象徴としての高揚」であって、特定の曲の再現ではない。
import { clamp, lerp } from './util.js';

const BPM = 92;
const BEAT = 60 / BPM;
// ヨナ抜き（ペンタトニック）D E F# A B ― この章のための簡素なオリジナル動機
const SCALE = [0, 2, 4, 7, 9];
const ROOT = 146.83; // D3
const MOTIF = [0, 2, 4, 3, 2, 0, 1, 2];      // 上がっていく素朴な旋律
const COUNTER = [4, 3, 2, 4, 5, 4, 3, 2];    // フィナーレで重ねる対旋律

const midi = (semi) => ROOT * Math.pow(2, semi / 12);
const deg = (d) => {
  const oct = Math.floor(d / SCALE.length);
  return midi(SCALE[((d % SCALE.length) + SCALE.length) % SCALE.length] + oct * 12);
};

export class Audio {
  constructor() {
    this.ok = false; this.muted = false; this.ctx = null;
    this.intensity = 0; this._wantIntensity = 0;
    this.beat = 0; this.nextTime = 0; this.started = false;
    this.finaleMode = false;
  }

  init() {
    if (this.ctx) return this.ok;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    const c = this.ctx;

    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 22;
    this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.24;
    this.master.connect(this.comp).connect(c.destination);

    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.95; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.0; this.ambBus.connect(this.master);

    // 屋外の広がり（河川敷の反射）
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(2.6, 2.2);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.42;
    this.verb.connect(this.verbGain).connect(this.master);

    this.noise = this._noiseBuffer(2.0);
    this._startAmbience();
    this.ok = true;
    return true;
  }

  _noiseBuffer(sec) {
    const c = this.ctx, n = (c.sampleRate * sec) | 0;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.7 + last * 3.2; }
    return b;
  }
  _impulse(sec, decay) {
    const c = this.ctx, n = (c.sampleRate * sec) | 0;
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  _pan(x) { // x: -1..1
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) p.pan.value = clamp(x, -1, 1);
    return p;
  }
  _to(node, dest, wet = 0) {
    node.connect(dest);
    if (wet > 0) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(this.verb); }
  }

  // --- 環境音：観客のざわめきと川の音 ---
  _startAmbience() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const g = c.createGain(); g.gain.value = 0.055;
    src.connect(bp).connect(lp).connect(g).connect(this.ambBus);
    src.start();
    // ゆっくりしたうねり（人のざわめき）
    const lfo = c.createOscillator(); lfo.frequency.value = 0.11;
    const lg = c.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain); lfo.start();
    this.ambBus.gain.setTargetAtTime(0.85, c.currentTime, 1.2);
  }

  // --- 打上げの音 ---
  whoosh(pan = 0) {
    if (!this.ok || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 1.4;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3.2;
    f.frequency.setValueAtTime(340, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.75);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.10);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    let tail = g;
    const p = this._pan(pan); if (p) { g.connect(p); tail = p; }
    s.connect(f).connect(g);
    this._to(tail, this.sfxBus, 0.18);
    s.start(t); s.stop(t + 0.95);
  }

  // --- 開花の音（距離ぶんだけ遅れて届く） ---
  boom(size = 1, pan = 0, dist = 0) {
    if (!this.ok || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + clamp(dist, 0, 1) * 0.42;
    const dur = 0.6 + size * 0.7;

    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.55 + Math.random() * 0.2;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100 + 700 * size, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.44 * clamp(size, .3, 1.6), t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail = g;
    const p = this._pan(pan); if (p) { g.connect(p); tail = p; }
    s.connect(lp).connect(g);
    this._to(tail, this.sfxBus, 0.5);
    s.start(t); s.stop(t + dur + 0.1);

    // 腹に響く低域
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(88 * (1 / clamp(size, .6, 1.4)), t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.42);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.40 * clamp(size, .4, 1.5), t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    o.connect(og).connect(this.sfxBus);
    o.start(t); o.stop(t + 0.7);
  }

  crackle(pan = 0, amount = 1) {
    if (!this.ok || this.muted) return;
    const c = this.ctx, t = c.currentTime + 0.12;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 2.4;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * amount, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    let tail = g; const p = this._pan(pan); if (p) { g.connect(p); tail = p; }
    s.connect(hp).connect(g); this._to(tail, this.sfxBus, 0.25);
    s.start(t); s.stop(t + 1.0);
  }

  cheer(amount = 1) {
    if (!this.ok || this.muted) return;
    const c = this.ctx, t = c.currentTime + 0.35;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * amount, t + 0.5);
    g.gain.setTargetAtTime(0.0001, t + 1.4, 0.9);
    s.connect(bp).connect(g); this._to(g, this.sfxBus, 0.4);
    s.start(t); s.stop(t + 5.2);
  }

  // --- 楽曲（オリジナル） ---
  setIntensity(v) { this._wantIntensity = clamp(v, 0, 1); }
  startMusic() {
    if (!this.ok || this.started) return;
    this.started = true;
    this.nextTime = this.ctx.currentTime + 0.15;
    this.beat = 0;
    this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.5);
    this._pad();
  }
  setFinale(on) { this.finaleMode = on; }

  _pad() {
    const c = this.ctx, t = c.currentTime;
    this.padGain = c.createGain(); this.padGain.gain.value = 0.0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
    this.padFilter = f;
    [0, 0.03, -0.04].forEach((det, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'sine' : 'triangle';
      o.frequency.value = deg(0) * (i === 2 ? 0.5 : 1) * Math.pow(2, det / 12);
      const g = c.createGain(); g.gain.value = i === 2 ? 0.5 : 0.26;
      o.connect(g).connect(f); o.start(t);
    });
    const o5 = c.createOscillator(); o5.type = 'triangle'; o5.frequency.value = deg(3);
    const g5 = c.createGain(); g5.gain.value = 0.14;
    o5.connect(g5).connect(f); o5.start(t);
    f.connect(this.padGain); this.padGain.connect(this.musicBus);
    const vg = c.createGain(); vg.gain.value = 0.7; this.padGain.connect(vg).connect(this.verb);
  }

  _note(freq, time, dur, gain, type = 'triangle', wet = 0.55) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.002;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const g2 = c.createGain(); g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.musicBus);
    const w = c.createGain(); w.gain.value = wet; g.connect(w).connect(this.verb);
    o.start(time); o.stop(time + dur + 0.05);
    o2.start(time); o2.stop(time + dur + 0.05);
  }

  _taiko(time, gain) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, time);
    o.frequency.exponentialRampToValueAtTime(48, time + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    o.connect(g).connect(this.musicBus);
    o.start(time); o.stop(time + 0.5);

    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.1;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 280; bp.Q.value = 1.1;
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.0001, time);
    sg.gain.exponentialRampToValueAtTime(gain * 0.5, time + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    s.connect(bp).connect(sg).connect(this.musicBus);
    const w = c.createGain(); w.gain.value = 0.5; sg.connect(w).connect(this.verb);
    s.start(time); s.stop(time + 0.3);
  }

  tick() {
    if (!this.ok || !this.started || this.muted) return;
    const c = this.ctx;
    this.intensity = lerp(this.intensity, this._wantIntensity, 0.02);
    const I = this.intensity;
    if (this.padGain) this.padGain.gain.setTargetAtTime(0.10 + I * 0.16, c.currentTime, 0.6);
    if (this.padFilter) this.padFilter.frequency.setTargetAtTime(520 + I * 1500, c.currentTime, 0.8);

    const F = this.finaleMode;
    const lookahead = 0.35;
    let guard = 0;
    while (this.nextTime < c.currentTime + lookahead && guard++ < 32) {
      const b = this.beat, t = this.nextTime;
      const bar = Math.floor(b / 8), step = b % 8;

      // 太鼓：進むほど密に
      if (I > 0.12) {
        if (step % 4 === 0) this._taiko(t, 0.34 + I * 0.24);
        else if (I > 0.5 && step % 2 === 0) this._taiko(t, 0.14 + I * 0.12);
        if (F && step === 7) { this._taiko(t + BEAT * 0.5, 0.3); }
      }
      // 旋律：中盤から
      if (I > 0.28) {
        const d = MOTIF[step] + 7;
        this._note(deg(d), t, BEAT * (F ? 1.5 : 1.15), 0.10 + I * 0.10, 'triangle');
        if (I > 0.6) this._note(deg(d + 5), t + BEAT * 0.5, BEAT * 0.7, 0.045 + I * 0.05, 'sine');
      }
      // フィナーレ：対旋律とオクターブ重ね
      if (F) {
        const d2 = COUNTER[step] + 7;
        this._note(deg(d2 + 5), t, BEAT * 1.8, 0.075, 'sine', 0.8);
        if (step % 2 === 0) this._note(deg(MOTIF[step] + 12), t, BEAT * 1.2, 0.055, 'triangle', 0.9);
      }
      // 低音の支え
      if (step === 0 || step === 4) {
        this._note(deg(0) * 0.5, t, BEAT * 2.4, 0.10 + I * 0.06, 'sine', 0.3);
      }

      this.beat++;
      this.nextTime += BEAT;
    }
  }
}
