// Global layout constants (station-local coordinates, meters).
// The projection screen lies in the plane z = 0 facing +z.
// The machine (turntable) sits between screen and lamp; the lamp is at z = LIGHT_Z.

export const STATION_SPACING = 8;

export const LIGHT_Z = 5.2;
export const TABLE_Z = 2.62;
export const TABLE_TOP_Y = 0.78;

export const SCREEN_BOTTOM = 0.86;
export const SCREEN_TOP = 2.06;
export const SCREEN_HALF_W = 0.92;
export const SCREEN_CY = (SCREEN_BOTTOM + SCREEN_TOP) / 2;

export const RAIL_Z_A = 5.42;
export const RAIL_Z_B = 5.95;

export const WHEEL_TABLE_RATIO = 3.2; // handwheel turns 3.2x faster than table

export interface RodSpec {
  kind: 'rod';
  /** screen-space endpoints [x, y] of the shadow stroke this rod produces */
  a: [number, number];
  za: number; // depth (z) of endpoint a in space
  b: [number, number];
  zb: number;
  strokeW: number; // desired shadow stroke width on the screen
}

export interface RingSpec {
  kind: 'ring';
  center: [number, number];
  z: number;
  radius: number; // shadow ring radius on screen (centerline)
  strokeW: number;
}

export type PartSpec = RodSpec | RingSpec;

/** support column dropping from a point on a part down to the turntable */
export interface FootSpec {
  part: number;
  u: number; // param along rod (0..1); for rings: angle in radians (0 = bottom)
  r?: number; // column radius
}

/** rigid connector aligned with a light ray (invisible in the solved shadow) */
export interface StrutSpec {
  screen: [number, number];
  z1: number;
  z2: number;
}

/**
 * support brace expressed like a rod (screen anchor + depth per end) whose
 * shadow is engineered to hide behind a stroke or fall off the screen
 */
export interface BraceSpec {
  a: [number, number];
  za: number;
  b: [number, number];
  zb: number;
  r: number; // world radius
}

export interface LetterSpec {
  letter: string;
  parts: PartSpec[];
  feet: FootSpec[];
  struts: StrutSpec[];
  braces: BraceSpec[];
  lightY: number; // solved lamp height (nominal for fixed-lamp stations)
  lightY0?: number; // starting lamp height (lever stations)
  leverRange?: [number, number];
  tableAngle0: number; // starting turntable angle (rad)
  tableRange: [number, number]; // mechanical stops (rad)
  tableRadius: number;
  detent: number; // half-width of the mechanical detent (rad)
  hasLever: boolean;
  /** seconds of stalling before a physical hint; later letters guide less */
  hintDelay: number;
}
