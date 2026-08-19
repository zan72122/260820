import type { WebGPURenderer } from 'three/webgpu';
import type { RuntimeFlags } from './config';
import { clamp } from './mathx';

export type Tier = 'low' | 'mid' | 'high';

export interface QualityProfile {
  tier: Tier;
  /** Hard cap on internal render resolution multiplier. */
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Floating dust motes. */
  dust: number;
  /** Fake volumetric light cones. */
  lightShafts: boolean;
  /** How often (in frames) the audience idle sway refreshes. */
  audienceStride: number;
  /** Extra soft fill lights that are pure polish. */
  fillLights: boolean;
}

const PROFILES: Record<Tier, QualityProfile> = {
  high: {
    tier: 'high',
    maxPixelRatio: 2.0,
    shadows: true,
    shadowMapSize: 1024,
    dust: 340,
    lightShafts: true,
    audienceStride: 2,
    fillLights: true,
  },
  mid: {
    tier: 'mid',
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 768,
    dust: 170,
    lightShafts: true,
    audienceStride: 4,
    fillLights: true,
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1.1,
    shadows: false,
    shadowMapSize: 512,
    dust: 0,
    lightShafts: false,
    audienceStride: 8,
    fillLights: false,
  },
};

const ORDER: Tier[] = ['low', 'mid', 'high'];

function guessStartTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const px = window.screen.width * window.screen.height * (window.devicePixelRatio || 1);
  if (cores <= 4 || mem <= 3) return 'mid';
  if (px > 4.2e6 && cores <= 6) return 'mid';
  return 'high';
}

/**
 * Frame-pacing first. We would rather run a plainer frame at a steady 60 than a
 * gorgeous one that stutters, so this watches frame time and steps the whole
 * scene down (resolution, then shadows, then extras) when it slips.
 */
export class Quality {
  profile: QualityProfile;
  private index: number;
  private ema = 16.7;
  private badTime = 0;
  private goodTime = 0;
  private pinned: boolean;
  private listeners: ((p: QualityProfile) => void)[] = [];
  private renderer: WebGPURenderer;
  private cooldown = 2.5;

  constructor(renderer: WebGPURenderer, flags: RuntimeFlags) {
    this.renderer = renderer;
    const start: Tier = flags.pinnedQuality ?? (flags.fast ? 'low' : guessStartTier());
    this.pinned = flags.pinnedQuality !== null || flags.fast;
    this.index = ORDER.indexOf(start);
    this.profile = PROFILES[start];
  }

  onChange(fn: (p: QualityProfile) => void): void {
    this.listeners.push(fn);
    fn(this.profile);
  }

  /** Resolution is clamped both by tier and by an absolute pixel budget. */
  applyPixelRatio(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    let ratio = Math.min(dpr, this.profile.maxPixelRatio);
    // Never exceed ~2.6 megapixels of internal buffer: past that the gain is
    // invisible on a phone and the fill cost is not.
    const budget = 2.6e6;
    const px = width * height * ratio * ratio;
    if (px > budget) ratio = Math.sqrt(budget / (width * height));
    this.renderer.setPixelRatio(clamp(ratio, 0.75, 2.0));
  }

  sample(frameMs: number, dt: number): void {
    if (this.pinned) return;
    // Ignore obvious hitches (tab switch, first shader compiles).
    if (frameMs > 220) return;
    this.ema += (frameMs - this.ema) * 0.06;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    if (this.ema > 21.5) {
      this.badTime += dt;
      this.goodTime = 0;
    } else if (this.ema < 13.2) {
      this.goodTime += dt;
      this.badTime = 0;
    } else {
      this.badTime *= 0.9;
      this.goodTime *= 0.9;
    }

    if (this.badTime > 1.2 && this.index > 0) {
      this.setIndex(this.index - 1);
    } else if (this.goodTime > 7 && this.index < ORDER.length - 1) {
      this.setIndex(this.index + 1);
    }
  }

  private setIndex(i: number): void {
    this.index = i;
    this.profile = PROFILES[ORDER[i]];
    this.ema = 16.7;
    this.badTime = 0;
    this.goodTime = 0;
    this.cooldown = 4;
    for (const fn of this.listeners) fn(this.profile);
  }
}
