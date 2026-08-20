/** Shared soil texel density so dig patches and the lot never show a seam. */
export const SOIL_REPEAT_PER_M = 0.9;
/** Kerb line: soil working lot on -Z, closed carriageway on +Z. */
export const LOT_Z = 2.55;
/** Dig patches sit a hair above the lot so the overlap never z-fights. */
export const PATCH_LIFT = 0.0015;

export interface GroundHole {
  x: number;
  z: number;
  size: number;
}
