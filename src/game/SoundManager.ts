import { DoorState } from '../sim/DoorStateMachine';

/**
 * 控えめな環境音。
 * - 扉駆動のモーター音(走行中のみ)
 * - 開いた扉から漏れる空調音(開度に比例)
 * 最初のユーザー操作まで AudioContext を作らない。
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private motorGain: GainNode | null = null;
  private airGain: GainNode | null = null;
  private enabled = true;

  init(): void {
    if (this.ctx || !this.enabled) return;
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;

      const noiseLen = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < noiseLen; i++) {
        // 低域寄りのノイズ(空調らしく)
        const white = Math.random() * 2 - 1;
        last = last * 0.94 + white * 0.06;
        data[i] = last * 3;
      }

      const mkLoop = (freq: number): GainNode => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start();
        return gain;
      };
      this.airGain = mkLoop(600);
      this.motorGain = mkLoop(240);
    } catch {
      this.enabled = false;
    }
  }

  update(state: DoorState, position: number): void {
    if (!this.ctx) return;
    const moving = state === 'OPENING' || state === 'CLOSING' || state === 'REVERSING';
    const t = this.ctx.currentTime;
    this.motorGain?.gain.setTargetAtTime(moving ? 0.05 : 0, t, 0.08);
    // 開いた隙間から空調音が漏れる
    this.airGain?.gain.setTargetAtTime(position * 0.055, t, 0.25);
  }

  /** やわらかい確認音(正解/操作完了) */
  chime(good = true): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = good ? 660 : 330;
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    if (good) {
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 880;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
      g2.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.65);
    }
  }
}
