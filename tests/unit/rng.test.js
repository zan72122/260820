import { describe, it, expect } from 'vitest';
import { Rng, clamp, lerp, smoothstep, damp, angleDelta, TAU } from '../../src/core/Rng.js';

describe('Rng', () => {
  it('replays exactly from a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('diverges between seeds and stays in range', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('reset rewinds the stream', () => {
    const r = new Rng(5);
    const first = [r.next(), r.next()];
    r.reset();
    expect([r.next(), r.next()]).toEqual(first);
  });

  it('int stays inside the requested range', () => {
    const r = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const v = r.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});

describe('helpers', () => {
  it('clamps, lerps and smoothsteps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('damp converges and is framerate independent within tolerance', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
    for (let i = 0; i < 120; i++) b = damp(b, 1, 5, 1 / 120);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
    expect(a).toBeGreaterThan(0.99);
  });

  it('angleDelta takes the short way round', () => {
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
    expect(angleDelta(0, TAU - 0.5)).toBeCloseTo(-0.5);
    expect(Math.abs(angleDelta(3, -3))).toBeLessThan(Math.PI);
  });
});
