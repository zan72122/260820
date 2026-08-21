import { describe, expect, it } from 'vitest';
import { mulberry32, uniform } from '../../src/util/rng';
import { BOARD_WIDTH, LANE_WIDTH, pinPositions, PIN_SPACING } from '../../src/util/units';

describe('mulberry32', () => {
  it('同一シードで同一系列を返す（決定論）', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('異なるシードで系列が異なる', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('uniform は範囲内に収まる', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = uniform(rng, -2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('units', () => {
  it('レーン幅は39枚板 × 板幅', () => {
    expect(BOARD_WIDTH * 39).toBeCloseTo(LANE_WIDTH, 10);
  });

  it('ピンは10本、隣接ピン中心間は12in', () => {
    const pins = pinPositions();
    expect(pins).toHaveLength(10);
    // 1番ピン(先頭)と2番ピン(2列目左)の距離 = PIN_SPACING
    const p1 = pins[0]!;
    const p2 = pins[1]!;
    const d = Math.hypot(p1.x - p2.x, p1.z - p2.z);
    expect(d).toBeCloseTo(PIN_SPACING, 6);
  });
});
