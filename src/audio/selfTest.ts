import { AuscultationChannel } from './AuscultationChannel';
import { BodySoundField, type ChestCoord, type WindowId } from './BodySoundField';
import { HeartSoundSource } from './HeartSoundSource';

export interface WindowMeasurement {
  id: WindowId | 'centre';
  coord: ChestCoord;
  /** RMS of the window around the first sound. */
  s1: number;
  /** RMS of the window around the second sound. */
  s2: number;
  /** s1 / s2 — the thing the child is actually discovering. */
  balance: number;
  /** Fraction of energy above roughly 150 Hz: how defined the edge sounds. */
  brightness: number;
}

/**
 * Renders the real audio graph offline and measures it.
 *
 * This is the check that the piece works at all: the same heartbeat, the same
 * clock and the same four buffers, rendered through the field at five places,
 * has to come out with a different first/second balance and a different
 * brightness at each of them — and it has to change smoothly in between.
 * Loaded on demand, never part of the game bundle.
 */
export async function runAudioSelfTest(): Promise<{
  windows: WindowMeasurement[];
  sweepMonotonic: boolean;
  sweep: Array<{ t: number; balance: number }>;
}> {
  const field = new BodySoundField();
  const period = 60 / 72;
  const systole = 0.3;

  const places: Array<{ id: WindowId | 'centre'; coord: ChestCoord }> = [
    { id: 'centre', coord: { lat: 0, sup: 0.34 } },
    ...field.windows.map((w) => ({ id: w.id, coord: w.at })),
  ];

  const windows: WindowMeasurement[] = [];
  for (const place of places) {
    const measured = await renderPlace(field, place.coord, period, systole);
    windows.push({ id: place.id, coord: place.coord, ...measured });
  }

  // Walk from the aortic area to the mitral area and confirm the balance moves
  // one way the whole time — no steps, no zone edges.
  const sweep: Array<{ t: number; balance: number }> = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const s = field.sample({ lat: -0.44 + t * 1.06, sup: 0.68 - t * 1.04 });
    sweep.push({ t, balance: s.s1 / s.s2 });
  }
  let sweepMonotonic = true;
  for (let i = 1; i < sweep.length; i++) {
    if (sweep[i].balance < sweep[i - 1].balance - 1e-6) sweepMonotonic = false;
  }

  return { windows, sweepMonotonic, sweep };
}

async function renderPlace(
  field: BodySoundField,
  coord: ChestCoord,
  period: number,
  systole: number,
): Promise<{ s1: number; s2: number; balance: number; brightness: number }> {
  const sr = 48000;
  const ctx = new OfflineAudioContext(1, Math.floor(sr * 1.2), sr);
  const source = new HeartSoundSource(ctx);
  const channel = new AuscultationChannel(ctx, ctx.destination);
  const profile = field.sample(coord);
  channel.applyProfile(profile, 0.0001);
  channel.setLevel(1, 0.0001);
  source.scheduleBeat(channel, 0.1, 0.1 + systole, profile);
  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);

  const rms = (from: number, to: number): number => {
    let sum = 0;
    let n = 0;
    for (let i = Math.floor(from * sr); i < Math.min(data.length, Math.floor(to * sr)); i++) {
      sum += data[i] * data[i];
      n++;
    }
    return n ? Math.sqrt(sum / n) : 0;
  };

  const s1 = rms(0.1, 0.1 + Math.min(0.18, systole - 0.02));
  const s2 = rms(0.1 + systole, 0.1 + systole + 0.16);

  // Crude brightness: energy left after a one-pole high-pass near 150 Hz.
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let prevIn = 0;
  let prevOut = 0;
  let hi = 0;
  let all = 0;
  const from = Math.floor(0.1 * sr);
  const to = Math.min(data.length, Math.floor((0.1 + period) * sr));
  for (let i = from; i < to; i++) {
    const x = data[i];
    prevOut = a * (prevOut + x - prevIn);
    prevIn = x;
    hi += prevOut * prevOut;
    all += x * x;
  }
  return {
    s1,
    s2,
    balance: s2 > 1e-9 ? s1 / s2 : 0,
    brightness: all > 1e-12 ? hi / all : 0,
  };
}
