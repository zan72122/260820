import { clamp } from './math';

export type QualityTier = 'low' | 'mid' | 'high';

export interface Settings {
  /** Deterministic mode used by automated tests: fixed seed, no post noise, reduced particles. */
  fast: boolean;
  seed: number;
  tier: QualityTier;
  maxPixelRatio: number;
  /** Hard caps that keep the transparent fill-rate bounded on phones. */
  activeArcs: number;
  arcSegments: number;
  archiveArcs: number;
  mistParticles: number;
  dropletParticles: number;
  grassBlades: number;
  shadowMapSize: number;
  shadows: boolean;
}

const qs = (): URLSearchParams => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams('');
  }
};

function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = nav.hardwareConcurrency ?? 4;
  const px = window.screen.width * window.screen.height * (window.devicePixelRatio || 1) ** 2;
  if (mem <= 2 || cores <= 2) return 'low';
  if (mem >= 6 && cores >= 6 && px < 6.0e6) return 'high';
  return 'mid';
}

export function createSettings(): Settings {
  const q = qs();
  const fast = q.get('fast') === '1' || q.get('e2e') === '1';
  const forced = q.get('tier') as QualityTier | null;
  const tier = forced ?? (fast ? 'low' : detectTier());
  const seedParam = q.get('seed');
  const seed = seedParam ? Number(seedParam) >>> 0 : fast ? 20260821 : (Math.random() * 0xffffffff) >>> 0;

  const byTier = {
    low: {
      maxPixelRatio: 1,
      activeArcs: 8,
      arcSegments: 96,
      archiveArcs: 14,
      mistParticles: 220,
      dropletParticles: 90,
      grassBlades: 900,
      shadowMapSize: 512,
      shadows: !fast,
    },
    mid: {
      maxPixelRatio: 1.75,
      activeArcs: 12,
      arcSegments: 128,
      archiveArcs: 22,
      mistParticles: 460,
      dropletParticles: 160,
      grassBlades: 2200,
      shadowMapSize: 1024,
      shadows: true,
    },
    high: {
      maxPixelRatio: 2,
      activeArcs: 14,
      arcSegments: 160,
      archiveArcs: 28,
      mistParticles: 720,
      dropletParticles: 240,
      grassBlades: 3600,
      shadowMapSize: 1024,
      shadows: true,
    },
  }[tier];

  return {
    fast,
    seed,
    tier,
    ...byTier,
    maxPixelRatio: clamp(byTier.maxPixelRatio, 1, window.devicePixelRatio || 1),
  };
}
