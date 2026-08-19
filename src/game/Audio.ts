/**
 * Everything is synthesised — no assets to download and nothing to fail on a
 * flaky mobile connection. The pull sound is the one that matters most.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private started = false;
  private ready = false;
  muted = false;

  /** Must be called from inside a user gesture on iOS. */
  start(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    // one shared noise buffer for every grit/air sound
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2 + w * 0.35;
    }
    this.noiseBuf = buf;

    this.buildEngine();
    this.ready = true;
    void this.ctx.resume();
  }

  private buildEngine() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.9;
    g.connect(lp).connect(this.master);
    this.engineGain = g;

    for (const [f, amp, type] of [
      [43, 0.5, 'sawtooth'],
      [86, 0.24, 'sawtooth'],
      [129, 0.1, 'triangle'],
    ] as Array<[number, number, OscillatorType]>) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      // gentle wow so it never sounds like a held synth note
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 3.1 + f / 200;
      const lg = ctx.createGain();
      lg.gain.value = f * 0.012;
      lfo.connect(lg).connect(o.frequency);
      o.start();
      lfo.start();
    }

    // rubber belt hiss
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.16;
    src.connect(bp).connect(ng).connect(g);
    src.start();
  }

  setEngine(level: number) {
    if (!this.ctx || !this.ready) return;
    this.engineGain.gain.setTargetAtTime(level * 0.16, this.ctx.currentTime, 0.18);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.ready) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  private noise(dur: number): AudioBufferSourceNode | null {
    if (!this.ctx || !this.ready || !this.noiseBuf) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.9 + Math.random() * 0.35;
    s.start(this.ctx.currentTime, Math.random() * 0.4, dur);
    return s;
  }

  private env(node: AudioNode, peak: number, attack: number, decay: number, delay = 0): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    return g;
  }

  /** Rubber taking hold of the leaves. */
  grip() {
    if (!this.ctx || !this.ready) return;
    const n = this.noise(0.14);
    if (!n) return;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, this.ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.13);
    bp.Q.value = 1.3;
    n.connect(bp);
    this.env(bp, 0.16, 0.012, 0.14).connect(this.master);
  }

  /** The one that has to feel good: スポンッ. */
  pop(variation = 0) {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const k = 1 + (Math.random() - 0.5) * 0.16 + variation * 0.02;

    // hollow body of the sound: a fast downward glide
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(600 * k, t);
    o.frequency.exponentialRampToValueAtTime(132 * k, t + 0.115);
    const og = this.env(o, 0.5, 0.005, 0.19);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    og.connect(lp).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);

    // the wet suck of soil letting go
    const n = this.noise(0.26);
    if (n) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400 * k, t);
      bp.frequency.exponentialRampToValueAtTime(320, t + 0.2);
      bp.Q.value = 1.1;
      n.connect(bp);
      this.env(bp, 0.3, 0.006, 0.24).connect(this.master);
    }

    // a bright tick right on the release so it reads as a snap, not a whoosh
    const c = ctx.createOscillator();
    c.type = 'sine';
    c.frequency.setValueAtTime(2100 * k, t);
    c.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    this.env(c, 0.12, 0.002, 0.05).connect(this.master);
    c.start(t);
    c.stop(t + 0.1);
  }

  /** Rotary knife through the neck. */
  cut() {
    if (!this.ctx || !this.ready) return;
    const n = this.noise(0.09);
    if (!n) return;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4200, this.ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.07);
    bp.Q.value = 2.4;
    n.connect(bp);
    this.env(bp, 0.2, 0.004, 0.08).connect(this.master);
  }

  /** A root landing on the pile. */
  thud() {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(210 + Math.random() * 60, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    this.env(o, 0.3, 0.004, 0.13).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
    const n = this.noise(0.1);
    if (n) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      n.connect(lp);
      this.env(lp, 0.12, 0.004, 0.1).connect(this.master);
    }
  }

  /** Hydraulics dropping the head into the ridge. */
  clunk() {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx;
    const n = this.noise(0.35);
    if (n) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);
      n.connect(lp);
      this.env(lp, 0.14, 0.02, 0.34).connect(this.master);
    }
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, ctx.currentTime + 0.26);
    o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.42);
    this.env(o, 0.34, 0.006, 0.18, 0.26).connect(this.master);
    o.start(ctx.currentTime + 0.26);
    o.stop(ctx.currentTime + 0.6);
  }

  /** End of a row. */
  chime() {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx;
    [0, 0.13, 0.26].forEach((d, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = [523.25, 659.25, 783.99][i];
      const g = this.env(o, 0.16, 0.02, 0.55, d);
      g.connect(this.master);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.8);
    });
  }
}
