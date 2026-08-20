import { describe, expect, it } from 'vitest';
import { Rand, hashStringToSeed } from '../core/Rand';
import { clamp, damp, lerp, smoothstep } from '../core/Easing';
import { Spring } from '../core/Spring';

describe('Rand', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rand(42);
    const b = new Rand(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 10 }, (_, i) => new Rand(i + 1).next());
    expect(new Set(a).size).toBe(a.length);
  });

  it('stays inside [0,1)', () => {
    const r = new Rand(7);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('respects pick weights', () => {
    const r = new Rand(11);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[r.pick(['a', 'b'] as const, [9, 1])]++;
    expect(counts.a).toBeGreaterThan(counts.b * 4);
  });

  it('hashes strings stably', () => {
    expect(hashStringToSeed('amethyst')).toBe(hashStringToSeed('amethyst'));
    expect(hashStringToSeed('amethyst')).not.toBe(hashStringToSeed('citrine'));
  });
});

describe('easing', () => {
  it('clamps', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('smoothsteps with flat ends', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
  });

  it('damp is frame-rate independent within tolerance', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
    for (let i = 0; i < 240; i++) b = damp(b, 1, 5, 1 / 240);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('lerps', () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
  });
});

describe('Spring', () => {
  it('converges to its target without exploding on long frames', () => {
    const s = new Spring(0, 120, 20);
    s.target = 1;
    for (let i = 0; i < 200; i++) s.step(0.2); // deliberately huge steps
    expect(Number.isFinite(s.value)).toBe(true);
    expect(s.value).toBeCloseTo(1, 3);
  });
});
