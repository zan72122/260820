/**
 * すべてWebAudioで合成するサウンド。外部アセットなし。
 * ・環境音（風・湖・ヒーター）は常時。静止時に少し引く。
 * ・「ピクッ」= ごく小さな高域のティック
 * ・「クイッ」= 短い上向きスウィッシュ
 * ・「ウィーン」= 電動リールのモーター。押している間だけ鳴る。
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientGain!: GainNode;
  private motor: {
    osc: OscillatorNode;
    osc2: OscillatorNode;
    noise: AudioBufferSourceNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null = null;
  private muted = false;

  get unlocked() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** 初回タッチで呼ぶ。iOSのオーディオ解錠。 */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private noiseBuffer(seconds: number, brown = false): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buf;
  }

  private startAmbient() {
    const ctx = this.ctx!;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.5;
    this.ambientGain.connect(this.master);

    // 風（ブラウンノイズ + ゆっくり揺れるローパス）
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4, true);
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.16;
    wind.connect(windFilter).connect(windGain).connect(this.ambientGain);
    wind.start();
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 140;
    windLfo.connect(windLfoGain).connect(windFilter.frequency);
    windLfo.start();

    // ヒーターの低い連続音
    const heater = ctx.createOscillator();
    heater.type = 'triangle';
    heater.frequency.value = 58;
    const heaterGain = ctx.createGain();
    heaterGain.gain.value = 0.018;
    heater.connect(heaterGain).connect(this.ambientGain);
    heater.start();
    const hn = ctx.createBufferSource();
    hn.buffer = this.noiseBuffer(2);
    hn.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = 900;
    hf.Q.value = 0.6;
    const hg = ctx.createGain();
    hg.gain.value = 0.012;
    hn.connect(hf).connect(hg).connect(this.ambientGain);
    hn.start();

    // 船縁の水のちゃぷちゃぷ（間欠）
    const lap = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(0.5);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 500 + Math.random() * 400;
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.03, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      src.connect(f).connect(g).connect(this.ambientGain);
      src.start();
      src.stop(t + 0.55);
      window.setTimeout(lap, 2400 + Math.random() * 4200);
    };
    window.setTimeout(lap, 1600);
  }

  /** 静止時に環境音を引く。stillness∈[0,1] */
  setStillness(stillness: number) {
    if (!this.ctx) return;
    const target = 0.5 - 0.28 * stillness;
    this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35);
  }

  /** 誘い。竿を振るごく小さな音＋水中の餌の水押し。 */
  jig() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.1);
    f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    src.stop(t + 0.13);
  }

  /** ピクッ。ごく小さく、しかしはっきり聞こえる高域ティック。 */
  bite() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1350, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(t + 0.1);
  }

  /** クイッ。短い上向きスウィッシュと糸の張り。 */
  hookset() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.25);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.14);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    src.stop(t + 0.25);
    // 糸の張り：短い弦音
    const s = ctx.createOscillator();
    s.type = 'triangle';
    s.frequency.setValueAtTime(340, t + 0.03);
    s.frequency.exponentialRampToValueAtTime(430, t + 0.1);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.035, t + 0.03);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(sg).connect(this.master);
    s.start(t + 0.03);
    s.stop(t + 0.22);
  }

  /** ウィーン開始。押している間だけ。 */
  motorStart() {
    if (!this.ctx || this.motor) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(62, t);
    osc.frequency.linearRampToValueAtTime(118, t + 0.35);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(740, t);
    osc2.frequency.linearRampToValueAtTime(1180, t + 0.4);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(1.2);
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 2000;
    nf.Q.value = 0.8;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.075, t + 0.16);
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    osc.connect(filter);
    osc2.connect(g2).connect(filter);
    noise.connect(nf).connect(ng).connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    osc2.start();
    noise.start();
    this.motor = { osc, osc2, noise, gain, filter };
  }

  motorStop() {
    if (!this.ctx || !this.motor) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const m = this.motor;
    this.motor = null;
    m.osc.frequency.cancelScheduledValues(t);
    m.osc.frequency.setTargetAtTime(48, t, 0.09);
    m.osc2.frequency.setTargetAtTime(520, t, 0.09);
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setTargetAtTime(0.0001, t, 0.08);
    window.setTimeout(() => {
      try {
        m.osc.stop();
        m.osc2.stop();
        m.noise.stop();
      } catch {
        /* already stopped */
      }
    }, 450);
  }

  /** 魚の負荷でモーターの音程がわずかに沈む。load∈[0,1] */
  setMotorLoad(load: number) {
    if (!this.ctx || !this.motor) return;
    const t = this.ctx.currentTime;
    this.motor.osc.frequency.setTargetAtTime(118 - load * 16, t, 0.1);
    this.motor.osc2.frequency.setTargetAtTime(1180 - load * 160, t, 0.1);
  }

  /** 魚が水面を割る小さなスプラッシュ。 */
  splash(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    src.stop(t + 0.55);
  }

  /** バケツへのぽちゃん。 */
  plop() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(t + 0.22);
    this.splash(0.5);
  }

  /** 釣り上げ達成。派手にしない、木琴のような二音。 */
  catchChime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 3.01;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.012, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g).connect(this.master);
      o2.connect(g2).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.75);
      o2.start(t);
      o2.stop(t + 0.3);
    });
  }
}
