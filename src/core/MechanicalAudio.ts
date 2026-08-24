import { clamp01, lerp } from '../util/math';
import type { AudioSession } from './AudioSession';

/**
 * Everything the equipment itself makes: the check valve, air entering the
 * bladder, the fabric taking up tension, and the continuous escape hiss while
 * the release valve is open. All on the mechanical bus, so it stays present
 * even while the room is ducked for listening.
 */
export class MechanicalAudio {
  private hissGain: GainNode | null = null;
  private hissFilter: BiquadFilterNode | null = null;
  private started = false;

  constructor(private audio: AudioSession) {}

  start(): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.started) return;
    this.started = true;

    const src = ctx.createBufferSource();
    src.buffer = this.audio.getNoiseBuffer();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.audio.mechanicalBus);
    src.start();

    this.hissGain = g;
    this.hissFilter = bp;
  }

  /** Escape noise is a function of how open the valve is and what is left inside. */
  updateBleed(openness: number, pressure: number): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.hissGain || !this.hissFilter) return;
    const flow = clamp01(openness) * clamp01(pressure * 1.3);
    this.hissGain.gain.setTargetAtTime(flow * 0.075, ctx.currentTime, 0.05);
    this.hissFilter.frequency.setTargetAtTime(
      lerp(1500, 3400, clamp01(openness)),
      ctx.currentTime,
      0.08,
    );
  }

  /** One bulb squeeze: check-valve snap plus air arriving in the bladder. */
  pumpStroke(strength: number, pressure: number): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const level = 0.16 + strength * 0.2;

    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(lerp(240, 340, pressure), t);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, t);
    clickGain.gain.exponentialRampToValueAtTime(level * 0.28, t + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    const clickLp = ctx.createBiquadFilter();
    clickLp.type = 'lowpass';
    clickLp.frequency.value = 2600;
    click.connect(clickGain);
    clickGain.connect(clickLp);
    clickLp.connect(this.audio.mechanicalBus);
    click.start(t);
    click.stop(t + 0.06);

    const air = ctx.createBufferSource();
    air.buffer = this.audio.getNoiseBuffer();
    air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.16);
    bp.Q.value = 0.7;
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(level * 0.5, t + 0.02);
    airGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    air.connect(bp);
    bp.connect(airGain);
    airGain.connect(this.audio.mechanicalBus);
    air.start(t, 1.13);
    air.stop(t + 0.24);
  }

  /** Rubber recovering and drawing air back in through the inlet. */
  bulbRelease(): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const air = ctx.createBufferSource();
    air.buffer = this.audio.getNoiseBuffer();
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    air.connect(lp);
    lp.connect(g);
    g.connect(this.audio.mechanicalBus);
    air.start(t, 0.47);
    air.stop(t + 0.26);
  }

  /** A soft creak as the woven shell takes up tension against the arm. */
  fabricTension(strength: number): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.getNoiseBuffer();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 640;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018 * strength + 0.002, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.audio.mechanicalBus);
    src.start(t, 1.61);
    src.stop(t + 0.34);
  }

  /** The chestpiece meeting the skin: a dull, damped contact. */
  chestpieceContact(): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(88, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g);
    g.connect(this.audio.mechanicalBus);
    osc.start(t);
    osc.stop(t + 0.16);

    const rub = ctx.createBufferSource();
    rub.buffer = this.audio.getNoiseBuffer();
    rub.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    rub.connect(lp);
    lp.connect(rg);
    rg.connect(this.audio.mechanicalBus);
    rub.start(t, 0.23);
    rub.stop(t + 0.2);
  }

  /** Hook-and-loop and cuff dropping loose at the end of a run. */
  cuffRelease(): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.getNoiseBuffer();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.audio.mechanicalBus);
    src.start(t, 0.91);
    src.stop(t + 0.5);
  }
}
