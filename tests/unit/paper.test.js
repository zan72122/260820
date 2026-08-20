import { describe, it, expect } from 'vitest';
import {
  createPaperState,
  updatePaper,
  isTorn,
  integrity,
  sagProfile,
  syncTears,
  holeDepth,
  PAPER,
} from '../../src/game/paper.js';
import { Rng } from '../../src/core/Rng.js';

const step = (state, seconds, ctx, rng, dt = 1 / 60) => {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) updatePaper(state, dt, ctx, rng);
  return state;
};

const IN_WATER = { submerged: 1, planarSpeed: 0.1, liftSpeed: 0, fishLoad: 0, struggling: 0 };
const IN_AIR = { submerged: 0, planarSpeed: 0, liftSpeed: 0, fishLoad: 0, struggling: 0 };

describe('wetness', () => {
  it('soaks to fully wet in about the advertised time', () => {
    const s = createPaperState();
    step(s, PAPER.soakSeconds * 0.5, IN_WATER, new Rng(1));
    expect(s.wetness).toBeGreaterThan(0.45);
    expect(s.wetness).toBeLessThan(0.55);
    step(s, PAPER.soakSeconds * 0.6, IN_WATER, new Rng(1));
    expect(s.wetness).toBe(1);
  });

  it('the stain covers the sheet within a beat of first contact', () => {
    const s = createPaperState();
    expect(s.everWet).toBe(false);
    step(s, 1 / 30, IN_WATER, new Rng(1));
    expect(s.everWet).toBe(true);
    expect(s.wetFront).toBeGreaterThan(0);
    step(s, 0.6, IN_WATER, new Rng(1));
    expect(s.wetFront).toBe(1);
  });

  it('gives a little back in the air, but never dries out', () => {
    const s = createPaperState();
    step(s, 6, IN_WATER, new Rng(1));
    const wet = s.wetness;
    step(s, 4, IN_AIR, new Rng(1));
    expect(s.wetness).toBeLessThan(wet);
    expect(s.wetness).toBeGreaterThan(wet - 0.1);
  });
});

describe('damage', () => {
  it('dry paper is indestructible', () => {
    const s = createPaperState();
    step(s, 5, { ...IN_AIR, planarSpeed: 2, liftSpeed: 2, fishLoad: 1.4, struggling: 1 }, new Rng(1));
    expect(s.damage).toBe(0);
    expect(s.tears.length).toBe(0);
  });

  it('never decreases', () => {
    const s = createPaperState();
    let prev = 0;
    for (let i = 0; i < 400; i++) {
      updatePaper(s, 1 / 60, i % 3 === 0 ? IN_AIR : IN_WATER, new Rng(3));
      expect(s.damage).toBeGreaterThanOrEqual(prev);
      prev = s.damage;
    }
  });

  it('punishes dragging the sheet about, and ignores a slow hand', () => {
    const slow = createPaperState();
    const fast = createPaperState();
    step(slow, 12, { ...IN_WATER, planarSpeed: 0.1 }, new Rng(2));
    step(fast, 12, { ...IN_WATER, planarSpeed: 0.95 }, new Rng(2));
    expect(fast.damage).toBeGreaterThan(slow.damage * 2);
  });

  it('a heavier fish, lifted faster, costs more', () => {
    const gentle = createPaperState();
    const yank = createPaperState();
    const soak = { ...IN_WATER, planarSpeed: 0 };
    step(gentle, 10, soak, new Rng(4));
    step(yank, 10, soak, new Rng(4));
    const g0 = gentle.damage;
    const y0 = yank.damage;
    step(gentle, 1, { submerged: 0.5, planarSpeed: 0, liftSpeed: 0.2, fishLoad: 0.8, struggling: 0.5 }, new Rng(4));
    step(yank, 1, { submerged: 0.5, planarSpeed: 0, liftSpeed: 1.0, fishLoad: 1.3, struggling: 1 }, new Rng(4));
    expect(yank.damage - y0).toBeGreaterThan((gentle.damage - g0) * 1.8);
  });
});

/**
 * These two are the design, not an implementation detail: a careful child
 * gets a handful of fish out of one poi, and a child who thrashes loses the
 * sheet in well under a minute. If either stops holding, the game stops
 * teaching anything.
 */
describe('how long a poi lasts', () => {
  const gentleCycle = (s, rng) => {
    step(s, 4.0, { submerged: 1, planarSpeed: 0.12, liftSpeed: 0, fishLoad: 0, struggling: 0 }, rng);
    step(s, 0.6, { submerged: 0.5, planarSpeed: 0.1, liftSpeed: 0.35, fishLoad: 0.9, struggling: 0.8 }, rng);
    step(s, 1.0, { submerged: 0, planarSpeed: 0.1, liftSpeed: 0, fishLoad: 0.9, struggling: 0.4 }, rng);
    step(s, 1.4, IN_AIR, rng);
  };

  it('careful play gets several fish out of one sheet', () => {
    const s = createPaperState();
    const rng = new Rng(9);
    let lifts = 0;
    while (!s.destroyed && lifts < 30) {
      gentleCycle(s, rng);
      lifts++;
    }
    expect(lifts).toBeGreaterThanOrEqual(5);
    expect(lifts).toBeLessThanOrEqual(12);
  });

  it('thrashing loses the sheet inside a minute', () => {
    const s = createPaperState();
    const rng = new Rng(9);
    let t = 0;
    while (!s.destroyed && t < 90) {
      step(s, 0.5, { submerged: 1, planarSpeed: 1.1, liftSpeed: 0.3, fishLoad: 0.4, struggling: 0.6 }, rng);
      t += 0.5;
    }
    expect(s.destroyed).toBe(true);
    expect(t).toBeLessThan(45);
  });
});

describe('holes', () => {
  it('opens in the middle first and leaves the rim to scoop with', () => {
    const s = createPaperState();
    s.damage = 0.4;
    syncTears(s, new Rng(11));
    expect(s.tears.length).toBeGreaterThan(0);
    // Somewhere in the middle is gone...
    const middleGone = [0, 0.1, 0.2].some((r) =>
      [0, 1.2, 2.4, 3.6, 4.8].some((a) => isTorn(s, Math.cos(a) * r, Math.sin(a) * r))
    );
    expect(middleGone).toBe(true);
    // ...but the outer ring is still whole all the way round.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      expect(isTorn(s, Math.cos(a) * 0.86, Math.sin(a) * 0.86)).toBe(false);
    }
    expect(integrity(s)).toBeGreaterThan(0.7);
  });

  it('grows monotonically and eats the sheet by the time damage is spent', () => {
    const s = createPaperState();
    let last = 1;
    for (const d of [0.3, 0.5, 0.7, 0.85, 0.95, 1]) {
      s.damage = d;
      syncTears(s, new Rng(11));
      const i = integrity(s);
      expect(i).toBeLessThanOrEqual(last + 1e-9);
      last = i;
    }
    expect(last).toBeLessThan(0.45);
  });

  it('anything outside the hoop counts as no paper', () => {
    const s = createPaperState();
    expect(isTorn(s, 0, 0)).toBe(false);
    expect(isTorn(s, 1.01, 0)).toBe(true);
    expect(isTorn(s, 0.8, 0.8)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = createPaperState();
    const b = createPaperState();
    a.damage = b.damage = 0.8;
    syncTears(a, new Rng(77));
    syncTears(b, new Rng(77));
    expect(a.tears).toEqual(b.tears);
    expect(holeDepth(a, 0.1, 0.1)).toBe(holeDepth(b, 0.1, 0.1));
  });
});

describe('sag', () => {
  it('hangs lowest in the middle and is pinned at the hoop', () => {
    expect(sagProfile(1, 0.3)).toBeCloseTo(0, 6);
    expect(sagProfile(0, 0.3)).toBeLessThan(sagProfile(0.6, 0.3));
    expect(sagProfile(0.6, 0.3)).toBeLessThan(0);
  });

  it('dimples under a weight, where the weight is', () => {
    const flat = sagProfile(0.5, 0.2, 0, 0);
    const loaded = sagProfile(0.5, 0.2, 1, 0.5);
    expect(loaded).toBeLessThan(flat);
    const away = sagProfile(0.5, 0.2, 1, 1.6);
    expect(away).toBeGreaterThan(loaded);
  });
});
