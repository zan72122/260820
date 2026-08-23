/**
 * Canonical glyph system — single source of truth.
 *
 * Every number that decides BOTH what you see and what the ball can do
 * lives here as a pure function of one parameter state. Mesh builders and
 * collision checks both read these; they can not diverge.
 *
 * Units: meters. Local station frames:
 *   O, C: letter lies in the XZ plane on the granite plate (read from above,
 *         screen-up = -Z, screen-right = +X).
 *   I:    letter stands in the XY plane, extruded in Z, read from the front.
 */
import { lerp, clamp01, clamp, DEG } from '../core/math';

// ---------------------------------------------------------------- Glyph O —
// A ring gauge: fixed outer shell, iris of 12 rigid overlapping steel
// leaves. Rotating the leaves widens/narrows the counter continuously.
// weight t: 0 = thin stroke (wide counter) … 1 = fat stroke (small counter).

export const O_SPEC = {
  outerR: 0.42, // letter outer radius (fixed — the O never changes size)
  shellInnerR: 0.365, // fixed rim; leaves slide underneath
  leafCount: 12,
  leafEdgeR: 0.3, // q — radius of each leaf's curved cutting edge
  pivotR: 0.4, // leaf pivot circle
  pivotToEdgeCenter: 0.6, // e — pivot -> cutting-arc center
  strokeMin: 0.16,
  strokeMax: 0.34,
  ringHeight: 0.3,
  leafThickness: 0.016,
  leafTopY: 0.285,
  cantDeg: 4, // whole gauge leans toward the camera so a rejected ball rolls off forward
};

export interface OState {
  weight: number; // 0..1
}

export function oStroke(weight: number): number {
  return lerp(O_SPEC.strokeMin, O_SPEC.strokeMax, clamp01(weight));
}

/** Inscribed counter radius h — the hole a ball must fit through. */
export function oCounterR(weight: number): number {
  return O_SPEC.outerR - oStroke(weight);
}

/** Distance ring-center -> leaf cutting-arc center for a given weight. */
export function oLeafArcCenterDist(weight: number): number {
  return oCounterR(weight) + O_SPEC.leafEdgeR;
}

/** Leaf rotation about its pivot (radians) that realises the given weight.
 *  psi = angle at the pivot between (pivot->ringCenter) and (pivot->arcCenter). */
export function oLeafPsi(weight: number): number {
  const { pivotR, pivotToEdgeCenter } = O_SPEC;
  const d = oLeafArcCenterDist(weight);
  const c =
    (pivotR * pivotR + pivotToEdgeCenter * pivotToEdgeCenter - d * d) /
    (2 * pivotR * pivotToEdgeCenter);
  return Math.acos(clamp(c, -1, 1));
}

/** Angle of the arc center as seen from the ring center, off the pivot ray.
 *  Law of cosines — gamma can be obtuse when e > d. */
export function oLeafGamma(weight: number): number {
  const d = oLeafArcCenterDist(weight);
  const { pivotR, pivotToEdgeCenter: e } = O_SPEC;
  const c = (d * d + pivotR * pivotR - e * e) / (2 * d * pivotR);
  return Math.acos(clamp(c, -1, 1));
}

/** Counter radius sampled at an arbitrary polar angle (for scallop checks).
 *  The hole boundary is the nearest leaf cutting arc in that direction. */
export function oCounterRAt(weight: number, polarAngle: number): number {
  const n = O_SPEC.leafCount;
  const d = oLeafArcCenterDist(weight);
  const q = O_SPEC.leafEdgeR;
  const gamma = oLeafGamma(weight);
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const arcDir = (i * 2 * Math.PI) / n + gamma; // direction of leaf i's arc center
    const rel = polarAngle - arcDir;
    const cos = Math.cos(rel);
    const disc = q * q - d * d * (1 - cos * cos);
    if (disc < 0) continue;
    const r = d * cos - Math.sqrt(disc);
    if (r > 0 && r < best) best = r;
  }
  return best;
}

export function oBallPasses(weight: number, ballD: number): boolean {
  return ballD <= 2 * oCounterR(weight) - 0.02;
}

// ---------------------------------------------------------------- Glyph C —
// A curved wall standing on the plate: elliptical centerline with an
// aperture facing +X. Width u: 0 = condensed (pinched aperture) …
// 1 = extended (wide bowl, open aperture). The terminals swing outward as
// the width grows — this is NOT a plain x-scale: aperture angle, bowl
// curvature and stroke taper all follow the parameter.

export const C_SPEC = {
  ry: 0.4, // fixed vertical (z) semi-axis — cap height of the letter
  rxMin: 0.3,
  rxMax: 0.56,
  apertureDegMin: 24, // half-angle of the opening at u=0
  apertureDegMax: 46,
  strokeBowl: 0.16, // wall thickness at the far bowl (west)
  strokeTerminal: 0.115, // tapered thickness at the terminals
  wallHeight: 0.26,
  segments: 9, // visible rigid wall segments (overlap-plate construction)
};

export interface CState {
  width: number; // 0..1
}

export function cRx(width: number): number {
  return lerp(C_SPEC.rxMin, C_SPEC.rxMax, clamp01(width));
}

export function cApertureHalfAngle(width: number): number {
  return lerp(C_SPEC.apertureDegMin, C_SPEC.apertureDegMax, clamp01(width)) * DEG;
}

/** Centerline point at ellipse parameter a in [theta, 2PI - theta]. */
export function cCenterline(width: number, a: number): { x: number; z: number } {
  return { x: cRx(width) * Math.cos(a), z: C_SPEC.ry * Math.sin(a) };
}

/** Wall thickness along the arc (a as above): tapers toward terminals. */
export function cStrokeAt(width: number, a: number): number {
  // a = PI is the deep bowl; a = ±theta are the terminals.
  const t = Math.abs(Math.cos(a / 2)); // 0 at bowl, ~1 at terminals (a in (0, 2PI))
  return lerp(C_SPEC.strokeBowl, C_SPEC.strokeTerminal, t * t);
}

/** Clear opening between the two terminal end caps. */
export function cApertureGap(width: number): number {
  const th = cApertureHalfAngle(width);
  const zTerm = C_SPEC.ry * Math.sin(th);
  return 2 * zTerm - cStrokeAt(width, th);
}

export function cBallEnters(width: number, ballD: number): boolean {
  return ballD <= cApertureGap(width) - 0.015;
}

/** Interior clear width across x (sanity: can the ball circulate?). */
export function cInteriorWidthX(width: number): number {
  return 2 * (cRx(width) - cStrokeAt(width, Math.PI) / 2) - cStrokeAt(width, Math.PI);
}

// ---------------------------------------------------------------- Glyph I —
// Upright I: fixed bottom bar, laminated shear stack stem (a mechanical
// parallelogram), top bar carrying a ball track. Slant s in [-1, 1]:
// the stem shears and the top bar both translates and tips toward the
// slant, so a ball on the track rolls in the slant direction.

export const I_SPEC = {
  stemW: 0.16,
  stemDepth: 0.19,
  baseBarW: 0.64,
  baseBarH: 0.1,
  topBarW: 0.68,
  topBarH: 0.095,
  stemBottomY: 0.1,
  stemTopY: 0.82,
  slantMaxDeg: 12,
  barTipFactor: 0.75, // top bar tips at this fraction of the stem shear angle
  laminations: 9,
  extrudeDepth: 0.16,
  rollThreshold: 0.16, // |s| beyond which the ball leaves the center detent
};

export interface IState {
  slant: number; // -1..1
}

export function iShearAngle(slant: number): number {
  return clamp(slant, -1, 1) * I_SPEC.slantMaxDeg * DEG;
}

/** Horizontal offset of a point at height y (above stem bottom pivot). */
export function iShearOffset(slant: number, y: number): number {
  return Math.tan(iShearAngle(slant)) * Math.max(0, y - I_SPEC.stemBottomY);
}

/** Tilt of the top-bar ball track, radians. Positive slant -> right end dips. */
export function iTrackTilt(slant: number): number {
  return -iShearAngle(slant) * I_SPEC.barTipFactor;
}

/** -1 rolls left, 0 stays in the detent, +1 rolls right. */
export function iBallDirection(slant: number): -1 | 0 | 1 {
  if (slant > I_SPEC.rollThreshold) return 1;
  if (slant < -I_SPEC.rollThreshold) return -1;
  return 0;
}

// ------------------------------------------------------------------ Balls —

export type BallKind = 'rubber' | 'wood' | 'steel';

export interface BallSpec {
  kind: BallKind;
  diameter: number;
  mass: number; // relative — drives sound + bounce feel only
  bounce: number;
  color: number;
}

export const BALLS: Record<BallKind, BallSpec> = {
  rubber: { kind: 'rubber', diameter: 0.3, mass: 1, bounce: 0.42, color: 0xa8423a },
  wood: { kind: 'wood', diameter: 0.13, mass: 0.6, bounce: 0.22, color: 0x9a7a4f },
  steel: { kind: 'steel', diameter: 0.42, mass: 2.6, bounce: 0.12, color: 0xc8ccd0 },
};
