/**
 * Device tiering and adaptive internal resolution.
 *
 * Target platform is iPhone / iPad Safari, so everything here assumes a
 * thermally-limited GPU: we pick a conservative starting budget and then let
 * measured frame time move the internal render scale, never the layout size.
 */

import { clamp } from './Rng.js';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export function detectPlatform() {
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi/.test(ua);
  return { isIOS, isAndroid, isSafari, isMobile };
}

export function isFastMode() {
  if (typeof window === 'undefined') return false;
  if (window.__E2E_FAST__) return true;
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('fast') === '1' || p.has('e2e');
  } catch {
    return false;
  }
}

/**
 * @param {WebGLRenderingContext|WebGL2RenderingContext|null} gl
 */
export function pickTier(gl) {
  const { isIOS, isMobile } = detectPlatform();
  // A query override so a specific tier can be exercised on any machine.
  if (typeof window !== 'undefined') {
    try {
      const forced = new URLSearchParams(window.location.search).get('tier');
      if (forced && TIER_SETTINGS[forced]) return forced;
    } catch {
      /* opaque location, fall through to detection */
    }
  }
  if (isFastMode()) return 'low';

  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
  const isWebGL2 = !!gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  let score = 0;
  score += isWebGL2 ? 2 : 0;
  score += cores >= 6 ? 2 : cores >= 4 ? 1 : 0;
  score += mem >= 6 ? 2 : mem >= 4 ? 1 : 0;
  if (!isMobile) score += 2;
  // Older iPhones report 2 cores / no deviceMemory; Safari hides deviceMemory
  // entirely, so an iOS device that clears the core check is treated as mid.
  if (isIOS && !navigator.deviceMemory) score += 1;

  if (score >= 7) return 'high';
  if (score >= 4) return 'mid';
  return 'low';
}

export const TIER_SETTINGS = {
  low: {
    maxPixelRatio: 1.35,
    startScale: 0.8,
    minScale: 0.55,
    waterSegments: 48,
    rippleCount: 5,
    shadows: true,
    shadowMapSize: 512,
    caustics: true,
    dropletBudget: 40,
    crowd: 14,
    fishCount: 8,
    anisotropy: 2,
    softShadow: false,
  },
  mid: {
    maxPixelRatio: 1.75,
    startScale: 0.9,
    minScale: 0.6,
    waterSegments: 72,
    rippleCount: 6,
    shadows: true,
    shadowMapSize: 1024,
    caustics: true,
    dropletBudget: 72,
    crowd: 20,
    fishCount: 9,
    anisotropy: 4,
    softShadow: true,
  },
  high: {
    maxPixelRatio: 2,
    startScale: 1,
    minScale: 0.7,
    waterSegments: 110,
    rippleCount: 8,
    shadows: true,
    shadowMapSize: 1536,
    caustics: true,
    dropletBudget: 120,
    crowd: 30,
    fishCount: 10,
    anisotropy: 8,
    softShadow: true,
  },
};

/**
 * Moves the internal render scale to keep the frame rate at the display's
 * refresh rate.
 *
 * Measuring against a fixed millisecond target is wrong on a phone: a 120Hz
 * iPad and a 60Hz iPhone have completely different budgets, and a device that
 * is vsync-limited at 60Hz sits at exactly 16.7ms whether it has 20% headroom
 * or none. So the target is learned — the fastest frames we have seen stand in
 * for the display interval, and the scale moves on how far the typical frame
 * has drifted from it.
 *
 * Slow to brighten, quick to back off: a child holding a warm phone should
 * never watch the frame rate collapse, and never see the resolution flicker.
 */
export class AdaptiveResolution {
  constructor(tier) {
    const s = TIER_SETTINGS[tier];
    this.min = s.minScale;
    this.max = s.startScale;
    this.scale = s.startScale;
    this.samples = [];
    this.cooldown = 1.2;
    /** learned display interval, ms; starts at 60Hz and adapts down */
    this.interval = 16.7;
    this.changed = false;
  }

  /** @param {number} frameMs wall-clock time since the previous frame @param {number} dt seconds */
  update(frameMs, dt) {
    this.changed = false;
    if (frameMs > 1 && frameMs < 500) {
      this.samples.push(frameMs);
      // The fastest frames we ever see are the ones that were not doing work,
      // so they approximate how often the display can actually present.
      if (frameMs < this.interval) this.interval = Math.max(6.5, frameMs * 0.5 + this.interval * 0.5);
    }
    if (this.samples.length > 60) this.samples.shift();
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.samples.length < 30) return this.scale;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    const ratio = med / Math.max(this.interval, 6.5);
    const prev = this.scale;

    if (ratio > 1.32) {
      // Dropping frames. Back off, harder the worse it is.
      this.scale = clamp(this.scale - (ratio > 1.9 ? 0.14 : 0.07), this.min, this.max);
      this.cooldown = 1.2;
    } else if (ratio < 1.08 && this.scale < this.max) {
      // Comfortably hitting the refresh rate; take a little back.
      this.scale = clamp(this.scale + 0.05, this.min, this.max);
      this.cooldown = 2.6;
    } else {
      this.cooldown = 0.6;
    }
    if (Math.abs(this.scale - prev) > 1e-3) {
      this.changed = true;
      this.samples.length = 0;
    }
    return this.scale;
  }
}
