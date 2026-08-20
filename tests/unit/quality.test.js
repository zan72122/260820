import { describe, it, expect } from 'vitest';
import { AdaptiveResolution, TIER_SETTINGS, pickTier } from '../../src/core/Quality.js';

/** Feed the controller `seconds` of frames that each took `frameMs`. */
function run(a, frameMs, seconds) {
  const dt = frameMs / 1000;
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) a.update(frameMs, dt);
  return a.scale;
}

describe('AdaptiveResolution', () => {
  it('starts at the tier default and never leaves its bounds', () => {
    for (const tier of ['low', 'mid', 'high']) {
      const a = new AdaptiveResolution(tier);
      expect(a.scale).toBe(TIER_SETTINGS[tier].startScale);
      run(a, 90, 30);
      expect(a.scale).toBeGreaterThanOrEqual(a.min);
      run(a, 16.7, 60);
      expect(a.scale).toBeLessThanOrEqual(a.max);
    }
  });

  it('backs off when frames are being dropped', () => {
    const a = new AdaptiveResolution('high');
    run(a, 16.7, 3); // learn a 60Hz display
    const before = a.scale;
    run(a, 34, 12);
    expect(a.scale).toBeLessThan(before);
  });

  it('recovers once the frames come back', () => {
    const a = new AdaptiveResolution('high');
    run(a, 16.7, 3);
    run(a, 40, 12);
    const dipped = a.scale;
    expect(dipped).toBeLessThan(TIER_SETTINGS.high.startScale);
    run(a, 16.7, 40);
    expect(a.scale).toBeGreaterThan(dipped);
  });

  /**
   * The bug this replaced: a fixed millisecond target treats a device that is
   * vsync-locked at 60Hz as permanently "too slow to recover", so the
   * resolution could only ever go down.
   */
  it('treats hitting the refresh rate as headroom, not as a miss', () => {
    const a = new AdaptiveResolution('mid');
    a.scale = a.min;
    run(a, 16.7, 40);
    expect(a.scale).toBeGreaterThan(a.min);
  });

  it('learns a fast display instead of assuming 60Hz', () => {
    const a = new AdaptiveResolution('high');
    run(a, 8.3, 6);
    expect(a.interval).toBeLessThan(11);
    // 12ms on a 120Hz panel is a missed frame, even though it would be fine at 60.
    const before = a.scale;
    run(a, 14, 14);
    expect(a.scale).toBeLessThanOrEqual(before);
  });

  it('ignores nonsense frame times', () => {
    const a = new AdaptiveResolution('mid');
    const before = a.scale;
    for (let i = 0; i < 200; i++) a.update(0, 1 / 60);
    for (let i = 0; i < 200; i++) a.update(100000, 1 / 60);
    expect(a.scale).toBe(before);
  });
});

describe('pickTier', () => {
  it('falls back to a conservative tier without a WebGL2 context', () => {
    const tier = pickTier(null);
    expect(['low', 'mid', 'high']).toContain(tier);
    expect(TIER_SETTINGS[tier]).toBeDefined();
  });

  it('every tier is fully specified', () => {
    for (const [name, s] of Object.entries(TIER_SETTINGS)) {
      for (const key of [
        'maxPixelRatio',
        'startScale',
        'minScale',
        'waterSegments',
        'rippleCount',
        'shadowMapSize',
        'dropletBudget',
        'crowd',
        'fishCount',
        'anisotropy',
      ]) {
        expect(s[key], `${name}.${key}`).toBeTypeOf('number');
      }
      expect(s.minScale).toBeLessThanOrEqual(s.startScale);
      expect(s.rippleCount).toBeLessThanOrEqual(8);
    }
  });
});
