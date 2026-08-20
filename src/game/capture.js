/**
 * Catching rules. Pure maths, no three.js — the scene code converts world
 * space into the paper's local unit-disc space and hands it over.
 *
 * The rule the child is being taught, in one line: the paper has to be
 * *under* the fish, and it has to be paper (not a hole) at that spot, and it
 * has to be going *up*.
 */

import { clamp, smoothstep } from '../core/Rng.js';
import { isTorn } from './paper.js';

export const CAPTURE = {
  /** fish must be inside this fraction of the sheet radius */
  usableRadius: 0.93,
  /** vertical window above the sheet, in sheet radii, that counts as "riding on it" */
  band: 0.62,
  /** poi must be rising at least this fast (m/s) before a scoop registers */
  minLiftSpeed: 0.045,
  /** soft attraction reaches this far out, in sheet radii */
  attractRadius: 1.5,
  /** how hard the nudge pulls (m/s^2) — strong, but it is a force, never a teleport */
  attractAccel: 2.9,
  /** the nudge can never add more than this much speed (m/s) */
  attractMaxSpeed: 0.42,
  /** at least this share of the fish footprint must rest on intact paper */
  supportNeeded: 0.5,
};

/**
 * Does intact paper actually sit under the fish's body?
 * Samples the centre plus a ring around it, so a fish can straddle a small
 * hole with its belly on the surviving rim and still be lifted.
 *
 * @param {number} lx,ly     fish centre in unit-disc space
 * @param {number} halfWidth fish footprint radius, in unit-disc units
 */
export function supportRatio(paperState, lx, ly, halfWidth) {
  let intact = 0;
  let total = 0;
  const rings = halfWidth > 0.06 ? 2 : 1;
  for (let ring = 0; ring <= rings; ring++) {
    const rr = (ring / rings) * halfWidth;
    const count = ring === 0 ? 1 : 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.5;
      const x = lx + Math.cos(a) * rr;
      const y = ly + Math.sin(a) * rr;
      total++;
      if (!isTorn(paperState, x, y)) intact++;
    }
  }
  return total > 0 ? intact / total : 0;
}

/**
 * @param {object} q
 * @param {object} q.paper        paper state
 * @param {number} q.lx,q.ly      fish centre in the sheet's unit-disc space
 * @param {number} q.above        fish height above the sheet, in sheet radii (may be negative)
 * @param {number} q.halfWidth    fish footprint radius in unit-disc units
 * @param {number} q.liftSpeed    poi vertical speed, m/s
 * @param {number} q.forgiveness  0..1 extra grace (the very first fish gets 1)
 * @returns {{caught:boolean, support:number, reason:string}}
 */
export function evaluateCatch(q) {
  const forgive = clamp(q.forgiveness ?? 0, 0, 1);
  const r = Math.hypot(q.lx, q.ly);
  const maxR = CAPTURE.usableRadius + forgive * 0.08;
  if (r > maxR) return { caught: false, support: 0, reason: 'offSheet' };

  const band = CAPTURE.band * (1 + forgive * 0.55);
  if (q.above < -0.22 || q.above > band) return { caught: false, support: 0, reason: 'notAbove' };

  const support = supportRatio(q.paper, q.lx, q.ly, q.halfWidth ?? 0.16);
  if (support < CAPTURE.supportNeeded * (1 - forgive * 0.35)) {
    return { caught: false, support, reason: 'throughHole' };
  }

  if ((q.liftSpeed ?? 0) < CAPTURE.minLiftSpeed * (1 - forgive * 0.6)) {
    return { caught: false, support, reason: 'notRising' };
  }
  return { caught: true, support, reason: 'ok' };
}

/**
 * How strongly the sheet should coax a fish towards its middle.
 * Peaks when the poi is squarely under the fish and fades out with distance;
 * zero once the sheet is above the fish (you cannot herd a fish with the top
 * of the paper).
 *
 * @param {number} distNorm  centre distance in sheet radii
 * @param {number} above     fish height above the sheet, in sheet radii
 * @param {number} submerged 0..1
 */
export function attractionWeight(distNorm, above, submerged, forgiveness = 0) {
  if (above < -0.1 || above > 1.1) return 0;
  const reach = CAPTURE.attractRadius * (1 + forgiveness * 0.5);
  const radial = smoothstep(reach, 0.2, distNorm);
  const vertical = smoothstep(1.1, 0.15, Math.abs(above - 0.16));
  return radial * vertical * clamp(submerged, 0, 1);
}
