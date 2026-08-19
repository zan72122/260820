import { Rng, clamp, clamp01 } from './mathx';

/**
 * The whole soundtrack is synthesised at runtime: nothing to download, nothing
 * to decode, and the "muffled behind the curtain -> wide open room" transition
 * can be done as a real filter/reverb move rather than a crossfade between two
 * recordings.
 *
 * Signal flow:
 *
 *   [behind-curtain bus] -> lowpass -> gain -.
 *   [near bus]                              -+-> dry -> comp -> out
 *                                            '-> send -> convolver -> wet -^
 *
 * `openUp()` sweeps the lowpass, lifts the reverb send and widens the room:
 * that single move is the audio half of the reveal.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  ready = false;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private send!: GainNode;
  private convolver!: ConvolverNode;

  /** Everything the child hears through the fabric. */
  private farBus!: GainNode;
  private farFilter!: BiquadFilterNode;
  /** Everything happening right next to the child. */
  private nearBus!: GainNode;

  private noise!: AudioBuffer;
  private applauseBuf!: AudioBuffer;
  private murmurGain!: GainNode;
  private rustleGain!: GainNode;
  private roomGain!: GainNode;
  private applauseGain!: GainNode;
  private applauseSrc: AudioBufferSourceNode | null = null;

  private musicTimer = 0;
  private musicNotes: { t: number; midi: number; dur: number }[] = [];
  private musicPlaying = false;
  private musicGain!: GainNode;
  private rng = new Rng(7);
  private muted = false;

  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined);
      return;
    }
    type Win = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as Win).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      await ctx.resume().catch(() => undefined);
      this.build();
      this.ready = true;
    } catch (err) {
      console.warn('[butai] audio unavailable', err);
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ready) this.master.gain.setTargetAtTime(m ? 0 : 1, this.now, 0.08);
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;

    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.dry.connect(this.master);

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.makeHallIR(2.2, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.16; // tight, boxy backstage to start with
    this.send = ctx.createGain();
    this.send.gain.value = 1;
    this.send.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.wet.connect(this.master);

    // Behind-the-curtain bus.
    this.farFilter = ctx.createBiquadFilter();
    this.farFilter.type = 'lowpass';
    this.farFilter.frequency.value = 620;
    this.farFilter.Q.value = 0.5;
    this.farBus = ctx.createGain();
    this.farBus.gain.value = 0.62;
    this.farFilter.connect(this.farBus);
    this.farBus.connect(this.dry);
    this.farBus.connect(this.send);

    // Close bus (cloth, shoes, the teacher's voice).
    this.nearBus = ctx.createGain();
    this.nearBus.gain.value = 1;
    this.nearBus.connect(this.dry);
    this.nearBus.connect(this.send);

    this.noise = this.makeNoise(3);
    this.applauseBuf = this.makeApplause(4.2);

    this.startMurmur();
    this.startRustle();
    this.startRoomTone();

    this.applauseGain = ctx.createGain();
    this.applauseGain.gain.value = 0;
    this.applauseGain.connect(this.farFilter);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.farFilter);
  }

  // ---------------------------------------------------------------- buffers

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /** Exponentially decaying noise with a touch of early reflection structure. */
  private makeHallIR(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * 0.42; // slight HF damping, like a room full of coats
        d[i] = lp * env;
      }
      // A couple of early reflections give the hall a readable size.
      const taps = [0.017, 0.029, 0.041, 0.063];
      for (const tap of taps) {
        const idx = Math.floor(tap * ctx.sampleRate) + c * 31;
        if (idx < len) d[idx] += (c ? -1 : 1) * 0.35;
      }
    }
    return buf;
  }

  /** A loopable crowd of hands: hundreds of short decaying grains. */
  private makeApplause(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    const rng = new Rng(0x5eed);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const claps = Math.floor(seconds * 620);
      for (let k = 0; k < claps; k++) {
        const start = Math.floor(rng.next() * len);
        const dur = Math.floor(sr * rng.range(0.004, 0.016));
        const amp = rng.range(0.05, 0.3);
        for (let i = 0; i < dur && start + i < len; i++) {
          const e = Math.pow(1 - i / dur, 2.4);
          d[start + i] += (Math.random() * 2 - 1) * amp * e;
        }
      }
      // Gentle high-pass by differentiation so it reads as hands, not surf.
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const x = d[i];
        d[i] = clamp((x - prev) * 0.75 + x * 0.35, -1, 1);
        prev = x;
      }
      // Crossfade the tail into the head so the loop is seamless.
      const fade = Math.floor(sr * 0.25);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[i] = d[i] * t + d[len - fade + i] * (1 - t);
      }
    }
    return buf;
  }

  // ------------------------------------------------------------- continuous

  private startMurmur(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 430;
    bp.Q.value = 0.55;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;

    this.murmurGain = ctx.createGain();
    this.murmurGain.gain.value = 0.05;

    // Slow breathing so the crowd never sounds like static.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain);
    lfoGain.connect(this.murmurGain.gain);
    lfo.start();

    src.connect(bp);
    bp.connect(lp);
    lp.connect(this.murmurGain);
    this.murmurGain.connect(this.farFilter);
    src.start();
  }

  private startRustle(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2700;
    bp.Q.value = 0.7;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    this.rustleGain = ctx.createGain();
    this.rustleGain.gain.value = 0;
    src.connect(bp);
    bp.connect(hp);
    hp.connect(this.rustleGain);
    this.rustleGain.connect(this.nearBus);
    src.start();
  }

  private startRoomTone(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0.035;
    src.connect(lp);
    lp.connect(this.roomGain);
    this.roomGain.connect(this.dry);
    src.start();
  }

  // ------------------------------------------------------------------ hooks

  /** Fabric noise follows how fast the cloth is actually moving. */
  setClothSpeed(metresPerSecond: number): void {
    if (!this.ready) return;
    const g = clamp01(Math.abs(metresPerSecond) * 0.55) * 0.13;
    this.rustleGain.gain.setTargetAtTime(g, this.now, 0.05);
  }

  /** 0 = curtain shut, 1 = child is out in the room. */
  setOpenness(t: number): void {
    if (!this.ready) return;
    const k = clamp01(t);
    const now = this.now;
    this.farFilter.frequency.setTargetAtTime(620 + k * k * 13000, now, 0.12);
    this.farBus.gain.setTargetAtTime(0.62 + k * 0.5, now, 0.15);
    this.wet.gain.setTargetAtTime(0.16 + k * 0.4, now, 0.2);
    this.murmurGain.gain.setTargetAtTime(0.05 + k * 0.1, now, 0.25);
  }

  startPrevAct(seed: number): void {
    if (!this.ready) return;
    this.rng = new Rng(seed || 7);
    // A short, sweet pentatonic tune: the class before yours, playing on.
    const scale = [0, 2, 4, 7, 9, 12, 14];
    const root = this.rng.pick([60, 62, 65, 67]);
    this.musicNotes = [];
    let t = 0;
    let idx = 2;
    for (let i = 0; i < 34; i++) {
      const dur = this.rng.next() < 0.22 ? 0.6 : 0.3;
      idx = clamp(idx + this.rng.int(-2, 2), 0, scale.length - 1);
      this.musicNotes.push({ t, midi: root + scale[idx], dur });
      t += dur;
    }
    this.musicTimer = 0;
    this.musicPlaying = true;
    this.musicGain.gain.setTargetAtTime(0.16, this.now, 0.6);
  }

  /** Ends the tune with a little cadence, the way a kindergarten piece lands. */
  endPrevAct(): void {
    if (!this.ready) return;
    this.musicPlaying = false;
    this.musicGain.gain.setTargetAtTime(0, this.now, 0.35);
    const t0 = this.now;
    for (let i = 0; i < 3; i++) {
      this.tone(72 - i * 5, t0 + i * 0.16, 0.22, 0.1, 'triangle', this.farFilter);
    }
  }

  applause(peak: number, attack = 0.5, hold = 2.0, release = 1.6): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    if (!this.applauseSrc) {
      const src = ctx.createBufferSource();
      src.buffer = this.applauseBuf;
      src.loop = true;
      src.connect(this.applauseGain);
      src.start();
      this.applauseSrc = src;
    }
    const g = this.applauseGain.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.setValueAtTime(peak, t + attack + hold);
    g.linearRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  /** A held ovation for the reveal; call `fadeApplause` to release it. */
  applauseHold(peak: number, attack = 0.7): void {
    if (!this.ready) return;
    this.applause(peak, attack, 60, 2);
  }

  fadeApplause(seconds = 2): void {
    if (!this.ready) return;
    const g = this.applauseGain.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(0.0001, t + seconds);
  }

  /** Soft-soled indoor shoes on a waxed deck. */
  footstep(strength = 1): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = this.now;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 780 + Math.random() * 320;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.nearBus);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.2);
  }

  /**
   * Not speech - a short warm vowel with two formants. It reads as "a grown-up
   * just said something kind" without ever putting words in the teacher's mouth.
   */
  teacherVoice(kind: 'wait' | 'now' | 'hum'): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = this.now;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = kind === 'now' ? 232 : 198;
    osc.frequency.setValueAtTime(base, t);
    if (kind === 'now') {
      osc.frequency.linearRampToValueAtTime(base * 1.18, t + 0.18);
      osc.frequency.linearRampToValueAtTime(base * 1.05, t + 0.34);
    } else {
      osc.frequency.linearRampToValueAtTime(base * 0.88, t + 0.3);
    }

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = kind === 'now' ? 720 : 610;
    f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = kind === 'now' ? 1180 : 1010;
    f2.Q.value = 7;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const g = ctx.createGain();
    const dur = kind === 'hum' ? 0.26 : 0.42;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.05);
    g.gain.setValueAtTime(0.075, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(g);
    g.connect(this.nearBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Rope, pulley and a lot of velvet. */
  curtainMotor(duration = 3.2): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = this.now;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.35);
    g.gain.setValueAtTime(0.065, t + duration * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + duration);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.farFilter);
    src.start(t, Math.random());
    src.stop(t + duration + 0.1);
  }

  /** One soft bell, used only where a real hall would have one. */
  chime(midi = 84, gain = 0.06): void {
    if (!this.ready) return;
    this.tone(midi, this.now, 1.6, gain, 'sine', this.farFilter);
    this.tone(midi + 12, this.now, 1.1, gain * 0.4, 'sine', this.farFilter);
  }

  private tone(
    midi: number,
    at: number,
    dur: number,
    gain: number,
    type: OscillatorType,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Called every frame; schedules the previous act's tune a little ahead. */
  update(dt: number): void {
    if (!this.ready || !this.musicPlaying) return;
    const prev = this.musicTimer;
    this.musicTimer += dt;
    const total = this.musicNotes.length
      ? this.musicNotes[this.musicNotes.length - 1].t + 1
      : 1;
    const loopPrev = prev % total;
    const loopNow = this.musicTimer % total;
    for (const n of this.musicNotes) {
      const hit =
        loopNow >= loopPrev ? n.t > loopPrev && n.t <= loopNow : n.t > loopPrev || n.t <= loopNow;
      if (hit) {
        this.tone(n.midi, this.now + 0.02, n.dur * 0.9, 0.12, 'triangle', this.musicGain);
        if (Math.random() < 0.34) {
          this.tone(n.midi - 12, this.now + 0.02, n.dur * 0.7, 0.06, 'sine', this.musicGain);
        }
      }
    }
  }
}
