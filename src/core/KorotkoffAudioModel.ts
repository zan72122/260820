import { clamp01, lerp, smoothstep } from '../util/math';
import type { AudioSession } from './AudioSession';
import type { HeartModel } from './HeartModel';
import { CuffPressureModel } from './CuffPressureModel';
import { Signal } from './Signals';

export interface BeatVoicing {
  /** 0 when nothing is heard, up to 1 at the clearest point of the window. */
  gain: number;
  /** 1 = sharp tap, 0 = muffled thud. */
  brightness: number;
}

/**
 * Turns cuff pressure into what the stethoscope hears.
 *
 * The mapping is a pure function of pressure — no randomness anywhere — so the
 * sound appears at exactly the same point every single time the child repeats
 * the run. Level and band are shifted upward from a clinical recording so a
 * four-year-old can hear them on a phone speaker; the *order* of events
 * (shut = silent, partly open = tapping, open = silent) is untouched.
 */
export const voicingFor = (pressure: number): BeatVoicing => {
  const p = CuffPressureModel.windowPhase(pressure);
  if (pressure >= 0.999 || p <= 0 || p >= 1) return { gain: 0, brightness: 0 };
  // Appears just inside the top edge rather than exactly on it.
  const onset = smoothstep(0.995, 0.9, p);
  // Fades out toward the bottom edge and is gone before it.
  const tail = smoothstep(0.0, 0.2, p);
  const body = 0.6 + 0.4 * smoothstep(0.12, 0.72, p);
  return {
    gain: clamp01(onset * tail * body),
    brightness: clamp01(smoothstep(0.1, 0.82, p)),
  };
};

export class KorotkoffAudioModel {
  /** Fires on the audio-clock time of each audible tap. */
  readonly onSoundBeat = new Signal<{ time: number; gain: number }>();
  /** Fires on every module beat, audible or not (drives the visible twitch). */
  readonly onModuleBeat = new Signal<{ time: number }>();
  /** Number of audible taps produced in the current run. */
  audibleCount = 0;

  private timer: number | null = null;
  private nextBeat = 0;
  private lookahead = 0.15;
  private sample: (time: number) => number = () => 0;
  private contact = 0;
  private allowed = true;

  constructor(
    private audio: AudioSession,
    private heart: HeartModel,
  ) {}

  /** `sample` predicts cuff pressure at a future audio-clock time. */
  start(sample: (time: number) => number): void {
    this.sample = sample;
    const ctx = this.audio.ctx;
    if (!ctx || this.timer !== null) return;
    this.heart.anchorToAudio(ctx.currentTime);
    this.nextBeat = Math.ceil(this.heart.beatAt(ctx.currentTime) + 0.05);
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  resetRun(): void {
    this.audibleCount = 0;
  }

  /** How firmly the chestpiece sits on the skin, 0..1. */
  setContact(c: number): void {
    this.contact = clamp01(c);
  }

  /**
   * Tapping belongs to the deflation. While the child is still pumping, the
   * cuff races up through the window in a beat or two; suppressing it there
   * keeps the appearance of the sound tied to the child's own hand easing the
   * valve open, which is the one causal link this game is about.
   */
  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
  }

  private tick(): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const horizon = ctx.currentTime + this.lookahead;
    let guard = 0;
    while (this.heart.timeOfBeat(this.nextBeat) < horizon && guard++ < 8) {
      const t = this.heart.timeOfBeat(this.nextBeat);
      if (t > ctx.currentTime + 0.005) this.scheduleBeat(t);
      this.nextBeat += 1;
    }
  }

  private scheduleBeat(time: number): void {
    const pressure = this.sample(time);
    const v = voicingFor(pressure);
    this.moduleTick(time);
    this.onModuleBeat.emit({ time });
    if (v.gain > 0.01 && this.contact > 0.3 && this.allowed) {
      this.korotkoff(time, v);
      this.audibleCount += 1;
      this.onSoundBeat.emit({ time, gain: v.gain });
    }
  }

  /**
   * The pulse module itself: a small solenoid tick, on the mechanical bus, so
   * it is audible in the room without the stethoscope. This is the sound that
   * proves something is running while the stethoscope stays silent.
   */
  private moduleTick(time: number): void {
    const ctx = this.audio.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.getNoiseBuffer();
    src.playbackRate.value = 1.8;
    // Deterministic read offset tied to the beat, not to a random number.
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.055, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 0.035);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(310, time);
    body.frequency.exponentialRampToValueAtTime(190, time + 0.04);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.03, time + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.audio.mechanicalBus);
    body.connect(bodyGain);
    bodyGain.connect(this.audio.mechanicalBus);

    src.start(time, 0.31);
    src.stop(time + 0.06);
    body.start(time);
    body.stop(time + 0.06);
  }

  /**
   * One Korotkoff tap: a short low thump with a filtered noise transient on
   * top. Crisp and bright at the top of the window, softer and duller as the
   * cuff loosens, then nothing.
   */
  private korotkoff(time: number, v: BeatVoicing): void {
    const ctx = this.audio.ctx!;
    const level = v.gain * lerp(0.5, 1, this.contact);

    // Low body — the "ton".
    const thumpFreq = lerp(96, 158, v.brightness);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(thumpFreq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(thumpFreq, time + 0.03);
    const oscGain = ctx.createGain();
    const decay = lerp(0.1, 0.055, v.brightness);
    oscGain.gain.setValueAtTime(0.0001, time);
    oscGain.gain.exponentialRampToValueAtTime(0.5 * level, time + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    // A second, slightly detuned partial keeps it from sounding like a beep.
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(thumpFreq * 2.02, time);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.0001, time);
    osc2Gain.gain.exponentialRampToValueAtTime(0.13 * level * v.brightness + 0.02, time + 0.003);
    osc2Gain.gain.exponentialRampToValueAtTime(0.0001, time + decay * 0.6);

    // Turbulent transient — the jet through the partly open vessel.
    const noise = ctx.createBufferSource();
    noise.buffer = this.audio.getNoiseBuffer();
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(lerp(340, 1000, v.brightness), time);
    bp.Q.value = lerp(1.1, 2.2, v.brightness);
    const noiseGain = ctx.createGain();
    const nLevel = level * lerp(0.1, 0.36, v.brightness);
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, nLevel), time + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + lerp(0.05, 0.028, v.brightness));

    // The stethoscope's own acoustic character: it is not a full-range speaker.
    const shape = ctx.createBiquadFilter();
    shape.type = 'lowpass';
    shape.frequency.value = lerp(700, 1700, v.brightness);
    shape.Q.value = 0.7;

    osc.connect(oscGain);
    oscGain.connect(shape);
    osc2.connect(osc2Gain);
    osc2Gain.connect(shape);
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(shape);
    shape.connect(this.audio.bodyBus);

    osc.start(time);
    osc.stop(time + decay + 0.05);
    osc2.start(time);
    osc2.stop(time + decay + 0.05);
    noise.start(time, 0.77);
    noise.stop(time + 0.09);
  }
}
