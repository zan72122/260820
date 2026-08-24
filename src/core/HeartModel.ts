import { clamp01 } from '../util/math';

/**
 * The manikin's pulse module. It runs from the moment the app boots — before
 * any audio exists — which is what makes the opening silence a puzzle rather
 * than a broken app. Once the AudioContext is alive the clock re-anchors to it,
 * because every sound in the game is scheduled on the audio clock and never on
 * requestAnimationFrame.
 */
export class HeartModel {
  /** Beats per minute of the training module. Varied between runs only. */
  bpm = 76;

  private anchorAudioTime = 0;
  private anchorBeat = 0;
  private wallStart = performance.now() / 1000;
  private audioAnchored = false;

  get period(): number {
    return 60 / this.bpm;
  }

  /** Re-anchor onto the audio clock, keeping beat continuity. */
  anchorToAudio(audioTime: number): void {
    const beat = this.audioAnchored
      ? this.beatAt(audioTime)
      : (performance.now() / 1000 - this.wallStart) / this.period;
    this.anchorBeat = beat;
    this.anchorAudioTime = audioTime;
    this.audioAnchored = true;
  }

  /** Change tempo without a discontinuity in beat phase. */
  setBpm(bpm: number, audioTime: number): void {
    if (this.audioAnchored) {
      this.anchorBeat = this.beatAt(audioTime);
      this.anchorAudioTime = audioTime;
    }
    this.bpm = bpm;
  }

  /** Fractional beat number at an audio-clock time. */
  beatAt(audioTime: number): number {
    return this.anchorBeat + (audioTime - this.anchorAudioTime) / this.period;
  }

  timeOfBeat(beat: number): number {
    return this.anchorAudioTime + (beat - this.anchorBeat) * this.period;
  }

  /** Visual beat phase 0..1 for the render loop (audio time when available). */
  phase(audioTime: number | null): number {
    const beat = this.audioAnchored && audioTime !== null
      ? this.beatAt(audioTime)
      : (performance.now() / 1000 - this.wallStart) / this.period;
    return beat - Math.floor(beat);
  }

  /** Short mechanical twitch envelope used by the visible pulse indicator. */
  pulseEnvelope(audioTime: number | null): number {
    const p = this.phase(audioTime);
    const strike = Math.exp(-p * 26);
    const recoil = Math.exp(-Math.max(0, p - 0.14) * 9) * 0.35;
    return clamp01(strike + recoil * (p > 0.14 ? 1 : 0));
  }
}
