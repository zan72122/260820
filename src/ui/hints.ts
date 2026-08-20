import { clamp01, smoothstep } from '../util/math';

/**
 * Hints.
 *
 * The rule is strict: a hint may show you *how to work the machine*, never what
 * the machine will do. So the ladder escalates through pure mechanism — the
 * specimen stirs in its clamp, the ring settles a little, a small sound comes
 * from the rig, and finally the ring itself performs the pull and springs back.
 *
 * Nothing about the bounce is ever previewed. The child finds that out by
 * pulling.
 */

export type HintContext = 'ring' | 'tray' | 'shelf' | 'height' | 'tile' | 'none';

const STEPS = [6.5, 11.5, 17.5, 24.5];
const REPEAT = 13;

export class HintDirector {
  context: HintContext = 'none';
  private level = 0;
  private timer = 0;
  private ghostTime = -1;
  private soundPending = false;
  private lastContext: HintContext = 'none';

  /** 0..1 tremor of the held specimen. */
  ballJiggle = 0;
  /** 0..1 extra dip on the release ring. */
  ringDip = 0;
  /** 0..1 progress of the ghost pull, or 0 when idle. */
  ghostPull = 0;
  /** 0..1 nudge applied to the tray, the shelf or a tile. */
  objectNudge = 0;

  setContext(ctx: HintContext) {
    if (ctx === this.context) return;
    this.context = ctx;
    if (ctx !== this.lastContext) {
      this.level = 0;
      this.timer = 0;
      this.ghostTime = -1;
      this.lastContext = ctx;
    }
  }

  /** Any real interaction resets the ladder to the bottom. */
  interrupt() {
    this.level = 0;
    this.timer = 0;
    this.ghostTime = -1;
    this.ballJiggle = 0;
    this.ringDip = 0;
    this.ghostPull = 0;
    this.objectNudge = 0;
  }

  /** True on the frame the small "ぽとん" cue should play. */
  consumeSound() {
    if (!this.soundPending) return false;
    this.soundPending = false;
    return true;
  }

  update(dt: number, idle: number) {
    if (this.context === 'none') {
      this.decay(dt);
      return;
    }

    // Which rung of the ladder are we on?
    let level = 0;
    for (let i = 0; i < STEPS.length; i++) if (idle > STEPS[i]) level = i + 1;
    if (idle > STEPS[STEPS.length - 1]) {
      const since = idle - STEPS[STEPS.length - 1];
      if (since % REPEAT < dt) this.ghostTime = 0;
    }
    if (level > this.level) {
      if (level === 3) this.soundPending = true;
      if (level === 4) this.ghostTime = 0;
      this.level = level;
    }
    if (level < this.level) this.level = level;

    this.timer += dt;

    const ringContext = this.context === 'ring';

    // 1 — the specimen stirs in the clamp.
    const wantJiggle = ringContext && this.level >= 1 ? 1 : 0;
    this.ballJiggle = approach(this.ballJiggle, wantJiggle, dt, 2.2);

    // 2 — the ring settles by a few millimetres, as if it were being noticed.
    const wantDip = ringContext && this.level >= 2 ? 0.5 + 0.5 * Math.sin(this.timer * 1.5) : 0;
    this.ringDip = approach(this.ringDip, wantDip * 0.16, dt, 3.2);

    // 4 — the ring performs the whole pull once, then springs back.
    if (this.ghostTime >= 0) {
      this.ghostTime += dt;
      const t = this.ghostTime;
      // Down over 0.5 s, hold briefly, back up over 0.4 s.
      const down = smoothstep(0, 0.5, t);
      const up = 1 - smoothstep(0.72, 1.12, t);
      this.ghostPull = clamp01(Math.min(down, up)) * 0.62;
      if (t > 1.3) {
        this.ghostTime = -1;
        this.ghostPull = 0;
      }
    } else {
      this.ghostPull = approach(this.ghostPull, 0, dt, 6);
    }

    // For the non-ring contexts the object itself does the asking.
    const wantNudge = !ringContext && this.level >= 2 ? 0.5 + 0.5 * Math.sin(this.timer * 2.1) : 0;
    this.objectNudge = approach(this.objectNudge, wantNudge, dt, 3);
  }

  private decay(dt: number) {
    this.ballJiggle = approach(this.ballJiggle, 0, dt, 4);
    this.ringDip = approach(this.ringDip, 0, dt, 4);
    this.ghostPull = approach(this.ghostPull, 0, dt, 6);
    this.objectNudge = approach(this.objectNudge, 0, dt, 4);
  }

  get currentLevel() {
    return this.level;
  }
}

function approach(current: number, target: number, dt: number, rate: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
