/* ------------------------------------------------------------------
   Fully synthesised audio (WebAudio). No files to download.
   iOS needs the context resumed inside a user gesture -> start().
------------------------------------------------------------------- */

let ctx = null;
let master = null;
let ready = false;

// persistent loops
let engine = null;   // low diesel rumble
let auger = null;    // rotating auger whir
let chute = null;    // "zaaaa" snow rushing through the chute
let lastThump = 0;

function noiseBuffer(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;   // slight brown tilt, less hissy
    d[i] = w * 0.7 + last * 3.2;
  }
  return buf;
}

function makeNoiseSource(loopBuf) {
  const s = ctx.createBufferSource();
  s.buffer = loopBuf;
  s.loop = true;
  s.start();
  return s;
}

export function isReady() { return ready; }

export function start() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.8);

  const nb = noiseBuffer(3);

  /* ---- engine: two detuned saws + rumble noise through a lowpass ---- */
  {
    const g = ctx.createGain(); g.gain.value = 0.0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 4;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 42;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 28;
    const og = ctx.createGain(); og.gain.value = 0.5;
    const o2g = ctx.createGain(); o2g.gain.value = 0.35;
    const rum = makeNoiseSource(nb);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 130;
    const rg = ctx.createGain(); rg.gain.value = 0.55;
    o1.connect(og); og.connect(lp);
    o2.connect(o2g); o2g.connect(lp);
    rum.connect(rlp); rlp.connect(rg); rg.connect(lp);
    lp.connect(g); g.connect(master);
    o1.start(); o2.start();
    engine = { g, o1, o2, lp };
  }

  /* ---- auger: bandpassed noise + a whirring tone that follows rpm ---- */
  {
    const g = ctx.createGain(); g.gain.value = 0.0;
    const src = makeNoiseSource(nb);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
    const tone = ctx.createOscillator(); tone.type = 'triangle'; tone.frequency.value = 150;
    const tg = ctx.createGain(); tg.gain.value = 0.16;
    src.connect(bp); bp.connect(g);
    tone.connect(tg); tg.connect(g);
    g.connect(master);
    tone.start();
    auger = { g, bp, tone };
  }

  /* ---- chute: the "zaaaa" of snow rushing up the tube ---- */
  {
    const g = ctx.createGain(); g.gain.value = 0.0;
    const src = makeNoiseSource(nb);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.8;
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
    chute = { g, bp };
  }

  ready = true;
}

/* continuous parameters, called every frame ------------------------- */
export function setEngine(load, speed) {
  if (!ready) return;
  const t = ctx.currentTime;
  engine.g.gain.setTargetAtTime(0.20 + load * 0.16, t, 0.25);
  const rpm = 40 + speed * 16 + load * 14;
  engine.o1.frequency.setTargetAtTime(rpm, t, 0.3);
  engine.o2.frequency.setTargetAtTime(rpm * 0.66, t, 0.3);
  engine.lp.frequency.setTargetAtTime(200 + load * 260, t, 0.3);
}

export function setAuger(amount) {
  if (!ready) return;
  const t = ctx.currentTime;
  auger.g.gain.setTargetAtTime(amount * 0.16, t, 0.15);
  auger.bp.frequency.setTargetAtTime(620 + amount * 900, t, 0.2);
  auger.tone.frequency.setTargetAtTime(96 + amount * 120, t, 0.2);
}

export function setChute(amount) {
  if (!ready) return;
  const t = ctx.currentTime;
  chute.g.gain.setTargetAtTime(amount * 0.26, t, 0.12);
  chute.bp.frequency.setTargetAtTime(1500 + amount * 1900, t, 0.15);
}

/* one-shots ---------------------------------------------------------- */
function thumpAt(t, gain, freq, dur, noiseAmt) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(master);

  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.32, t + dur * 0.85);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);

  if (noiseAmt > 0) {
    const nb = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    nb.buffer = b;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.value = noiseAmt * gain;
    nb.connect(lp); lp.connect(ng); ng.connect(master);
    nb.start(t);
  }
}

/** snow landing in the truck bed: "dosu" */
export function thump(strength = 1) {
  if (!ready) return;
  const t = ctx.currentTime;
  if (t - lastThump < 0.075) return;
  lastThump = t;
  thumpAt(t, 0.20 + 0.2 * strength, 96 + Math.random() * 30, 0.28, 0.7);
}

/** the big load sliding off at the dump site */
export function bigDump() {
  if (!ready) return;
  const t = ctx.currentTime;
  thumpAt(t, 0.55, 62, 1.5, 1.0);
  thumpAt(t + 0.22, 0.42, 52, 1.7, 1.1);
  thumpAt(t + 0.5, 0.3, 44, 1.4, 0.9);
  // long snow-rush tail
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
  const len = Math.floor(ctx.sampleRate * 2.4);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
  const s = ctx.createBufferSource(); s.buffer = b;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t);
}

/** hydraulic whine while the bed tilts */
export function hydraulic(up) {
  if (!ready) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.12);
  g.gain.setValueAtTime(0.07, t + 1.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(up ? 300 : 260, t);
  o.frequency.linearRampToValueAtTime(up ? 420 : 190, t + 1.6);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 6;
  o.connect(bp); bp.connect(g); g.connect(master);
  o.start(t); o.stop(t + 2.1);
}

/** friendly chime when the bed gets full */
export function jingle() {
  if (!ready) return;
  const t0 = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = t0 + i * 0.12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.55);
  });
}

/** truck horn - used as a "come here / follow me" cue */
export function horn() {
  if (!ready) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.04);
  g.gain.setValueAtTime(0.16, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
  [196, 233].forEach((f) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 0.7);
  });
  g.connect(master);
}
