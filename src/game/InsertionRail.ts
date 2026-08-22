import * as THREE from 'three';

/**
 * Maps finger travel to insertion depth along the lock axis.
 * - swipe direction is projected onto the axis, so diagonal swipes insert;
 * - depth is clamped, so a fast fling still seats safely at full depth;
 * - stopping mid-swipe simply leaves the depth where it is.
 */
export class InsertionRail {
  /** 0 = key just at the keyway mouth, 1 = fully home */
  depth = 0.42;
  readonly minDepth = 0.02;
  private pxPerFullTravel = 420;

  setViewport(w: number, h: number): void {
    this.pxPerFullTravel = Math.min(w, h) * 0.62;
  }

  /** apply projected pixel delta (positive = deeper) */
  push(px: number): void {
    this.depth = THREE.MathUtils.clamp(
      this.depth + px / this.pxPerFullTravel,
      this.minDepth,
      1
    );
  }

  isFull(): boolean {
    return this.depth >= 0.995;
  }

  /** ease toward a scripted depth (intro / key-change animations) */
  glideTo(target: number, dt: number, speed = 1.6): boolean {
    const d = target - this.depth;
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    this.depth += step;
    return Math.abs(target - this.depth) < 0.002;
  }
}
