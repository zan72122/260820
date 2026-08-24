import { clamp01, damp } from '../util/math';
import type { AssistTarget } from '../scene/InstructorHand';

export type Beat =
  | 'awaitStethoscope'
  | 'awaitInflation'
  | 'holdAndNotice'
  | 'awaitValve'
  | 'listening'
  | 'reveal'
  | 'fading'
  | 'comparison'
  | 'ready';

/**
 * All guidance is physical. Nothing is written on the screen, nothing is
 * outlined, nothing lights up. The instructor's hand drifts toward whatever
 * comes next, and a part the child could touch trembles very slightly — the
 * valve because there is pressure behind it, the bulb because a hand is resting
 * near it. If the child is already doing something, the help backs off.
 */
export class ChildGuidance {
  /** Assist-hand destination for the scene rig. */
  assist: AssistTarget = 'idle';
  /** Small physical tremble on the parts that can be touched, 0..1. */
  bulbHint = 0;
  valveHint = 0;
  /** 1 while the whole scene should be still, so the sound has the stage. */
  stillness = 0;

  private idle = 0;
  private strength = 1;
  private targetStill = 0;

  setStrength(v: number): void {
    this.strength = clamp01(v);
  }

  noteActivity(): void {
    this.idle = 0;
  }

  freeze(on: boolean): void {
    this.targetStill = on ? 1 : 0;
  }

  update(beat: Beat, dt: number, interacting: boolean): void {
    this.idle = interacting ? 0 : this.idle + dt;
    // Help arrives only after a child has had time to look around.
    const patience = 3.2 + (1 - this.strength) * 5;
    const nudge = clamp01((this.idle - patience) / 2.5) * this.strength;

    let assist: AssistTarget = 'idle';
    let bulb = 0;
    let valve = 0;

    switch (beat) {
      case 'awaitStethoscope':
        assist = 'steth';
        break;
      case 'awaitInflation':
        assist = 'bulb';
        bulb = nudge;
        break;
      case 'holdAndNotice':
        // The silence is the point here; the hand only rests near the valve.
        assist = 'valve';
        valve = nudge * 0.8;
        break;
      case 'awaitValve':
        assist = 'valve';
        valve = 0.35 + nudge * 0.65;
        break;
      case 'listening':
      case 'reveal':
      case 'comparison':
        assist = 'hold';
        break;
      case 'fading':
        assist = 'valve';
        valve = 0.2;
        break;
      case 'ready':
        assist = 'bulb';
        bulb = nudge * 0.6;
        break;
    }

    this.assist = assist;
    this.bulbHint = damp(this.bulbHint, bulb, 4, dt);
    this.valveHint = damp(this.valveHint, valve, 4, dt);
    this.stillness = damp(this.stillness, this.targetStill, 5, dt);
  }

  reset(): void {
    this.idle = 0;
    this.bulbHint = 0;
    this.valveHint = 0;
    this.stillness = 0;
    this.targetStill = 0;
  }
}
