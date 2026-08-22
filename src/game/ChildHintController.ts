import { KEY, pinZ } from '../core/config';
import { PinStackRig } from './PinStackRig';

/**
 * The one wordless hint: shortly after the half-inserted mystery is shown,
 * the next pin ahead of the key tip does a single small anticipatory
 * bounce, as if waiting for the key to arrive. Runs once per fresh start,
 * never repeats, never draws text or arrows.
 */
export class ChildHintController {
  private armed = true;
  private delay = 2.4;
  private playing = false;
  private t = 0;

  update(dt: number, rig: PinStackRig, depth: number, interactive: boolean): void {
    if (!this.armed || !interactive) {
      if (this.playing) this.animate(dt, rig);
      return;
    }
    this.delay -= dt;
    if (this.delay <= 0) {
      // first pin the key tip has not yet reached
      const tipZ = -depth * KEY.travel;
      let idx = -1;
      for (let i = 0; i < rig.stacks.length; i++) {
        if (pinZ(i) < tipZ) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        rig.hintPinIndex = idx;
        this.playing = true;
        this.t = 0;
      }
      this.armed = false;
    }
  }

  /** one soft up-down (raised-cosine pulse) */
  private animate(dt: number, rig: PinStackRig): void {
    this.t += dt;
    const dur = 0.9;
    if (this.t >= dur) {
      rig.hintNudge = 0;
      rig.hintPinIndex = -1;
      this.playing = false;
      return;
    }
    const p = this.t / dur;
    rig.hintNudge = 0.0028 * 0.5 * (1 - Math.cos(Math.PI * 2 * p));
  }

  disarm(): void {
    this.armed = false;
  }
}
