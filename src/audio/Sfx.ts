/**
 * Small synthesised kitchen sounds. No files, nothing loud: the cream squeeze
 * is a whisper, a finished petal is a soft note, and placing the flower is the
 * only real reward sound.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private extrudeGain: GainNode | null = null;
  private spinGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.035 * white) / 1.035;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buf;

    this.extrudeGain = this.makeNoiseLoop(420, 0.9);
    this.spinGain = this.makeNoiseLoop(1400, 0.4);
  }

  private makeNoiseLoop(freq: number, q: number): GainNode | null {
    if (!this.ctx || !this.noiseBuffer || !this.master) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    return gain;
  }

  setExtrude(amount: number) {
    if (!this.ctx || !this.extrudeGain) return;
    const g = this.muted ? 0 : amount * 0.09;
    this.extrudeGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
  }

  setSpin(amount: number) {
    if (!this.ctx || !this.spinGain) return;
    const g = this.muted ? 0 : amount * 0.014;
    this.spinGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.2);
  }

  private blip(freqs: number[], dur: number, vol: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const start = t0 + i * 0.055;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
  }

  petalDone() {
    this.blip([784, 1046.5], 0.35, 0.07);
  }
  coneReady() {
    this.blip([659.25, 987.77, 1318.5], 0.5, 0.06);
  }
  snap() {
    this.blip([420], 0.09, 0.05, 'triangle');
  }
  layerUp() {
    this.blip([523.25, 659.25], 0.4, 0.05);
  }
  placed() {
    this.blip([523.25, 659.25, 783.99, 1046.5], 0.7, 0.075);
  }
  pickup() {
    this.blip([392, 523.25], 0.25, 0.05, 'triangle');
  }
}
