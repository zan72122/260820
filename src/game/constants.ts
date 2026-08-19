/** Shared field / machine dimensions, in metres. */

export const LANE_W = 3.44;         // one header width
export const LANES = 6;
export const FIELD_W = LANE_W * LANES;   // 20.64
export const FIELD_L = 30;               // driving length of the paddy

export const HILL_DX = 0.5;         // rice hills across the rows
export const HILL_DZ = 0.5;         // rice hills along the row
export const COLS = Math.round(FIELD_W / HILL_DX);  // 41
export const ROWS = Math.round(FIELD_L / HILL_DZ);  // 60

/** hills that must go in to fill the chamber -> roughly one full lane */
export const HILLS_PER_BALE = 400;

export const DRIVE_SPEED = 2.4;     // m/s at full throttle
export const TURN_RATE = 1.5;       // rad/s of heading authority

export const BALE_R_MIN = 0.17;
export const BALE_R_MAX = 0.68;
export const BALE_HALF_W = 0.58;    // half length along the machine's X axis

export const CHAMBER_R = 0.76;      // inner radius of the roll room
/** chamber centre in machine-local space */
export const CHAMBER_POS = { x: 0, y: 1.62, z: -1.95 };

export const HEADER_Z = 2.78;       // mouth of the header, machine-local
/** A real forage header overhangs the body on both sides — which is also
 *  the only reason you can see it working from behind. */
export const HEADER_HALF_W = 1.72;

export function laneCenterX(i: number) {
  return -FIELD_W / 2 + (i + 0.5) * LANE_W;
}
