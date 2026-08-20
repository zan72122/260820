import * as THREE from 'three';

/**
 * Quality selection.
 *
 * Picked once from what the device tells us, then trimmed at runtime if frames
 * start slipping. Two things are protected no matter how far quality falls:
 * the contact shadow under the ball, and the deformation of the surface it
 * lands on — without those the causal read breaks, and a smooth frame rate is
 * worth nothing if the child can no longer tell what happened.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  pixelRatioCap: number;
  shadowMapSize: number;
  shadows: boolean;
  textureScale: number;
  anisotropy: number;
  ballSegments: number;
  panelFieldRes: number;
  panelMeshRes: number;
  panelWearRes: number;
  particleCount: number;
}

const TIERS: Record<QualityTier, Omit<QualitySettings, 'tier'>> = {
  high: {
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    shadows: true,
    textureScale: 0.65,
    anisotropy: 8,
    ballSegments: 48,
    panelFieldRes: 72,
    panelMeshRes: 30,
    panelWearRes: 512,
    particleCount: 360,
  },
  medium: {
    pixelRatioCap: 1.7,
    shadowMapSize: 1024,
    shadows: true,
    textureScale: 0.55,
    anisotropy: 4,
    ballSegments: 36,
    panelFieldRes: 56,
    panelMeshRes: 24,
    panelWearRes: 256,
    particleCount: 240,
  },
  low: {
    pixelRatioCap: 1.35,
    shadowMapSize: 512,
    shadows: true,
    textureScale: 0.45,
    anisotropy: 2,
    ballSegments: 28,
    panelFieldRes: 44,
    panelMeshRes: 18,
    panelWearRes: 256,
    particleCount: 150,
  },
};

export function detectQuality(renderer: THREE.WebGLRenderer): QualitySettings {
  const gl = renderer.getContext();
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const area = window.innerWidth * window.innerHeight * dpr * dpr;

  let tier: QualityTier = 'high';
  if (maxTex < 4096 || cores <= 2 || mem <= 2) tier = 'low';
  else if (cores <= 4 || mem <= 3 || area > 4.6e6) tier = 'medium';

  // A very large canvas on a mid device costs more than a small one on a weak
  // device, so the pixel budget gets the final say.
  if (tier === 'high' && area > 6.2e6) tier = 'medium';

  return { tier, ...TIERS[tier] };
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return { tier, ...TIERS[tier] };
}

/** Rolling frame-time watchdog that can step the tier down (never up mid-play). */
export class PerformanceGovernor {
  private samples: number[] = [];
  private cooldown = 4;
  private lowered = 0;

  update(dt: number): 'down' | null {
    this.cooldown -= dt;
    this.samples.push(dt);
    if (this.samples.length > 90) this.samples.shift();
    if (this.cooldown > 0 || this.samples.length < 90 || this.lowered >= 2) return null;

    const sorted = [...this.samples].sort((a, b) => a - b);
    // The 80th percentile, so one long frame from a texture upload does not
    // trigger a downgrade, but sustained slowness does.
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    if (p80 > 1 / 34) {
      this.cooldown = 6;
      this.samples.length = 0;
      this.lowered++;
      return 'down';
    }
    return null;
  }

  get fps() {
    if (!this.samples.length) return 0;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return avg > 0 ? 1 / avg : 0;
  }
}
