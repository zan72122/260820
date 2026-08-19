/* ------------------------------------------------------------------ *
 * Tunables.  Distances are metres, angles radians, times seconds.
 * X runs across the lanes, Z runs along them, Y is up.
 * ------------------------------------------------------------------ */

export const LANE_COUNT = 6
export const LANE_W = 2.625 // one header pass, with a little overlap
export const FIELD_W = LANE_COUNT * LANE_W // 15.75
export const FIELD_L = 20
export const HALF_W = FIELD_W / 2
export const HALF_L = FIELD_L / 2
/** bare turning strip beyond each end of the crop, as a real headland is */
export const HEADLAND = 4.6
export const PADDY_HALF_L = HALF_L + HEADLAND

/** world X of the centre-line of lane `i` */
export const laneX = (i: number) => -HALF_W + LANE_W * (i + 0.5)

/** rice hill spacing — one instance is a clump of stalks, like a transplanted hill */
export const CROP_DX = 0.4
export const CROP_DZ = 0.34
export const CROP_JITTER = 0.1

export const COMBINE = {
  speed: 3.0,
  reverseSpeed: 1.4,
  turnRate: 1.05,
  headerWidth: 2.5,
  /** distance from the machine origin forward to the cutter bar */
  headerFront: 2.35,
  /** how deep (along travel) the cutter sweeps per contact test */
  headerDepth: 0.9,
  bodyHalfWidth: 1.05,
}

export const TANK = {
  /** capacity measured in harvested clumps ≈ 1.4 lanes */
  capacity: 470,
  /** delay between a clump being cut and its grain landing in the tank */
  throughputDelay: 1.15,
}

export const CAM = {
  fov: 52,
  near: 0.35,
  far: 900,
}

export const QUALITY = {
  /** detailed rice clumps kept around the machine */
  nearCap: 820,
  maxGrains: 900,
  maxStraw: 260,
  maxChaff: 120,
}

export const COLORS = {
  paint: 0xbe3a24,
  paintDark: 0x8d2716,
  chassis: 0x3b4045,
  chassisDark: 0x24282b,
  rubber: 0x1d2023,
  steel: 0x9aa3a8,
  steelDark: 0x5d6469,
  glass: 0x9fc8d8,
  riceGold: 0xd8a733,
  riceTip: 0xf0d180,
  riceGreen: 0xa39c4a,
  riceStem: 0x8a9c4e,
  fog: 0xc8d2c6,
}

export const SUN_DIR = { azimuth: -0.92, elevation: 0.47 }
