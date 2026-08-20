// Every sound here is synthesised. Nothing is loaded.
//
// The brief asks for ambience rather than music, and for the *sound* to thin out
// after the sparks do -- the silence at the end is part of the drama. It also
// asks, twice over, that the bead falling must never sound like failure. So the
// drop has no impact at all: the crackle simply stops, and the garden is still
// there.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this._crackleAcc = 0;
    this._nextChime = 6 + Math.random() * 10;
    this._nextDrum = 4 + Math.random() * 8;
    this._t = 0;
    this._targets = { hiss: 0, sizzle: 0, crackle: 0 };
    this.lastPhaseName = null;
  }

  /** Must be called from a user gesture on mobile. Safe to call repeatedly. */
  async unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) {
        this.enabled = false;
        return;
      }
      try {
        this.ctx = new Ctx({ latencyHint: 'interactive' });
      } catch {
        this.enabled = false;
        return;
      }
      this._build();
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* the browser will let us try again on the next gesture */
      }
    }
    this.ready = this.ctx.state === 'running';
  }

  _noiseBuffer(seconds = 2) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // A touch of brown in the white keeps it from sounding like TV static.
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.7 + last * 3.2;
    }
    return buf;
  }

  _build() {
    const ctx = this.ctx;
    this.noise = this._noiseBuffer(2.5);

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);

    // --- distance: everything far away goes through this ---------------------
    this.farBus = ctx.createGain();
    this.farBus.gain.value = 1;
    const farLp = ctx.createBiquadFilter();
    farLp.type = 'lowpass';
    farLp.frequency.value = 1400;
    this.farBus.connect(farLp).connect(this.master);

    this.nearBus = ctx.createGain();
    this.nearBus.gain.value = 1;
    this.nearBus.connect(this.master);

    // --- wind -----------------------------------------------------------------
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 320;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.045;
    wind.connect(windLp).connect(this.windGain).connect(this.farBus);
    wind.start();
    this.wind = wind;

    // Slow gusting.
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.055;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 0.028;
    gust.connect(gustAmt).connect(this.windGain.gain);
    gust.start();

    // --- the sparkler itself --------------------------------------------------
    // "ji......": a narrow band of noise, the sound of something small burning.
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = this.noise;
    hissSrc.loop = true;
    const hissBp = ctx.createBiquadFilter();
    hissBp.type = 'bandpass';
    hissBp.frequency.value = 1750;
    hissBp.Q.value = 1.1;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    hissSrc.connect(hissBp).connect(this.hissGain).connect(this.nearBus);
    hissSrc.start();

    // The dry "sara-sara" of the late, thin sparks.
    const sizSrc = ctx.createBufferSource();
    sizSrc.buffer = this.noise;
    sizSrc.loop = true;
    sizSrc.playbackRate.value = 1.4;
    const sizHp = ctx.createBiquadFilter();
    sizHp.type = 'highpass';
    sizHp.frequency.value = 4200;
    const sizBp = ctx.createBiquadFilter();
    sizBp.type = 'peaking';
    sizBp.frequency.value = 7200;
    sizBp.gain.value = 5;
    this.sizzleGain = ctx.createGain();
    this.sizzleGain.gain.value = 0;
    sizSrc.connect(sizHp).connect(sizBp).connect(this.sizzleGain).connect(this.nearBus);
    sizSrc.start();

    this.crackleBus = ctx.createGain();
    this.crackleBus.gain.value = 1;
    this.crackleBus.connect(this.nearBus);
  }

  /** Phase-driven levels. p is a sampled timeline row. */
  setPhase(p, alive) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const gate = alive ? 1 : 0;
    // Kept as plain numbers as well as scheduled: the AudioParam value lags the
    // request by design, so the requested level is what "the sound follows the
    // stages" actually means, and what a test can check.
    this._targets.crackle = p.crackle * gate;
    this._targets.hiss = p.hiss * 0.055 * gate;
    this._targets.sizzle = p.sizzle * 0.030 * gate;
    this.hissGain.gain.setTargetAtTime(this._targets.hiss, t, 0.22);
    this.sizzleGain.gain.setTargetAtTime(this._targets.sizzle, t, 0.3);
  }

  /** A single "pachi". Short, bright, and never the same twice. */
  _crackle(when, strength) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const off = Math.random() * (this.noise.duration - 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200 + Math.random() * 4200;
    bp.Q.value = 2.4 + Math.random() * 3;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() - 0.5) * 1.1;

    const dur = 0.006 + Math.random() * 0.02;
    const peak = strength * (0.05 + Math.random() * 0.09);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.0016);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    src.connect(bp).connect(g);
    if (pan) g.connect(pan).connect(this.crackleBus);
    else g.connect(this.crackleBus);
    src.start(when, off, dur + 0.01);
    src.stop(when + dur + 0.02);
  }

  /** The one deliberate "patsu" when the very first spark leaves the bead. */
  firstSpark() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this._crackle(t, 2.4);
    this._crackle(t + 0.013, 1.2);
  }

  /** No impact, no sting: the bead leaves and the garden is simply audible again. */
  beadFell() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.hissGain.gain.setTargetAtTime(0, t, 0.35);
    this.sizzleGain.gain.setTargetAtTime(0, t, 0.35);
    this._targets.crackle = 0;

    // A soft breath of air as it drops away. Warm, low, and quieter than the
    // crickets it leaves behind.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(lp).connect(g).connect(this.nearBus);
    src.start(t);
    src.stop(t + 1.3);
  }

  /** A cricket: a handful of pulses, not a tone. */
  _cricket(when, freq, panv, level) {
    const ctx = this.ctx;
    const pulses = 3 + Math.floor(Math.random() * 3);
    const g = ctx.createGain();
    g.gain.value = 1;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = panv;
      g.connect(pan).connect(this.farBus);
    } else {
      g.connect(this.farBus);
    }
    for (let i = 0; i < pulses; i++) {
      const t0 = when + i * 0.031;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq * (0.99 + Math.random() * 0.02);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.0001, t0);
      eg.gain.exponentialRampToValueAtTime(level, t0 + 0.004);
      eg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.019);
      osc.connect(eg).connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.03);
    }
  }

  /** A furin: two partials, a long decay, and it is over. */
  _chime(when) {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 1;
    if (pan) {
      pan.pan.value = -0.55;
      out.connect(pan).connect(this.farBus);
    } else {
      out.connect(this.farBus);
    }
    const base = 1980 + Math.random() * 260;
    const partials = [
      [1, 0.02, 2.6],
      [2.74, 0.011, 1.5],
      [5.42, 0.004, 0.8],
    ];
    for (const [ratio, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(amp, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.00008, when + decay);
      osc.connect(g).connect(out);
      osc.start(when);
      osc.stop(when + decay + 0.05);
    }
  }

  /** A festival a long way off: one soft drum, low-passed to almost nothing. */
  _distantDrum(when) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, when);
    osc.frequency.exponentialRampToValueAtTime(54, when + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.017, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
    osc.connect(g).connect(this.farBus);
    osc.start(when);
    osc.stop(when + 0.6);
  }

  update(dt) {
    if (!this.ready) return;
    const ctx = this.ctx;
    this._t += dt;

    // Crackles, scheduled a little ahead. Past roughly twenty-five a second the
    // ear stops counting them and starts hearing "pachi-pachi", which is the
    // goal; going higher would only cost node churn on a phone.
    const rate = clamp(this._targets.crackle, 0, 26);
    this._crackleAcc += rate * dt;
    let budget = Math.min(4, Math.floor(this._crackleAcc));
    this._crackleAcc -= budget;
    const density = clamp(this._targets.crackle / 26, 0, 1);
    while (budget-- > 0) {
      const when = ctx.currentTime + 0.012 + Math.random() * dt;
      this._crackle(when, 0.55 + (1 - density) * 0.9);
    }

    this._nextChime -= dt;
    if (this._nextChime <= 0) {
      this._chime(ctx.currentTime + 0.02);
      this._nextChime = 11 + Math.random() * 22;
    }

    this._nextDrum -= dt;
    if (this._nextDrum <= 0) {
      this._distantDrum(ctx.currentTime + 0.02);
      this._nextDrum = Math.random() < 0.35 ? 0.62 : 9 + Math.random() * 14;
    }

    // Crickets, more or less continuously, from a few directions.
    this._cricketAcc = (this._cricketAcc || 0) + dt;
    if (this._cricketAcc > 0.42) {
      this._cricketAcc = 0;
      if (Math.random() < 0.75) {
        this._cricket(
          ctx.currentTime + Math.random() * 0.3,
          3900 + Math.random() * 1400,
          (Math.random() - 0.5) * 1.6,
          0.0032 + Math.random() * 0.004
        );
      }
    }
  }

  setMuted(muted) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.12);
  }

  suspend() {
    this.ctx?.suspend?.();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }
}
