import * as THREE from 'three';

/** Hills march down one ridge; everything else is placed relative to them. */
export const ROW_STEP = 2.55;
export const HERO_ROW_X = 0;
/** Radius of the terrain opening each hill's own soil patch covers. */
export const DIG_CUT_R = 0.68;
/** How far from the crown a hand is allowed to move soil. */
export const DIG_REACH = 0.5;

export const hillPos = (i: number) => new THREE.Vector3(HERO_ROW_X, 0, i * ROW_STEP);

/** Openings punched in the static terrain so a dug hollow is not hidden by it. */
export function hillCutouts(count = 48) {
  return Array.from({ length: count }, (_, i) => ({ x: HERO_ROW_X, z: i * ROW_STEP, r: DIG_CUT_R }));
}
