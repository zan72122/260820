/**
 * Tiny procedural audio: the crank/rail rumble while a letter is moved
 * (its tone settles when the spacing enters the good range, strains when
 * too narrow), water noise while the valve runs, and a soft splash.
 * No downloaded samples; everything from one noise buffer.
 */
export class AudioKit {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;

  /** Must be called from a user gesture. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 9;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }

    const makeLoop = (freq: number, q: number): [GainNode, BiquadFilterNode] => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      return [gain, filter];
    };

    [this.rumbleGain, this.rumbleFilter] = makeLoop(90, 1.2);
    [this.waterGain] = makeLoop(2600, 0.6);
  }

  /**
   * speed: |letter velocity|. state tunes the machine's voice: the crank
   * load settles in the good range, strains when too narrow.
   */
  rumble(speed: number, state: 'wide' | 'ok' | 'narrow'): void {
    if (!this.ctx || !this.rumbleGain || !this.rumbleFilter) return;
    const t = this.ctx.currentTime;
    const vol = Math.min(0.16, speed * 0.35);
    const freq = state === 'narrow' ? 300 : state === 'ok' ? 70 : 130;
    this.rumbleGain.gain.setTargetAtTime(state === 'ok' ? vol * 0.55 : vol, t, 0.06);
    this.rumbleFilter.frequency.setTargetAtTime(freq, t, 0.1);
  }

  water(on: boolean): void {
    if (!this.ctx || !this.waterGain) return;
    this.waterGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.25);
  }

  splash(): void {
    if (!this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t, 0.3, 0.55);
  }

  thud(): void {
    if (!this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t, 0.8, 0.25);
  }
}
