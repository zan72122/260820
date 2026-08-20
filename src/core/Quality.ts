/**
 * Three quality tiers. The signature experience — big paper shapes, ink lines, dye colour,
 * the light-up and the parade — is identical in all three; only secondary particles,
 * secondary lights and crowd density are traded away.
 */

export type TierName = 'high' | 'standard' | 'low';

export interface QualitySettings {
  tier: TierName;
  /** Upper bound on device pixel ratio. */
  maxDpr: number;
  /** Multiplier applied on top of DPR, adjusted at runtime by the dynamic resolution loop. */
  renderScale: number;
  minRenderScale: number;
  /** Side length of the shared paper paint atlas. */
  paintAtlas: number;
  /** Side length of the baked interior-lighting atlas. */
  interiorAtlas: number;
  shadowMapSize: number;
  /** Number of interior lamps promoted to real (shadow casting) lights. */
  realInteriorLights: number;
  bloom: boolean;
  bloomIterations: number;
  /** Dye bleeding through the paper fibres runs as a periodic diffusion pass. */
  dyeDiffusion: boolean;
  paperSegments: number;
  crowdCount: number;
  lanternCount: number;
  plantCount: number;
}

const PRESETS: Record<TierName, Omit<QualitySettings, 'tier'>> = {
  high: {
    maxDpr: 2,
    renderScale: 1,
    minRenderScale: 0.68,
    paintAtlas: 2048,
    interiorAtlas: 1024,
    shadowMapSize: 1024,
    realInteriorLights: 3,
    bloom: true,
    bloomIterations: 3,
    dyeDiffusion: true,
    paperSegments: 26,
    crowdCount: 26,
    lanternCount: 22,
    plantCount: 40,
  },
  standard: {
    maxDpr: 1.75,
    renderScale: 0.92,
    minRenderScale: 0.6,
    paintAtlas: 1536,
    interiorAtlas: 768,
    shadowMapSize: 768,
    realInteriorLights: 2,
    bloom: true,
    bloomIterations: 2,
    dyeDiffusion: true,
    paperSegments: 20,
    crowdCount: 16,
    lanternCount: 14,
    plantCount: 24,
  },
  low: {
    maxDpr: 1.4,
    renderScale: 0.8,
    minRenderScale: 0.5,
    paintAtlas: 1024,
    interiorAtlas: 512,
    shadowMapSize: 512,
    realInteriorLights: 1,
    bloom: true,
    bloomIterations: 2,
    dyeDiffusion: false,
    paperSegments: 15,
    crowdCount: 8,
    lanternCount: 8,
    plantCount: 12,
  },
};

function readRendererString(gl: WebGL2RenderingContext | null): string {
  if (!gl) return '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    return String(gl.getParameter(gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

export function detectTier(gl: WebGL2RenderingContext | null): TierName {
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'high' || forced === 'standard' || forced === 'low') return forced;

  const renderer = readRendererString(gl).toLowerCase();
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const px = window.screen.width * window.screen.height * dpr * dpr;

  // Software rasterisers (CI / headless) must never be asked for the heavy tier.
  if (/swiftshader|llvmpipe|software|angle \(google/.test(renderer)) return 'low';

  let score = 0;
  if (/apple (a1[4-9]|a2\d|m[1-9])/.test(renderer)) score += 3;
  else if (/apple/.test(renderer)) score += 2;
  if (/adreno \((7|8)\d\d\)/.test(renderer)) score += 3;
  else if (/adreno \(6\d\d\)/.test(renderer)) score += 1;
  if (/mali-g[7-9]\d/.test(renderer)) score += 2;
  if (/nvidia|radeon|geforce|intel iris|intel\(r\) arc/.test(renderer)) score += 3;

  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  if (mem >= 8) score += 2;
  else if (mem >= 4) score += 1;
  if (px > 4.5e6) score -= 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'standard';
  return 'low';
}

export function settingsFor(tier: TierName): QualitySettings {
  return { tier, ...PRESETS[tier] };
}
