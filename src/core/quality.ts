/**
 * Device capability probe and quality tiers.
 *
 * The rule for every tier: root-cluster silhouette, soil cracks and the
 * staggered lift delay are never reduced. Only particle counts, background
 * instancing density, shadow resolution and internal render scale move.
 */

export type TierName = 'low' | 'mid' | 'high';

export interface QualitySettings {
  tier: TierName;
  /** Multiplier applied on top of devicePixelRatio. */
  renderScale: number;
  maxPixelRatio: number;
  shadowMapSize: number;
  softShadows: boolean;
  /** Falling soil grains per burst. */
  particleBudget: number;
  /** Instanced background cassava plants. */
  backgroundPlants: number;
  /** Radial segments used on each storage root tube. */
  rootRadialSegments: number;
  /** Length segments used on each storage root tube. */
  rootLengthSegments: number;
  /** Fibrous hair roots per storage root. */
  fibrePerRoot: number;
  textureSize: number;
  anisotropy: number;
  contactShadows: boolean;
}

export interface DeviceProfile {
  isIOS: boolean;
  isTouch: boolean;
  hasWebGPU: boolean;
  memoryGB: number;
  cores: number;
  dpr: number;
}

export function probeDevice(): DeviceProfile {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  return {
    isIOS,
    isTouch: (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window,
    hasWebGPU: typeof (navigator as { gpu?: unknown }).gpu !== 'undefined',
    memoryGB: (navigator as { deviceMemory?: number }).deviceMemory ?? (isIOS ? 4 : 8),
    cores: navigator.hardwareConcurrency ?? 4,
    dpr: window.devicePixelRatio || 1,
  };
}

const TIERS: Record<TierName, QualitySettings> = {
  low: {
    tier: 'low',
    renderScale: 0.72,
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    softShadows: false,
    particleBudget: 90,
    backgroundPlants: 90,
    rootRadialSegments: 13,
    rootLengthSegments: 24,
    fibrePerRoot: 5,
    textureSize: 256,
    anisotropy: 2,
    contactShadows: true,
  },
  mid: {
    tier: 'mid',
    renderScale: 0.88,
    maxPixelRatio: 2,
    shadowMapSize: 1536,
    softShadows: true,
    particleBudget: 180,
    backgroundPlants: 180,
    rootRadialSegments: 20,
    rootLengthSegments: 32,
    fibrePerRoot: 9,
    textureSize: 512,
    anisotropy: 4,
    contactShadows: true,
  },
  high: {
    tier: 'high',
    renderScale: 1,
    maxPixelRatio: 2,
    shadowMapSize: 2048,
    softShadows: true,
    particleBudget: 320,
    backgroundPlants: 320,
    rootRadialSegments: 26,
    rootLengthSegments: 40,
    fibrePerRoot: 14,
    textureSize: 1024,
    anisotropy: 8,
    contactShadows: true,
  },
};

export function pickTier(device: DeviceProfile): QualitySettings {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'low' || forced === 'mid' || forced === 'high') {
    return { ...TIERS[forced] };
  }

  const pixels = window.innerWidth * window.innerHeight * device.dpr * device.dpr;
  let tier: TierName = 'mid';

  if (device.cores >= 6 && device.memoryGB >= 6) tier = 'high';
  if (device.cores <= 4 && device.memoryGB <= 4) tier = 'mid';
  if (device.cores <= 2 || device.memoryGB <= 2) tier = 'low';
  // Very large canvases on modest silicon: step down one notch.
  if (pixels > 4.4e6 && tier === 'high') tier = 'mid';
  if (pixels > 6.2e6 && tier === 'mid') tier = 'low';

  const settings = { ...TIERS[tier] };
  // WebGPU-capable browsers get the richer contact/particle treatment only;
  // the WebGL 2 baseline path is what everything else runs.
  if (device.hasWebGPU && tier !== 'low') {
    settings.particleBudget = Math.round(settings.particleBudget * 1.4);
    settings.anisotropy = Math.max(settings.anisotropy, 8);
  }
  return settings;
}

/** Runtime downshift when the measured frame budget is missed. */
export function degrade(q: QualitySettings): QualitySettings | null {
  if (q.renderScale > 0.78) return { ...q, renderScale: Math.max(0.66, q.renderScale - 0.12) };
  if (q.particleBudget > 80) {
    return { ...q, particleBudget: Math.round(q.particleBudget * 0.6), softShadows: false };
  }
  if (q.backgroundPlants > 70) {
    return { ...q, backgroundPlants: Math.round(q.backgroundPlants * 0.6) };
  }
  return null;
}
