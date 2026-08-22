import { KEY, LOCK, SHEAR_Y, pinZ } from '../core/config';
import {
  KeyProfileSpec,
  bladeHeightAt,
  lowerPinLength,
} from './FictionalKeyProfile';

export interface PinStackState {
  /** deterministic target: lower pin bottom height above keyway floor */
  targetLift: number;
  /** spring-smoothed visual lift (rendered) */
  visualLift: number;
  /** spring velocity */
  velocity: number;
  /** lower pin length (fixed per stack) */
  lowerLength: number;
  /** world Y of the lower/upper boundary using the DETERMINISTIC lift */
  boundaryY: number;
  /** whether this stack currently crosses the shear line */
  crossesShear: boolean;
}

/**
 * Deterministic pin rig. Pin heights are pure functions of
 * (key profile, insertion depth). A critically-damped spring is layered on
 * top for rendering only — game logic always reads the deterministic value.
 */
export class PinStackRig {
  readonly stacks: PinStackState[] = [];
  private profile: KeyProfileSpec;
  /** one-shot anticipation nudge (ChildHintController drives amplitude) */
  hintNudge = 0;
  hintPinIndex = -1;

  constructor(profile: KeyProfileSpec) {
    this.profile = profile;
    for (let i = 0; i < LOCK.pinCount; i++) {
      this.stacks.push({
        targetLift: LOCK.restLift,
        visualLift: LOCK.restLift,
        velocity: 0,
        lowerLength: lowerPinLength(i),
        boundaryY: LOCK.keywayFloorY + LOCK.restLift + lowerPinLength(i),
        crossesShear: true,
      });
    }
  }

  setProfile(profile: KeyProfileSpec): void {
    this.profile = profile;
  }

  getProfile(): KeyProfileSpec {
    return this.profile;
  }

  /** deterministic lift of stack i at insertion depth d (0..1) */
  liftAt(i: number, depth: number): number {
    const tipZ = -depth * KEY.travel;
    const s = pinZ(i) - tipZ; // arc length from tip currently under pin i
    if (s < 0) return LOCK.restLift; // key has not reached this pin
    return Math.max(bladeHeightAt(this.profile, s), LOCK.restLift * 0.5);
  }

  /** recompute deterministic targets for the given insertion depth */
  setDepth(depth: number): void {
    for (let i = 0; i < LOCK.pinCount; i++) {
      const st = this.stacks[i]!;
      st.targetLift = this.liftAt(i, depth);
      st.boundaryY = LOCK.keywayFloorY + st.targetLift + st.lowerLength;
      st.crossesShear = Math.abs(st.boundaryY - SHEAR_Y) > LOCK.shearTolerance;
    }
  }

  /** all boundaries within tolerance of the shear line? */
  isAligned(): boolean {
    return this.stacks.every((s) => !s.crossesShear);
  }

  /** signed offset (m) of each boundary from the shear line, deterministic */
  boundaryOffsets(): number[] {
    return this.stacks.map((s) => s.boundaryY - SHEAR_Y);
  }

  /** advance the cosmetic springs; never affects logic */
  update(dt: number): void {
    const omega = 34; // rad/s — quick but visibly springy
    for (let i = 0; i < LOCK.pinCount; i++) {
      const st = this.stacks[i]!;
      let target = st.targetLift;
      if (i === this.hintPinIndex) target += this.hintNudge;
      // critically damped spring toward target
      const x = st.visualLift - target;
      const a = -omega * omega * x - 2 * omega * st.velocity;
      st.velocity += a * dt;
      st.visualLift += st.velocity * dt;
      // never intersect the blade or fly out of the chamber
      const maxLift = LOCK.keywayFloorY * -1 + LOCK.plugRadius + LOCK.chamberDepth - st.lowerLength;
      if (st.visualLift < 0) { st.visualLift = 0; st.velocity = 0; }
      if (st.visualLift > maxLift) { st.visualLift = maxLift; st.velocity = 0; }
    }
  }

  /** snap visuals to targets (used on restore / scene cuts) */
  snap(): void {
    for (const st of this.stacks) {
      st.visualLift = st.targetLift;
      st.velocity = 0;
    }
  }
}
