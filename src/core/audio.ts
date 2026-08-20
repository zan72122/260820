import { clamp } from './util';

/**
 * Every sound is synthesised: no downloads, no hotlinked assets, and the
 * loops can follow the simulation continuously instead of triggering clips.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private verb!: ConvolverNode;
  private verbGain!: GainNode;

  private trickle?: { gain: GainNode; filter: BiquadFilterNode; q: BiquadFilterNode };
  private scrape?: { gain: GainNode; filter: BiquadFilterNode };
  private pond?: { gain: GainNode; filter: BiquadFilterNode };

  private lastCreak = 0;
  private lastVoice = 0;
  enabled = true;
  ready = false;

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // white noise bed reused by every water / sand voice
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1;
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 1073741823.5 - 1) * 0.85;
    }
    this.noise = buf;

    // short synthetic room so the pond arrival can open up
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) {
        const t = i / ch.length;
        s = (s * 16807) % 2147483647;
        ch[i] = (s / 1073741823.5 - 1) * Math.pow(1 - t, 3.2) * 0.5;
      }
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.32;
    this.verb.connect(this.verbGain).connect(this.master);

    this.trickle = this.makeLoop(320, 6, 0);
    this.scrape = this.makeScrape();
    this.pond = this.makeLoop(520, 1.2, 0);
    if (ctx.state === 'suspended') await ctx.resume();
    this.ready = true;
  }

  private makeLoop(freq: number, q: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const q2 = ctx.createBiquadFilter();
    q2.type = 'highpass';
    q2.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(q2).connect(g).connect(this.master);
    g.connect(this.verb);
    src.start();
    return { gain: g, filter, q: q2 };
  }

  private makeScrape() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    return { gain: g, filter };
  }

  setMuted(m: boolean) {
    this.enabled = !m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx!.currentTime, 0.05);
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /* ---------------- continuous voices ---------------- */

  /** flow: 0..1 overall movement, jet: 0..1 water escaping the gate */
  setWater(flow: number, jet: number) {
    if (!this.ctx || !this.trickle) return;
    const t = this.ctx.currentTime;
    const f = clamp(flow, 0, 1);
    const j = clamp(jet, 0, 1);
    const level = clamp(f * 0.5 + j * 0.55, 0, 1);
    this.trickle.gain.gain.setTargetAtTime(level * 0.34, t, 0.09);
    // a thin leak hisses high; a real stream sits lower and wider
    this.trickle.filter.frequency.setTargetAtTime(2100 - level * 1250, t, 0.15);
    this.trickle.filter.Q.setTargetAtTime(8 - level * 6.2, t, 0.15);
  }

  setPond(fill: number) {
    if (!this.ctx || !this.pond) return;
    const t = this.ctx.currentTime;
    this.pond.gain.gain.setTargetAtTime(clamp(fill, 0, 1) * 0.11, t, 0.4);
    this.pond.filter.frequency.setTargetAtTime(360 + fill * 260, t, 0.4);
  }

  setDigging(speed: number, wet: number) {
    if (!this.ctx || !this.scrape) return;
    const t = this.ctx.currentTime;
    const s = clamp(speed, 0, 1);
    this.scrape.gain.gain.setTargetAtTime(s * 0.2, t, 0.045);
    // dry sand rasps; wet sand is dull and low
    this.scrape.filter.frequency.setTargetAtTime(2300 - wet * 1500, t, 0.1);
    this.scrape.filter.Q.setTargetAtTime(0.9 + wet * 1.6, t, 0.1);
  }

  /* ---------------- one shots ---------------- */

  private burst(
    dur: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    gain: number,
    verb = 0,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    if (verb > 0) {
      const vg = ctx.createGain();
      vg.gain.value = verb;
      g.connect(vg).connect(this.verb);
    }
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private tone(freq0: number, freq1: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Wood sliding against wood and iron — louder the faster it is pulled. */
  creak(speed: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastCreak < 0.11) return;
    this.lastCreak = now;
    const s = clamp(speed, 0, 1);
    this.burst(0.18 + s * 0.12, 'bandpass', 380 + s * 460, 240, 7, 0.05 + s * 0.16);
    this.tone(150 + s * 120, 96, 0.16, 0.02 + s * 0.045, 'sawtooth');
  }

  /** The latch knock when the board reaches the end of its travel. */
  knock() {
    this.burst(0.11, 'bandpass', 900, 260, 3.5, 0.16);
    this.tone(210, 84, 0.13, 0.1, 'triangle');
  }

  mudPress(strength: number) {
    const s = clamp(strength, 0, 1);
    this.burst(0.17, 'lowpass', 1500, 220, 1.1, 0.1 + s * 0.16);
    this.tone(120, 62, 0.13, 0.05 + s * 0.06, 'sine');
  }

  breach(power: number) {
    const p = clamp(power, 0, 1);
    this.burst(0.55, 'highpass', 900, 2600, 0.7, 0.1 + p * 0.14, 0.3); // サラサラ
    this.burst(0.3, 'lowpass', 700, 90, 0.9, 0.12 + p * 0.16, 0.25); // ドサッ
    this.tone(96, 44, 0.28, 0.09 + p * 0.07, 'sine');
  }

  arrive() {
    this.burst(0.9, 'bandpass', 1400, 380, 0.8, 0.22, 0.8);
    this.burst(0.5, 'lowpass', 520, 160, 0.9, 0.14, 0.6);
    this.tone(320, 210, 0.5, 0.05, 'sine');
  }

  splash(power: number) {
    const p = clamp(power, 0, 1);
    this.burst(0.22 + p * 0.2, 'bandpass', 1700, 620, 1.2, 0.05 + p * 0.13, 0.25);
  }

  /** Very short Japanese onomatopoeia only — never a spoken instruction. */
  say(word: string) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastVoice < 2600) return;
    this.lastVoice = now;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'ja-JP';
      u.rate = 0.85;
      u.pitch = 1.45;
      u.volume = 0.85;
      synth.cancel();
      synth.speak(u);
    } catch {
      /* speech is a bonus, never a requirement */
    }
  }
}
