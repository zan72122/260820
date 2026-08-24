import * as THREE from 'three';

/**
 * Kinematic model of an articulated-flexible (関節可撓式) straddle-beam
 * monorail turnout.
 *
 * Confirmed against Osaka Monorail's official "モノレールのしくみ" description:
 *  - single-turnout = four 5.5 m steel box girders
 *  - girders fold like joints when set to the curved route
 *  - side guide/stabilising faces are bent into one smooth curve
 *  - motor -> reducer -> horizontal arm -> arm guide pushes girders sideways
 *  - wheeled trolleys under the girders roll on ground rails
 *  - after travel, lock cylinders descend and clamp onto bed plates
 *
 * Coordinates: x = lateral (curve deflects to +x), y = up, z = along track.
 * The articulation heel (fixed pivot) is at the origin; the free tip is at
 * z ~= 22 m. The camera/walkway side is -x, south of the heel.
 */

export const SEG_LEN = 5.5;          // confirmed: 5.5 m box girders
export const SEG_COUNT = 4;         // confirmed: four girders per turnout
export const BEAM_W = 0.85;         // Japanese straddle standard beam width (plausible interpolation)
export const BEAM_H = 1.35;         // steel switch girder depth (plausible interpolation)
export const DELTA = 0.0732;        // per-joint deflection at full curve (rad) => total turn ~16.8°
export const TIP_TURN = SEG_COUNT * DELTA;
export const ARC_R = SEG_LEN / DELTA; // smoothed guide-face arc radius ~75 m

export const BEAM_TOP_Y = 2.05;     // running surface height above switch deck
export const BEAM_BOT_Y = BEAM_TOP_Y - BEAM_H;

/** Heading of girder k (0-based) at articulation parameter t in [0,1]. */
export function girderHeading(k: number, t: number): number {
  return t * DELTA * (k + 0.5);
}

/** Position of joint k (0 = heel ... SEG_COUNT = free tip) at parameter t. */
export function jointPos(k: number, t: number): THREE.Vector2 {
  let x = 0;
  let z = 0;
  for (let i = 0; i < k; i++) {
    const h = girderHeading(i, t);
    x += SEG_LEN * Math.sin(h);
    z += SEG_LEN * Math.cos(h);
  }
  return new THREE.Vector2(x, z);
}

export function tipPos(t: number): THREE.Vector2 {
  return jointPos(SEG_COUNT, t);
}

/**
 * The smooth centreline the bent guide/stabilising faces form at parameter t.
 * Returns sampled points (lateral x, along z). At t=0 it is a straight line,
 * at t=1 it converges to a circular arc of radius ARC_R (tangent to the
 * approach track at the heel). Intermediate states interpolate the joint
 * chain with a natural spline so the flex faces never show a kink.
 */
export function guideCurve(t: number, samples = 48): THREE.Vector2[] {
  // Control points: heel plus every joint, with a phantom pre-heel point to
  // pin the start tangent to the approach track.
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= SEG_COUNT; k++) pts.push(jointPos(k, t));
  const out: THREE.Vector2[] = [];
  // Catmull-Rom through joints with clamped ends.
  const P = (i: number): THREE.Vector2 => {
    if (i < 0) return new THREE.Vector2(0, i * SEG_LEN); // straight before heel
    if (i > SEG_COUNT) {
      const tip = pts[SEG_COUNT];
      const h = t * TIP_TURN;
      return new THREE.Vector2(
        tip.x + SEG_LEN * Math.sin(h) * (i - SEG_COUNT),
        tip.y + SEG_LEN * Math.cos(h) * (i - SEG_COUNT),
      );
    }
    return pts[i];
  };
  for (let s = 0; s < samples; s++) {
    const u = (s / (samples - 1)) * SEG_COUNT; // 0..4 across the joints
    const i = Math.min(Math.floor(u), SEG_COUNT - 1);
    const f = u - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const f2 = f * f, f3 = f2 * f;
    out.push(new THREE.Vector2(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3),
    ));
  }
  return out;
}

/** Heading (rad, about +y from +z axis toward +x) along the guide curve. */
export function guideHeading(t: number, u: number): number {
  // u in [0,1] along the switch length
  const eps = 0.01;
  const a = sampleGuide(t, Math.max(0, u - eps));
  const b = sampleGuide(t, Math.min(1, u + eps));
  return Math.atan2(b.x - a.x, b.y - a.y);
}

export function sampleGuide(t: number, u: number): THREE.Vector2 {
  const pts = guideCurve(t, 48);
  const f = u * (pts.length - 1);
  const i = Math.min(Math.floor(f), pts.length - 2);
  const w = f - i;
  return new THREE.Vector2(
    pts[i].x + (pts[i + 1].x - pts[i].x) * w,
    pts[i].y + (pts[i + 1].y - pts[i].y) * w,
  );
}

// ---------------------------------------------------------------------------
// Drive units (motor + reducer + horizontal crank arm + arm guide).
// Placed under girder 2 and girder 4 near their leading joints, matching the
// official description of the drive chain. Crank centre sits at mid-travel so
// the arm sweeps symmetrically.
// ---------------------------------------------------------------------------

export interface DriveUnitSpec {
  joint: number;      // which joint the arm guide is bolted under
  crankR: number;     // horizontal arm length (m)
  center: THREE.Vector2; // fixed crank axis position on the deck (x, z)
}

export function driveUnits(): DriveUnitSpec[] {
  const mk = (joint: number, crankR: number): DriveUnitSpec => {
    const a = jointPos(joint, 0);
    const b = jointPos(joint, 1);
    // crank axis sits behind the joint so the roller stays inside the arm
    // guide bolted under the tail end of the girder ahead of it
    return {
      joint,
      crankR,
      center: new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2 - crankR - 0.33),
    };
  };
  return [mk(2, 0.72), mk(4, 1.85)];
}

/**
 * Crank angle for a drive unit at parameter t. The arm tip rides in a guide
 * channel under the girder (slotted along the girder axis), so only the
 * lateral component constrains the angle. 0 = arm pointing +z (along track).
 */
export function crankAngle(spec: DriveUnitSpec, t: number): number {
  const j = jointPos(spec.joint, t);
  const d = THREE.MathUtils.clamp((j.x - spec.center.x) / spec.crankR, -0.985, 0.985);
  return Math.asin(d);
}

/** Trolley (transfer bogie) specs: one under each moving joint. */
export interface TrolleySpec {
  joint: number;
  /** travel trace across t in deck coordinates, for laying the ground rails */
  trace: THREE.Vector2[];
}

export function trolleys(): TrolleySpec[] {
  const list: TrolleySpec[] = [];
  for (let j = 1; j <= SEG_COUNT; j++) {
    const trace: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) trace.push(jointPos(j, i / 16));
    list.push({ joint: j, trace });
  }
  return list;
}

// ---------------------------------------------------------------------------
// Ride paths — generated from the SAME articulation state so the visual beam
// and the path the train follows can never disagree.
// ---------------------------------------------------------------------------

export const APPROACH_LEN = 78;   // south of the heel (towards/past the camera)
export const ROUTE_LEN = 150;     // fixed track beyond the switch tip

export type RouteSide = 'straight' | 'curve';

/**
 * Full centreline for a locked route, from s=0 at the far end of the
 * approach (z = -APPROACH_LEN) to the end of the fixed route. Sampled at
 * ~1 m. Trains traverse it in either direction.
 */
export function routePath(side: RouteSide): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  // approach: straight, z from -APPROACH_LEN to 0
  for (let z = -APPROACH_LEN; z < 0; z += 1) pts.push(new THREE.Vector2(0, z));
  if (side === 'straight') {
    for (let z = 0; z <= SEG_COUNT * SEG_LEN; z += 1) pts.push(new THREE.Vector2(0, z));
    const zEnd = SEG_COUNT * SEG_LEN;
    for (let d = 1; d <= ROUTE_LEN; d += 1) pts.push(new THREE.Vector2(0, zEnd + d));
  } else {
    // through the switch: the exact smoothed guide arc
    const g = guideCurve(1, 44);
    for (const p of g) pts.push(p.clone());
    // fixed curved route: continue the arc for a while, then ease straight
    const tip = tipPos(1);
    let h = TIP_TURN;
    let x = tip.x, z = tip.y;
    const contArc = 36; // metres continuing on the same radius
    for (let d = 1; d <= ROUTE_LEN; d += 1) {
      if (d <= contArc) h = TIP_TURN + (d / contArc) * (Math.PI / 14);
      x += Math.sin(h); z += Math.cos(h);
      pts.push(new THREE.Vector2(x, z));
    }
  }
  return pts;
}

export interface PathSampler {
  length: number;
  pos(s: number): THREE.Vector3;      // world position of beam top centre
  heading(s: number): number;         // yaw about +y
}

export function makeSampler(pts: THREE.Vector2[], topY: number): PathSampler {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const total = cum[cum.length - 1];
  const locate = (s: number): [number, number] => {
    const ss = THREE.MathUtils.clamp(s, 0, total);
    let lo = 0, hi = cum.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= ss) lo = mid; else hi = mid;
    }
    const span = cum[lo + 1] - cum[lo] || 1;
    return [lo, (ss - cum[lo]) / span];
  };
  return {
    length: total,
    pos(s: number) {
      const [i, w] = locate(s);
      return new THREE.Vector3(
        pts[i].x + (pts[i + 1].x - pts[i].x) * w,
        topY,
        pts[i].y + (pts[i + 1].y - pts[i].y) * w,
      );
    },
    heading(s: number) {
      const [i] = locate(s);
      const a = pts[Math.max(0, i)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      return Math.atan2(b.x - a.x, b.y - a.y);
    },
  };
}
