import * as THREE from 'three';
import { COURSE_POINTS, LANDMARK_X } from '../core/Config';
import { clamp } from '../core/Rng';

export interface CourseFrame {
  position: THREE.Vector3;
  /** Unit vector along travel. */
  tangent: THREE.Vector3;
  /** Unit vector across the flume (raft's right). */
  side: THREE.Vector3;
  /** Unit vector out of the flume floor. */
  up: THREE.Vector3;
}

/**
 * The sliding centre line. Everything in the game - raft position, nozzles,
 * camera rail, the flume shell itself - is expressed as a 1D distance along
 * this curve, which is what keeps the simulation cheap and deterministic.
 */
export class CourseSpline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;

  private readonly samples: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly arc: Float32Array;

  private readonly _p = new THREE.Vector3();
  private readonly _t = new THREE.Vector3();

  constructor(samples = 2400) {
    const pts = COURSE_POINTS.map(([x, y]) => new THREE.Vector3(x, y, 0));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    this.samples = samples;

    this.px = new Float32Array(samples + 1);
    this.py = new Float32Array(samples + 1);
    this.arc = new Float32Array(samples + 1);

    const tmp = new THREE.Vector3();
    let total = 0;
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i <= samples; i++) {
      this.curve.getPoint(i / samples, tmp);
      if (i > 0) {
        total += Math.hypot(tmp.x - prevX, tmp.y - prevY);
      }
      this.px[i] = tmp.x;
      this.py[i] = tmp.y;
      this.arc[i] = total;
      prevX = tmp.x;
      prevY = tmp.y;
    }
    this.length = total;
  }

  /** Index/fraction of the LUT slot that holds arc length s. */
  private locate(s: number): { i: number; f: number } {
    const target = clamp(s, 0, this.length);
    let lo = 0;
    let hi = this.samples;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] <= target) lo = mid;
      else hi = mid;
    }
    const seg = this.arc[lo + 1] - this.arc[lo];
    const f = seg > 1e-6 ? (target - this.arc[lo]) / seg : 0;
    return { i: lo, f };
  }

  positionAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { i, f } = this.locate(s);
    return out.set(
      this.px[i] + (this.px[i + 1] - this.px[i]) * f,
      this.py[i] + (this.py[i + 1] - this.py[i]) * f,
      0,
    );
  }

  /** Unit tangent, central-differenced so slope reads smoothly. */
  tangentAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const h = 0.35;
    const a = this.positionAt(clamp(s - h, 0, this.length), this._p).clone();
    const b = this.positionAt(clamp(s + h, 0, this.length), this._t);
    return out.copy(b).sub(a).normalize();
  }

  /** dy/ds: the number the whole game is really about. */
  gradeAt(s: number): number {
    return this.tangentAt(s, this._t).y;
  }

  heightAt(s: number): number {
    return this.positionAt(s, this._p).y;
  }

  frameAt(s: number, out?: CourseFrame): CourseFrame {
    const frame: CourseFrame = out ?? {
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      side: new THREE.Vector3(),
      up: new THREE.Vector3(),
    };
    this.positionAt(s, frame.position);
    this.tangentAt(s, frame.tangent);
    // No banking anywhere on this course: the camera and the child both need a
    // stable horizon, so the frame is built from world up every time.
    frame.side.set(0, 0, 1);
    frame.up.copy(frame.side).cross(frame.tangent).normalize();
    if (frame.up.y < 0) frame.up.negate();
    return frame;
  }

  /** Arc length of the first point at world x (course x is monotonic). */
  sAtX(x: number): number {
    let lo = 0;
    let hi = this.samples;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.px[mid] <= x) lo = mid;
      else hi = mid;
    }
    const seg = this.px[lo + 1] - this.px[lo];
    const f = seg > 1e-6 ? clamp((x - this.px[lo]) / seg, 0, 1) : 0;
    return this.arc[lo] + (this.arc[lo + 1] - this.arc[lo]) * f;
  }

  xAt(s: number): number {
    return this.positionAt(s, this._p).x;
  }
}

/** Landmarks converted once, in arc length. */
export interface CourseMarks {
  launch: number;
  dropStart: number;
  valleyIn: number;
  restPool: number;
  hillToe: number;
  hillTop: number;
  landing: number;
  runoutEnd: number;
}

export function markCourse(spline: CourseSpline): CourseMarks {
  return {
    launch: spline.sAtX(LANDMARK_X.launch),
    dropStart: spline.sAtX(LANDMARK_X.dropStart),
    valleyIn: spline.sAtX(LANDMARK_X.valleyIn),
    restPool: spline.sAtX(LANDMARK_X.restPool),
    hillToe: spline.sAtX(LANDMARK_X.hillToe),
    hillTop: spline.sAtX(LANDMARK_X.hillTop),
    landing: spline.sAtX(LANDMARK_X.landing),
    runoutEnd: spline.sAtX(LANDMARK_X.runoutEnd),
  };
}
