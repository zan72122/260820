import { KEY, LOCK, cutPosition } from '../core/config';

/**
 * A fictional key profile. Cut values are normalized 0..1 where 1 is the
 * shallowest cut (tall) and 0 the deepest (low). These are invented,
 * exaggerated demonstration values with no relation to real bitting codes.
 */
export interface KeyProfileSpec {
  id: string;
  /** display name (hiragana, child-facing) */
  name: string;
  /** normalized cut heights, front (bow side pin) first */
  cuts: readonly number[];
  /** subtle finish variation so the three keys read as distinct objects */
  finish: 'brass' | 'nickelSilver' | 'agedBrass';
}

/** The one correct key: aligns every stack at the shear line. */
export const KEY_A: KeyProfileSpec = {
  id: 'key-a',
  name: 'まるいかぎ',
  cuts: [0.62, 0.28, 0.82, 0.44, 0.58],
  finish: 'nickelSilver', // bright nickel silver reads clearly against the brass plug
};

/** Wrong key: only the FRONT stack boundary ends up clearly low. */
export const KEY_B: KeyProfileSpec = {
  id: 'key-b',
  name: 'さんかくのかぎ',
  cuts: [0.24, 0.28, 0.82, 0.44, 0.58],
  finish: 'brass',
};

/** Wrong key: only the DEEPEST (rearmost) stack boundary ends up high. */
export const KEY_C: KeyProfileSpec = {
  id: 'key-c',
  name: 'しかくのかぎ',
  cuts: [0.62, 0.28, 0.82, 0.44, 0.90],
  finish: 'agedBrass',
};

export const ALL_KEYS: readonly KeyProfileSpec[] = [KEY_A, KEY_B, KEY_C];

/** normalized cut value -> actual blade-top height above keyway floor */
export function cutHeight(v: number): number {
  return KEY.cutMinHeight + v * (KEY.cutMaxHeight - KEY.cutMinHeight);
}

function smoothBlend(t: number): number {
  // cosine ease between two heights; keeps the wave silhouette soft
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

/**
 * Height of the blade top surface at arc-length s from the tip.
 * Deterministic; drives BOTH the visible key mesh and the pin lift math,
 * so the ride is exact by construction.
 */
export function bladeHeightAt(spec: KeyProfileSpec, s: number): number {
  if (s <= 0) return KEY.tipHeight;
  if (s >= KEY.bladeLength) return KEY.bladeBaseHeight;

  // control points: tip ramp, then per-cut valleys with peaks between
  let h: number = KEY.bladeBaseHeight;

  // tip lead-in: ramp from tipHeight up to base height
  if (s < KEY.tipRampLength) {
    const t = smoothBlend(s / KEY.tipRampLength);
    h = KEY.tipHeight + (KEY.bladeBaseHeight - KEY.tipHeight) * t;
  }

  // subtract each cut valley (cosine flanks around the cut position)
  for (let i = 0; i < LOCK.pinCount; i++) {
    const cutV = spec.cuts[i] ?? 0.5;
    const center = cutPosition(i);
    const dist = Math.abs(s - center);
    if (dist < KEY.cutHalfWidth) {
      const depthHere = cutHeight(cutV);
      const w = smoothBlend(1 - dist / KEY.cutHalfWidth);
      const target = depthHere + (1 - w) * (KEY.bladeBaseHeight - depthHere);
      h = Math.min(h, target);
    }
  }
  return h;
}

/**
 * Lower pin lengths are manufactured (in the fiction: by the museum
 * workshop) so that KEY_A aligns every boundary exactly at the shear line.
 */
export function lowerPinLength(i: number): number {
  const hAtFull = cutHeight(KEY_A.cuts[i] ?? 0.5);
  return SHEAR_FROM_FLOOR - hAtFull;
}

/** shear line height measured from the keyway floor */
export const SHEAR_FROM_FLOOR = LOCK.plugRadius - LOCK.keywayFloorY;
