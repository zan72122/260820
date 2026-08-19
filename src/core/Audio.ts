/**
 * Everything you hear is synthesised at runtime — no audio files to ship
 * or to stall on a phone connection.  The context is created lazily on
 * the first touch, which is what mobile Safari insists on.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private feedSrc: AudioBufferSourceNode | null = null;
  private feedGain: GainNode | null = null;
  private feedFilter: BiquadFilterNode | null = null;

  private wrapOsc: OscillatorNode | null = null;
  private wrapGain: GainNode | null = null;

  muted = false;
  private started = false;

  /** Must be called from inside a user gesture. */
  unlock() {
    if (this.started) {
      this.ctx?.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);

      // one second of white noise, reused by every grain / rumble
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      this.buildEngine();
      this.buildFeed();
      this.started = true;
      this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  private buildEngine() {
    const ctx = this.ctx!;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 3.4;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;

    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.value = 23;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;

    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(subGain).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master!);
    this.engineOsc.start();
    this.engineSub.start();
  }

  private buildFeed() {
    const ctx = this.ctx!;
    this.feedGain = ctx.createGain();
    this.feedGain.gain.value = 0;
    this.feedFilter = ctx.createBiquadFilter();
    this.feedFilter.type = 'bandpass';
    this.feedFilter.frequency.value = 2600;
    this.feedFilter.Q.value = 0.8;
    this.feedSrc = ctx.createBufferSource();
    this.feedSrc.buffer = this.noiseBuf;
    this.feedSrc.loop = true;
    this.feedSrc.connect(this.feedFilter).connect(this.feedGain).connect(this.master!);
    this.feedSrc.start();
  }

  /** throttle: 0 idle .. 1 working hard */
  engine(throttle: number, load = 0) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.055 + throttle * 0.075, t, 0.14);
    this.engineOsc!.frequency.setTargetAtTime(42 + throttle * 26 + load * 5, t, 0.2);
    this.engineSub!.frequency.setTargetAtTime(21 + throttle * 13, t, 0.2);
    this.engineFilter!.frequency.setTargetAtTime(340 + throttle * 460 + load * 300, t, 0.2);
  }

  /** The dry rustle of stalks being drawn through the header. */
  feed(amount: number) {
    if (!this.ctx || !this.feedGain) return;
    const t = this.ctx.currentTime;
    this.feedGain.gain.setTargetAtTime(Math.min(0.16, amount * 0.16), t, 0.09);
    this.feedFilter!.frequency.setTargetAtTime(1900 + amount * 2400, t, 0.15);
  }

  /** One stalk swallowed. */
  chomp(pitch = 1) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500 * pitch + Math.random() * 1400;
    f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.16);
  }

  wrapping(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.wrapOsc) {
      this.wrapGain = ctx.createGain();
      this.wrapGain.gain.value = 0;
      this.wrapOsc = ctx.createOscillator();
      this.wrapOsc.type = 'triangle';
      this.wrapOsc.frequency.value = 300;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1200;
      this.wrapOsc.connect(f).connect(this.wrapGain).connect(this.master!);
      this.wrapOsc.start();
      this.wrapGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.12);
      // the film reel whirring round
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuf;
      noise.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'highpass';
      nf.frequency.value = 3200;
      const ng = ctx.createGain();
      ng.gain.value = 0.03;
      noise.connect(nf).connect(ng).connect(this.wrapGain!);
      noise.start();
      (this.wrapOsc as any).__noise = noise;
    } else if (!on && this.wrapOsc) {
      const t = ctx.currentTime;
      this.wrapGain!.gain.setTargetAtTime(0, t, 0.09);
      const osc = this.wrapOsc;
      const noise = (osc as any).__noise as AudioBufferSourceNode | undefined;
      setTimeout(() => {
        try { osc.stop(); noise?.stop(); } catch { /* already stopped */ }
      }, 400);
      this.wrapOsc = null;
    }
  }

  /** Wobble the wrap whirr as the arm swings round the bale. */
  wrapPitch(v: number) {
    if (this.wrapOsc && this.ctx) {
      this.wrapOsc.frequency.setTargetAtTime(260 + v * 200, this.ctx.currentTime, 0.06);
    }
  }

  /** Hydraulic tailgate lifting. */
  gate() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 1.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
    g.gain.setValueAtTime(0.05, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    osc.connect(f).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 1.8);
  }

  /** Bale hitting the paddy. */
  thud(strength = 1) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.34);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * strength, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.6);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.22 * strength, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(f).connect(ng).connect(this.master!);
    src.start(t);
    src.stop(t + 0.45);
  }

  /** Continuous rumble of a bale rolling over the ground. */
  rollRumble(amount: number) {
    if (!this.ctx || !this.feedGain) return;
    // reuse the feed bus with a much lower band when nothing is feeding
    if (amount <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.feedGain.gain.setTargetAtTime(Math.min(0.2, amount * 0.2), t, 0.07);
    this.feedFilter!.frequency.setTargetAtTime(180, t, 0.07);
  }

  /** Little reward arpeggio. */
  chime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const base = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = base + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /** Soft click for UI. */
  click() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(760, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}
