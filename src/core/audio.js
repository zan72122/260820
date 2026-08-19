// 効果音はすべて WebAudio で合成する(外部アセットなし)。
// iOS は最初のタップまで音が出ないので、unlock() を初回入力で呼ぶ。

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.unlocked = false;
    this.noiseBuf = null;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this._makeNoise(1.2);
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
      this.ambience();
    } catch {
      this.enabled = false;
    }
  }

  _makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03; // ブラウンノイズ寄り = 土っぽい
      d[i] = last * 3.2;
    }
    return buf;
  }

  get ok() {
    return this.enabled && this.unlocked && this.ctx;
  }

  _env(node, t0, a, d, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  /** 土を掘る音 */
  dig(strength = 1) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420 + Math.random() * 380;
    f.Q.value = 0.9;
    src.connect(f);
    this._env(f, t0, 0.02, 0.16 + 0.1 * strength, 0.5 * strength);
    src.start(t0);
    src.stop(t0 + 0.4);
  }

  /** 落ち葉を払う音 */
  leaves(strength = 1) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.8 + Math.random() * 0.8;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2200;
    src.connect(f);
    this._env(f, t0, 0.02, 0.22, 0.35 * strength);
    src.start(t0);
    src.stop(t0 + 0.5);
  }

  /** 根元を切る「サクッ」 */
  cut() {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 2.4;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2600, t0);
    f.frequency.exponentialRampToValueAtTime(700, t0 + 0.16);
    f.Q.value = 2.2;
    src.connect(f);
    this._env(f, t0, 0.008, 0.2, 0.8);
    src.start(t0);
    src.stop(t0 + 0.35);
  }

  /** 抜ける瞬間の「スポン」 */
  pop() {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(760, t0 + 0.09);
    o.frequency.exponentialRampToValueAtTime(300, t0 + 0.22);
    this._env(o, t0, 0.012, 0.28, 0.9);
    o.start(t0);
    o.stop(t0 + 0.4);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.1;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    src.connect(f);
    this._env(f, t0 + 0.02, 0.01, 0.3, 0.4);
    src.start(t0);
    src.stop(t0 + 0.5);
  }

  /** ちいさな正解チャイム */
  chime(base = 660) {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    [1, 1.5, 2].forEach((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base * m;
      this._env(o, t0 + i * 0.07, 0.02, 0.45, 0.22);
      o.start(t0 + i * 0.07);
      o.stop(t0 + i * 0.07 + 0.6);
    });
  }

  /** はずれのときの、やさしい反応 */
  nudge() {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(300, t0 + 0.18);
    this._env(o, t0, 0.02, 0.2, 0.18);
    o.start(t0);
    o.stop(t0 + 0.3);
  }

  /** かごに入れた音 */
  basket() {
    if (!this.ok) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 2.0;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 1.4;
    src.connect(f);
    this._env(f, t0, 0.01, 0.25, 0.45);
    src.start(t0);
    src.stop(t0 + 0.4);
    this.chime(520);
  }

  /** 竹林の環境音(かすかな風) */
  ambience() {
    if (!this.ok) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.35;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 520;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
  }
}
