import * as THREE from 'three';
import { CourseSpline, CourseMarks, markCourse } from '../course/CourseSpline';
import { BlastZone } from '../course/BlastZone';
import { RaftDynamics } from '../raft/RaftDynamics';
import { PHYSICS, RUNS, RunPreset } from './Config';
import { clamp } from './Rng';

export interface SimEvents {
  crested: boolean;
  splashed: boolean;
  splashSpeed: number;
  settled: boolean;
  slidBack: boolean;
}

/**
 * Deterministic core: fixed-step integration of the blast hydraulics and the
 * raft, plus the handful of events the flow controller reacts to.
 */
export class Simulation {
  readonly spline = new CourseSpline();
  readonly marks: CourseMarks;
  readonly blast: BlastZone;
  readonly raft: RaftDynamics;

  runIndex = 0;
  /** Water is only supplied once a raft is on the course. */
  armed = false;
  timeSinceRelease = 0;
  blastHeldTotal = 0;
  /** Recorded centre-line path of the current run, for the review line. */
  readonly trail: THREE.Vector3[] = [];

  private accumulator = 0;
  private slowTimer = 0;
  private trailTimer = 0;
  private crestedFlag = false;
  private splashedFlag = false;
  private wasAboveHillToe = false;
  private lastThrust = 0;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    this.marks = markCourse(this.spline);
    this.blast = new BlastZone(this.spline);
    this.raft = new RaftDynamics(this.spline);
    this.applyRun(0);
    this.raft.placeAt(this.marks.launch);
  }

  get preset(): RunPreset {
    return RUNS[clamp(this.runIndex, 0, RUNS.length - 1)];
  }

  get thrust(): number {
    return this.lastThrust;
  }

  /** 0..1 push actually landing on the raft - drives foam, audio, gauge. */
  get pushOnRaft(): number {
    return this.blast.contact;
  }

  applyRun(index: number): void {
    this.runIndex = clamp(index, 0, RUNS.length - 1);
    this.blast.setZones(this.preset.zones);
  }

  /** Put a fresh raft on the launch ramp, valves closed. */
  stage(): void {
    this.raft.placeAt(this.marks.launch);
    this.blast.reset();
    this.armed = false;
    this.timeSinceRelease = 0;
    this.blastHeldTotal = 0;
    this.crestedFlag = false;
    this.splashedFlag = false;
    this.wasAboveHillToe = false;
    this.lastThrust = 0;
    this.trail.length = 0;
    this.accumulator = 0;
    this.slowTimer = 0;
  }

  release(): void {
    if (this.armed) return;
    this.armed = true;
    this.raft.released = true;
    this.raft.v = 1.15; // the gentle shove of a hand on the tube
  }

  update(dt: number, leverPressed: boolean): SimEvents {
    const events: SimEvents = {
      crested: false,
      splashed: false,
      splashSpeed: 0,
      settled: false,
      slidBack: false,
    };

    this.accumulator += Math.min(dt, PHYSICS.MAX_FRAME_DT);
    let steps = 0;
    while (this.accumulator >= PHYSICS.FIXED_DT && steps < 240) {
      const h = PHYSICS.FIXED_DT;
      const prevS = this.raft.s;

      this.blast.update(h, leverPressed, this.armed);
      const thrust = this.blast.thrustOn(this.raft.s);
      this.lastThrust = thrust;
      this.raft.step(h, thrust);

      if (this.armed) {
        this.timeSinceRelease += h;
        if (leverPressed) this.blastHeldTotal += h;
      }

      if (!this.crestedFlag && prevS < this.marks.hillTop && this.raft.s >= this.marks.hillTop) {
        this.crestedFlag = true;
        events.crested = true;
      }
      if (
        !this.splashedFlag &&
        this.crestedFlag &&
        prevS < this.marks.landing &&
        this.raft.s >= this.marks.landing
      ) {
        this.splashedFlag = true;
        events.splashed = true;
        events.splashSpeed = this.raft.v;
      }
      if (this.raft.s > this.marks.hillToe + 1.2) this.wasAboveHillToe = true;
      if (
        this.wasAboveHillToe &&
        !this.crestedFlag &&
        this.raft.s < this.marks.hillToe - 0.5 &&
        this.raft.v < 0
      ) {
        this.wasAboveHillToe = false;
        events.slidBack = true;
      }

      this.accumulator -= h;
      steps++;
    }
    if (steps >= 240) this.accumulator = 0;

    if (this.raft.resting && this.raft.restTimer > 0.35 && !this.crestedFlag) {
      events.settled = true;
    }

    if (this.armed && Math.abs(this.raft.v) < 0.8 && this.raft.s < this.marks.hillToe) {
      this.slowTimer += dt;
    } else {
      this.slowTimer = 0;
    }

    this.trailTimer += dt;
    if (this.armed && Math.abs(this.raft.v) > 0.4 && this.trailTimer > 0.06) {
      this.trailTimer = 0;
      this.spline.positionAt(this.raft.s, this.tmp);
      this.trail.push(this.tmp.clone().add(new THREE.Vector3(0, 0.28, 0)));
      if (this.trail.length > 420) this.trail.shift();
    }

    return events;
  }

  get crested(): boolean {
    return this.crestedFlag;
  }

  get splashed(): boolean {
    return this.splashedFlag;
  }

  /**
   * The raft has run out of speed in the valley. Deliberately a little looser
   * than "fully stopped": the game should get to the nozzle close-up while
   * the raft is still rocking in the dimple, not ten seconds later.
   */
  get parkedInPool(): boolean {
    return (
      this.slowTimer > 0.45 &&
      this.raft.s < this.marks.hillToe &&
      this.raft.s > this.marks.valleyIn - 4 &&
      !this.crestedFlag
    );
  }

  /** Raft has come to rest in the runout at the end of the course. */
  get parkedInRunout(): boolean {
    return this.raft.s > this.marks.landing && Math.abs(this.raft.v) < 0.35;
  }
}
