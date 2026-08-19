/** One place for every world dimension. 1 world unit = 10 cm, so the cake is
 *  22 cm across and the sponge base is a believable 2.6 cm thick. */
export const DIM = {
  /** frozen ice-cream dome radius */
  iceRadius: 0.95,
  /** where the meringue shell's base surface sits (just proud of the ice) */
  shellRadius: 0.968,
  /** nominal outer radius of the finished meringue coat (before peaks) */
  meringueRadius: 1.11,
  /** how far the meringue shell can swell above its base surface */
  meringueSwell: 0.14,
  spongeRadius: 1.24,
  spongeHeight: 0.26,
  plateRadius: 1.62,
  plateHeight: 0.07,
  /** counter surface height; everything above is stacked from here */
  benchY: 0,
  /** world Y of the dome equator (plate + sponge) */
  cakeY: 0.33,
  /** azimuth window (radians) occupied by the pre-split slice. Centred on the
   *  camera's bearing so the notch — and both cut faces — face the player. */
  sliceStart: 0.707,
  sliceSweep: 1.012,
} as const;

export const SLICE_MID = DIM.sliceStart + DIM.sliceSweep * 0.5;

/** Baked-surface colour ramp: white -> cream -> gold -> amber. */
export const BAKE_RAMP = {
  raw: [0.955, 0.945, 0.918],
  cream: [0.949, 0.898, 0.76],
  gold: [0.858, 0.639, 0.316],
  amber: [0.541, 0.318, 0.129],
} as const;

export type FlavourId = 'vanilla' | 'peach' | 'lavender';

export interface Flavour {
  id: FlavourId;
  /** hiragana label for the finish card */
  label: string;
  /** meringue tint (kept inside a believable food gamut) */
  meringue: number;
  /** ice cream body colour */
  iceCream: number;
  /** swatch shown in the HUD */
  swatch: string;
}

export const FLAVOURS: readonly Flavour[] = [
  {
    id: 'vanilla',
    label: 'ミルク',
    meringue: 0xf7f2e8,
    iceCream: 0xf1dcaa,
    swatch: '#f7f0e2',
  },
  {
    id: 'peach',
    label: 'ももいろ',
    meringue: 0xf7e3dc,
    iceCream: 0xeeb8a8,
    swatch: '#f6dcd2',
  },
  {
    id: 'lavender',
    label: 'すみれ',
    meringue: 0xeee7f0,
    iceCream: 0xcfc0dd,
    swatch: '#e7ddec',
  },
];

export interface QualityProfile {
  /** device pixel ratio ceiling */
  maxDpr: number;
  /** paint mask render-target edge length */
  maskSize: number;
  /** meringue peak budget across the whole dome */
  peakBudget: number;
  /** dome shell tessellation */
  shellSegU: number;
  shellSegV: number;
  shadowMapSize: number;
  shadows: boolean;
  /** background kitchen detail */
  backdropDetail: 0 | 1 | 2;
  /** additive haze / spark extras on the flame */
  flameExtras: boolean;
}

const HIGH: QualityProfile = {
  maxDpr: 2,
  maskSize: 512,
  peakBudget: 760,
  shellSegU: 168,
  shellSegV: 52,
  shadowMapSize: 1024,
  shadows: true,
  backdropDetail: 2,
  flameExtras: true,
};

const MEDIUM: QualityProfile = {
  maxDpr: 1.75,
  maskSize: 512,
  peakBudget: 600,
  shellSegU: 132,
  shellSegV: 42,
  shadowMapSize: 1024,
  shadows: true,
  backdropDetail: 1,
  flameExtras: true,
};

const LOW: QualityProfile = {
  maxDpr: 1.4,
  maskSize: 256,
  peakBudget: 420,
  shellSegU: 96,
  shellSegV: 32,
  shadowMapSize: 512,
  shadows: true,
  backdropDetail: 1,
  flameExtras: false,
};

/** Used by the Playwright smoke run (E2E_FAST=1) and by software renderers. */
const FAST: QualityProfile = {
  maxDpr: 1,
  maskSize: 256,
  peakBudget: 260,
  shellSegU: 72,
  shellSegV: 24,
  shadowMapSize: 512,
  shadows: false,
  backdropDetail: 0,
  flameExtras: false,
};

export function isFastMode(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __E2E_FAST?: boolean };
  if (w.__E2E_FAST) return true;
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('fast') === '1' || q.get('e2e') === '1';
  } catch {
    return false;
  }
}

/** `?q=low|medium|high|fast` forces a profile — used when reviewing visuals on
 *  a software renderer, where auto-detection would always pick the fast one. */
function forcedProfile(): QualityProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q === 'high') return { ...HIGH };
    if (q === 'medium') return { ...MEDIUM };
    if (q === 'low') return { ...LOW };
    if (q === 'fast') return { ...FAST };
  } catch {
    /* ignore */
  }
  return null;
}

export function pickQuality(gl: WebGLRenderingContext | WebGL2RenderingContext): QualityProfile {
  const forced = forcedProfile();
  if (forced) return forced;
  if (isFastMode()) return { ...FAST };

  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
    : '';
  const software = /swiftshader|llvmpipe|software|angle \(software/i.test(renderer);
  if (software) return { ...FAST, maxDpr: 1 };

  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  if (mem <= 3 || cores <= 4 || shortSide <= 360) return { ...LOW };
  if (mem <= 6 || cores <= 6) return { ...MEDIUM };
  return { ...HIGH };
}
