import { describe, expect, it } from 'vitest';
import {
  AdaptiveQuality, isSoftwareRenderer, pickTier, profileFor, resolvePixelRatio, stepTier,
} from '../src/core/Quality';

describe('quality tiers', () => {
  it('recognises software rasterisers', () => {
    expect(isSoftwareRenderer('Google SwiftShader')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15)')).toBe(true);
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
    expect(isSoftwareRenderer(undefined)).toBe(false);
  });

  it('does not gut the look just because a rasteriser is software', () => {
    const tier = pickTier({ renderer: 'SwiftShader Device', deviceMemoryGb: 2, hardwareConcurrency: 2 });
    expect(tier).toBe('balanced');
    const p = profileFor(tier);
    // Hero materials and real geometry survive functional verification.
    expect(p.richTransparency).toBe(true);
    expect(p.shadows).toBe(true);
  });

  it('scales with the device it is actually given', () => {
    expect(pickTier({ deviceMemoryGb: 8, hardwareConcurrency: 8, devicePixelRatio: 2, maxViewport: 1024 }))
      .toBe('high');
    expect(pickTier({ deviceMemoryGb: 2, hardwareConcurrency: 2, devicePixelRatio: 3, maxViewport: 900 }))
      .toBe('low');
  });

  it('honours an explicit override', () => {
    expect(pickTier({ forced: 'low', deviceMemoryGb: 16, hardwareConcurrency: 16 })).toBe('low');
  });

  it('never lets the drawing buffer scale without a ceiling', () => {
    expect(resolvePixelRatio(4, profileFor('low'))).toBe(1);
    expect(resolvePixelRatio(4, profileFor('balanced'))).toBe(2);
    expect(resolvePixelRatio(4, profileFor('high'))).toBe(2.5);
    expect(resolvePixelRatio(0, profileFor('high'))).toBe(1);
  });

  it('keeps hero textures larger than background ones at every tier', () => {
    for (const tier of ['low', 'balanced', 'high'] as const) {
      const p = profileFor(tier);
      expect(p.heroTexture).toBeGreaterThan(p.bgTexture);
      expect(p.heroTexture).toBeLessThanOrEqual(2048);
      expect(p.bgTexture).toBeLessThanOrEqual(1024);
    }
  });

  it('clamps tier stepping at both ends', () => {
    expect(stepTier('low', -1)).toBe('low');
    expect(stepTier('high', 1)).toBe('high');
    expect(stepTier('balanced', -1)).toBe('low');
  });
});

describe('adaptive quality', () => {
  it('drops a tier after a sustained slow patch', () => {
    const a = new AdaptiveQuality({ slowMs: 34, holdSec: 1 });
    let out: string | null = null;
    for (let i = 0; i < 400 && !out; i++) out = a.sample(60, 'high');
    expect(out).toBe('balanced');
  });

  it('needs far longer to climb back up than to drop', () => {
    const a = new AdaptiveQuality({ holdSec: 1 });
    let ups = 0;
    for (let i = 0; i < 200; i++) if (a.sample(8, 'low')) ups++;
    expect(ups).toBeLessThanOrEqual(1);
  });

  it('never judges a software rasteriser by its frame rate', () => {
    const a = new AdaptiveQuality({ software: true });
    for (let i = 0; i < 2000; i++) expect(a.sample(400, 'high')).toBeNull();
  });

  it('stays put at a steady, healthy frame time', () => {
    const a = new AdaptiveQuality();
    for (let i = 0; i < 600; i++) expect(a.sample(20, 'balanced')).toBeNull();
  });
});
