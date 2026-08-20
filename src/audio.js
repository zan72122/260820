/**
 * Web Audio: this is the game's real "camera" while the blindfold is down.
 *
 * Spatialisation is done by hand (StereoPanner + head-shadow low-pass + a
 * front/back gain lobe) rather than with a PannerNode. Hand-rolled panning
 * behaves identically on every browser, still gives a usable cue on a mono
 * phone speaker, and lets the design tune "how obvious is left vs right"
 * directly — which is the whole mechanic.
 *
 * Voices are synthesised (glottal saw + three formant band-passes), so the
 * game ships with no audio assets and every caller can be re-pitched per round.
 */

const VOWELS = {
  a: [780, 1180, 2700],
  i: [300, 2280, 3000],
  u: [350, 1250, 2200],
  e: [530, 1840, 2480],
  o: [500, 900, 2600],
};

/** Short calls. `c` consonant, `v` vowel, `d` duration, `p` relative pitch. */
const WORDS = {
  koc_chi:   { text: 'こっち！',     moras: [['k','o',.15,1.0], ['','',.06,1], ['ch','i',.26,1.16]] },
  kocchi_dayo:{text: 'こっちだよー', moras: [['k','o',.13,1.0], ['','',.05,1], ['ch','i',.15,1.14], ['d','a',.14,1.05], ['y','o',.34,.92]] },
  ooi:       { text: 'おーい！',     moras: [['','o',.30,.98], ['','i',.34,1.12]] },
  mou_chotto:{ text: 'もうちょっと', moras: [['m','o',.16,1.0], ['','u',.10,1.02], ['ch','o',.14,1.1], ['','',.05,1], ['t','o',.20,1.0]] },
  chikai:    { text: 'ちかいよ！',   moras: [['ch','i',.14,1.06], ['k','a',.14,1.12], ['','i',.16,1.2], ['y','o',.24,1.0]] },
  soko:      { text: 'そこ！',       moras: [['s','o',.15,1.14], ['k','o',.26,1.3]] },
  sokoda:    { text: 'そこそこ！',   moras: [['s','o',.12,1.14], ['k','o',.13,1.26], ['s','o',.12,1.2], ['k','o',.24,1.34]] },
  sou:       { text: 'そう！',       moras: [['s','o',.16,1.1], ['','u',.26,1.18]] },
  ganbare:   { text: 'がんばれー',   moras: [['g','a',.15,1.0], ['n','',.10,.96], ['b','a',.14,1.04], ['r','e',.32,.94]] },
  imada:     { text: 'いまだ！',     moras: [['','i',.13,1.1], ['m','a',.13,1.16], ['d','a',.26,1.24]] },
  yatta:     { text: 'やったー！',   moras: [['y','a',.14,1.1], ['','',.05,1], ['t','a',.36,1.2]] },
  waa:       { text: 'わあー！',     moras: [['w','a',.46,1.12]] },
  sugoi:     { text: 'すごーい！',   moras: [['s','u',.12,1.0], ['g','o',.22,1.12], ['','i',.30,1.2]] },
  hai:       { text: 'はーい',       moras: [['h','a',.20,1.0], ['','i',.24,1.06]] },
};

export const WORD_TEXT = Object.fromEntries(
  Object.entries(WORDS).map(([k, v]) => [k, v.text]),
);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.sources = new Map();
    this.duck = 1;
    this._noise = null;
  }

  /** Must be called from a real user gesture (iOS requirement). */
  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ready;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC({ latencyHint: 'interactive' });

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);

    this.voiceBus = this.ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voiceBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = 0.55;
    this.ambientBus.connect(this.master);

    // silent tick unlocks playback on iOS
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.connect(this.master); s.start(0);

    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this._buildNoise();
    this._buildAmbience();
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.4);
    this.ready = true;
    return true;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  _buildNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // a touch of brown for body
      d[i] = w * 0.7 + last * 3.2;
    }
    this._noise = buf;
  }

  _noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    s.loop = loop;
    return s;
  }

  /* ---------------- ambience ---------------- */

  _buildAmbience() {
    const ctx = this.ctx;

    // surf: filtered noise with a slow swell
    const surf = this._noiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 120;
    const surfGain = ctx.createGain();
    surfGain.gain.value = 0.34;
    surf.connect(hp); hp.connect(lp); lp.connect(surfGain); surfGain.connect(this.ambientBus);
    surf.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.16;
    lfo.connect(lfoGain); lfoGain.connect(surfGain.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.077;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 260;
    lfo2.connect(lfo2Gain); lfo2Gain.connect(lp.frequency);
    lfo.start(); lfo2.start();

    // cicadas: the sound of a Japanese afternoon
    this._cicada(4600, 62, -0.55, 0.030);
    this._cicada(5400, 41, 0.62, 0.022);
    this._cicada(3600, 88, 0.15, 0.014);

    // a light onshore breeze
    const wind = this._noiseSource(true);
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass'; wlp.frequency.value = 380;
    const wg = ctx.createGain(); wg.gain.value = 0.08;
    wind.connect(wlp); wlp.connect(wg); wg.connect(this.ambientBus);
    wind.start();

    this._ambientNodes = { surfGain };
  }

  _cicada(freq, am, pan, level) {
    const ctx = this.ctx;
    const src = this._noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 9;
    const g = ctx.createGain(); g.gain.value = level;
    const amOsc = ctx.createOscillator();
    amOsc.type = 'sawtooth';
    amOsc.frequency.value = am;
    const amGain = ctx.createGain(); amGain.gain.value = level * 0.85;
    amOsc.connect(amGain); amGain.connect(g.gain);
    const p = this._makePanner(pan);
    src.connect(bp); bp.connect(g); g.connect(p.node); p.out.connect(this.ambientBus);
    src.start(); amOsc.start();
    // slow breathing so it never feels like a loop
    const br = ctx.createOscillator(); br.frequency.value = 0.05 + Math.random() * 0.04;
    const brg = ctx.createGain(); brg.gain.value = level * 0.5;
    br.connect(brg); brg.connect(g.gain); br.start();
  }

  /** StereoPanner when available, equal-power gain pair on older Safari. */
  _makePanner(value = 0) {
    if (this.ctx.createStereoPanner) {
      const n = this.ctx.createStereoPanner();
      n.pan.value = value;
      return { node: n, out: n, param: n.pan };
    }
    const input = this.ctx.createGain();
    const l = this.ctx.createGain(), r = this.ctx.createGain();
    const merger = this.ctx.createChannelMerger(2);
    input.connect(l); input.connect(r);
    l.connect(merger, 0, 0); r.connect(merger, 0, 1);
    const apply = (v, t, c) => {
      const a = (Math.max(-1, Math.min(1, v)) + 1) * Math.PI / 4;
      if (t === undefined) { l.gain.value = Math.cos(a); r.gain.value = Math.sin(a); }
      else { l.gain.setTargetAtTime(Math.cos(a), t, c); r.gain.setTargetAtTime(Math.sin(a), t, c); }
    };
    apply(value);
    const param = {
      setTargetAtTime: (v, t, c) => apply(v, t, c),
      set value(v) { apply(v); },
      get value() { return value; },
    };
    return { node: input, out: merger, param };
  }

  /* ---------------- spatial sources ---------------- */

  /**
   * One persistent chain per hero character. `setSpatial` is called every frame
   * with the source's bearing relative to where the avatar is facing.
   */
  createSource(id) {
    if (!this.ctx) return null;
    if (this.sources.has(id)) return this.sources.get(id);
    const ctx = this.ctx;
    const input = ctx.createGain();
    const shadow = ctx.createBiquadFilter();
    shadow.type = 'lowpass';
    shadow.frequency.value = 8000;
    shadow.Q.value = 0.3;
    const dist = ctx.createGain();
    dist.gain.value = 1;
    const panner = this._makePanner(0);

    input.connect(shadow);
    shadow.connect(dist);
    dist.connect(panner.node);
    panner.out.connect(this.voiceBus);

    const src = {
      id, input, shadow, dist, panner, pan: 0, level: 1,
      /**
       * @param {number} rel  bearing in radians; 0 = dead ahead,
       *                      negative = to the player's left.
       * @param {number} distance metres
       * @param {number} boost extra loudness (design-driven, not physical)
       */
      setSpatial: (rel, distance, boost = 1) => {
        const t = ctx.currentTime;
        const s = Math.sin(rel);
        const c = Math.cos(rel);
        // exaggerated pan: turning must read instantly for a 4-year-old
        const pan = Math.max(-1, Math.min(1, s * 1.25));
        src.pan = pan;                 // inspectable: AudioParams ramp, this does not
        panner.param.setTargetAtTime(pan, t, 0.05);
        // head shadow: muffled when behind, open when in front
        shadow.frequency.setTargetAtTime(1100 + 6400 * Math.max(0, c), t, 0.06);
        const atten = 1 / (1 + Math.pow(distance / 3.2, 1.35));
        const lobe = 0.62 + 0.38 * Math.max(0, c);
        src.level = Math.min(1.6, atten * lobe * boost * 2.1);
        dist.gain.setTargetAtTime(src.level, t, 0.08);
      },
    };
    this.sources.set(id, src);
    return src;
  }

  /* ---------------- voice synthesis ---------------- */

  /**
   * @param {string} sourceId  spatial chain to sing through
   * @param {string} word      key of WORDS
   * @param {object} opts      f0, gain, excitement (0..1), rate
   * @returns {string} caption text
   */
  speak(sourceId, word, opts = {}) {
    const spec = WORDS[word];
    if (!spec) return '';
    if (!this.ready || this.muted) return spec.text;
    const src = this.sources.get(sourceId);
    const out = src ? src.input : this.voiceBus;

    const { f0 = 260, gain = 1, excitement = 0, rate = 1, formantScale = 1 } = opts;
    const ctx = this.ctx;
    let t = ctx.currentTime + 0.02;
    const baseF0 = f0 * (1 + excitement * 0.16);

    const bus = ctx.createGain();
    bus.gain.value = gain * (0.55 + excitement * 0.45);
    bus.connect(out);

    spec.moras.forEach((m, i) => {
      const [cons, vow, dur0, pitch] = m;
      const dur = dur0 / rate;
      if (!vow) {                       // geminate pause (small tsu)
        t += dur;
        return;
      }
      const last = i === spec.moras.length - 1;
      const f = baseF0 * pitch * (1 + excitement * 0.05 * Math.sin(i));
      if (cons) t = this._consonant(cons, t, bus, excitement);
      this._vowel(vow, f, t, dur, bus, {
        formantScale, last, excitement,
      });
      t += dur * 0.92;
    });

    return spec.text;
  }

  _consonant(c, t, out, excitement) {
    const ctx = this.ctx;
    const stops = { k: [2600, 0.012, 0.030], t: [3600, 0.010, 0.026], p: [900, 0.012, 0.028],
                    b: [420, 0.014, 0.024], d: [1600, 0.010, 0.024], g: [1300, 0.014, 0.028] };
    const fric = { s: [6200, 0.075, 0], sh: [3200, 0.085, 0], h: [1400, 0.070, 0], ch: [2900, 0.055, 0.028], ts: [4200, 0.05, 0.024] };
    const nasal = { m: 280, n: 320 };

    if (stops[c] || fric[c]) {
      const [freq, dur, gap] = stops[c] || fric[c];
      t += gap || 0;
      const n = this._noiseSource();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = fric[c] ? 1.4 : 2.2;
      const g = ctx.createGain();
      const amp = (fric[c] ? 0.16 : 0.26) * (1 + excitement * 0.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(out);
      n.start(t); n.stop(t + dur + 0.02);
      return t + dur * 0.6;
    }
    if (nasal[c]) {
      const dur = 0.055;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = nasal[c];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.02);
      return t + dur * 0.75;
    }
    // y / w / r glide straight into the vowel
    return t;
  }

  _vowel(v, f0, t, dur, out, { formantScale = 1, last = false, excitement = 0 }) {
    const ctx = this.ctx;
    const F = VOWELS[v] || VOWELS.a;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // natural declination, with a lift on the final mora of an excited shout
    const endF = last ? f0 * (excitement > 0.5 ? 1.10 : 0.86) : f0 * 0.96;
    osc.frequency.setValueAtTime(f0 * 0.94, t);
    osc.frequency.linearRampToValueAtTime(f0 * 1.02, t + Math.min(0.05, dur * 0.3));
    osc.frequency.linearRampToValueAtTime(endF, t + dur);

    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2 + excitement * 1.8;
    const vibG = ctx.createGain();
    vibG.gain.value = f0 * 0.015;
    vib.connect(vibG); vibG.connect(osc.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.022);
    env.gain.setValueAtTime(0.5, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);

    osc.connect(env);

    // a little breath keeps the synthetic voice from sounding like a buzzer
    const br = this._noiseSource();
    const brf = ctx.createBiquadFilter();
    brf.type = 'bandpass'; brf.frequency.value = F[1] * formantScale; brf.Q.value = 2;
    const brg = ctx.createGain();
    brg.gain.setValueAtTime(0.0001, t);
    brg.gain.exponentialRampToValueAtTime(0.035, t + 0.03);
    brg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    br.connect(brf); brf.connect(brg); brg.connect(out);

    const amps = [0.9, 0.42, 0.16];
    F.forEach((freq, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * formantScale;
      bp.Q.value = 7 + i * 2;
      const g = ctx.createGain();
      g.gain.value = amps[i];
      env.connect(bp); bp.connect(g); g.connect(out);
    });

    osc.start(t); osc.stop(t + dur * 1.2);
    vib.start(t); vib.stop(t + dur * 1.2);
    br.start(t); br.stop(t + dur * 1.2);
  }

  /* ---------------- sound effects ---------------- */

  /** Slow hand-clap used as a continuous "I'm over here" beacon. */
  clap(sourceId, gain = 0.5) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const out = this.sources.get(sourceId)?.input || this.sfxBus;
    const t = ctx.currentTime + 0.01;
    const n = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    n.connect(bp); bp.connect(g); g.connect(out);
    n.start(t); n.stop(t + 0.14);
  }

  footstep(soft = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const n = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 700; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10 * soft, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.2);
  }

  /** The stick cutting the air just before contact. */
  whoosh(dur = 0.26) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.exponentialRampToValueAtTime(2100, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.30, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    n.start(t); n.stop(t + dur + 0.05);
  }

  /** "バコン" — dull thud, hollow rind resonance, then the tearing crack. */
  impact() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, t);
    thud.frequency.exponentialRampToValueAtTime(44, t + 0.22);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(1.0, t + 0.006);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    thud.connect(tg); tg.connect(this.sfxBus);
    thud.start(t); thud.stop(t + 0.36);

    // hollow body: the "コン" half of バコン
    [188, 262, 355].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.34 / (i + 1), t + 0.016);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30 + i * 0.05);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.42);
    });

    // impact body noise
    const n = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.7, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    n.connect(bp); bp.connect(ng); ng.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.26);

    // rind tearing open, a beat later
    const c = this._noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t + 0.035);
    cg.gain.exponentialRampToValueAtTime(0.34, t + 0.055);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    c.connect(hp); hp.connect(cg); cg.connect(this.sfxBus);
    c.start(t + 0.03); c.stop(t + 0.48);
  }

  /** Wet splash of juice hitting the sheet. */
  splash() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.06;
    const n = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.20, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    n.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.4);
  }

  /** Duck everything for the held breath just before the swing. */
  hush(amount = 0.22, time = 0.35) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.ambientBus.gain.setTargetAtTime(0.55 * amount, t, time * 0.4);
    this.voiceBus.gain.setTargetAtTime(amount, t, time * 0.3);
  }

  unhush(time = 0.4) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.ambientBus.gain.setTargetAtTime(0.55, t, time);
    this.voiceBus.gain.setTargetAtTime(1.0, t, time * 0.5);
  }
}
