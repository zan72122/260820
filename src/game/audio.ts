/**
 * All sound is synthesised with WebAudio - no audio assets.
 * The context unlocks on the first pointerdown (iOS requirement).
 */

export class Foley {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private pourNodes: { gain: GainNode; stop: () => void } | null = null;
  enabled = true;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      // shared noise buffer, deterministic-ish is unnecessary for audio
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x3fffffff - 1);
      }
      this.startAmbient();
    } catch { /* audio unavailable - play silent */ }
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.loopStart = Math.random() * 1.2;
    return s;
  }

  private startAmbient() {
    if (!this.ctx || !this.master) return;
    // low shop rumble: furnace draft + ventilation
    const src = this.noiseSource(); if (!src) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 130; lp.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    // gentle fan tone
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 46;
    const og = this.ctx.createGain(); og.gain.value = 0.012;
    osc.connect(og).connect(this.master);
    osc.start();
  }

  private burst(opts: { dur: number; freq: number; q?: number; type?: BiquadFilterType; gain: number; attack?: number; freqEnd?: number }) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const src = this.noiseSource(); if (!src) return;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 1;
    const t = this.ctx.currentTime;
    if (opts.freqEnd) f.frequency.linearRampToValueAtTime(opts.freqEnd, t + opts.dur);
    const g = this.ctx.createGain();
    const a = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0004, t + opts.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + opts.dur + 0.1);
  }

  private thump(freq: number, gain: number, dur = 0.28) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * 0.4), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  leverCreak(v = 1) {
    this.burst({ dur: 0.16, freq: 380 + Math.random() * 160, q: 6, gain: 0.05 * v });
  }

  pressCrunch() {
    // sand compacting: broadband low crunch + machine thump
    this.burst({ dur: 0.7, freq: 210, type: 'lowpass', gain: 0.4, attack: 0.05 });
    this.burst({ dur: 0.4, freq: 900, q: 0.8, gain: 0.10 });
    this.thump(70, 0.4, 0.4);
  }

  patternRelease() {
    this.burst({ dur: 0.3, freq: 500, type: 'lowpass', gain: 0.22 });
    this.thump(120, 0.12, 0.15);
  }

  brushSwish() {
    this.burst({ dur: 0.22, freq: 2400 + Math.random() * 900, q: 0.7, gain: 0.08, freqEnd: 1500 });
  }

  slideClick() {
    this.thump(240, 0.1, 0.08);
    this.burst({ dur: 0.08, freq: 1500, q: 3, gain: 0.05 });
  }

  pourStart() {
    if (!this.ctx || !this.master || this.pourNodes) return;
    const src = this.noiseSource(); if (!src) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 500;
    lfo.connect(lfoG).connect(bp.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 0.25);
    const g2 = this.ctx.createGain(); g2.gain.value = 0.35;
    src.connect(lp).connect(g);
    src.connect(bp).connect(g2).connect(g);
    g.connect(this.master);
    src.start(); lfo.start();
    this.pourNodes = {
      gain: g,
      stop: () => { try { src.stop(); lfo.stop(); } catch { /* noop */ } },
    };
  }

  setPourLevel(v: number) {
    if (!this.pourNodes || !this.ctx) return;
    this.pourNodes.gain.gain.setTargetAtTime(0.16 * v, this.ctx.currentTime, 0.12);
  }

  pourStop() {
    if (!this.pourNodes || !this.ctx) return;
    const n = this.pourNodes;
    this.pourNodes = null;
    n.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => n.stop(), 600);
  }

  sizzle() {
    this.burst({ dur: 1.4, freq: 5200, q: 0.6, gain: 0.06, freqEnd: 3300, attack: 0.03 });
  }

  coolTick() {
    if (!this.ctx || !this.master || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1600 + Math.random() * 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.035 + Math.random() * 0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0003, t + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.12);
  }

  crumble() {
    this.burst({ dur: 1.1, freq: 320, type: 'lowpass', gain: 0.42, attack: 0.04 });
    this.burst({ dur: 0.8, freq: 1400, q: 0.6, gain: 0.12 });
    this.thump(55, 0.3, 0.5);
  }

  latchClink() {
    this.thump(300, 0.1, 0.08);
    this.burst({ dur: 0.12, freq: 2600, q: 4, gain: 0.07 });
  }

  chime() {
    if (!this.ctx || !this.master || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (const [f, dt, gv] of [[523.25, 0, 0.10], [659.25, 0.12, 0.09], [783.99, 0.24, 0.11]] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine'; o2.frequency.value = f * 2.76; // bell partial
      const g = this.ctx.createGain();
      const g2 = this.ctx.createGain(); g2.gain.value = 0.2;
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(gv, t + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0003, t + dt + 1.3);
      osc.connect(g); o2.connect(g2).connect(g);
      g.connect(this.master);
      osc.start(t + dt); osc.stop(t + dt + 1.4);
      o2.start(t + dt); o2.stop(t + dt + 1.4);
    }
  }

  /** short spoken letter name, after the reveal only */
  sayLetter(nameJa: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(nameJa);
      u.lang = 'ja-JP';
      u.rate = 0.85;
      u.pitch = 1.15;
      u.volume = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* optional */ }
  }
}
