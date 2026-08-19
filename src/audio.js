// ---------------------------------------------------------------------------
// All sound is synthesised with the Web Audio API - no audio files, so the
// game stays a single self-contained static bundle and starts instantly.
//   - brush : dry "sa-sa" of snow being swept aside
//   - scrape: gritty rub of damp soil
//   - pop   : the "spon!" as the carrot lets go of the ground
//   - knock : the "koto" of a carrot landing in the wooden crate
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let noiseBuf = null;
let windNode = null;
let ready = false;

function makeNoise(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // mild brown tint keeps the noise from sounding like a hiss
    last = (last + 0.02 * white) / 1.02;
    d[i] = white * 0.75 + last * 3.0;
  }
  return buf;
}

/** Must be called from a user gesture (iOS unlocks audio only then). */
export function initAudio() {
  if (ready) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
  } catch (e) { return false; }
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  noiseBuf = makeNoise(2);
  ready = true;
  if (ctx.state === 'suspended') ctx.resume();
  startWind();
  // a silent blip: some iOS versions need one scheduled source to fully unlock
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + 0.02);
  return true;
}

export function audioReady() { return ready && ctx && ctx.state === 'running'; }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.5;
  return s;
}

// --- ambience ---------------------------------------------------------------
function startWind() {
  const src = noiseSource();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 340;
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.0;
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start();
  // slow breathing modulation
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.022;
  lfo.connect(lfoGain); lfoGain.connect(g.gain);
  lfo.start();
  g.gain.setTargetAtTime(0.035, ctx.currentTime, 3);
  windNode = { src, g };
}

// --- one-shots --------------------------------------------------------------
let lastBrush = 0;

/**
 * Sweeping snow: a short band-passed noise stroke. `speed` (0..1) drives
 * brightness and level so slow strokes whisper and fast ones swish.
 */
export function playBrush(speed = 0.5, wet = 0) {
  if (!ready) return;
  const now = ctx.currentTime;
  if (now - lastBrush < 0.055) return;
  lastBrush = now;
  const s = clamp01(speed);
  const src = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  // dry snow is bright and papery; wet soil is darker and grittier
  const centre = (2600 + s * 3400) * (1 - wet * 0.62);
  bp.frequency.value = centre;
  bp.Q.value = 0.8 + wet * 1.6;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = wet > 0.5 ? 180 : 700;
  const g = ctx.createGain();
  const dur = 0.10 + s * 0.13;
  const peak = (0.055 + s * 0.16) * (1 - wet * 0.15);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.012 + s * 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
  bp.frequency.setValueAtTime(centre, now);
  bp.frequency.exponentialRampToValueAtTime(Math.max(220, centre * 0.45), now + dur);
  src.start(now);
  src.stop(now + dur + 0.02);
}

/** Chunky snow being shoved aside - a heavier, crunchier version of brush. */
export function playCrunch(level = 1) {
  if (!ready) return;
  const now = ctx.currentTime;
  const src = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900 + Math.random() * 500;
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  const dur = 0.20;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.12 * level, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(now); src.stop(now + dur + 0.02);
}

/**
 * The money sound: carrot releasing from the soil.
 * A fast upward pitch bend (the "spo") plus a wet transient and a short
 * low tail (the "n") - the classic uncorking pop.
 */
export function playPop() {
  if (!ready) return;
  const now = ctx.currentTime;

  // 1. body: sine whose pitch leaps up as the root breaks free
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(112, now);
  osc.frequency.exponentialRampToValueAtTime(430, now + 0.048);
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.16);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.linearRampToValueAtTime(0.5, now + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
  osc.connect(og); og.connect(master);
  osc.start(now); osc.stop(now + 0.24);

  // 2. transient: the crisp "p"
  const n1 = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1500, now);
  bp.frequency.exponentialRampToValueAtTime(3200, now + 0.05);
  bp.Q.value = 2.4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.linearRampToValueAtTime(0.20, now + 0.005);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
  n1.connect(bp); bp.connect(ng); ng.connect(master);
  n1.start(now); n1.stop(now + 0.14);

  // 3. soil tail: earth crumbling back into the hole
  const n2 = noiseSource();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, now + 0.03);
  lp.frequency.exponentialRampToValueAtTime(320, now + 0.42);
  const n2g = ctx.createGain();
  n2g.gain.setValueAtTime(0.0001, now + 0.03);
  n2g.gain.linearRampToValueAtTime(0.075, now + 0.06);
  n2g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  n2.connect(lp); lp.connect(n2g); n2g.connect(master);
  n2.start(now + 0.03); n2.stop(now + 0.5);
}

/** Soft rising "here it is!" chime when the leaves first show. */
export function playReveal() {
  if (!ready) return;
  const now = ctx.currentTime;
  const notes = [784, 1047, 1319]; // G5 C6 E6
  notes.forEach((f, i) => {
    const t = now + i * 0.085;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13 - i * 0.022, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.8);
    o2.start(t); o2.stop(t + 0.8);
  });
}

/** Wooden "koto" of a carrot dropping into the crate. */
export function playKnock() {
  if (!ready) return;
  const now = ctx.currentTime;
  // hollow wooden body: two damped resonances
  [[196, 0.34, 0.13], [430, 0.20, 0.085], [720, 0.10, 0.055]].forEach(([f, amp, dec]) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.06, now);
    o.frequency.exponentialRampToValueAtTime(f, now + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dec);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + dec + 0.05);
  });
  // knock transient
  const n = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2100;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  n.connect(bp); bp.connect(g); g.connect(master);
  n.start(now); n.stop(now + 0.08);
}

/** Tiny sparkle used when a new dig spot lights up. */
export function playTwinkle(pitch = 1) {
  if (!ready) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1180 * pitch, now);
  o.frequency.exponentialRampToValueAtTime(1760 * pitch, now + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.07, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  o.connect(g); g.connect(master);
  o.start(now); o.stop(now + 0.4);
}

// --- continuous pull rumble -------------------------------------------------
let pull = null;
/** Low creak while the carrot is fighting the soil; call with 0..1 tension. */
export function setPullTension(t) {
  if (!ready) return;
  if (t <= 0.001) {
    if (pull) {
      pull.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      const p = pull; pull = null;
      setTimeout(() => { try { p.src.stop(); } catch (e) {} }, 400);
    }
    return;
  }
  if (!pull) {
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start();
    pull = { src, bp, g };
  }
  const now = ctx.currentTime;
  pull.g.gain.setTargetAtTime(0.02 + t * 0.10, now, 0.04);
  pull.bp.frequency.setTargetAtTime(360 + t * 620, now, 0.06);
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export function setMasterVolume(v) {
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
}
