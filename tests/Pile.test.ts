import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { massForRadius, PileSolver } from '../src/world/Pile';

const body = (x: number, z: number, r = 0.04, y = 0.5) => ({
  pos: new THREE.Vector3(x, y, z),
  vel: new THREE.Vector3(),
  radius: r,
  mass: massForRadius(r),
  restitution: 0.16,
  ref: 0,
});

const settle = (s: PileSolver, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) s.step(1 / 60);
};

describe('the fruit pile', () => {
  it('drops fruit onto the ground and lets them come to rest', () => {
    const s = new PileSolver();
    const b = s.add(body(0, 0));
    settle(s, 3);
    expect(b.pos.y).toBeCloseTo(b.radius, 2);
    expect(b.sleeping).toBe(true);
    expect(Number.isFinite(b.pos.x)).toBe(true);
  });

  it('reports the landing so a sound can be played for it', () => {
    const s = new PileSolver();
    s.add(body(0, 0, 0.04, 1.2));
    let heard = 0;
    for (let i = 0; i < 200; i++) {
      s.step(1 / 60);
      heard += s.consumeImpacts().filter((im) => im.kind === 'floor').length;
    }
    expect(heard).toBeGreaterThan(0);
  });

  it('never lets two fruit occupy the same space', () => {
    const s = new PileSolver();
    const a = s.add(body(0, 0, 0.045, 0.2));
    const b = s.add(body(0.01, 0.01, 0.045, 0.28));
    settle(s, 4);
    const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
    expect(d).toBeGreaterThan(a.radius + b.radius - 0.004);
  });

  it('gives heavier fruit more inertia in a collision', () => {
    const s = new PileSolver({ gravity: 0 });
    const big = s.add({ ...body(0, 0, 0.06, 0.06), vel: new THREE.Vector3(1, 0, 0) });
    const small = s.add(body(0.1, 0, 0.03, 0.06));
    settle(s, 0.5);
    expect(small.vel.x).toBeGreaterThan(big.vel.x);
  });

  it('rolls fruit downhill, which is how the net gathers them', () => {
    const s = new PileSolver({
      // A shallow bowl, exactly like the lifted net.
      floorAt: (x, z) => (x * x + z * z) * 0.35,
      slopeAt: (x, z, out) => out.set(-x * 0.7, -z * 0.7),
      linearDamping: 0.5,
      rollingFriction: 1.05,
    });
    const b = s.add(body(0.7, 0.5, 0.04, 0.4));
    settle(s, 6);
    expect(Math.hypot(b.pos.x, b.pos.z)).toBeLessThan(0.35);
  });

  it('keeps everything inside a cylindrical container', () => {
    const s = new PileSolver({
      bounds: { kind: 'cylinder', center: new THREE.Vector3(), radius: 0.3 },
    });
    const b = s.add({ ...body(0.1, 0, 0.04, 0.2), vel: new THREE.Vector3(6, 0, 0) });
    settle(s, 4);
    expect(Math.hypot(b.pos.x, b.pos.z)).toBeLessThanOrEqual(0.3);
  });

  it('turns a rolling fruit so its markings really move', () => {
    const s = new PileSolver({ gravity: 0 });
    const b = s.add({ ...body(0, 0, 0.04, 0.04), vel: new THREE.Vector3(0.6, 0, 0) });
    const before = b.quat.clone();
    settle(s, 1);
    expect(b.quat.angleTo(before)).toBeGreaterThan(0.5);
  });

  it('leaves a held fruit entirely under the hand', () => {
    const s = new PileSolver();
    const b = s.add(body(0, 0, 0.04, 0.9));
    b.held = true;
    settle(s, 2);
    expect(b.pos.y).toBeCloseTo(0.9, 5);
  });

  it('produces the same result at 30 fps as at 120 fps', () => {
    const make = () => {
      const s = new PileSolver({ slopeAt: (x, z, out) => out.set(-x, -z) });
      s.add(body(0.3, 0.2, 0.04, 0.5));
      return s;
    };
    const slow = make();
    for (let i = 0; i < 30 * 4; i++) slow.step(1 / 30);
    const fast = make();
    for (let i = 0; i < 120 * 4; i++) fast.step(1 / 120);
    expect(slow.bodies[0].pos.x).toBeCloseTo(fast.bodies[0].pos.x, 1);
    expect(slow.bodies[0].pos.z).toBeCloseTo(fast.bodies[0].pos.z, 1);
  });

  it('scales mass with the cube of the radius', () => {
    expect(massForRadius(0.08) / massForRadius(0.04)).toBeCloseTo(8, 5);
  });
});
