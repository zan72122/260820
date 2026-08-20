import { clamp } from './mathx';

export type QualityTier = 'low' | 'balanced' | 'high';

export interface QualityProfile {
  tier: QualityTier;
  /** Hard cap applied on top of window.devicePixelRatio. */
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Maximum simultaneous shadow-casting lights. */
  shadowCasters: number;
  /** Upper bound on live salt grains. */
  saltBudget: number;
  /** Upper bound on live droplet sprites. */
  dropletBudget: number;
  /** Texture edge length for hero materials. */
  heroTexture: number;
  /** Texture edge length for background materials. */
  bgTexture: number;
  anisotropy: number;
  /** Enables the extra refractive shell on the jar and the brine. */
  richTransparency: boolean;
  /** Enables leaf dapple + ambient motes. */
  atmosphere: boolean;
  antialias: boolean;
}

export const PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    shadowCasters: 0,
    saltBudget: 260,
    dropletBudget: 26,
    heroTexture: 512,
    bgTexture: 256,
    anisotropy: 1,
    richTransparency: false,
    atmosphere: false,
    antialias: false,
  },
  balanced: {
    tier: 'balanced',
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 1024,
    shadowCasters: 1,
    saltBudget: 700,
    dropletBudget: 48,
    heroTexture: 1024,
    bgTexture: 512,
    anisotropy: 4,
    richTransparency: true,
    atmosphere: true,
    antialias: true,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2.5,
    shadows: true,
    shadowMapSize: 2048,
    shadowCasters: 1,
    saltBudget: 1300,
    dropletBudget: 72,
    heroTexture: 2048,
    bgTexture: 1024,
    anisotropy: 8,
    richTransparency: true,
    atmosphere: true,
    antialias: true,
  },
};

export interface DeviceHints {
  /** Unmasked WebGL renderer string when available. */
  renderer?: string;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
  /** Longest viewport edge in CSS pixels. */
  maxViewport?: number;
  forced?: QualityTier | null;
}

/** True for software rasterisers, where fps says nothing about a real device. */
export function isSoftwareRenderer(renderer?: string): boolean {
  if (!renderer) return false;
  const r = renderer.toLowerCase();
  return (
    r.includes('swiftshader') ||
    r.includes('llvmpipe') ||
    r.includes('software') ||
    r.includes('softwarerasterizer')
  );
}

/**
 * Picks a starting tier. A software rasteriser is *not* pushed to `low`:
 * the brief asks that hero materials and real geometry survive functional
 * verification, so SwiftShader keeps `balanced` structure with a capped
 * pixel ratio instead of being visually gutted.
 */
export function pickTier(hints: DeviceHints): QualityTier {
  if (hints.forced) return hints.forced;
  if (isSoftwareRenderer(hints.renderer)) return 'balanced';

  const mem = hints.deviceMemoryGb ?? 4;
  const cores = hints.hardwareConcurrency ?? 4;
  const dpr = hints.devicePixelRatio ?? 2;
  const maxViewport = hints.maxViewport ?? 900;

  let score = 0;
  score += mem >= 6 ? 2 : mem >= 4 ? 1 : 0;
  score += cores >= 8 ? 2 : cores >= 6 ? 1 : 0;
  // A large, dense panel costs fill rate; be conservative there.
  score -= dpr >= 3 && maxViewport >= 1000 ? 1 : 0;
  score += maxViewport >= 1000 && mem >= 6 ? 1 : 0;

  if (score >= 4) return 'high';
  if (score >= 2) return 'balanced';
  return 'low';
}

export function profileFor(tier: QualityTier): QualityProfile {
  return PROFILES[tier];
}

/** Resolution of the drawing buffer, never unbounded. */
export function resolvePixelRatio(devicePixelRatio: number, profile: QualityProfile): number {
  return clamp(devicePixelRatio || 1, 1, profile.maxPixelRatio);
}

const ORDER: QualityTier[] = ['low', 'balanced', 'high'];

export function stepTier(tier: QualityTier, delta: number): QualityTier {
  const i = clamp(ORDER.indexOf(tier) + delta, 0, ORDER.length - 1);
  return ORDER[i];
}

export interface AdaptiveOptions {
  /** Frame time above which we consider downgrading, ms. */
  slowMs?: number;
  /** Frame time below which we consider upgrading, ms. */
  fastMs?: number;
  /** Consecutive seconds required before acting. */
  holdSec?: number;
  /** Software rasterisers report meaningless frame times. */
  software?: boolean;
}

/**
 * Watches smoothed frame time and recommends a tier change. Upgrades require
 * a much longer hold than downgrades so quality never oscillates.
 */
export class AdaptiveQuality {
  private slowMs: number;
  private fastMs: number;
  private holdSec: number;
  private software: boolean;
  private avgMs = 16.7;
  private slowSec = 0;
  private fastSec = 0;
  /** Prevents climbing back to a tier that already proved too heavy. */
  private ceiling: QualityTier = 'high';

  constructor(opts: AdaptiveOptions = {}) {
    this.slowMs = opts.slowMs ?? 34;
    this.fastMs = opts.fastMs ?? 15;
    this.holdSec = opts.holdSec ?? 2.5;
    this.software = opts.software ?? false;
  }

  /** Returns a new tier when a change is warranted, otherwise null. */
  sample(frameMs: number, current: QualityTier): QualityTier | null {
    if (this.software) return null; // never judge a software rasteriser by fps
    const dt = Math.min(0.25, frameMs / 1000);
    this.avgMs = this.avgMs + (frameMs - this.avgMs) * 0.08;

    if (this.avgMs > this.slowMs) {
      this.slowSec += dt;
      this.fastSec = 0;
    } else if (this.avgMs < this.fastMs) {
      this.fastSec += dt;
      this.slowSec = 0;
    } else {
      this.slowSec = Math.max(0, this.slowSec - dt);
      this.fastSec = Math.max(0, this.fastSec - dt);
    }

    if (this.slowSec >= this.holdSec) {
      this.slowSec = 0;
      const next = stepTier(current, -1);
      if (next !== current) {
        this.ceiling = current === this.ceiling ? next : this.ceiling;
        return next;
      }
    }
    if (this.fastSec >= this.holdSec * 4) {
      this.fastSec = 0;
      const next = stepTier(current, 1);
      if (next !== current && ORDER.indexOf(next) <= ORDER.indexOf(this.ceiling)) return next;
    }
    return null;
  }

  get averageMs(): number {
    return this.avgMs;
  }
}
