/**
 * Small procedural sound bed. No audio files, so nothing to redistribute
 * and nothing to download: a seat thunk, collar detents, valve travel and
 * a water bed whose brightness follows the flow.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private ambGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private started = false;

  /** Must be called from inside a user gesture. */
  start(): void {
    if (this.started) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // water bed
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 700;
    this.waterFilter.Q.value = 0.7;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    src.connect(this.waterFilter).connect(this.waterGain).connect(this.master);
    src.start();

    // outdoor ambience
    const amb = ctx.createBufferSource();
    amb.buffer = buf;
    amb.loop = true;
    const ambFilter = ctx.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.frequency.value = 340;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.045;
    amb.connect(ambFilter).connect(this.ambGain).connect(this.master);
    amb.start();

    if (ctx.state === 'suspended') void ctx.resume();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setWater(flow: number): void {
    if (!this.ctx || !this.waterGain || !this.waterFilter) return;
    const t = this.ctx.currentTime;
    this.waterGain.gain.setTargetAtTime(flow * 0.3, t, 0.35);
    this.waterFilter.frequency.setTargetAtTime(520 + flow * 1750, t, 0.4);
    this.waterFilter.Q.setTargetAtTime(0.6 + flow * 0.5, t, 0.4);
  }

  private env(node: AudioNode, at: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    node.connect(g).connect(this.master!);
    return g;
  }

  /** the "koton" of a plate settling into the guide rails */
  thunk(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    this.env(osc, t, 0.5, 0.006, 0.24);
    osc.start(t);
    osc.stop(t + 0.35);

    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1650;
    f.Q.value = 1.6;
    n.connect(f);
    this.env(f, t, 0.16, 0.004, 0.1);
    n.start(t);
    n.stop(t + 0.2);
  }

  click(strength = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2600 + Math.random() * 500;
    f.Q.value = 5;
    n.connect(f);
    this.env(f, t, 0.09 * strength, 0.002, 0.05);
    n.start(t);
    n.stop(t + 0.09);
  }

  latch(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
    this.env(osc, t, 0.12, 0.003, 0.09);
    osc.start(t);
    osc.stop(t + 0.16);
    this.click(1.4);
  }

  /** two soft notes for the moment the light starts to run */
  chime(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [i, f] of [523.25, 783.99].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.env(osc, t + i * 0.19, 0.16, 0.03, 1.5);
      g.gain.value = 0;
      osc.start(t + i * 0.19);
      osc.stop(t + i * 0.19 + 1.7);
    }
  }

  valve(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    f.Q.value = 8;
    n.connect(f);
    this.env(f, t, 0.05, 0.05, 0.25);
    n.start(t);
    n.stop(t + 0.4);
  }
}
