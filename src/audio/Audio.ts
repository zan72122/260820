/**
 * Every sound is synthesised at runtime. No audio files means no load time on
 * a phone connection, and it lets the scrub and creak loops track the finger
 * continuously instead of triggering canned one-shots.
 */

type Ctx = AudioContext;

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];

export class GameAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private ambientGain: GainNode | null = null;
  private scrubGain: GainNode | null = null;
  private scrubFilter: BiquadFilterNode | null = null;
  private creakGain: GainNode | null = null;
  private creakOsc: OscillatorNode | null = null;
  private creakFilter: BiquadFilterNode | null = null;

  private started = false;
  private muted = false;
  private chimeStep = 0;

  get available(): boolean { return this.ctx !== null; }

  /** Must be called from inside a real user gesture on iOS. */
  unlock(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
    const Impl = AC.AudioContext ?? AC.webkitAudioContext;
    if (!Impl) return;
    try {
      this.ctx = new Impl();
    } catch {
      return;
    }
    this.started = true;

    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(ctx.destination);

    // Shared noise bed.
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // pink-ish
      d[i] = last * 3.2 + white * 0.35;
    }
    this.noise = buf;

    this.buildAmbience();
    this.buildScrub();
    this.buildCreak();
    void ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  private src(loop = true): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  // ------------------------------------------------------------------ beds

  private buildAmbience(): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master!);
    this.ambientGain = g;

    // Stream: band-limited noise with a slow wandering filter.
    const s = this.src();
    if (s) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 780;
      bp.Q.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(bp.frequency);
      lfo.start();
      const sg = ctx.createGain();
      sg.gain.value = 0.16;
      s.connect(bp).connect(sg).connect(g);
      s.start();
    }

    // Room tone: a very quiet low pad so silence never feels like a bug.
    for (const [f, gain] of [[82, 0.020], [123, 0.012], [164.8, 0.008]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = gain;
      const det = ctx.createOscillator();
      det.frequency.value = 0.11 + f * 0.0004;
      const detG = ctx.createGain();
      detG.gain.value = 0.9;
      det.connect(detG).connect(o.frequency);
      det.start();
      o.connect(og).connect(g);
      o.start();
    }
  }

  private buildScrub(): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master!);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 0.9;
    bp.connect(g);
    const s = this.src();
    if (s) { s.connect(bp); s.start(); }
    this.scrubGain = g;
    this.scrubFilter = bp;
  }

  private buildCreak(): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master!);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 4.5;
    lp.connect(g);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 58;
    o.connect(lp);
    o.start();
    const n = this.src();
    if (n) {
      const ng = ctx.createGain();
      ng.gain.value = 0.35;
      n.connect(ng).connect(lp);
      n.start();
    }
    this.creakGain = g;
    this.creakOsc = o;
    this.creakFilter = lp;
  }

  // ------------------------------------------------------------- continuous

  setAmbience(level: number): void {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.35);
  }

  /** `intensity` 0..1 from scrub speed; `wetness` brightens it as water builds. */
  setScrub(intensity: number, wetness = 0): void {
    if (!this.ctx || !this.scrubGain || !this.scrubFilter) return;
    const t = this.ctx.currentTime;
    this.scrubGain.gain.setTargetAtTime(intensity * 0.16, t, 0.045);
    this.scrubFilter.frequency.setTargetAtTime(750 + intensity * 1500 + wetness * 900, t, 0.06);
    this.scrubFilter.Q.setTargetAtTime(0.7 + wetness * 1.6, t, 0.1);
  }

  /** Rising strain as the wedge is pressed: pitch climbs, then releases. */
  setCreak(load: number): void {
    if (!this.ctx || !this.creakGain || !this.creakOsc || !this.creakFilter) return;
    const t = this.ctx.currentTime;
    this.creakGain.gain.setTargetAtTime(load * 0.10, t, 0.05);
    this.creakOsc.frequency.setTargetAtTime(52 + load * 46, t, 0.09);
    this.creakFilter.frequency.setTargetAtTime(240 + load * 520, t, 0.09);
  }

  // ------------------------------------------------------------------ hits

  private burst(o: {
    dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number;
    freqTo?: number; delay?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay ?? 0);
    const s = this.src(false);
    if (!s) return;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + o.dur + 0.05);
  }

  private tone(o: {
    freq: number; dur: number; gain: number; type?: OscillatorType;
    delay?: number; fm?: number; fmIndex?: number; glide?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.glide), t + o.dur);

    if (o.fm) {
      const m = ctx.createOscillator();
      m.frequency.value = o.freq * o.fm;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(o.freq * (o.fmIndex ?? 1.2), t);
      mg.gain.exponentialRampToValueAtTime(0.01, t + o.dur * 0.5);
      m.connect(mg).connect(osc.frequency);
      m.start(t);
      m.stop(t + o.dur + 0.05);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  splash(strength = 1): void {
    this.burst({ dur: 0.28 * strength, gain: 0.16 * strength, type: 'highpass', freq: 900, freqTo: 2600, q: 0.7 });
    for (let i = 0; i < 3; i++) {
      this.tone({
        freq: 900 + Math.random() * 1400, dur: 0.07, gain: 0.035,
        delay: 0.02 + Math.random() * 0.08, glide: 1600 + Math.random() * 1600,
      });
    }
  }

  drip(): void {
    const f = 1100 + Math.random() * 900;
    this.tone({ freq: f, dur: 0.13, gain: 0.05, glide: f * 2.4 });
  }

  /** The moment the stone gives. Sharp transient, then the body ringing. */
  crack(power = 1): void {
    this.burst({ dur: 0.055, gain: 0.42 * power, type: 'highpass', freq: 2400, freqTo: 5200, q: 0.6 });
    this.burst({ dur: 0.22, gain: 0.30 * power, type: 'bandpass', freq: 620, q: 3.2 });
    this.burst({ dur: 0.38, gain: 0.20 * power, type: 'bandpass', freq: 190, q: 2.4 });
    this.tone({ freq: 150, dur: 0.30, gain: 0.20 * power, type: 'triangle', glide: 62 });
  }

  /** A single dry knock: the wedge biting, or the stone set down. */
  knock(pitch = 1, gain = 0.22): void {
    this.tone({ freq: 96 * pitch, dur: 0.16, gain, type: 'triangle', glide: 52 * pitch });
    this.burst({ dur: 0.05, gain: gain * 0.5, type: 'lowpass', freq: 1400, q: 0.8 });
  }

  /** Bell cluster. Walks up the pentatonic scale so repeated use feels like
   *  progress rather than repetition. */
  chime(step?: number, gain = 0.10): void {
    const i = step ?? this.chimeStep++;
    const f = PENTATONIC[i % PENTATONIC.length] * (1 + Math.floor(i / PENTATONIC.length) * 0.0);
    this.tone({ freq: f, dur: 1.5, gain, fm: 2.01, fmIndex: 1.1 });
    this.tone({ freq: f * 2.005, dur: 0.9, gain: gain * 0.45, delay: 0.01 });
    this.tone({ freq: f * 3.01, dur: 0.5, gain: gain * 0.2, delay: 0.02 });
  }

  resetChime(): void { this.chimeStep = 0; }

  /** The shimmer that says "there is something beautiful in here". */
  reveal(): void {
    const notes = [4, 5, 6, 7, 9];
    notes.forEach((n, i) => {
      const f = PENTATONIC[n % PENTATONIC.length] * (n >= PENTATONIC.length ? 2 : 1);
      this.tone({ freq: f, dur: 2.2 - i * 0.15, gain: 0.085, fm: 3.01, fmIndex: 0.8, delay: i * 0.075 });
    });
    this.burst({ dur: 1.1, gain: 0.05, type: 'highpass', freq: 4200, freqTo: 9000, q: 0.5, delay: 0.03 });
  }

  brush(intensity: number): void {
    if (!this.ctx || !this.scrubGain) return;
    this.setScrub(intensity * 0.55, 0);
    if (this.scrubFilter) {
      this.scrubFilter.frequency.setTargetAtTime(2600 + intensity * 2600, this.ctx.currentTime, 0.05);
    }
  }

  /** Warm swelling chord for the pedestal finale. */
  finale(): void {
    const root = 261.63;
    [1, 1.5, 2, 2.5, 3].forEach((m, i) => {
      this.tone({ freq: root * m, dur: 3.4, gain: 0.055 / (1 + i * 0.3), type: 'sine', delay: i * 0.10 });
    });
    [7, 9, 11].forEach((n, i) => {
      this.tone({
        freq: PENTATONIC[n % PENTATONIC.length] * 2, dur: 2.0, gain: 0.06,
        fm: 2.01, fmIndex: 0.9, delay: 0.5 + i * 0.16,
      });
    });
  }

  ui(): void {
    this.tone({ freq: 660, dur: 0.11, gain: 0.07, type: 'sine', glide: 990 });
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}
