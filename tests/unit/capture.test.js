import { describe, it, expect } from 'vitest';
import { evaluateCatch, supportRatio, attractionWeight, CAPTURE } from '../../src/game/capture.js';
import { createPaperState, syncTears } from '../../src/game/paper.js';
import { Rng } from '../../src/core/Rng.js';

const fresh = () => createPaperState();
const holed = (damage, seed = 5) => {
  const s = createPaperState();
  s.damage = damage;
  syncTears(s, new Rng(seed));
  return s;
};

const base = (over = {}) => ({
  paper: fresh(),
  lx: 0,
  ly: 0,
  above: 0.2,
  halfWidth: 0.34,
  liftSpeed: 0.3,
  forgiveness: 0,
  ...over,
});

describe('evaluateCatch', () => {
  it('lifts a fish sitting on whole paper', () => {
    expect(evaluateCatch(base()).caught).toBe(true);
  });

  it('refuses a fish that is beside the hoop, not on it', () => {
    expect(evaluateCatch(base({ lx: 1.4 })).reason).toBe('offSheet');
  });

  it('refuses when the paper is above the fish rather than under it', () => {
    expect(evaluateCatch(base({ above: -0.8 })).reason).toBe('notAbove');
    expect(evaluateCatch(base({ above: 2.0 })).reason).toBe('notAbove');
  });

  it('refuses while the poi is still going down', () => {
    expect(evaluateCatch(base({ liftSpeed: 0 })).reason).toBe('notRising');
    expect(evaluateCatch(base({ liftSpeed: -0.4 })).reason).toBe('notRising');
  });

  it('lets a fish fall straight through a hole in the middle', () => {
    const paper = holed(0.95);
    expect(evaluateCatch(base({ paper })).reason).toBe('throughHole');
  });

  it('but still scoops one off the surviving rim', () => {
    const paper = holed(0.45);
    const onRim = evaluateCatch(base({ paper, lx: 0.0, ly: 0.62, halfWidth: 0.2 }));
    expect(onRim.caught).toBe(true);
  });

  it('is more forgiving for the very first fish', () => {
    const hard = base({ liftSpeed: 0.02, above: 0.85 });
    expect(evaluateCatch(hard).caught).toBe(false);
    expect(evaluateCatch({ ...hard, forgiveness: 1 }).caught).toBe(true);
  });
});

describe('supportRatio', () => {
  it('is total on a fresh sheet and nothing off it', () => {
    expect(supportRatio(fresh(), 0, 0, 0.3)).toBe(1);
    expect(supportRatio(fresh(), 2, 0, 0.3)).toBe(0);
  });

  it('falls as the hole under the fish grows', () => {
    const a = supportRatio(holed(0.35), 0, 0, 0.3);
    const b = supportRatio(holed(0.7), 0, 0, 0.3);
    const c = supportRatio(holed(1.0), 0, 0, 0.3);
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
    expect(c).toBeLessThan(0.5);
  });

  it('stays high out at the rim of a half-wrecked sheet', () => {
    expect(supportRatio(holed(0.5), 0, 0.66, 0.18)).toBeGreaterThan(0.6);
  });
});

describe('attractionWeight', () => {
  it('is strongest when the paper is squarely underneath', () => {
    const near = attractionWeight(0.1, 0.16, 1);
    const far = attractionWeight(CAPTURE.attractRadius * 0.95, 0.16, 1);
    expect(near).toBeGreaterThan(0.8);
    expect(far).toBeLessThan(0.15);
  });

  it('does nothing once the paper is above the fish', () => {
    expect(attractionWeight(0.1, -0.5, 1)).toBe(0);
    expect(attractionWeight(0.1, 3.0, 1)).toBe(0);
  });

  it('does nothing while the poi is out of the water', () => {
    expect(attractionWeight(0.1, 0.16, 0)).toBe(0);
  });

  it('never becomes a snap: the assist is capped well below a fish sprint', () => {
    expect(CAPTURE.attractMaxSpeed).toBeLessThan(0.6);
  });
});
