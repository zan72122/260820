/**
 * Fixed dimensions of the pavilion, in metres. Everything else derives from
 * these, so the rig, the turntable, the pads and the camera all agree on where
 * the ball is going to land.
 */

/** Top of the concrete slab. */
export const SLAB_Y = 0;

/** Steel deck of the rotating tray. */
export const TRAY_DECK_Y = 0.34;
/** Top of a sample sitting in a tray pocket — the surface the ball meets. */
export const TRAY_SURFACE_Y = 0.36;

export const TRAY_CENTER_Z = -0.82;
export const TRAY_OUTER_R = 1.12;
export const TRAY_POCKET_R = 0.3;
export const TRAY_POCKET_RING_R = 0.82;
export const TRAY_SLOTS = 7;

/** The drop axis in tray mode: directly over the front pocket. */
export const TRAY_DROP_Z = 0;
/** The drop axis in free-arrangement mode: out over the apron. */
export const CHAIN_DROP_Z = 1.15;

export const GANTRY_X = 1.32;
export const GANTRY_Z = -0.32;
export const GANTRY_TOP_Y = 3.02;
export const CARRIAGE_MIN_Y = 0.95;

export const CHAIN_PADS: Array<{ x: number; y: number; z: number; tilt: number; halfX: number; halfZ: number }> = [
  { x: 0, y: 0.16, z: CHAIN_DROP_Z, tilt: 8, halfX: 0.34, halfZ: 0.25 },
  { x: -0.8, y: 0.085, z: CHAIN_DROP_Z, tilt: 8, halfX: 0.36, halfZ: 0.25 },
  { x: -1.62, y: 0.02, z: CHAIN_DROP_Z, tilt: 0, halfX: 0.42, halfZ: 0.27 },
];

export const SHELF_POS = { x: -2.16, y: 0, z: -0.28 };
export const SHELF_TOP_Y = 0.86;
export const TILE_RACK_POS = { x: 1.05, y: 0, z: 1.92 };

/** Where the release ring hangs, well clear of the impact point. */
export const RING_X = 0.76;
export const RING_Z = 0.36;
export const RING_TRAVEL = 0.34;
