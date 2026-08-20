// ---------------------------------------------------------------------------
// 効果音。全部 WebAudio の合成音（音声ファイル 0 個）。
// ゲーム状態と同期させたいので「押す」「ポン」「カラン」「シュワ」を
// 1 本の SE にまとめず、すべて独立したトリガとして持つ。
// ---------------------------------------------------------------------------

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.nodes = {};
  }

  /** iOS Safari はユーザー操作の中でしか開始できない */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    this.master = master;

    this.noise = this._noiseBuffer(2.5);
    this.crackle = this._crackleBuffer(3.0);
    this._startAmbience();
    this._startPourVoice();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0.0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get t() { return this.ctx.currentTime; }

  _noiseBuffer(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 細かい気泡がはじける「シュワ」の芯になるインパルス列 */
  _crackleBuffer(sec) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * sec);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const count = Math.floor(sec * 900);
    for (let k = 0; k < count; k++) {
      const at = Math.floor(Math.random() * (n - 400));
      const f = 2200 + Math.random() * 6500;
      const dur = Math.floor(sr * (0.0008 + Math.random() * 0.0022));
      const amp = 0.12 + Math.random() * 0.5;
      for (let i = 0; i < dur; i++) {
        const e = Math.exp(-i / (dur * 0.32));
        d[at + i] += Math.sin((2 * Math.PI * f * i) / sr) * e * amp;
      }
    }
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
    if (max > 0) for (let i = 0; i < n; i++) d[i] /= max;
    return buf;
  }

  _src(buffer, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer; s.loop = loop;
    return s;
  }

  // --- 常時鳴っているもの -------------------------------------------------

  _startAmbience() {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.0; g.connect(this.master);
    this.ambienceGain = g;

    // 蝉のジリジリ
    const cic = this._src(this.noise, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4100; bp.Q.value = 5.5;
    const cg = ctx.createGain(); cg.gain.value = 0.055;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain); lfoGain.connect(cg.gain);
    cic.connect(bp); bp.connect(cg); cg.connect(g);
    cic.start(); lfo.start();

    // 風・遠景
    const wind = this._src(this.noise, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(lp); lp.connect(wg); wg.connect(g);
    wind.start();

    g.gain.setTargetAtTime(0.55, ctx.currentTime, 1.5);
  }

  /** 注ぐ音は常設のボイスを用意して gain だけ動かす（流量に追従させるため） */
  _startPourVoice() {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master);
    this.pourGain = out;

    const src = this._src(this.noise, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 1.1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    src.connect(bp); bp.connect(lp); lp.connect(out);
    src.start();
    this.pourFilter = bp;

    const bub = this._src(this.crackle, true);
    const bg = ctx.createGain(); bg.gain.value = 0.35;
    bub.connect(bg); bg.connect(out);
    bub.start();
  }

  setPour(level) {
    if (!this.ready) return;
    const v = Math.max(0, Math.min(1, level));
    this.pourGain.gain.setTargetAtTime(v * 0.5, this.t, 0.08);
    this.pourFilter.frequency.setTargetAtTime(700 + v * 900, this.t, 0.1);
  }

  // --- 単発 ---------------------------------------------------------------

  /**
   * 指が押し具を沈めるときの、樹脂とガラスがこすれる微かな音。
   * 単発 SE を連打すると「カチカチ」になってしまうので、
   * 常設のボイスの音量と音色を押し込み量に追従させる。
   */
  setPress(intensity, amount) {
    if (!this.ready) return;
    if (!this.pressGain) {
      const ctx = this.ctx;
      const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master);
      const src = this._src(this.noise, true);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3.2;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      src.connect(bp); bp.connect(hp); hp.connect(out); src.start();
      this.pressGain = out; this.pressFilter = bp;
    }
    const v = Math.max(0, Math.min(1, intensity));
    this.pressGain.gain.setTargetAtTime(v * 0.10, this.t, 0.03);
    this.pressFilter.frequency.setTargetAtTime(1500 + amount * 2400, this.t, 0.05);
  }

  /** 栓が外れる「ポン」。圧が抜ける一瞬。 */
  pon() {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    // 芯（ピッチが落ちる）
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(760, now);
    o.frequency.exponentialRampToValueAtTime(165, now + 0.075);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.55, now + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0006, now + 0.16);
    o.connect(og); og.connect(this.master);
    o.start(now); o.stop(now + 0.2);

    // 瓶の胴鳴り
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(268, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0004, now + 0.26);
    o2.connect(g2); g2.connect(this.master);
    o2.start(now); o2.stop(now + 0.3);

    // 圧の抜けるアタック
    const s = this._src(this.noise);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.12);
    bp.Q.value = 1.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(now, Math.random()); s.stop(now + 0.15);
  }

  /**
   * ビー玉がガラスの内壁を転がっている間の、低い「コロコロ」。
   * 単発の衝突音とは別に、接触したまま転がる速さへ連続的に追従させる。
   * ゆっくり傾けて転がすだけで手応えがあるのは、この音のおかげ。
   */
  setRoll(intensity) {
    if (!this.ready) return;
    if (!this.rollGain) {
      const ctx = this.ctx;
      const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master);
      const src = this._src(this.noise, true);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 780; bp.Q.value = 4.5;
      const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1950; bp2.Q.value = 7;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      src.connect(bp); bp.connect(out);
      src.connect(bp2); bp2.connect(g2); g2.connect(out);
      src.start();
      this.rollGain = out; this.rollFilter = bp;
    }
    const v = Math.max(0, Math.min(1, intensity));
    this.rollGain.gain.setTargetAtTime(v * v * 0.16, this.t, 0.04);
    this.rollFilter.frequency.setTargetAtTime(620 + v * 620, this.t, 0.06);
  }

  /** ガラスにビー玉が当たる「カラン」「コロ」 */
  marble(speed, dull = false) {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    const v = Math.max(0.05, Math.min(1, speed / 0.9));
    const base = (dull ? 900 : 1560) * (0.85 + Math.random() * 0.3);
    const partials = dull ? [1, 2.1] : [1, 2.71, 5.15];
    partials.forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'sine';
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      const amp = (0.20 * v) / (1 + i * 1.4);
      const dur = (dull ? 0.10 : 0.20) / (1 + i * 0.5);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(amp, now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0002, now + dur);
      o.connect(g); g.connect(this.master);
      o.start(now); o.stop(now + dur + 0.02);
    });
    const s = this._src(this.noise);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = dull ? 1200 : 3600; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10 * v, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.03);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(now, Math.random()); s.stop(now + 0.04);
  }

  /** 開栓直後の「シュワワワ」 */
  fizz(strength = 1) {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(0.5 * strength, now + 0.05);
    out.gain.setTargetAtTime(0.0001, now + 0.35, 0.85);
    out.connect(this.master);

    const c = this._src(this.crackle);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    c.connect(hp); hp.connect(out);
    c.start(now); c.stop(now + 3.0);

    const s = this._src(this.noise, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, now);
    bp.frequency.exponentialRampToValueAtTime(2100, now + 2.4);
    bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.30;
    s.connect(bp); bp.connect(g); g.connect(out);
    s.start(now); s.stop(now + 3.0);
  }

  /** 氷が鳴る */
  ice() {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const at = now + k * (0.03 + Math.random() * 0.05);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 1700 + Math.random() * 2600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0002, at + 0.12 + Math.random() * 0.12);
      o.connect(g); g.connect(this.master);
      o.start(at); o.stop(at + 0.3);
    }
    const s = this._src(this.noise);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.0004, now + 0.09);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(now, Math.random()); s.stop(now + 0.1);
  }

  /** 風鈴（たまに） */
  chime() {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    [2350, 3520, 5300].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f * (0.99 + Math.random() * 0.02);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.045 / (1 + i), now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.00015, now + 1.6 - i * 0.35);
      o.connect(g); g.connect(this.master);
      o.start(now); o.stop(now + 1.8);
    });
  }

  /** 氷から新しい瓶を取り出す */
  swap() {
    if (!this.ready) return;
    const now = this.t, ctx = this.ctx;
    const s = this._src(this.noise);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, now);
    bp.frequency.linearRampToValueAtTime(3400, now + 0.5);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.75);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(now, Math.random()); s.stop(now + 0.8);
    this.ice();
  }
}
