/**
 * Global dimensional constants for the fictional, oversized educational
 * pin cylinder. Units are meters. All values are exaggerated for museum
 * demonstration and deliberately do NOT correspond to any real keying
 * system, bitting code, or manufacturer specification.
 */
export const LOCK = {
  /** plug radius (oversized: 60 mm diameter demonstration plug) */
  plugRadius: 0.03,
  /** housing (bible + body) outer radius */
  housingRadius: 0.045,
  /** how tall the bible (pin chamber block) rises above housing cylinder */
  bibleHeight: 0.055,
  /** cylinder depth front face -> back face */
  bodyDepth: 0.118,
  /** number of pin stacks */
  pinCount: 5,
  /** z position (negative = deeper) of the first pin chamber center */
  firstPinZ: -0.018,
  /** spacing between pin chambers */
  pinSpacing: 0.020,
  /** pin (chamber) bore radius */
  pinRadius: 0.0052,
  /** keyway floor height, measured from plug axis (negative = below axis) */
  keywayFloorY: -0.013,
  /** keyway half width */
  keywayHalfWidth: 0.0035,
  /** upper pin length (uniform driver pins) */
  upperPinLength: 0.020,
  /** chamber depth above shear line inside bible */
  chamberDepth: 0.046,
  /** rest protrusion: how high a lower pin bottom sits above keyway floor with no key */
  restLift: 0.004,
  /** shear line tolerance for "aligned" (0.5 mm on the oversized model) */
  shearTolerance: 0.0006,
} as const;

export const KEY = {
  /** blade length from tip to shoulder */
  bladeLength: 0.128,
  /** blade thickness */
  bladeThickness: 0.0058,
  /** baseline (uncut) blade top height above keyway floor */
  bladeBaseHeight: 0.0205,
  /** minimum cut height (deepest fictional cut) above keyway floor */
  cutMinHeight: 0.0085,
  /** maximum cut height (shallowest fictional cut) above keyway floor */
  cutMaxHeight: 0.0185,
  /** tip lead-in height (matches pin rest protrusion for a continuous ride) */
  tipHeight: 0.004,
  /** length of the tip lead-in ramp */
  tipRampLength: 0.012,
  /** half-width of each cut valley along the blade */
  cutHalfWidth: 0.0072,
  /** full insertion travel of the key tip along -Z */
  travel: 0.128,
} as const;

/** z position of pin stack i (0 = frontmost) */
export function pinZ(i: number): number {
  return LOCK.firstPinZ - i * LOCK.pinSpacing;
}

/** shear line height above plug axis */
export const SHEAR_Y = LOCK.plugRadius;

/** blade arc-length position (from tip) that sits under pin i at full insertion */
export function cutPosition(i: number): number {
  return KEY.travel + pinZ(i);
}

export const STORAGE_KEY = 'pin-forest-save-v1';
