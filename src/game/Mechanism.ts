import * as THREE from 'three';

/**
 * PlugAndTailpiece + BoltMechanism: the mm→m causal chain.
 * Plug angle is the single input; the cam picks up the bolt over a defined
 * angular window, and the door can only move once the bolt is clear.
 */
export const PLUG_OPEN_ANGLE = Math.PI / 2;
/** cam lobe engages the bolt through this window of plug rotation */
const BOLT_START = 0.55;
const BOLT_END = 1.42;

/** elastic limit when pins are NOT aligned: a few degrees of springy give */
export const ELASTIC_LIMIT = THREE.MathUtils.degToRad(4);

export class Mechanism {
  /** actual plug angle (radians, 0..PI/2) */
  plugAngle = 0;
  /** where the finger is asking the plug to be */
  requestedAngle = 0;
  boltProgress = 0;
  doorAngle = 0;
  /** small pop when the bolt clears */
  static readonly DOOR_POP = 0.05;
  static readonly DOOR_OPEN = 0.6;

  /** advance toward the requested angle; elastic when blocked */
  update(dt: number, aligned: boolean, driving: boolean): void {
    let target: number;
    if (aligned) {
      target = THREE.MathUtils.clamp(this.requestedAngle, 0, PLUG_OPEN_ANGLE);
    } else {
      target = THREE.MathUtils.clamp(this.requestedAngle, -ELASTIC_LIMIT, ELASTIC_LIMIT);
      if (!driving) {
        // spring back to seated when the finger lets go
        this.requestedAngle *= Math.exp(-9 * dt);
        target = THREE.MathUtils.clamp(this.requestedAngle, -ELASTIC_LIMIT, ELASTIC_LIMIT);
      }
    }
    const k = 1 - Math.exp(-18 * dt);
    this.plugAngle += (target - this.plugAngle) * k;
    this.boltProgress = THREE.MathUtils.clamp(
      (this.plugAngle - BOLT_START) / (BOLT_END - BOLT_START),
      0,
      1
    );
  }

  boltCleared(): boolean {
    return this.boltProgress >= 0.985;
  }

  reset(): void {
    this.plugAngle = 0;
    this.requestedAngle = 0;
    this.boltProgress = 0;
    this.doorAngle = 0;
  }
}
