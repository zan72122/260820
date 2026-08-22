/**
 * Tiny synthesized music-box voice (no audio assets, no speech). Quiet,
 * short, and started only from a user gesture as mobile browsers require.
 * Failure to start audio is silently ignored — the game never depends on it.
 */
export class AudioChime {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** one soft tine pluck */
  note(freq: number, when = 0, gain = 0.05): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 1.4);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  /** the reward: a slow fictional music-box phrase (pentatonic, gentle) */
  musicBoxPhrase(): void {
    const base = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const order = [0, 2, 4, 3, 1, 4, 5, 4, 2, 0, 3, 2];
    order.forEach((idx, i) => {
      this.note(base[idx] ?? 523.25, 0.4 + i * 0.42, 0.045);
    });
  }

  /** barely-there mechanical seat click (key fully home) */
  seatClick(): void {
    this.note(180, 0, 0.03);
  }
}
