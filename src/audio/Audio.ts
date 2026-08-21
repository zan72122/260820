/**
 * Every sound is synthesised: a diesel that idles under everything, the
 * conveyor rattle tied to chain speed, and the dry, quiet sounds of soil and
 * vines. There is no music, and the machine ducks at the moment of inversion
 * so the pods and the falling soil are what you actually hear.
 */
export class GameAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private machineBus?: GainNode;
  private worldBus?: GainNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineOscs: OscillatorNode[] = [];
  private engineLfo?: OscillatorNode;
  private conveyorGain?: GainNode;
  private conveyorLfoGain?: GainNode;
  private conveyorLfo?: OscillatorNode;
  private noiseBuf?: AudioBuffer;
  private lastClod = 0;
  started = false;
  muted = false;

  /** Must be called from a real user gesture on iOS. */
  start() {
    if (this.started) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.started = true;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);

    this.machineBus = ctx.createGain();
    this.machineBus.gain.value = 1;
    this.machineBus.connect(this.master);

    this.worldBus = ctx.createGain();
    this.worldBus.gain.value = 1;
    this.worldBus.connect(this.master);

    // shared white noise
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff - 1) * 0.8;
    }
    this.noiseBuf = buf;

    this.buildEngine();
    this.buildConveyor();
    void ctx.resume();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private buildEngine() {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0.0;
    out.connect(this.machineBus!);
    this.engineGain = out;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 0.9;
    lp.connect(out);
    this.engineFilter = lp;

    // firing rhythm: a slow LFO chopping the body of the sound
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 13.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.55;
    lfo.connect(lfoGain);
    lfo.start();
    this.engineLfo = lfo;

    for (const [f, g, type] of [
      [27, 0.5, 'sawtooth'],
      [40.5, 0.28, 'triangle'],
      [81, 0.12, 'sawtooth'],
    ] as [number, number, OscillatorType][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g2 = ctx.createGain();
      g2.gain.value = g;
      lfoGain.connect(g2.gain);
      o.connect(g2);
      g2.connect(lp);
      o.start();
      this.engineOscs.push(o);
    }

    // combustion rattle
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf!;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.value = 0.1;
    lfoGain.connect(ng.gain);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    n.start();
  }

  private buildConveyor() {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.machineBus!);
    this.conveyorGain = out;

    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf!;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 3.4;
    const chop = ctx.createGain();
    chop.gain.value = 0.0;
    this.conveyorLfoGain = chop;
    n.connect(bp);
    bp.connect(chop);
    chop.connect(out);
    n.start();

    // metallic ring of the rods
    const ring = ctx.createOscillator();
    ring.type = 'square';
    ring.frequency.value = 780;
    const ringBp = ctx.createBiquadFilter();
    ringBp.type = 'bandpass';
    ringBp.frequency.value = 1500;
    ringBp.Q.value = 8;
    const ringGain = ctx.createGain();
    ringGain.gain.value = 0;
    ring.connect(ringBp);
    ringBp.connect(ringGain);
    ringGain.connect(out);
    ring.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 11;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(chop.gain);
    const lg2 = ctx.createGain();
    lg2.gain.value = 0.05;
    lfo.connect(lg2);
    lg2.connect(ringGain.gain);
    lfo.start();
    this.conveyorLfo = lfo;
  }

  /** load 0 = ticking over, 1 = pulling hard through the ridge. */
  setEngine(level: number, load: number) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.32 * level, t, 0.25);
    const rpm = 1 + load * 0.22;
    for (let i = 0; i < this.engineOscs.length; i++) {
      const base = [27, 40.5, 81][i];
      this.engineOscs[i].frequency.setTargetAtTime(base * rpm, t, 0.3);
    }
    if (this.engineLfo) this.engineLfo.frequency.setTargetAtTime(13.5 * rpm, t, 0.3);
    if (this.engineFilter) this.engineFilter.frequency.setTargetAtTime(260 + load * 180, t, 0.3);
  }

  setConveyor(speed: number) {
    if (!this.ctx || !this.conveyorGain) return;
    const t = this.ctx.currentTime;
    this.conveyorGain.gain.setTargetAtTime(0.14 * Math.min(1, speed), t, 0.18);
    if (this.conveyorLfo) this.conveyorLfo.frequency.setTargetAtTime(6 + speed * 13, t, 0.2);
    if (this.conveyorLfoGain) this.conveyorLfoGain.gain.setTargetAtTime(0.02, t, 0.2);
  }

  private burst(opts: {
    freq: number;
    q: number;
    dur: number;
    gain: number;
    type?: BiquadFilterType;
    bus?: GainNode;
    sweepTo?: number;
  }) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    f.Q.value = opts.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + Math.min(0.012, opts.dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus ?? this.worldBus!);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  private tone(freq: number, to: number, dur: number, gain: number, type: OscillatorType = 'sine', bus?: GainNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.worldBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Short whine while the cylinder moves. */
  hydraulic(down: boolean) {
    this.burst({ freq: down ? 1400 : 900, sweepTo: down ? 700 : 1500, q: 6, dur: 0.5, gain: 0.1, bus: this.machineBus });
    this.tone(down ? 320 : 220, down ? 180 : 300, 0.45, 0.05, 'sawtooth', this.machineBus);
  }

  /** The dull, heavy sound of steel going into soil. */
  bladeEnter() {
    this.burst({ freq: 380, sweepTo: 180, q: 1.2, dur: 0.55, gain: 0.34, type: 'lowpass' });
    this.tone(78, 42, 0.5, 0.3);
  }

  clod(size: number, wet: number) {
    const now = performance.now();
    if (now - this.lastClod < 45) return;
    this.lastClod = now;
    const f = 620 / (0.6 + size) + Math.random() * 160;
    this.burst({ freq: f, q: 1.9, dur: 0.09 + size * 0.05, gain: 0.13 + size * 0.06 });
    if (wet > 0.5) this.tone(120, 70, 0.1, 0.05);
  }

  /** Vines and pods coming to rest, soft and low. */
  vineLand() {
    this.burst({ freq: 900, sweepTo: 300, q: 0.9, dur: 0.35, gain: 0.16, type: 'lowpass' });
    this.tone(96, 62, 0.28, 0.09);
  }

  /** Small dry rustle when the crop is shaken. */
  rustle(strength: number) {
    this.burst({ freq: 2600, q: 1.1, dur: 0.16, gain: 0.05 * strength });
  }

  /** Pull the machine down for a moment so the crop can be heard. */
  duckMachine(seconds: number, depth = 0.22) {
    if (!this.ctx || !this.machineBus) return;
    const t = this.ctx.currentTime;
    this.machineBus.gain.cancelScheduledValues(t);
    this.machineBus.gain.setValueAtTime(this.machineBus.gain.value, t);
    this.machineBus.gain.linearRampToValueAtTime(depth, t + 0.12);
    this.machineBus.gain.setValueAtTime(depth, t + seconds);
    this.machineBus.gain.linearRampToValueAtTime(1, t + seconds + 0.7);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
