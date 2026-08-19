import { clamp } from '../core/mathx';

/**
 * The route from the tape mark in the wing, through the parted curtain, to the
 * spot at the front of the stage. The camera walks the *same* polyline a fixed
 * distance behind the child, which is what keeps the whole exit as one
 * travelling shot: if the child fits through the gap, so does the lens.
 */
export class WalkPath {
  private pts: [number, number][];
  private cum: number[] = [];
  readonly length: number;

  constructor(points: [number, number][]) {
    this.pts = points;
    let total = 0;
    this.cum.push(0);
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      this.cum.push(total);
    }
    this.length = total;
  }

  /** Position at arc length `s`; extrapolates smoothly past either end. */
  at(s: number, out: [number, number]): void {
    const pts = this.pts;
    if (s <= 0) {
      const dx = pts[1][0] - pts[0][0];
      const dz = pts[1][1] - pts[0][1];
      const l = Math.hypot(dx, dz) || 1;
      out[0] = pts[0][0] + (dx / l) * s;
      out[1] = pts[0][1] + (dz / l) * s;
      return;
    }
    if (s >= this.length) {
      const n = pts.length - 1;
      const dx = pts[n][0] - pts[n - 1][0];
      const dz = pts[n][1] - pts[n - 1][1];
      const l = Math.hypot(dx, dz) || 1;
      const over = s - this.length;
      out[0] = pts[n][0] + (dx / l) * over;
      out[1] = pts[n][1] + (dz / l) * over;
      return;
    }
    let i = 1;
    while (i < this.cum.length && this.cum[i] < s) i++;
    const t = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1]);
    // Rounded corners: blend toward the neighbouring segment near the joints so
    // the child does not pivot on a vertex.
    const a = pts[i - 1];
    const b = pts[i];
    let x = a[0] + (b[0] - a[0]) * t;
    let z = a[1] + (b[1] - a[1]) * t;
    const round = 0.35;
    if (t < round && i >= 2) {
      const p = pts[i - 2];
      const k = (1 - t / round) * 0.5;
      const mx = (p[0] + b[0]) * 0.5;
      const mz = (p[1] + b[1]) * 0.5;
      x += (mx - a[0]) * k * 0.42;
      z += (mz - a[1]) * k * 0.42;
    }
    out[0] = x;
    out[1] = z;
  }

  /** Unit tangent at arc length `s`. */
  tangent(s: number, out: [number, number]): void {
    const h = 0.12;
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    this.at(clamp(s - h, -3, this.length + 6), a);
    this.at(clamp(s + h, -3, this.length + 6), b);
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    out[0] = dx / l;
    out[1] = dz / l;
  }
}
