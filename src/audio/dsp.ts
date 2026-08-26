/** 小さなDSP道具。全ての音は起動時にここで生成し、AudioBufferへ焼く。 */
import { makeRng } from '../util/math';

export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  private set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): this {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }

  lowpass(sr: number, f: number, q: number): this {
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    return this.set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al);
  }

  highpass(sr: number, f: number, q: number): this {
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    return this.set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
  }

  bandpass(sr: number, f: number, q: number): this {
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    return this.set(al, 0, -al, 1 + al, -2 * c, 1 - al);
  }

  peaking(sr: number, f: number, q: number, dbGain: number): this {
    const A = Math.pow(10, dbGain / 40);
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    return this.set(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A);
  }

  process(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  reset(): void {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
}

export function noiseArray(n: number, seed: number): Float32Array {
  const rng = makeRng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}

/** 減衰正弦（モード）を加算する。竹・石の共鳴はこれで作る。 */
export function addMode(
  out: Float32Array,
  sr: number,
  freq: number,
  amp: number,
  decay: number,
  start = 0,
  phase = 0,
): void {
  const w = (2 * Math.PI * freq) / sr;
  const d = Math.exp(-1 / (decay * sr));
  let a = amp;
  for (let i = start; i < out.length; i++) {
    out[i] += a * Math.sin(w * (i - start) + phase);
    a *= d;
    if (a < 1e-5) break;
  }
}

/** ループの継ぎ目を消す。 */
export function makeSeamless(data: Float32Array, fade: number): Float32Array {
  const n = data.length;
  const f = Math.min(fade, Math.floor(n / 3));
  const out = data.slice(0, n - f);
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = out[i] * t + data[n - f + i] * (1 - t);
  }
  return out;
}

export function normalize(data: Float32Array, peak: number): Float32Array {
  let m = 0;
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]));
  if (m > 1e-6) {
    const g = peak / m;
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
  return data;
}

export function softClip(x: number): number {
  return Math.tanh(x * 0.9);
}

function writeChannel(buf: AudioBuffer, data: Float32Array, channel: number): void {
  buf.getChannelData(channel).set(data);
}

export function toBuffer(ctx: BaseAudioContext, data: Float32Array, channels = 1): AudioBuffer {
  const buf = ctx.createBuffer(channels, data.length, ctx.sampleRate);
  for (let c = 0; c < channels; c++) writeChannel(buf, data, c);
  return buf;
}

/** 2ch を別々に持つバッファ（庭の広がり用） */
export function toStereoBuffer(
  ctx: BaseAudioContext,
  l: Float32Array,
  r: Float32Array,
): AudioBuffer {
  const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  writeChannel(buf, l, 0);
  writeChannel(buf, r, 1);
  return buf;
}

export const envAD = (i: number, atk: number, dec: number): number => {
  if (i < atk) return i / atk;
  const t = (i - atk) / Math.max(1, dec);
  return t >= 1 ? 0 : Math.exp(-t * 4) * (1 - t);
};

export function fadeEdges(data: Float32Array, n: number): Float32Array {
  const f = Math.min(n, Math.floor(data.length / 2));
  for (let i = 0; i < f; i++) {
    const t = i / f;
    data[i] *= t;
    data[data.length - 1 - i] *= t;
  }
  return data;
}
