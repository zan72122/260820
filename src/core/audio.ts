/**
 * Everything is synthesised — no asset downloads, and the pour sound can track
 * the flow continuously. Audio only starts after the first real touch.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private pourSrc: AudioBufferSourceNode | null = null;
  private pourGain: GainNode | null = null;
  private pourFilter: BiquadFilterNode | null = null;
  muted = false;

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.master = master;

    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    void ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private get ok() {
    return !!this.ctx && !!this.master && !this.muted;
  }

  private env(
    node: AudioNode,
    t0: number,
    peak: number,
    attack: number,
    decay: number
  ): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(this.master!);
    return g;
  }

  private noise(t0: number, dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    this.env(f, t0, peak, 0.006, dur);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  private tone(t0: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', bend = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, t0 + dur);
    this.env(o, t0, peak, 0.008, dur);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** silicone releasing the frozen cake */
  pop() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.22, 420, 1.1, 0.16, 'lowpass');
    this.tone(t + 0.02, 150, 0.22, 0.12, 'sine', 0.55);
  }

  /** cake or rack settling onto metal */
  clink(strength = 1) {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.13, 3600, 3.5, 0.06 * strength);
    this.tone(t, 1870, 0.35, 0.05 * strength, 'triangle', 0.99);
    this.tone(t + 0.004, 2760, 0.28, 0.032 * strength, 'sine', 0.99);
  }

  /** soft thud of something heavy touching down */
  thud() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.16, 220, 0.9, 0.14, 'lowpass');
    this.tone(t, 92, 0.2, 0.1, 'sine', 0.7);
  }

  tap() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 880, 0.09, 0.05, 'triangle', 1.35);
  }

  drop() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 620 + Math.random() * 260, 0.12, 0.045, 'sine', 0.42);
  }

  pourOn() {
    if (!this.ctx || !this.master || this.pourSrc || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 560;
    f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    this.pourSrc = src;
    this.pourGain = g;
    this.pourFilter = f;
  }

  pourLevel(v: number) {
    if (!this.pourGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.pourGain.gain.setTargetAtTime(Math.max(0.0001, v * 0.2), t, 0.06);
    if (this.pourFilter) {
      this.pourFilter.frequency.setTargetAtTime(360 + v * 900, t, 0.08);
    }
  }

  pourOff() {
    if (!this.pourSrc || !this.ctx) return;
    const src = this.pourSrc;
    const g = this.pourGain!;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.08);
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.pourSrc = null;
    this.pourGain = null;
    this.pourFilter = null;
  }

  chime() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((n, i) => {
      this.tone(t + i * 0.11, n, 0.9 - i * 0.08, 0.075, 'triangle', 1);
      this.tone(t + i * 0.11, n * 2, 0.5, 0.02, 'sine', 1);
    });
  }

  sparkle() {
    if (!this.ok) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 1560, 0.35, 0.045, 'triangle', 1.6);
  }
}
