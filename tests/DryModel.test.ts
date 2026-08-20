import { describe, expect, it } from 'vitest';
import { DryModel } from '../src/core/DryModel';

describe('sun drying', () => {
  it('only dries fruit that have actually been laid out', () => {
    const m = new DryModel(4);
    m.place(0);
    m.addSun(2);
    expect(m.sideDryness(0, 0)).toBeGreaterThan(0.9);
    expect(m.sideDryness(1, 0)).toBe(0);
    expect(m.placedCount).toBe(1);
  });

  it('dries only the face turned to the sky', () => {
    const m = new DryModel(1);
    m.place(0);
    m.addSun(2);
    expect(m.sideDryness(0, 0)).toBeGreaterThan(0.9);
    expect(m.sideDryness(0, 1)).toBe(0);
    expect(m.anyUnturned).toBe(true);
  });

  it('turning a fruit over exposes the pale face', () => {
    const m = new DryModel(1);
    m.place(0);
    m.addSun(2);
    expect(m.roll(0)).toBe(1);
    m.addSun(2);
    expect(m.sideDryness(0, 1)).toBeGreaterThan(0.9);
    expect(m.anyUnturned).toBe(false);
  });

  it('rewards turning without ever requiring it', () => {
    const oneSide = new DryModel(1);
    oneSide.place(0);
    oneSide.addSun(3);
    const bothSides = new DryModel(1);
    bothSides.place(0);
    bothSides.addSun(1.5);
    bothSides.roll(0);
    bothSides.addSun(1.5);
    expect(bothSides.overallDryness).toBeGreaterThan(oneSide.overallDryness);
    // A fruit left face-up still visibly dries: the child is never stuck.
    expect(oneSide.overallDryness).toBeGreaterThan(0.2);
  });

  it('cannot be rolled before it is placed', () => {
    const m = new DryModel(1);
    expect(m.roll(0)).toBeNull();
    expect(m.roll(9)).toBeNull();
  });

  it('eases dryness toward its target rather than snapping', () => {
    const m = new DryModel(1);
    m.place(0);
    m.addSun(2);
    m.tick(1 / 60);
    expect(m.fruits[0].dryness).toBeGreaterThan(0);
    expect(m.fruits[0].dryness).toBeLessThan(0.2);
    for (let i = 0; i < 600; i++) m.tick(1 / 60);
    expect(m.fruits[0].dryness).toBeCloseTo(m.targetDryness(m.fruits[0]), 2);
  });

  it('caps exposure so a long session cannot overcook anything', () => {
    const m = new DryModel(1, 2);
    m.place(0);
    m.addSun(500);
    expect(m.fruits[0].exposure[0]).toBeLessThanOrEqual(3.2);
    expect(m.sideDryness(0, 0)).toBe(1);
  });

  it('resets cleanly for a repeat round', () => {
    const m = new DryModel(3);
    m.place(0);
    m.addSun(3);
    m.roll(0);
    m.reset();
    expect(m.placedCount).toBe(0);
    expect(m.overallDryness).toBe(0);
    expect(m.fruits[0].up).toBe(0);
  });
});
