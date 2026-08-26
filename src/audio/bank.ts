/**
 * 音源バンク。実機で鳴る短音・ループはすべて起動時にここで合成し、
 * AudioBuffer として事前に用意する（読み込み待ちも decode 待ちも起きない）。
 * 差し替え用に、同じキーへ実録音を読み込ませることもできる構造にしてある。
 */
import { addMode, Biquad, fadeEdges, makeSeamless, noiseArray, normalize, toBuffer, toStereoBuffer } from './dsp';
import { clamp, makeRng } from '../util/math';

export interface SoundBank {
  waterThin: AudioBuffer;
  waterThick: AudioBuffer;
  waterRush: AudioBuffer;
  basinBed: AudioBuffer;
  tubeInterior: AudioBuffer;
  dumpBed: AudioBuffer;
  gateRub: AudioBuffer;
  pivotRub: AudioBuffer;
  leaves: AudioBuffer;
  wind: AudioBuffer;
  drips: AudioBuffer[];
  gulps: AudioBuffer[];
  splashes: AudioBuffer[];
  gateGrains: AudioBuffer[];
  axleCreaks: AudioBuffer[];
  backstops: AudioBuffer[];
  birds: AudioBuffer[];
  /** [竹筒index][変種] 3〜5種類の衝突音 */
  impacts: AudioBuffer[][];
  reverbIR: AudioBuffer;
}

const TAU = Math.PI * 2;

/* ── 素材 ────────────────────────────────── */

function bandNoise(
  sr: number,
  seconds: number,
  seed: number,
  f: number,
  q: number,
  type: 'bp' | 'lp' | 'hp' = 'bp',
): Float32Array {
  const n = Math.floor(sr * seconds);
  const src = noiseArray(n, seed);
  const bq = new Biquad();
  if (type === 'bp') bq.bandpass(sr, f, q);
  else if (type === 'lp') bq.lowpass(sr, f, q);
  else bq.highpass(sr, f, q);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = bq.process(src[i]);
  return out;
}

/** 不規則な振幅ゆらぎ（流量が同じでも音が固まらないように） */
function wobble(n: number, sr: number, seed: number, rate: number, depth: number): Float32Array {
  const rng = makeRng(seed);
  const out = new Float32Array(n);
  let v = 0.5;
  let target = 0.5;
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (i >= next) {
      target = rng();
      next = i + Math.floor((sr / rate) * (0.5 + rng()));
    }
    v += (target - v) * 0.0016;
    out[i] = 1 - depth + depth * v * 2;
  }
  return out;
}

/** 小さな泡・粒を撒く */
function sprinkle(
  out: Float32Array,
  sr: number,
  seed: number,
  perSec: number,
  fLo: number,
  fHi: number,
  decLo: number,
  decHi: number,
  amp: number,
): void {
  const rng = makeRng(seed);
  const n = out.length;
  let t = 0;
  while (t < n) {
    t += Math.floor((sr / perSec) * (0.25 + 1.5 * rng()));
    if (t >= n) break;
    const f = fLo + (fHi - fLo) * Math.pow(rng(), 1.6);
    const dec = decLo + (decHi - decLo) * rng();
    addMode(out, sr, f, amp * (0.35 + 0.65 * rng()), dec, t, rng() * TAU);
  }
}

/* ── 水 ─────────────────────────────────── */

function waterLoop(
  ctx: BaseAudioContext,
  seed: number,
  kind: 'thin' | 'thick' | 'rush',
): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 3.2;
  const n = Math.floor(sr * secs);
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const s = seed + ch * 977;
    let body: Float32Array;
    if (kind === 'thin') {
      body = bandNoise(sr, secs, s, 2100, 0.85);
      const hi = bandNoise(sr, secs, s + 31, 4200, 1.1);
      for (let i = 0; i < n; i++) body[i] = body[i] * 0.9 + hi[i] * 0.5;
    } else if (kind === 'thick') {
      body = bandNoise(sr, secs, s, 1350, 0.7);
      const low = bandNoise(sr, secs, s + 31, 520, 0.8);
      const hi = bandNoise(sr, secs, s + 57, 3400, 1.0);
      for (let i = 0; i < n; i++) body[i] = body[i] * 0.85 + low[i] * 0.55 + hi[i] * 0.3;
    } else {
      body = bandNoise(sr, secs, s, 900, 0.55);
      const low = bandNoise(sr, secs, s + 31, 330, 0.7);
      const hi = bandNoise(sr, secs, s + 57, 2800, 0.8);
      for (let i = 0; i < n; i++) body[i] = body[i] * 0.8 + low[i] * 0.7 + hi[i] * 0.45;
    }
    const wob = wobble(n, sr, s + 101, kind === 'thin' ? 7 : 4, kind === 'thin' ? 0.55 : 0.4);
    for (let i = 0; i < n; i++) body[i] *= wob[i];
    const perSec = kind === 'thin' ? 13 : kind === 'thick' ? 34 : 60;
    const fLo = kind === 'thin' ? 1500 : kind === 'thick' ? 800 : 480;
    const fHi = kind === 'thin' ? 4200 : kind === 'thick' ? 3000 : 2400;
    sprinkle(body, sr, s + 211, perSec, fLo, fHi, 0.004, 0.02, kind === 'thin' ? 0.22 : 0.3);
    chans.push(normalize(makeSeamless(body, Math.floor(sr * 0.25)), 0.85));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

function basinLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 3.0;
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const body = bandNoise(sr, secs, 4400 + ch * 13, 1700, 0.6);
    const low = bandNoise(sr, secs, 4500 + ch * 13, 420, 0.9);
    for (let i = 0; i < body.length; i++) body[i] = body[i] * 0.55 + low[i] * 0.4;
    const wob = wobble(body.length, sr, 4600 + ch, 5, 0.5);
    for (let i = 0; i < body.length; i++) body[i] *= wob[i];
    sprinkle(body, sr, 4700 + ch, 26, 700, 2600, 0.006, 0.035, 0.45);
    chans.push(normalize(makeSeamless(body, Math.floor(sr * 0.22)), 0.8));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

/** 竹筒の内部で水が跳ねる音（生の帯域。空洞共鳴は再生時に付ける） */
function interiorLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 3.0;
  const body = bandNoise(sr, secs, 8100, 900, 0.5);
  const low = bandNoise(sr, secs, 8200, 340, 0.8);
  for (let i = 0; i < body.length; i++) body[i] = body[i] * 0.6 + low[i] * 0.55;
  const wob = wobble(body.length, sr, 8300, 6, 0.6);
  for (let i = 0; i < body.length; i++) body[i] *= wob[i];
  sprinkle(body, sr, 8400, 18, 260, 1100, 0.01, 0.06, 0.5);
  return toBuffer(ctx, normalize(makeSeamless(body, Math.floor(sr * 0.2)), 0.8));
}

function dumpLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 2.4;
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const body = bandNoise(sr, secs, 9100 + ch * 17, 700, 0.5);
    const low = bandNoise(sr, secs, 9200 + ch * 17, 260, 0.7);
    const hi = bandNoise(sr, secs, 9300 + ch * 17, 2600, 0.8);
    for (let i = 0; i < body.length; i++) body[i] = body[i] * 0.9 + low[i] * 0.8 + hi[i] * 0.35;
    const wob = wobble(body.length, sr, 9400 + ch, 9, 0.35);
    for (let i = 0; i < body.length; i++) body[i] *= wob[i];
    sprinkle(body, sr, 9500 + ch, 48, 300, 1800, 0.008, 0.045, 0.4);
    chans.push(normalize(makeSeamless(body, Math.floor(sr * 0.2)), 0.9));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

/* ── 木・軸 ───────────────────────────────── */

function gateRubLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 2.5;
  const n = Math.floor(sr * secs);
  const src = noiseArray(n, 1201);
  const bp = new Biquad().bandpass(sr, 1250, 1.4);
  const bp2 = new Biquad().bandpass(sr, 2600, 2.2);
  const out = new Float32Array(n);
  // 木の中を伝わる短い遅延（櫛形）で「乾いた」響きを作る
  const d = Math.floor(sr * 0.0031);
  for (let i = 0; i < n; i++) {
    const x = src[i];
    let v = bp.process(x) * 0.9 + bp2.process(x) * 0.5;
    if (i > d) v += out[i - d] * 0.42;
    out[i] = v;
  }
  const wob = wobble(n, sr, 1301, 26, 0.75);
  for (let i = 0; i < n; i++) out[i] *= wob[i];
  return toBuffer(ctx, normalize(makeSeamless(out, Math.floor(sr * 0.18)), 0.8));
}

function pivotRubLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 2.5;
  const body = bandNoise(sr, secs, 1501, 1050, 2.4);
  const hi = bandNoise(sr, secs, 1601, 2300, 3.0);
  for (let i = 0; i < body.length; i++) body[i] = body[i] * 0.8 + hi[i] * 0.45;
  const wob = wobble(body.length, sr, 1701, 40, 0.85);
  for (let i = 0; i < body.length; i++) body[i] *= wob[i];
  return toBuffer(ctx, normalize(makeSeamless(body, Math.floor(sr * 0.18)), 0.7));
}

function axleCreak(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.34);
  const src = noiseArray(n, seed);
  const out = new Float32Array(n);
  const rng = makeRng(seed + 7);
  const f0 = 780 + rng() * 420;
  const bq = new Biquad();
  const slip = 42 + rng() * 30;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    bq.bandpass(sr, f0 * (1 + t * 0.7), 5.5);
    const am = 0.45 + 0.55 * Math.abs(Math.sin(TAU * slip * (i / sr)));
    const env = Math.pow(1 - t, 1.6) * Math.min(1, i / (sr * 0.01));
    out[i] = bq.process(src[i]) * am * env;
  }
  return toBuffer(ctx, normalize(out, 0.55));
}

/* ── 粒 ─────────────────────────────────── */

function drip(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.16);
  const out = new Float32Array(n);
  const rng = makeRng(seed);
  const f = 900 + rng() * 1500;
  // 水滴＝上がるピッチの短い正弦
  const dec = 0.02 + rng() * 0.02;
  const w0 = (TAU * f) / sr;
  let ph = 0;
  const glide = 1 + rng() * 0.9;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    ph += w0 * (1 + glide * t);
    const env = Math.exp(-i / (dec * sr));
    out[i] += Math.sin(ph) * env * 0.8;
  }
  const noise = noiseArray(n, seed + 3);
  const bq = new Biquad().bandpass(sr, 3200 + rng() * 1500, 1.2);
  for (let i = 0; i < n; i++) out[i] += bq.process(noise[i]) * Math.exp(-i / (0.004 * sr)) * 0.5;
  return toBuffer(ctx, normalize(out, 0.7));
}

function gulp(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.3);
  const out = new Float32Array(n);
  const rng = makeRng(seed);
  const f = 190 + rng() * 260;
  const w0 = (TAU * f) / sr;
  let ph = 0;
  const glide = -0.35 - rng() * 0.35;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    ph += w0 * (1 + glide * t);
    out[i] += Math.sin(ph) * Math.exp(-i / (0.05 * sr)) * 0.75;
  }
  const noise = noiseArray(n, seed + 5);
  const bq = new Biquad().bandpass(sr, 700 + rng() * 700, 1.0);
  for (let i = 0; i < n; i++) out[i] += bq.process(noise[i]) * Math.exp(-i / (0.012 * sr)) * 0.35;
  return toBuffer(ctx, normalize(out, 0.62));
}

function splash(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.42);
  const rng = makeRng(seed);
  const noise = noiseArray(n, seed + 11);
  const out = new Float32Array(n);
  const bq = new Biquad().bandpass(sr, 1400 + rng() * 1200, 0.8);
  const lo = new Biquad().lowpass(sr, 600 + rng() * 300, 0.9);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / (0.045 * sr));
    const env2 = Math.exp(-i / (0.12 * sr));
    out[i] = bq.process(noise[i]) * env + lo.process(noise[i]) * env2 * 0.55;
  }
  sprinkle(out, sr, seed + 13, 70, 800, 2800, 0.005, 0.02, 0.25);
  return toBuffer(ctx, normalize(fadeEdges(out, Math.floor(sr * 0.005)), 0.75));
}

function gateGrain(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.05);
  const rng = makeRng(seed);
  const noise = noiseArray(n, seed + 2);
  const out = new Float32Array(n);
  const bq = new Biquad().bandpass(sr, 1800 + rng() * 2600, 2.4);
  for (let i = 0; i < n; i++) out[i] = bq.process(noise[i]) * Math.exp(-i / (0.0035 * sr));
  addMode(out, sr, 520 + rng() * 300, 0.25, 0.012, 0, 0);
  return toBuffer(ctx, normalize(out, 0.5));
}

function bird(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.75);
  const out = new Float32Array(n);
  const rng = makeRng(seed);
  const notes = 2 + Math.floor(rng() * 3);
  for (let k = 0; k < notes; k++) {
    const start = Math.floor(rng() * sr * 0.45);
    const len = Math.floor(sr * (0.045 + rng() * 0.06));
    const f0 = 2400 + rng() * 1600;
    const bend = (rng() - 0.35) * 1400;
    let ph = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / len;
      ph += (TAU * (f0 + bend * t)) / sr;
      const env = Math.sin(Math.PI * t);
      out[start + i] += Math.sin(ph) * env * 0.6 + Math.sin(ph * 2) * env * 0.12;
    }
  }
  return toBuffer(ctx, normalize(out, 0.35));
}

/* ── 庭の環境 ────────────────────────────── */

function leavesLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 7.0;
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const body = bandNoise(sr, secs, 2201 + ch * 71, 3600, 0.55);
    const hi = bandNoise(sr, secs, 2301 + ch * 71, 7200, 0.7);
    for (let i = 0; i < body.length; i++) body[i] = body[i] * 0.85 + hi[i] * 0.4;
    const wob = wobble(body.length, sr, 2401 + ch, 0.8, 0.85);
    const wob2 = wobble(body.length, sr, 2501 + ch, 3.5, 0.5);
    for (let i = 0; i < body.length; i++) body[i] *= wob[i] * wob2[i];
    chans.push(normalize(makeSeamless(body, Math.floor(sr * 0.5)), 0.7));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

function windLoop(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 9.0;
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const body = bandNoise(sr, secs, 3301 + ch * 91, 260, 0.6, 'lp');
    const wob = wobble(body.length, sr, 3401 + ch, 0.35, 0.9);
    for (let i = 0; i < body.length; i++) body[i] *= wob[i];
    chans.push(normalize(makeSeamless(body, Math.floor(sr * 0.7)), 0.65));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

/* ── 衝突「コン」 ─────────────────────────── */

/**
 * 竹の曲げモード（非調和）＋筒内の気柱＋石の鈍い高域＋接触トランジェント。
 * variant で打点位置・張り・明るさを変え、20周期聞いても同じ音に聞こえないようにする。
 */
function impact(ctx: BaseAudioContext, length: number, variant: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 1.5);
  const out = new Float32Array(n);
  const rng = makeRng(0xc0 + variant * 977 + Math.floor(length * 1000));
  const scale = 0.64 / length;
  const f0 = 505 * scale * (0.94 + rng() * 0.13);
  // 竹稈の曲げモード比（棒に近い非調和列）
  const ratios = [1, 2.04, 3.42, 5.08, 7.15];
  const contact = 0.22 + variant * 0.13; // 打点の位置（支点からの相対）
  const decays = [0.2, 0.125, 0.08, 0.05, 0.033];
  for (let k = 0; k < ratios.length; k++) {
    const shape = Math.abs(Math.cos(Math.PI * contact * (k + 1)));
    const amp = (0.9 / (1 + k * 0.85)) * (0.45 + 0.55 * shape);
    addMode(out, sr, f0 * ratios[k] * (1 + (rng() - 0.5) * 0.02), amp, decays[k] * (0.85 + rng() * 0.3), 0, rng() * TAU);
  }
  // 筒内の気柱（余韻の芯）。低すぎるとiPhoneで消えるので基音は中域に置く
  const air = (343 / (2 * length)) * 2;
  addMode(out, sr, air, 0.28, 0.34, 0, 0);
  addMode(out, sr, air * 1.99, 0.12, 0.19, 0, 0);
  // 石：鈍い高域と短い反射
  const noise = noiseArray(n, 0x5a + variant * 31);
  const stoneBp = new Biquad().bandpass(sr, 3400 + variant * 420, 1.1);
  const stoneLo = new Biquad().bandpass(sr, 780 + variant * 60, 1.6);
  const clickBp = new Biquad().bandpass(sr, 1900 + variant * 260, 1.0);
  for (let i = 0; i < n; i++) {
    const x = noise[i];
    out[i] += stoneBp.process(x) * Math.exp(-i / (0.018 * sr)) * 0.5;
    out[i] += stoneLo.process(x) * Math.exp(-i / (0.03 * sr)) * 0.35;
    out[i] += clickBp.process(x) * Math.exp(-i / (0.0035 * sr)) * 0.85;
  }
  // 石面からの短い反射（1.6ms 後）
  const refl = Math.floor(sr * 0.0016);
  for (let i = n - 1; i >= refl; i--) out[i] += out[i - refl] * 0.28;
  // 中域を残す（iPhoneスピーカーで竹と石の識別が消えないように）
  const hp = new Biquad().highpass(sr, 105, 0.7);
  const pk = new Biquad().peaking(sr, 1150, 1.1, 4.2);
  for (let i = 0; i < n; i++) out[i] = pk.process(hp.process(out[i]));
  return toBuffer(ctx, normalize(fadeEdges(out, Math.floor(sr * 0.004)), 0.92));
}

function backstop(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.45);
  const out = new Float32Array(n);
  const rng = makeRng(seed);
  addMode(out, sr, 175 + rng() * 60, 0.7, 0.055, 0, 0);
  addMode(out, sr, 355 + rng() * 90, 0.45, 0.035, 0, 0);
  addMode(out, sr, 690 + rng() * 120, 0.2, 0.02, 0, 0);
  const noise = noiseArray(n, seed + 4);
  const lp = new Biquad().lowpass(sr, 900, 0.8);
  for (let i = 0; i < n; i++) out[i] += lp.process(noise[i]) * Math.exp(-i / (0.008 * sr)) * 0.7;
  const hp = new Biquad().highpass(sr, 95, 0.7);
  for (let i = 0; i < n; i++) out[i] = hp.process(out[i]);
  return toBuffer(ctx, normalize(fadeEdges(out, Math.floor(sr * 0.003)), 0.7));
}

/* ── 庭の空間（短い畳み込み用IR） ─────────── */

function gardenIR(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const secs = 0.85; // 過剰に長いリバーブを避ける
  const n = Math.floor(sr * secs);
  const chans: Float32Array[] = [];
  const taps = [0.0061, 0.0113, 0.0187, 0.0261, 0.0344, 0.0471];
  for (let ch = 0; ch < 2; ch++) {
    const rng = makeRng(6001 + ch * 331);
    const out = new Float32Array(n);
    // 初期反射（垣・石・建物）
    for (let k = 0; k < taps.length; k++) {
      const i = Math.floor(sr * taps[k] * (0.9 + rng() * 0.25));
      if (i < n) out[i] += (0.55 - k * 0.07) * (rng() > 0.5 ? 1 : -1);
    }
    // 拡散尾部
    const noise = noiseArray(n, 6101 + ch * 331);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const build = Math.min(1, t / 0.02);
      out[i] += noise[i] * Math.exp(-t * 6.2) * 0.5 * build;
    }
    const lp = new Biquad().lowpass(sr, 4200, 0.7);
    const hp = new Biquad().highpass(sr, 190, 0.7);
    for (let i = 0; i < n; i++) out[i] = hp.process(lp.process(out[i]));
    chans.push(normalize(fadeEdges(out, Math.floor(sr * 0.01)), 0.9));
  }
  return toStereoBuffer(ctx, chans[0], chans[1]);
}

/* ── 生成 ───────────────────────────────── */

export function buildBank(ctx: BaseAudioContext, tubeLengths: number[]): SoundBank {
  const arr = <T>(k: number, f: (i: number) => T): T[] => Array.from({ length: k }, (_, i) => f(i));
  return {
    waterThin: waterLoop(ctx, 101, 'thin'),
    waterThick: waterLoop(ctx, 202, 'thick'),
    waterRush: waterLoop(ctx, 303, 'rush'),
    basinBed: basinLoop(ctx),
    tubeInterior: interiorLoop(ctx),
    dumpBed: dumpLoop(ctx),
    gateRub: gateRubLoop(ctx),
    pivotRub: pivotRubLoop(ctx),
    leaves: leavesLoop(ctx),
    wind: windLoop(ctx),
    drips: arr(5, (i) => drip(ctx, 700 + i * 91)),
    gulps: arr(4, (i) => gulp(ctx, 810 + i * 71)),
    splashes: arr(4, (i) => splash(ctx, 920 + i * 61)),
    gateGrains: arr(4, (i) => gateGrain(ctx, 1030 + i * 53)),
    axleCreaks: arr(3, (i) => axleCreak(ctx, 1140 + i * 47)),
    backstops: arr(2, (i) => backstop(ctx, 1250 + i * 43)),
    birds: arr(3, (i) => bird(ctx, 1360 + i * 37)),
    impacts: tubeLengths.map((L) => arr(5, (v) => impact(ctx, L, v))),
    reverbIR: gardenIR(ctx),
  };
}

export const pick = <T>(list: T[], r: number): T => list[clamp(Math.floor(r * list.length), 0, list.length - 1)];
