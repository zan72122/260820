import { LANDMARK_X, PHYSICS } from '../core/Config';
import { CourseSpline } from '../course/CourseSpline';
import { approach, clamp, lerp, smoothstep } from '../core/Rng';

/**
 * One raft, one number: how far along the slide it is. Gravity comes from the
 * local grade, resistance from the water film and the standing pools, and the
 * only thing that can ever add energy is the blast.
 */
export class RaftDynamics {
  /** Arc length of the raft centre. */
  s = 0;
  /** Speed along the course, m/s. Negative means sliding back down. */
  v = 0;
  bags = 0;
  released = false;
  /** Highest point reached this run, for the "so close" read. */
  highWater = 0;
  /** True once the raft has settled in the valley pool. */
  resting = false;
  restTimer = 0;

  /** Cosmetic springs - these never feed back into the 1D motion. */
  bob = 0;
  bobVel = 0;
  sway = 0;
  swayVel = 0;
  pitch = 0;
  /** Rubber compression from load + jet, 0..1 each. */
  loadSquash = 0;
  jetSquash = 0;

  private readonly poolFrom: number;
  private readonly poolTo: number;
  private readonly dockS: number;
  private readonly runoutFrom: number;
  private phase = 0;

  constructor(private readonly spline: CourseSpline) {
    this.poolFrom = spline.sAtX(PHYSICS.POOL_FROM_X);
    this.poolTo = spline.sAtX(PHYSICS.POOL_TO_X);
    this.dockS = spline.sAtX(LANDMARK_X.restPool);
    this.runoutFrom = spline.sAtX(62.5);
  }

  get mass(): number {
    return PHYSICS.RAFT_MASS + this.bags * PHYSICS.BAG_MASS;
  }

  /** 0 = empty raft, 1 = the heaviest set-up the rig allows. */
  get loadFactor(): number {
    return clamp(this.bags / 2, 0, 1);
  }

  placeAt(s: number): void {
    this.s = s;
    this.v = 0;
    this.highWater = this.spline.heightAt(s);
    this.resting = false;
    this.restTimer = 0;
    this.bob = 0;
    this.bobVel = 0;
    this.sway = 0;
    this.swayVel = 0;
    this.pitch = 0;
    this.jetSquash = 0;
    this.released = false;
  }

  /** How much of the course is standing water at this point, 0..1. */
  private poolMix(s: number): number {
    if (s >= this.poolFrom && s <= this.poolTo) {
      const mid = (this.poolFrom + this.poolTo) * 0.5;
      const half = (this.poolTo - this.poolFrom) * 0.5;
      return clamp(1 - Math.abs(s - mid) / half, 0, 1);
    }
    return 0;
  }

  /** Fixed-step integration. thrust is in newtons along the course. */
  step(dt: number, thrust: number): void {
    if (!this.released) {
      // The launch dog holds the raft on the ramp until a hand sends it off.
      this.v = 0;
      this.integrateCosmetics(dt, 0, 0, this.spline.gradeAt(this.s));
      return;
    }
    const m = this.mass;
    const grade = this.spline.gradeAt(this.s);
    const cosT = Math.sqrt(Math.max(0, 1 - grade * grade));

    let f = -PHYSICS.G * grade * m;
    if (Math.abs(this.v) > 1e-4) {
      f -= Math.sign(this.v) * PHYSICS.FRICTION * PHYSICS.G * cosT * m;
    }
    f -= PHYSICS.DRAG * this.v * Math.abs(this.v);

    const pool = this.poolMix(this.s);
    if (pool > 0) {
      f -= pool * (PHYSICS.POOL_DRAG * this.v * Math.abs(this.v) + PHYSICS.POOL_LINEAR * this.v);
    }
    // The waiting dimple only grabs a raft that has already run out of speed,
    // so the first fast pass through the valley is untouched by it.
    const dock = clamp(1 - Math.abs(this.s - this.dockS) / PHYSICS.DOCK_SPAN, 0, 1);
    // Full grip on a raft drifting back or barely moving; it eases off once
    // the raft is genuinely running forward, so a blast can drive it out.
    const docking =
      dock * lerp(1, PHYSICS.DOCK_FORWARD_BIAS, smoothstep(0.5, 2.0, this.v));
    if (docking > 0) f -= docking * PHYSICS.DOCK_DAMPING * this.v;
    if (this.s > this.runoutFrom) {
      const w = clamp((this.s - this.runoutFrom) / 3.5, 0, 1);
      f -= w * (PHYSICS.RUNOUT_DRAG * this.v * Math.abs(this.v) + PHYSICS.RUNOUT_LINEAR * this.v);
    }

    if (this.released) f += thrust;

    const a = f / m;
    const pushed = this.released && Math.abs(f) > PHYSICS.STATIC_HOLD;
    this.v += a * dt;

    // Deterministic rest: on flat-ish standing water a crawling raft stops
    // instead of creeping forever, which keeps threshold runs repeatable.
    if (
      (docking > 0.2 || this.s > this.runoutFrom) &&
      Math.abs(this.v) < PHYSICS.REST_SPEED &&
      Math.abs(grade) < 0.045 &&
      !pushed
    ) {
      this.v = 0;
      this.resting = true;
      this.restTimer += dt;
    } else if (pushed || Math.abs(this.v) > PHYSICS.REST_SPEED * 2) {
      this.resting = false;
      this.restTimer = 0;
    }

    this.s = clamp(this.s + this.v * dt, 0, this.spline.length - 0.4);
    if (this.s <= 0 || this.s >= this.spline.length - 0.4) this.v = 0;

    const h = this.spline.heightAt(this.s);
    if (h > this.highWater) this.highWater = h;

    this.integrateCosmetics(dt, a, thrust, grade);
  }

  private integrateCosmetics(dt: number, a: number, thrust: number, grade: number): void {
    this.phase += dt * (1.6 + Math.abs(this.v) * 0.42);

    // Vertical bob: heavier rafts sit lower and answer more slowly.
    const sink = -0.035 - 0.055 * this.loadFactor;
    const wobble = Math.sin(this.phase * 2.1) * 0.012 * clamp(Math.abs(this.v) * 0.35, 0, 1);
    const targetBob = sink + wobble;
    const k = 46 - 14 * this.loadFactor;
    const c = 2 * Math.sqrt(k) * 0.5;
    this.bobVel += (-(this.bob - targetBob) * k - this.bobVel * c) * dt;
    this.bobVel = clamp(this.bobVel, -6, 6);
    this.bob += this.bobVel * dt;

    // Lateral sway: only ever a few centimetres, and never a roll.
    const swayTarget = Math.sin(this.phase * 0.83) * 0.05 * clamp(Math.abs(this.v) * 0.2, 0, 1);
    const ks = 30;
    this.swayVel += (-(this.sway - swayTarget) * ks - this.swayVel * 5.2) * dt;
    this.sway += this.swayVel * dt;

    // Nose lifts a little when the water is pushing, and when climbing.
    const pitchTarget = clamp(a * 0.012 - grade * 0.09, -0.09, 0.11);
    this.pitch = approach(this.pitch, pitchTarget, 0.16, dt);

    this.loadSquash = approach(this.loadSquash, this.loadFactor, 0.25, dt);
    const jetTarget = clamp(thrust / 620, 0, 1);
    this.jetSquash = approach(this.jetSquash, this.released ? jetTarget : 0, 0.09, dt);
  }
}
