import * as THREE from 'three';
import { NOZZLE, PHYSICS, PUMP } from '../core/Config';
import { CourseSpline } from './CourseSpline';
import { approach, clamp, smoothstep } from '../core/Rng';

export interface Nozzle {
  index: number;
  /** Distance along the course of the nozzle mouth. */
  s: number;
  position: THREE.Vector3;
  /** Jet direction: up-slope and raked away from the floor. */
  direction: THREE.Vector3;
  /** Floor normal at the nozzle. */
  up: THREE.Vector3;
  /** Is this nozzle's valve open for the current run. */
  supplied: boolean;
  /** Order within its supplied zone, 0 = nearest, 1 = furthest. */
  order: number;
  /** Water standing inside the nozzle body, 0..1. */
  fill: number;
  /** Jet flow leaving the bore, 0..1. */
  flow: number;
  /** How far the jet can throw right now, metres. */
  throwLength: number;
  /** Set when this nozzle's jet is currently landing on the raft. */
  hitsRaft: boolean;
}

/**
 * The pressurised floor nozzles. Holds hydraulic state (charge, per-nozzle
 * fill order) and turns it into a single scalar push on the raft.
 */
export class BlastZone {
  readonly nozzles: Nozzle[] = [];
  /** Hydraulic charge behind the lever, 0..1. */
  charge = 0;
  /** Lever travel, 0..1 - what the hand is doing right now. */
  lever = 0;
  /** Total normalised push being delivered to the raft, 0..1. */
  contact = 0;
  private zones: ReadonlyArray<readonly [number, number]> = [];

  constructor(private readonly spline: CourseSpline) {
    const first = spline.sAtX(NOZZLE.firstX);
    const last = spline.sAtX(NOZZLE.lastX);
    const count = Math.max(2, Math.round((last - first) / NOZZLE.spacing) + 1);
    const step = (last - first) / (count - 1);
    const frame = spline.frameAt(first);
    for (let i = 0; i < count; i++) {
      const s = first + step * i;
      spline.frameAt(s, frame);
      const dir = frame.tangent
        .clone()
        .multiplyScalar(Math.cos(NOZZLE.rake))
        .addScaledVector(frame.up, Math.sin(NOZZLE.rake))
        .normalize();
      this.nozzles.push({
        index: i,
        s,
        position: frame.position.clone(),
        direction: dir,
        up: frame.up.clone(),
        supplied: false,
        order: count > 1 ? i / (count - 1) : 0,
        fill: 0,
        flow: 0,
        throwLength: 0,
        hitsRaft: false,
      });
    }
  }

  /** Open the valves for this run. Zones are given in world x. */
  setZones(zonesX: ReadonlyArray<readonly [number, number]>): void {
    this.zones = zonesX.map(([a, b]) => [this.spline.sAtX(a), this.spline.sAtX(b)] as const);
    for (const n of this.nozzles) {
      n.supplied = this.zones.some(([a, b]) => n.s >= a && n.s <= b);
      n.fill = 0;
      n.flow = 0;
      n.throwLength = 0;
      n.hitsRaft = false;
    }
    // Fill order restarts inside each supplied zone so the cascade always
    // reads near-to-far, even when the run has two separate banks.
    for (const [a, b] of this.zones) {
      const inZone = this.nozzles.filter((n) => n.s >= a && n.s <= b);
      inZone.forEach((n, i) => {
        n.order = inZone.length > 1 ? i / (inZone.length - 1) : 0;
      });
    }
  }

  get suppliedCount(): number {
    let c = 0;
    for (const n of this.nozzles) if (n.supplied) c++;
    return c;
  }

  /** Zone boundaries in arc length, for the camera and the plumbing meshes. */
  get zoneBounds(): ReadonlyArray<readonly [number, number]> {
    return this.zones;
  }

  reset(): void {
    this.charge = 0;
    this.lever = 0;
    this.contact = 0;
    for (const n of this.nozzles) {
      n.fill = 0;
      n.flow = 0;
      n.throwLength = 0;
      n.hitsRaft = false;
    }
  }

  /**
   * @param pressed lever held down
   * @param armed the test rig only supplies water once a raft is on the course
   */
  update(dt: number, pressed: boolean, armed: boolean): void {
    const want = pressed ? 1 : 0;
    this.lever = approach(this.lever, want, pressed ? 0.09 : 0.16, dt);
    const target = armed ? want : 0;
    this.charge = approach(this.charge, target, target > this.charge ? PUMP.RISE_TAU : PUMP.FALL_TAU, dt);

    for (const n of this.nozzles) {
      if (!n.supplied) {
        n.fill = approach(n.fill, 0, 0.3, dt);
        n.flow = approach(n.flow, 0, 0.25, dt);
        continue;
      }
      const gate = clamp(
        (this.charge - n.order * PUMP.SEQUENCE_SPREAD) / PUMP.SEQUENCE_WIDTH,
        0,
        1,
      );
      n.fill = approach(n.fill, gate, PUMP.FILL_TAU, dt);
      n.flow = smoothstep(0.55, 1.0, n.fill) * this.charge;
    }
  }

  /**
   * Push delivered to a raft whose centre sits at sCentre, in newtons.
   * Also records, per nozzle, whether its jet is currently landing on the
   * raft - the jet meshes use that to stop exactly at the contact point.
   */
  thrustOn(sCentre: number): number {
    let coverage = 0;
    for (const n of this.nozzles) {
      n.hitsRaft = false;
      if (!n.supplied || n.flow <= 0.001) {
        n.throwLength = 0;
        continue;
      }
      const d = sCentre - n.s; // >0: nozzle is behind the raft
      const reach = PHYSICS.JET_REACH_BEHIND * (0.55 + 0.45 * n.flow);
      // With nothing to hit, the column breaks up within a couple of metres.
      const free = 1.15 + 1.05 * n.flow;
      if (d > -PHYSICS.JET_REACH_AHEAD && d < reach) {
        const w =
          smoothstep(-PHYSICS.JET_REACH_AHEAD, 0.35, d) * (1 - smoothstep(reach - 1.1, reach, d));
        coverage += w * n.flow;
        n.hitsRaft = w > 0.05;
        // Stop the column at the raft's tail, not somewhere inside it.
        n.throwLength = Math.max(0.35, d - PHYSICS.RAFT_LENGTH * 0.42);
      } else {
        n.throwLength = free;
      }
    }
    this.contact = clamp(coverage / PHYSICS.BLAST_COVERAGE_NORM, 0, 1);
    return PHYSICS.BLAST_FORCE * this.contact;
  }
}
