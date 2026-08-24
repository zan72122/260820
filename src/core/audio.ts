/**
 * Procedural sound engine — every sound is synthesised (no audio assets).
 * Sound is treated as part of weight perception: relays, motor spin-up,
 * reducer hum, trolleys rolling on ground rails, steel creaks, the lock
 * cylinder seating on the bed plate, and rubber tires on concrete.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private enabled: boolean;
  private noiseBuf!: AudioBuffer;

  // continuous layers
  private motorOsc!: OscillatorNode;
  private motorOsc2!: OscillatorNode;
  private motorGain!: GainNode;
  private motorFilter!: BiquadFilterNode;
  private rollSrc!: AudioBufferSourceNode;
  private rollGain!: GainNode;
  private rollFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private trainSrc!: AudioBufferSourceNode;
  private trainGain!: GainNode;
  private trainFilter!: BiquadFilterNode;
  private trainPan!: StereoPannerNode;

  private creakTimer = 0;
  private birdTimer = 4;
  private motorLevel = 0;
  private rollLevel = 0;

  constructor(enabled: boolean) {
    this.enabled = enabled && typeof AudioContext !== 'undefined';
  }

  /** must be called from a user gesture */
  unlock(): void {
    if (!this.enabled || this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.62;
    this.master.connect(ctx.destination);

    // shared noise buffer (2s white)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff) - 1;
    }
    this.noiseBuf = buf;

    // ambient wind
    const wind = this.loopNoise(420, 'lowpass');
    this.windGain = wind.gain;
    wind.gain.gain.value = 0.045;

    // motor + reducer hum (silent until commanded)
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.value = 500;
    this.motorOsc = ctx.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.value = 30;
    this.motorOsc2 = ctx.createOscillator();
    this.motorOsc2.type = 'triangle';
    this.motorOsc2.frequency.value = 60;
    const mg2 = ctx.createGain(); mg2.gain.value = 0.5;
    this.motorOsc.connect(this.motorFilter);
    this.motorOsc2.connect(mg2).connect(this.motorFilter);
    this.motorFilter.connect(this.motorGain).connect(this.master);
    this.motorOsc.start(); this.motorOsc2.start();

    // trolleys rolling on ground rails
    const roll = this.loopNoise(160, 'lowpass');
    this.rollGain = roll.gain;
    this.rollFilter = roll.filter;
    roll.gain.gain.value = 0;

    // train tire rumble
    const train = this.loopNoise(300, 'bandpass');
    this.trainGain = train.gain;
    this.trainFilter = train.filter;
    train.gain.gain.value = 0;
    this.trainPan = ctx.createStereoPanner();
    train.gain.disconnect();
    train.gain.connect(this.trainPan).connect(this.master);
  }

  private loopNoise(freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    return { src, filter, gain };
  }

  private env(peak: number, attack: number, decay: number): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  private blip(freq: number, peak: number, attack: number, decay: number, type: OscillatorType = 'sine'): void {
    if (!this.ctx) return;
    const g = this.env(peak, attack, decay);
    if (!g) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    o.start();
    o.stop(this.ctx.currentTime + attack + decay + 0.05);
  }

  private thud(freqs: number[], peak: number, decay: number, noise = 0.5, noiseFreq = 900): void {
    if (!this.ctx) return;
    for (const f of freqs) this.blip(f, peak * (freqs[0] / f) * 0.6, 0.004, decay);
    // metallic noise burst
    const g = this.env(peak * noise, 0.002, decay * 0.5);
    if (!g) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = noiseFreq;
    bp.Q.value = 1.2;
    src.connect(bp).connect(g);
    src.start(0, Math.random() * 1.5);
    src.stop(this.ctx.currentTime + decay + 0.05);
  }

  // ---- one-shots ----------------------------------------------------------
  leverDetent(): void { this.thud([210], 0.16, 0.08, 0.9, 2400); }
  leverResist(): void { this.blip(140, 0.05, 0.01, 0.05); }
  relayClick(): void { this.thud([320], 0.22, 0.05, 1.2, 3200); }
  contactor(): void { this.thud([180, 240], 0.3, 0.09, 1.0, 2100); }
  unlockHiss(): void {
    if (!this.ctx) return;
    const g = this.env(0.14, 0.05, 0.5);
    if (!g) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    src.connect(hp).connect(g);
    src.start(0, 0.3);
    src.stop(this.ctx.currentTime + 0.7);
    this.thud([95], 0.2, 0.16, 0.4, 700);
  }
  /** the カコン — lock cylinder seating on the bed plate */
  lockSeat(): void {
    this.thud([64, 96], 0.55, 0.34, 0.8, 620);
    setTimeout(() => this.thud([88, 132, 810, 1230], 0.34, 0.5, 0.5, 1500), 105);
  }
  signalClick(): void { this.thud([420], 0.12, 0.04, 1.0, 3600); }
  buttonClick(): void { this.thud([260], 0.1, 0.05, 1.0, 2800); }
  creak(): void {
    this.blip(320 + Math.random() * 500, 0.045, 0.02, 0.3, 'triangle');
  }
  hintTap(): void { this.thud([500], 0.05, 0.05, 0.9, 2600); }

  /** short musical afterglow after the first successful pass */
  afterglow(): void {
    if (!this.ctx) return;
    const notes = [523.25, 659.26, 783.99]; // C5 E5 G5
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.blip(f, 0.1, 0.01, 1.6, 'sine');
        this.blip(f * 2, 0.03, 0.01, 1.0, 'sine');
      }, i * 240);
    });
  }

  // ---- continuous levels --------------------------------------------------
  setMotor(level: number): void { this.motorLevel = level; }
  setRoll(level: number): void { this.rollLevel = level; }

  /** train rumble: level 0..1, pan -1..1, speed 0..1 */
  trainRumble(level: number, pan: number, speed: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.trainGain.gain.setTargetAtTime(level * 0.5, t, 0.1);
    this.trainPan.pan.setTargetAtTime(pan, t, 0.1);
    this.trainFilter.frequency.setTargetAtTime(180 + speed * 420, t, 0.15);
  }

  update(dt: number, moving: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // motor: pitch and level follow commanded value
    this.motorGain.gain.setTargetAtTime(this.motorLevel * 0.26, t, 0.12);
    this.motorOsc.frequency.setTargetAtTime(24 + this.motorLevel * 46, t, 0.25);
    this.motorOsc2.frequency.setTargetAtTime(48 + this.motorLevel * 74, t, 0.25);
    this.motorFilter.frequency.setTargetAtTime(220 + this.motorLevel * 640, t, 0.2);
    this.rollGain.gain.setTargetAtTime(this.rollLevel * 0.34, t, 0.15);
    this.rollFilter.frequency.setTargetAtTime(110 + this.rollLevel * 120, t, 0.2);

    // occasional steel creaks while the girders are moving
    if (moving) {
      this.creakTimer -= dt;
      if (this.creakTimer <= 0) {
        this.creak();
        this.creakTimer = 0.5 + Math.random() * 1.4;
      }
    }
    // sparse birds
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      const f = 2400 + Math.random() * 1600;
      this.blip(f, 0.02, 0.02, 0.12);
      setTimeout(() => this.blip(f * 1.18, 0.016, 0.02, 0.1), 120);
      this.birdTimer = 6 + Math.random() * 14;
    }
  }
}
