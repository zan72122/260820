import type { CardiacClock } from '../core/CardiacClock';
import type { RoomNoiseMixer } from '../audio/RoomNoiseMixer';
import type { HandPose, InstructorHand } from '../scene/InstructorHand';

export type GuidanceLevel = 'full' | 'light' | 'gesture' | 'none';

/**
 * The adult in the room.
 *
 * Guidance here is physical and it fades: in the first round the instructor's
 * hand sets the chestpiece down and takes the slack out of the tubing; in the
 * second it sweeps once over the upper and once over the lower half of the
 * chest and then withdraws; in the third and fourth it says nothing at all and
 * only knocks once on the rail at the moment of one of the two sounds. By the
 * fifth round the hand is off screen.
 */
export class ChildGuidance {
  private level: GuidanceLevel = 'full';
  private caption = '';
  private captionTimer = 0;
  private markPhase: 1 | 2 | null = null;
  private scheduledKnockBeat = -1;
  private pendingTapAt = 0;
  private sweepTimer = 0;
  private sweepSide: 'upper' | 'lower' = 'upper';
  private sweeping = false;

  constructor(
    private hand: InstructorHand,
    private clock: CardiacClock,
  ) {}

  setLevel(level: GuidanceLevel): void {
    this.level = level;
    if (level === 'none') this.hand.setPose('offstage');
  }

  getLevel(): GuidanceLevel {
    return this.level;
  }

  setPose(pose: HandPose): void {
    if (this.level === 'none' && pose !== 'offstage') return;
    this.hand.setPose(pose);
  }

  /**
   * A short, wordless demonstration: the hand passes once over the upper half
   * of the chest and once over the lower half, then leaves. It never stops on
   * a window.
   */
  startHalvesSweep(): void {
    if (this.level === 'none') return;
    this.sweeping = true;
    this.sweepTimer = 0;
    this.sweepSide = 'upper';
    this.hand.setPose('showUpper');
  }

  get sweepingHalves(): boolean {
    return this.sweeping;
  }

  /**
   * Mark one of the two sounds with a knuckle on the rail. This is how the
   * third and fourth rounds ask their question — there is no sentence, and
   * nothing on the chest changes.
   */
  markSound(which: 1 | 2 | null): void {
    this.markPhase = which;
    this.scheduledKnockBeat = -1;
    this.pendingTapAt = 0;
  }

  getMarkedSound(): 1 | 2 | null {
    return this.markPhase;
  }

  say(text: string, seconds = 6): void {
    this.caption = text;
    this.captionTimer = seconds;
  }

  clearCaption(): void {
    this.caption = '';
    this.captionTimer = 0;
  }

  getCaption(): string {
    return this.captionTimer > 0 ? this.caption : '';
  }

  update(dt: number, room: RoomNoiseMixer | null): void {
    if (this.captionTimer > 0) this.captionTimer -= dt;

    if (this.sweeping) {
      this.sweepTimer += dt;
      if (this.sweepSide === 'upper' && this.sweepTimer > 1.5) {
        this.sweepSide = 'lower';
        this.hand.setPose('showLower');
      } else if (this.sweepSide === 'lower' && this.sweepTimer > 3.1) {
        this.sweeping = false;
        this.hand.setPose('resting');
      }
    }

    if (this.markPhase !== null) {
      // The knock is scheduled ahead on the audio clock so it lands exactly on
      // the sound it is marking, whatever the frame rate is doing.
      const next = this.clock.beatIndex() + 1;
      if (this.scheduledKnockBeat < next && next % 2 === 0) {
        const at = this.clock.timeOfSound(next, this.markPhase);
        room?.knock(at, this.markPhase === 2);
        this.pendingTapAt = at;
        this.scheduledKnockBeat = next;
      }
      // Every other cycle, so it stays a gesture and not a metronome.
      if (this.pendingTapAt > 0 && this.clock.now() >= this.pendingTapAt - 0.09) {
        this.pendingTapAt = 0;
        this.hand.setPose('tapRail');
        this.hand.tap();
      }
    }
  }
}
