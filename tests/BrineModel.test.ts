import { describe, expect, it } from 'vitest';
import { BrineModel } from '../src/core/BrineModel';

describe('the salt-to-juice causality', () => {
  it('produces no juice at all until time passes', () => {
    const m = new BrineModel();
    for (let i = 0; i < 40; i++) m.addSalt(0.05, i % 9);
    for (let i = 0; i < 300; i++) m.tick(1 / 60);
    expect(m.saltPoured).toBeGreaterThan(0.5);
    expect(m.extraction).toBe(0);
    expect(m.level).toBe(0);
  });

  it('produces no juice from time alone, without salt', () => {
    const m = new BrineModel();
    m.advanceDays(6);
    for (let i = 0; i < 120; i++) m.tick(1 / 60);
    expect(m.extraction).toBe(0);
    expect(m.level).toBe(0);
  });

  it('beads exactly one droplet the moment the first grain lands', () => {
    const m = new BrineModel();
    const first = m.addSalt(0.05, 3);
    expect(first).not.toBeNull();
    expect(first?.fruit).toBe(3);
    expect(m.consumeDroplets()).toHaveLength(1);
    expect(m.addSalt(0.05, 3)).toBeNull();
    expect(m.consumeDroplets()).toHaveLength(0);
  });

  it('raises the level gradually, never in one jump', () => {
    const m = new BrineModel();
    m.addSalt(0.6, 0);
    const levels: number[] = [];
    for (let d = 0; d < 6; d++) {
      m.advanceDays(1);
      for (let i = 0; i < 240; i++) m.tick(1 / 60);
      levels.push(m.level);
    }
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1] - 1e-6);
    }
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[0]).toBeLessThan(0.45);
    expect(levels[levels.length - 1]).toBeGreaterThan(0.4);
    // No single day may account for most of the rise.
    const biggestStep = Math.max(...levels.map((v, i) => v - (levels[i - 1] ?? 0)));
    expect(biggestStep).toBeLessThan(levels[levels.length - 1] * 0.65);
  });

  it('gives more juice for more salt', () => {
    const little = new BrineModel();
    little.addSalt(0.2, 0);
    little.advanceDays(4);
    const lots = new BrineModel();
    lots.addSalt(1, 0);
    lots.advanceDays(4);
    expect(lots.extraction).toBeGreaterThan(little.extraction);
  });

  it('integrates a single big drag the same as many small ones', () => {
    const fast = new BrineModel();
    fast.addSalt(0.5, 0);
    fast.advanceDays(4);
    const slow = new BrineModel();
    slow.addSalt(0.5, 0);
    for (let i = 0; i < 40; i++) slow.advanceDays(0.1);
    expect(fast.extraction).toBeCloseTo(slow.extraction, 3);
  });

  it('dissolves the salt and wets the skin as the juice comes out', () => {
    const m = new BrineModel();
    m.addSalt(0.7, 0);
    expect(m.pileHeight).toBeCloseTo(0.7, 3);
    m.advanceDays(5);
    for (let i = 0; i < 600; i++) m.tick(1 / 60);
    expect(m.pileHeight).toBeLessThan(0.35);
    expect(m.wetness).toBeGreaterThan(0.4);
  });

  it('never runs past the compressed span of days', () => {
    const m = new BrineModel({ maxDays: 6 });
    m.addSalt(1, 0);
    m.advanceDays(50);
    expect(m.day).toBe(6);
    expect(m.level).toBeLessThanOrEqual(1);
  });

  it('emits drips while the salt is still pulling water out', () => {
    const m = new BrineModel();
    m.addSalt(0.8, 2);
    m.consumeDroplets();
    m.advanceDays(2);
    expect(m.consumeDroplets().length).toBeGreaterThan(0);
  });

  it('resets cleanly for a repeat round', () => {
    const m = new BrineModel();
    m.addSalt(1, 0);
    m.advanceDays(6);
    m.reset();
    expect(m.saltPoured).toBe(0);
    expect(m.day).toBe(0);
    expect(m.level).toBe(0);
    expect(m.firstContact).toBe(false);
    expect(m.consumeDroplets()).toHaveLength(0);
  });
});
