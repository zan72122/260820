export type QualityTier = 'low' | 'mid' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  bloomScale: number;
  sparkles: boolean;
  caustics: boolean;
  geodeNu: number;
  geodeNvOut: number;
  geodeNvIn: number;
  crystalMul: number;
  particleMul: number;
  maskSize: number;
}

const HIGH: QualitySettings = {
  tier: 'high', maxDpr: 2, shadows: true, shadowMapSize: 1024, bloom: true, bloomScale: 0.5,
  sparkles: true, caustics: true, geodeNu: 72, geodeNvOut: 24, geodeNvIn: 20,
  crystalMul: 1, particleMul: 1, maskSize: 256,
};

const MID: QualitySettings = {
  ...HIGH, tier: 'mid', maxDpr: 1.75, shadowMapSize: 768, bloomScale: 0.42,
  geodeNu: 56, geodeNvOut: 18, geodeNvIn: 15, crystalMul: 0.72, particleMul: 0.7,
};

const LOW: QualitySettings = {
  ...MID, tier: 'low', maxDpr: 1.25, shadows: false, shadowMapSize: 512, bloom: false,
  sparkles: true, caustics: false, geodeNu: 44, geodeNvOut: 14, geodeNvIn: 12,
  crystalMul: 0.5, particleMul: 0.45, maskSize: 192,
};

const TIERS: Record<QualityTier, QualitySettings> = { low: LOW, mid: MID, high: HIGH };

export function qualityFor(tier: QualityTier): QualitySettings {
  return { ...TIERS[tier] };
}

/**
 * Initial guess. Deliberately conservative on phones: it is far better to start
 * at `mid` and get promoted than to drop frames during the first wash.
 */
export function guessQuality(opts: { fast?: boolean; hint?: QualityTier } = {}): QualitySettings {
  if (opts.hint) return qualityFor(opts.hint);
  if (opts.fast) {
    return {
      ...LOW, tier: 'low', maxDpr: 1, shadows: false, bloom: false, sparkles: false,
      caustics: false, geodeNu: 32, geodeNvOut: 10, geodeNvIn: 8, crystalMul: 0.3,
      particleMul: 0.2, maskSize: 128,
    };
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const cores = nav?.hardwareConcurrency ?? 4;
  const mem = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 4;
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  // A high-DPR phone with few cores is the classic thermal-throttle trap.
  if (cores <= 4 && dpr >= 2.5) return qualityFor('mid');
  if (cores <= 2 || mem <= 2) return qualityFor('low');
  return qualityFor('high');
}

export function nextTierDown(tier: QualityTier): QualityTier | null {
  return tier === 'high' ? 'mid' : tier === 'mid' ? 'low' : null;
}

/**
 * Watches frame time and steps the tier down once if the device cannot hold up.
 * Only ever downgrades — oscillating quality is more distracting than a
 * consistently lower setting.
 */
export class QualityGovernor {
  private samples: number[] = [];
  private cooldown = 4;
  private demoted = false;

  constructor(private onDowngrade: (tier: QualityTier) => void) {}

  sample(dt: number, current: QualityTier): void {
    if (this.demoted) return;
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    this.samples.push(dt);
    if (this.samples.length < 90) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p70 = sorted[Math.floor(sorted.length * 0.7)];
    this.samples.length = 0;
    if (p70 > 1 / 34) {
      const next = nextTierDown(current);
      if (next) {
        this.demoted = true;
        this.onDowngrade(next);
      }
    }
  }
}
