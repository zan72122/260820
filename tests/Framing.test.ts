import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fovForFocalMm, makeShot, solveShot, type Viewport } from '../src/core/Framing';

const noSafe = { top: 0, right: 0, bottom: 0, left: 0 };
const notchSafe = { top: 47, right: 0, bottom: 34, left: 0 };

const SCREENS: Record<string, Viewport> = {
  'iPhone portrait': { width: 390, height: 844, safe: notchSafe },
  'iPhone landscape': { width: 844, height: 390, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
  'iPad portrait': { width: 1024, height: 1366, safe: noSafe },
  'iPad landscape': { width: 1366, height: 1024, safe: noSafe },
};

/** Projects the subject sphere and reports its screen box, 0..1. */
function project(vp: Viewport, target: THREE.Vector3, radius: number, shot: ReturnType<typeof makeShot>) {
  const s = solveShot(shot, vp);
  const cam = new THREE.PerspectiveCamera(s.fov, vp.width / vp.height, 0.05, 200);
  cam.position.copy(s.position);
  cam.lookAt(s.lookAt);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  // Sample the subject's bounding sphere rather than just its centre.
  for (let i = 0; i < 200; i++) {
    const a = (i / 200) * Math.PI * 2;
    for (const [dx, dy, dz] of [
      [Math.cos(a), 0, Math.sin(a)],
      [Math.cos(a), 0.85, Math.sin(a) * 0.5],
      [Math.cos(a), -0.85, Math.sin(a) * 0.5],
    ]) {
      const p = new THREE.Vector3(
        target.x + dx * radius, target.y + dy * radius, target.z + dz * radius,
      ).project(cam);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, maxX, minY, maxY, centreY: (minY + maxY) / 2, centreX: (minX + maxX) / 2 };
}

describe('framing', () => {
  it('maps focal length to a natural field of view', () => {
    expect(fovForFocalMm(35)).toBeCloseTo(37.8, 0);
    expect(fovForFocalMm(50)).toBeCloseTo(27.0, 0);
    expect(fovForFocalMm(85)).toBeCloseTo(16.1, 0);
    // The whole game stays inside the brief's 35-100mm range.
    expect(fovForFocalMm(100)).toBeGreaterThan(8);
  });

  const shot = makeShot({
    target: new THREE.Vector3(0, 0.9, 0),
    radius: 0.24,
    focalMm: 52,
    yaw: -10,
    pitch: 16,
    anchorPortrait: { x: -0.04, y: 0.22 },
    anchorLandscape: { x: 0.14, y: 0.17 },
  });

  for (const [name, vp] of Object.entries(SCREENS)) {
    it(`keeps the subject fully on screen on ${name}`, () => {
      const box = project(vp, shot.target, shot.radius, shot);
      // Nothing important is allowed to be cut off at any of the four sizes.
      expect(box.minX).toBeGreaterThan(-1);
      expect(box.maxX).toBeLessThan(1);
      expect(box.minY).toBeGreaterThan(-1);
      expect(box.maxY).toBeLessThan(1);
    });

    it(`keeps the subject clear of the safe-area insets on ${name}`, () => {
      const box = project(vp, shot.target, shot.radius, shot);
      const insetTop = 1 - (vp.safe.top / vp.height) * 2;
      const insetBottom = -1 + (vp.safe.bottom / vp.height) * 2;
      const insetLeft = -1 + (vp.safe.left / vp.width) * 2;
      const insetRight = 1 - (vp.safe.right / vp.width) * 2;
      expect(box.maxY).toBeLessThan(insetTop);
      expect(box.minY).toBeGreaterThan(insetBottom);
      expect(box.minX).toBeGreaterThan(insetLeft);
      expect(box.maxX).toBeLessThan(insetRight);
    });

    it(`keeps the parts that matter out of the reach zone on ${name}`, () => {
      // What must never be covered is the upper half of the jar: the beading
      // droplets and the climbing juice line. The hand works below that.
      const critical = shot.target.clone().add(new THREE.Vector3(0, shot.radius * 0.45, 0));
      const box = project(vp, critical, shot.radius * 0.5, shot);
      expect(box.centreY).toBeGreaterThan(0);
      expect(box.minY).toBeGreaterThan(-0.3);
      // And there is real room left underneath for a finger.
      const full = project(vp, shot.target, shot.radius, shot);
      expect(box.minY - full.minY).toBeGreaterThan(0.15);
    });
  }

  it('reframes on rotation without changing the shot itself', () => {
    const before = solveShot(shot, SCREENS['iPhone portrait']);
    const after = solveShot(shot, SCREENS['iPhone landscape']);
    // Same subject, same lens; only the camera placement adapts.
    expect(after.fov).toBeCloseTo(before.fov, 6);
    expect(before.position.equals(after.position)).toBe(false);
    expect(shot.radius).toBe(0.24);
  });

  it('pulls back further when the subject is larger', () => {
    const vp = SCREENS['iPhone portrait'];
    const near = solveShot(makeShot({ ...shot, radius: 0.2 }), vp);
    const far = solveShot(makeShot({ ...shot, radius: 0.6 }), vp);
    expect(far.position.distanceTo(far.lookAt)).toBeGreaterThan(
      near.position.distanceTo(near.lookAt),
    );
  });
});
