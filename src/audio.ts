// Procedural machine sounds — no assets. All levels deliberately restrained.
// iOS: the context resumes on the first touch.

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleTargetLevel = 0;
  private lastTick = 0;
  private noiseBuf: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      // shared noise buffer
      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let s = 22222;
      for (let i = 0; i < len; i++) {
        s = (s * 16807) % 2147483647;
        d[i] = ((s - 1) / 2147483646) * 2 - 1;
      }
      this.noiseBuf = buf;
      // continuous bearing rumble (silent until driven)
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 130;
      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.value = 0;
      src.connect(lp).connect(this.rumbleGain).connect(this.master);
      src.start();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  resume(): void {
    const c = this.ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  private burst(
    freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass',
  ): void {
    const c = this.ensure();
    if (!c || !this.noiseBuf || !this.master) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.8, dur + 0.05);
    src.stop(t + dur + 0.06);
  }

  private tone(
    freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0,
  ): void {
    const c = this.ensure();
    if (!c || !this.master) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    o.connect(g).connect(lp).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** ratchet click while the handwheel turns */
  tick(strength: number): void {
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    this.burst(1900 + Math.random() * 500, 5, 0.03, 0.05 + strength * 0.05, 'bandpass');
  }

  /** continuous bearing rumble level 0..1 */
  rumble(level: number): void {
    this.rumbleTargetLevel = level;
    const c = this.ctx;
    if (!c || !this.rumbleGain) return;
    const cur = this.rumbleGain.gain.value;
    this.rumbleGain.gain.setTargetAtTime(
      Math.min(0.12, this.rumbleTargetLevel * 0.1) + cur * 0, c.currentTime, 0.08,
    );
  }

  /** the detent seats: soft heavy thunk */
  clunk(): void {
    this.tone(82, 0.16, 0.22, 'sine');
    this.burst(240, 1.4, 0.09, 0.16, 'lowpass');
  }

  /** striker meets the end stop */
  stopHit(): void {
    this.burst(420, 2.5, 0.05, 0.1, 'bandpass');
  }

  /** safety pin retracts, the lever is free */
  leverUnlock(): void {
    this.burst(2600, 8, 0.05, 0.12, 'bandpass');
    this.tone(1180, 0.1, 0.05, 'triangle', 0.03);
  }

  leverTick(): void {
    const now = performance.now();
    if (now - this.lastTick < 70) return;
    this.lastTick = now;
    this.burst(760, 4, 0.035, 0.05, 'bandpass');
  }

  /** letter completed: relay click + two soft notes */
  success(): void {
    this.burst(3300, 7, 0.04, 0.1, 'bandpass');
    this.tone(659.3, 0.5, 0.1, 'triangle', 0.16);
    this.tone(880, 0.8, 0.09, 'triangle', 0.34);
  }

  /** dolly rolls to the next machine */
  travel(): void {
    this.burst(180, 0.8, 1.4, 0.07, 'lowpass');
    for (let i = 0; i < 4; i++) this.burst(900, 3, 0.03, 0.03 + Math.random() * 0.02, 'bandpass');
  }

  creak(): void {
    this.burst(500, 6, 0.12, 0.045, 'bandpass');
  }
}
