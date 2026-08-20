import * as THREE from 'three';
import { sampleTimeline, phaseNameAt } from './phases.js';

// The arc, in one place.
//
//   waiting   a tiny red thing hangs there and does nothing.       "what is that?"
//   burning   a finger touches, and it answers.                    "it does that if I hold it"
//             then it keeps changing, on its own.                  "it keeps changing"
//   falling   it lets go and drops.                                "oh -- it fell"
//   quiet     the garden is still there.
//   offering  a hand comes back with another one.                  "again"
//
// Nothing here scores anything. The only consequences in the model are physical
// ones: hold it and it lasts, wave it about and the bead deforms and eventually
// lets go, put your finger down again and it recovers.

export const STATE = {
  WAITING: 'waiting',
  BURNING: 'burning',
  FALLING: 'falling',
  QUIET: 'quiet',
  OFFERING: 'offering',
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_DURATION = 58;
const LATER_BASE = 43;

export class Session {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.rootSeed = seed;
    this.rand = mulberry32(seed);
    this.index = 0;
    this.state = STATE.WAITING;
    this.stateTime = 0;
    this.burn = 0;          // 0..1 through the timeline
    this.duration = FIRST_DURATION;
    this.params = sampleTimeline(0, {});
    this.grip = 1;          // how well the sparkler is being held, 0..1
    this.stress = 0;        // accumulated violent shaking
    this.firstSparkFired = false;
    this.sparkCount = 0;
    this.groundGlow = 0;
    this.offerT = 0;
    this.newSparkler = null;  // callback: a fresh one is being handed over
    this.onFirstSpark = null;
    this.onDetach = null;
    this.steadyAccum = 0;
    this.steadySamples = 0;
    this.beginSparkler(true);
  }

  beginSparkler(first) {
    const r = this.rand;
    this.index += first ? 0 : 1;
    // Every sparkler is slightly its own thing: the paper is dyed differently,
    // the powder burns a little faster or slower, the sparks fork a little more.
    this.character = {
      seed: r(),
      dyeA: new THREE.Color().setHSL(0.94 + r() * 0.13, 0.55 + r() * 0.3, 0.22 + r() * 0.12),
      dyeB: new THREE.Color().setHSL(0.08 + r() * 0.14, 0.45 + r() * 0.3, 0.30 + r() * 0.12),
      speedMul: 0.92 + r() * 0.18,
      branchMul: 0.9 + r() * 0.24,
      lifeMul: 0.94 + r() * 0.14,
      twist: 6.2 + r() * 3.2,
    };
    this.duration = first ? FIRST_DURATION : LATER_BASE + r() * 11;
    this.burn = 0;
    this.grip = 1;
    this.stress = 0;
    this.firstSparkFired = false;
    this.sparkCount = 0;
    this.steadyAccum = 0;
    this.steadySamples = 0;
    // The first one is completely forgiving: it cannot be shaken loose, and it
    // cannot be dropped by letting go. It is there to be watched to the end.
    this.forgiving = first;
  }

  get phaseName() {
    return phaseNameAt(this.burn);
  }

  update(dt, input) {
    this.stateTime += dt;

    switch (this.state) {
      case STATE.WAITING:
        // The clock does not start until a finger does. However long that takes.
        if (input.everTouched && input.active) this._enter(STATE.BURNING);
        break;

      case STATE.BURNING:
        this._burning(dt, input);
        break;

      case STATE.FALLING:
        if (this.stateTime > 0.85) {
          this.groundGlow = Math.min(1, (this.stateTime - 0.85) / 0.25);
        }
        if (this.stateTime > 2.6) this._enter(STATE.QUIET);
        break;

      case STATE.QUIET:
        this.groundGlow = Math.max(0, this.groundGlow - dt * 0.42);
        if (this.stateTime > 3.4) {
          this._enter(STATE.OFFERING);
          this.offerT = 0;
        }
        break;

      case STATE.OFFERING:
        this.offerT = Math.min(1, this.stateTime / 4.2);
        if (this.offerT >= 0.46 && !this._handedOver) {
          this._handedOver = true;
          this.beginSparkler(false);
          this.newSparkler?.(this.character);
        }
        if (this.offerT >= 1) {
          this._handedOver = false;
          this.groundGlow = 0;
          this._enter(STATE.WAITING);
        }
        break;
    }

    this.params = sampleTimeline(this.burn, this.params);
    return this.params;
  }

  _burning(dt, input) {
    // Grip: holding restores it quickly, letting go bleeds it away. This is the
    // whole "hold it and it keeps going" lesson, and it is deliberately slow
    // enough that a wandering finger has time to come back.
    if (input.active) {
      this.grip = Math.min(1, this.grip + dt * 0.9);
    } else {
      // The first sparkler bottoms out well above zero. It still visibly weakens
      // when the finger leaves -- which is the whole lesson -- but it cannot be
      // lost that way, because the first one has to be watched to the end.
      const floor = this.forgiving ? 0.32 : 0;
      this.grip = Math.max(floor, this.grip - dt * (this.forgiving ? 0.14 : 0.22));
    }

    if (!this.forgiving) {
      // Genuine waving -- not a four-year-old's tremor -- loosens the bead.
      if (input.shake > 0.72) this.stress += (input.shake - 0.72) * dt * 1.5;
      else this.stress = Math.max(0, this.stress - dt * 0.5);
    }

    this.steadyAccum += input.steadiness * dt;
    this.steadySamples += dt;

    // A steady hold makes it last longer. Not as a reward -- a bead that is not
    // being jostled really does hold together longer. Note the direction: steady
    // means the clock runs *slower*.
    const steadyFactor = 1.10 - 0.22 * input.steadiness;
    this.burn += (dt / this.duration) * steadyFactor;

    if (this.burn >= 1) {
      // Ran its course: a short beat of nothing, then it goes.
      if (this.burn >= 1 + 2.2 / this.duration) this._detach();
      this.burn = Math.min(this.burn, 1 + 2.2 / this.duration);
    }

    if ((!this.forgiving && this.grip <= 0.001) || this.stress > 1.6) this._detach();
  }

  _detach() {
    if (this.state !== STATE.BURNING) return;
    this._enter(STATE.FALLING);
    this.onDetach?.();
  }

  noteSpark(count) {
    this.sparkCount += count;
    if (!this.firstSparkFired && this.sparkCount > 0) {
      this.firstSparkFired = true;
      this.onFirstSpark?.();
    }
  }

  _enter(state) {
    this.state = state;
    this.stateTime = 0;
  }

  /** Effective burn progress clamped for the timeline sampler. */
  get progress() {
    return Math.min(1, this.burn);
  }

  /** 0..1 through the fall, for the camera. */
  fallAmount() {
    if (this.state === STATE.FALLING) return Math.min(1, this.stateTime / 1.1);
    if (this.state === STATE.QUIET) return Math.max(0, 1 - this.stateTime / 1.6);
    return 0;
  }

  /** Extra dimming applied to the bead when the hold has gone slack. */
  get gripDim() {
    return 0.35 + 0.65 * this.grip;
  }
}
