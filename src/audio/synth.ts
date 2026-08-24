import { makeRng } from '../core/rng';

/**
 * Every sound in this piece is synthesised here from a fixed seed.
 * No recorded or third-party audio is used (see ATTRIBUTIONS.md), so nothing
 * can drift, and the S1 -> S2 order and timing are guaranteed by construction.
 */

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function bandpassCoeffs(sr: number, freq: number, q: number): BiquadCoeffs {
  const w0 = (2 * Math.PI * freq) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  };
}

function runBiquad(input: Float32Array, c: BiquadCoeffs): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

export interface HeartComponentSpec {
  seed: number;
  /** Total length of the rendered component, seconds. */
  duration: number;
  /** Attack time, seconds. */
  attack: number;
  /** Exponential decay constant — larger is shorter. */
  decay: number;
  /** Centre of the noisy body of the sound, Hz. */
  centre: number;
  /** Resonance of that body. */
  q: number;
  /** Damped partials layered under the noise: [freq, level, damping]. */
  partials: Array<[number, number, number]>;
  /** Peak amplitude. */
  level: number;
}

/**
 * A single heart-sound component (M1, T1, A2 or P2).
 *
 * Real first and second heart sounds are short, low-frequency, noisy thuds
 * produced by the sudden deceleration of blood against closing valves — so
 * they are built here as a resonant noise burst with a couple of damped
 * partials, not as musical tones.
 */
export function renderHeartComponent(sr: number, spec: HeartComponentSpec): Float32Array {
  const n = Math.max(8, Math.floor(spec.duration * sr));
  const rng = makeRng(spec.seed);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rng() * 2 - 1;

  let body = runBiquad(noise, bandpassCoeffs(sr, spec.centre, spec.q));
  body = runBiquad(body, bandpassCoeffs(sr, spec.centre * 1.42, spec.q * 0.7));

  const out = new Float32Array(n);
  const attackSamples = Math.max(2, Math.floor(spec.attack * sr));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const atk = i < attackSamples ? i / attackSamples : 1;
    const env = atk * Math.exp(-spec.decay * t);
    let v = body[i] * 2.4;
    for (const [f, lvl, damp] of spec.partials) {
      v += Math.sin(2 * Math.PI * f * t) * lvl * Math.exp(-damp * t);
    }
    out[i] = v * env;
  }

  // Normalise to the requested peak so the mix balance is authored, not accidental.
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = spec.level / peak;
  for (let i = 0; i < n; i++) out[i] *= k;

  // A short fade out keeps every component click-free.
  const fade = Math.min(n, Math.floor(0.012 * sr));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** Filtered noise loop for room tone, cloth and tube friction. */
export function renderNoiseBed(
  sr: number,
  seconds: number,
  seed: number,
  centre: number,
  q: number,
  level: number,
): Float32Array {
  const n = Math.floor(seconds * sr);
  const rng = makeRng(seed);
  const src = new Float32Array(n);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    src[i] = white * 0.35 + brown * 3.2;
  }
  const filtered = runBiquad(src, bandpassCoeffs(sr, centre, q));
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(filtered[i]));
  const k = level / peak;
  for (let i = 0; i < n; i++) filtered[i] *= k;
  // Cross-fade the seam so the loop is inaudible.
  const xf = Math.min(Math.floor(n / 4), Math.floor(0.35 * sr));
  for (let i = 0; i < xf; i++) {
    const t = i / xf;
    filtered[i] = filtered[i] * t + filtered[n - xf + i] * (1 - t);
  }
  return filtered.slice(0, n - xf);
}

/** A short dry knock — the instructor's knuckle on the exam-table rail. */
export function renderKnock(sr: number, seed: number, centre: number, level: number): Float32Array {
  return renderHeartComponent(sr, {
    seed,
    duration: 0.14,
    attack: 0.0008,
    decay: 46,
    centre,
    q: 1.7,
    partials: [
      [centre * 1.9, 0.5, 90],
      [centre * 3.3, 0.22, 150],
    ],
    level,
  });
}

/** Soft rubbery seat of an eartip / thump of the chestpiece meeting skin. */
export function renderContactThud(sr: number, seed: number, level: number): Float32Array {
  return renderHeartComponent(sr, {
    seed,
    duration: 0.2,
    attack: 0.004,
    decay: 30,
    centre: 130,
    q: 0.9,
    partials: [[74, 0.6, 34]],
    level,
  });
}

export function toAudioBuffer(ctx: BaseAudioContext, data: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}
