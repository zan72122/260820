import { Rng } from './rng';
import { clamp01 } from './mathx';

export type SfxName =
  | 'umeFallSoft'   // ポトッ  -- ripe fruit onto taut net
  | 'umeFallRoll'   // コロッ  -- fruit landing and rolling
  | 'umeFallPop'    // ポン    -- lighter, brighter bounce
  | 'netDrag'       // net edge scraping over uneven ground
  | 'netSettle'     // corners finding their place
  | 'saltScoop'     // grains rattling inside the wooden scoop
  | 'saltGlass'     // grains ticking against the jar wall
  | 'saltHeap'      // grains landing on the growing pile
  | 'drip'          // a bead of juice letting go
  | 'pour'          // juice running down the glass
  | 'placeUme'      // fruit set down on the drying tray
  | 'rollUme'       // fruit turned over
  | 'sunMove'       // time moving on: a warm breath
  | 'chime';        // stage completed

interface Voice {
  gain: GainNode;
}

/**
 * Every sound is synthesised at runtime -- no audio files, no licences to
 * chase, nothing to download. Material sounds sit in front; the ambience is
 * quiet enough that grains, drips and footsteps on the net stay legible.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambientStarted = false;
  private rng = new Rng(1337);
  private _volume = 0.8;
  private _muted = false;
  private lastPlay = new Map<string, number>();

  get volume(): number {
    return this._volume;
  }

  get muted(): boolean {
    return this._muted;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from inside a user gesture (iOS unlocks audio there). */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0;
      this.ambientBus.connect(this.master);
      this.noiseBuf = this.makeNoise(2);
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore: will retry on the next gesture */
      }
    }
    if (this.ready && !this.ambientStarted) this.startAmbient();
  }

  setVolume(v: number): void {
    this._volume = clamp01(v);
    this._muted = this._volume <= 0.001;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime, 0.05);
    }
  }

  cycleVolume(): number {
    const steps = [0.8, 0.35, 0];
    const i = steps.findIndex((s) => Math.abs(s - this._volume) < 0.02);
    const next = steps[(i + 1) % steps.length];
    this.setVolume(next);
    return next;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private makeNoise(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this.rng.next() * 2 - 1;
    return buf;
  }

  private voice(dest: AudioNode | null = null): Voice | null {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    gain.connect(dest ?? this.sfxBus ?? this.ctx.destination);
    return { gain };
  }

  private noiseSource(playbackRate = 1): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    return src;
  }

  /** Rate limiting keeps a burst of 200 salt grains from turning into mush. */
  private throttled(name: string, minGapMs: number): boolean {
    const now = this.ctx ? this.ctx.currentTime * 1000 : 0;
    const last = this.lastPlay.get(name) ?? -1e9;
    if (now - last < minGapMs) return true;
    this.lastPlay.set(name, now);
    return false;
  }

  play(name: SfxName, strength = 1, detune = 0): void {
    if (!this.ready || this._muted) return;
    const s = clamp01(strength);
    switch (name) {
      case 'umeFallSoft': return this.thud(118 + detune * 20, 0.30, 0.55 * s, 0.55);
      case 'umeFallRoll': return this.roll(0.42 * s, detune);
      case 'umeFallPop':  return this.thud(232 + detune * 40, 0.19, 0.42 * s, 0.22);
      case 'netDrag':     return this.scrape(s);
      case 'netSettle':   return this.thud(86, 0.42, 0.34 * s, 0.75);
      case 'saltScoop':   return this.grains(s, 1.0, 'wood');
      case 'saltGlass':   return this.grains(s, 1.6, 'glass');
      case 'saltHeap':    return this.grains(s, 0.7, 'heap');
      case 'drip':        return this.drip(s, detune);
      case 'pour':        return this.pour(s);
      case 'placeUme':    return this.thud(150 + detune * 24, 0.24, 0.30 * s, 0.4);
      case 'rollUme':     return this.roll(0.26 * s, detune + 0.3);
      case 'sunMove':     return this.breath(s);
      case 'chime':       return this.chime(s);
    }
  }

  // --- individual material voices -----------------------------------------

  private thud(freq: number, dur: number, amp: number, body: number): void {
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.9, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.68), t + dur * 0.85);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400 + body * 900, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur);
    osc.connect(lp);
    lp.connect(v.gain);

    // Soft transient: the skin of the fruit slapping the net.
    const n = this.noiseSource(1);
    if (n) {
      const ng = ctx.createGain();
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 900 + body * 700;
      nf.Q.value = 0.8;
      ng.gain.setValueAtTime(amp * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(v.gain);
      n.start(t);
      n.stop(t + 0.08);
    }
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private roll(amp: number, detune: number): void {
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const n = this.noiseSource(0.65 + detune * 0.2);
    if (!n) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.linearRampToValueAtTime(240, t + 0.34);
    bp.Q.value = 2.4;
    n.connect(bp);
    bp.connect(v.gain);
    // Amplitude wobble = the fruit's irregular surface tapping the mesh.
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.linearRampToValueAtTime(amp, t + 0.02);
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.05 + i * 0.055;
      v.gain.gain.linearRampToValueAtTime(amp * (0.75 - i * 0.13), tt);
      v.gain.gain.linearRampToValueAtTime(amp * (0.4 - i * 0.07), tt + 0.026);
    }
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    n.start(t);
    n.stop(t + 0.46);
  }

  private scrape(strength: number): void {
    if (this.throttled('scrape', 90)) return;
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const n = this.noiseSource(1.1);
    if (!n) return;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500 + strength * 900, t);
    bp.frequency.linearRampToValueAtTime(1100, t + 0.22);
    bp.Q.value = 0.7;
    n.connect(hp);
    hp.connect(bp);
    bp.connect(v.gain);
    const amp = 0.05 + strength * 0.13;
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.linearRampToValueAtTime(amp, t + 0.04);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    n.start(t);
    n.stop(t + 0.3);
  }

  private grains(strength: number, brightness: number, surface: 'wood' | 'glass' | 'heap'): void {
    if (this.throttled('grains' + surface, 42)) return;
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const count = 3 + Math.round(strength * 7);
    const baseF = surface === 'glass' ? 4200 : surface === 'wood' ? 2400 : 1500;
    const q = surface === 'heap' ? 1.1 : 3.6;
    for (let i = 0; i < count; i++) {
      const at = t + this.rng.range(0, 0.075);
      const n = this.noiseSource(1);
      if (!n) break;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = baseF * brightness * this.rng.range(0.7, 1.45);
      bp.Q.value = q;
      const g = ctx.createGain();
      const amp = (surface === 'heap' ? 0.05 : 0.075) * strength * this.rng.range(0.5, 1.2);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (surface === 'heap' ? 0.05 : 0.028));
      n.connect(bp);
      bp.connect(g);
      g.connect(v.gain);
      n.start(at);
      n.stop(at + 0.09);
    }
    v.gain.gain.value = 1;
  }

  private drip(strength: number, detune: number): void {
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f0 = 620 * (1 + detune * 0.35);
    osc.frequency.setValueAtTime(f0 * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.055);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f0 * 1.3;
    bp.Q.value = 3;
    osc.connect(bp);
    bp.connect(v.gain);
    const amp = 0.16 * strength;
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.exponentialRampToValueAtTime(amp, t + 0.006);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private pour(strength: number): void {
    if (this.throttled('pour', 260)) return;
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const n = this.noiseSource(0.9);
    if (!n) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.linearRampToValueAtTime(950, t + 0.5);
    bp.Q.value = 1.6;
    n.connect(bp);
    bp.connect(v.gain);
    const amp = 0.05 * strength;
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.linearRampToValueAtTime(amp, t + 0.08);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.start(t);
    n.stop(t + 0.6);
  }

  private breath(strength: number): void {
    const ctx = this.ctx;
    const v = this.voice();
    if (!ctx || !v) return;
    const t = ctx.currentTime;
    const n = this.noiseSource(0.5);
    if (!n) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.5);
    lp.frequency.linearRampToValueAtTime(400, t + 1.2);
    n.connect(lp);
    lp.connect(v.gain);
    const amp = 0.06 * strength;
    v.gain.gain.setValueAtTime(0.0001, t);
    v.gain.gain.linearRampToValueAtTime(amp, t + 0.35);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    n.start(t);
    n.stop(t + 1.4);
  }

  private chime(strength: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    // A quiet open fifth -- an acknowledgement, not a fanfare.
    [523.25, 784.0].forEach((f, i) => {
      const v = this.voice();
      if (!v) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(v.gain);
      const at = t + i * 0.09;
      const amp = 0.09 * strength;
      v.gain.gain.setValueAtTime(0.0001, at);
      v.gain.gain.exponentialRampToValueAtTime(amp, at + 0.02);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
      osc.start(at);
      osc.stop(at + 1.2);
    });
  }

  // --- ambience ------------------------------------------------------------

  private startAmbient(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambientBus || this.ambientStarted) return;
    this.ambientStarted = true;
    const t = ctx.currentTime;

    // Warm early-summer air: filtered noise with a slow breathing filter.
    const wind = this.noiseSource(0.35);
    if (wind) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const g = ctx.createGain();
      g.gain.value = 0.34;
      wind.connect(lp);
      lp.connect(g);
      g.connect(this.ambientBus);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);
      lfo.start(t);
      wind.start(t);
    }

    // Distant leaf rustle, very quiet, keeps the field from feeling dead.
    const leaves = this.noiseSource(1.4);
    if (leaves) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3400;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      leaves.connect(bp);
      bp.connect(g);
      g.connect(this.ambientBus);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = 0.035;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start(t);
      leaves.start(t);
    }

    this.ambientBus.gain.setValueAtTime(0.0001, t);
    this.ambientBus.gain.linearRampToValueAtTime(0.28, t + 3.5);
  }

  /** Scene ambience level: the orchard is airier than the indoor workbench. */
  setAmbience(level: number): void {
    if (!this.ctx || !this.ambientBus) return;
    this.ambientBus.gain.setTargetAtTime(clamp01(level) * 0.32, this.ctx.currentTime, 0.8);
  }
}

export const audio = new AudioEngine();
