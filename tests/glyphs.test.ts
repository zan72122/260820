/**
 * Canonical glyph system tests: the shapes you see and the shapes the ball
 * feels must be the same shapes, at every axis position.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  O_SPEC,
  oCounterR,
  oCounterRAt,
  oBallPasses,
  C_SPEC,
  cApertureGap,
  cApertureHalfAngle,
  cBallEnters,
  cInteriorWidthX,
  cRx,
  I_SPEC,
  iTrackTilt,
  iBallDirection,
  BALLS,
} from '../src/glyph/spec';
import { leafPolygon, leafRotation, leafPivot, O_MESH } from '../src/glyph/oMesh';
import { cFrames, C_MESH } from '../src/glyph/cMesh';
import { SweepWall } from '../src/geo/dynamic';

const WEIGHTS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

function leafPointsAt(weight: number, i: number) {
  const poly = leafPolygon();
  const p0 = leafPivot(0);
  const local = poly.map((p) => ({ x: p.x - p0.x, z: p.z - p0.z }));
  const rot = leafRotation(weight);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const beta = (i * 2 * Math.PI) / O_SPEC.leafCount;
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const piv = leafPivot(i);
  return local.map((p) => {
    const rx = p.x * cos - p.z * sin;
    const rz = p.x * sin + p.z * cos;
    return { x: rx * cb - rz * sb + piv.x, z: rx * sb + rz * cb + piv.z };
  });
}

function pointInPoly(pt: { x: number; z: number }, pts: { x: number; z: number }[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > pt.z !== b.z > pt.z && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x)
      inside = !inside;
  }
  return inside;
}

describe('glyph O — iris ring gauge', () => {
  it('counter shrinks monotonically as weight grows', () => {
    for (let i = 1; i < WEIGHTS.length; i++) {
      expect(oCounterR(WEIGHTS[i])).toBeLessThan(oCounterR(WEIGHTS[i - 1]));
    }
  });

  it('leaf polygon is finite and non-degenerate', () => {
    const poly = leafPolygon();
    expect(poly.length).toBeGreaterThan(20);
    for (const p of poly) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });

  it('visual iris hole matches the collision counter at every weight', () => {
    for (const w of WEIGHTS) {
      const leaves = Array.from({ length: O_SPEC.leafCount }, (_, i) => leafPointsAt(w, i));
      let holeMin = Infinity;
      for (let ai = 0; ai < 96; ai++) {
        const ang = (ai * 2 * Math.PI) / 96;
        for (let rr = 0.02; rr < 0.4; rr += 0.0015) {
          if (leaves.some((lp) => pointInPoly({ x: Math.cos(ang) * rr, z: Math.sin(ang) * rr }, lp))) {
            holeMin = Math.min(holeMin, rr);
            break;
          }
        }
      }
      expect(Math.abs(holeMin - oCounterR(w))).toBeLessThan(0.006);
    }
  });

  it('the stroke annulus has no see-through gaps at any weight', () => {
    for (const w of WEIGHTS) {
      const h = oCounterR(w);
      const leaves = Array.from({ length: O_SPEC.leafCount }, (_, i) => leafPointsAt(w, i));
      for (let ai = 0; ai < 72; ai++) {
        const ang = (ai * 2 * Math.PI) / 72;
        for (const rr of [h + 0.02, (h + 0.36) / 2, 0.33, 0.355]) {
          if (rr <= h + 0.006) continue;
          const covered = leaves.some((lp) =>
            pointInPoly({ x: Math.cos(ang) * rr, z: Math.sin(ang) * rr }, lp),
          );
          expect(covered, `gap at w=${w} ang=${ang} r=${rr}`).toBe(true);
        }
      }
    }
  });

  it('leaves stay inside the mechanism drum over the whole travel', () => {
    for (const w of WEIGHTS) {
      const leaves = Array.from({ length: O_SPEC.leafCount }, (_, i) => leafPointsAt(w, i));
      for (const lp of leaves) {
        for (const p of lp) {
          expect(Math.hypot(p.x, p.z)).toBeLessThan(O_MESH.drumInnerR);
        }
      }
    }
  });

  it('no leaf material inside the counter (analytic scallop check)', () => {
    for (const w of WEIGHTS) {
      const h = oCounterR(w);
      for (let ai = 0; ai < 48; ai++) {
        const r = oCounterRAt(w, (ai * 2 * Math.PI) / 48);
        expect(r).toBeGreaterThanOrEqual(h - 1e-9);
        expect(r).toBeLessThan(h + 0.06); // scallop bulge stays gentle
      }
    }
  });

  it('gameplay thresholds: fat blocks the rubber ball, thin passes it', () => {
    expect(oBallPasses(1, BALLS.rubber.diameter)).toBe(false);
    expect(oBallPasses(0, BALLS.rubber.diameter)).toBe(true);
    expect(oBallPasses(1, BALLS.wood.diameter)).toBe(true); // small ball fits a fat O
    expect(oBallPasses(0.4, BALLS.steel.diameter)).toBe(false);
    expect(oBallPasses(0, BALLS.steel.diameter)).toBe(true); // big ball needs thin
  });
});

describe('glyph C — variable-width corral', () => {
  it('aperture opens monotonically with width', () => {
    for (let i = 1; i <= 10; i++) {
      expect(cApertureGap(i / 10)).toBeGreaterThan(cApertureGap((i - 1) / 10));
    }
  });

  it('is not a plain x-scale: aperture angle changes with width', () => {
    expect(cApertureHalfAngle(1)).toBeGreaterThan(cApertureHalfAngle(0) + 0.2);
  });

  it('mesh frames agree with the collision aperture', () => {
    for (const u of [0, 0.3, 0.6, 1]) {
      const frames = cFrames(u);
      const f0 = frames[0];
      const fn = frames[frames.length - 1];
      // terminal centers sit at ±Ry sin(theta)
      const th = cApertureHalfAngle(u);
      expect(Math.abs(f0.z - C_SPEC.ry * Math.sin(th))).toBeLessThan(1e-9);
      expect(Math.abs(fn.z + C_SPEC.ry * Math.sin(th))).toBeLessThan(1e-9);
      // clear gap between inner corners of the terminals == collision gap
      const gap = f0.z - f0.halfW - (fn.z + fn.halfW);
      expect(Math.abs(gap - cApertureGap(u))).toBeLessThan(1e-9);
      expect(Math.abs(f0.x - cRx(u) * Math.cos(th))).toBeLessThan(1e-9);
    }
  });

  it('sweep wall geometry is finite with sane normals', () => {
    const wall = new SweepWall(C_MESH.frames, 0, C_SPEC.wallHeight);
    for (const u of [0, 0.5, 1]) {
      wall.update(cFrames(u));
      const pos = wall.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        expect(Number.isFinite(pos.getX(i))).toBe(true);
        expect(Number.isFinite(pos.getY(i))).toBe(true);
        expect(Number.isFinite(pos.getZ(i))).toBe(true);
      }
      const norm = wall.geometry.getAttribute('normal') as THREE.BufferAttribute;
      let zeroNormals = 0;
      for (let i = 0; i < norm.count; i++) {
        const l = Math.hypot(norm.getX(i), norm.getY(i), norm.getZ(i));
        if (l < 0.5) zeroNormals++;
      }
      expect(zeroNormals).toBe(0);
    }
  });

  it('ball can circulate inside at widths where it can enter', () => {
    for (let u = 0; u <= 1.001; u += 0.05) {
      if (cBallEnters(u, BALLS.rubber.diameter)) {
        expect(cInteriorWidthX(u)).toBeGreaterThan(BALLS.rubber.diameter);
      }
    }
  });

  it('gameplay thresholds: narrow blocks, wide admits; small ball always fits', () => {
    expect(cBallEnters(0, BALLS.rubber.diameter)).toBe(false);
    expect(cBallEnters(1, BALLS.rubber.diameter)).toBe(true);
    expect(cBallEnters(0, BALLS.wood.diameter)).toBe(true);
    expect(cBallEnters(0.6, BALLS.steel.diameter)).toBe(false);
    expect(cBallEnters(1, BALLS.steel.diameter)).toBe(true);
  });
});

describe('glyph I — slant parallelogram', () => {
  it('track tilt follows slant with the correct sign', () => {
    expect(iTrackTilt(0)).toBeCloseTo(0, 9);
    expect(iTrackTilt(1)).toBeLessThan(0); // right end dips
    expect(iTrackTilt(-1)).toBeGreaterThan(0);
  });

  it('ball direction matches the lean, with a stable center detent', () => {
    expect(iBallDirection(0)).toBe(0);
    expect(iBallDirection(0.1)).toBe(0);
    expect(iBallDirection(0.5)).toBe(1);
    expect(iBallDirection(-0.5)).toBe(-1);
  });

  it('downhill acceleration points toward the slant side', () => {
    for (const s of [-1, -0.5, 0.5, 1]) {
      const a = -9.8 * Math.sin(iTrackTilt(s));
      expect(Math.sign(a)).toBe(Math.sign(s));
    }
  });

  it('slant range keeps the letter recognizable', () => {
    expect(I_SPEC.slantMaxDeg).toBeLessThanOrEqual(15);
  });
});
