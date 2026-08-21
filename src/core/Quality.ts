export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  causticRes: number;
  dropletCount: number;
  foamCount: number;
  tubeSegmentsAlong: number;
  tubeSegmentsAround: number;
  waterSegments: number;
  anisotropy: number;
  reflectionQuality: number; // 0..1 -> envmap resolution & clearcoat detail
  cloudLayers: number;
  farLOD: number; // 0..1 detail of the factory backdrop
}

const TIERS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    causticRes: 128,
    dropletCount: 26,
    foamCount: 40,
    tubeSegmentsAlong: 96,
    tubeSegmentsAround: 40,
    waterSegments: 60,
    anisotropy: 2,
    reflectionQuality: 0.35,
    cloudLayers: 2,
    farLOD: 0.4,
  },
  medium: {
    tier: 'medium',
    pixelRatioCap: 1.6,
    shadows: true,
    shadowMapSize: 1024,
    causticRes: 256,
    dropletCount: 60,
    foamCount: 90,
    tubeSegmentsAlong: 150,
    tubeSegmentsAround: 60,
    waterSegments: 110,
    anisotropy: 4,
    reflectionQuality: 0.7,
    cloudLayers: 3,
    farLOD: 0.75,
  },
  high: {
    tier: 'high',
    pixelRatioCap: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    causticRes: 512,
    dropletCount: 110,
    foamCount: 160,
    tubeSegmentsAlong: 220,
    tubeSegmentsAround: 84,
    waterSegments: 170,
    anisotropy: 8,
    reflectionQuality: 1.0,
    cloudLayers: 4,
    farLOD: 1.0,
  },
};

export function settingsFor(tier: QualityTier): QualitySettings {
  return { ...TIERS[tier] };
}

/** Cheap heuristic: mobile Safari / low DPR devices start lower, desktop starts high. */
export function autoDetectTier(): QualityTier {
  const ua = navigator.userAgent;
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const cores = (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (!mobile && cores >= 8) return 'high';
  if (mobile && cores >= 6 && mem >= 4) return 'medium';
  if (mobile) return 'medium';
  return cores >= 4 ? 'medium' : 'low';
}

/**
 * Watches frame time and steps the tier down when the device cannot keep up.
 * Never steps up automatically: a stable picture matters more than extra sparkle.
 */
export class PerfGovernor {
  private acc = 0;
  private frames = 0;
  private strikes = 0;
  private cooldown = 4;

  constructor(private readonly onDowngrade: (t: QualityTier) => void) {}

  update(dt: number, current: QualityTier): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.acc += dt;
    this.frames++;
    if (this.acc < 1.5) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 26) this.strikes++;
    else this.strikes = Math.max(0, this.strikes - 1);
    if (this.strikes >= 2) {
      this.strikes = 0;
      this.cooldown = 8;
      if (current === 'high') this.onDowngrade('medium');
      else if (current === 'medium') this.onDowngrade('low');
    }
  }
}
