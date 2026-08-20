import { Vector3 } from 'three';
import { clamp, deg, lerp, smootherstep } from '../core/math';

/**
 * The slide bed, described the way the simulation wants it: an arc-length
 * parametrisation with slope and curvature available at any point. Everything
 * else — the mesh, the camera rail, the placement zones — is derived from this
 * one curve, so what you see and what the physics uses cannot drift apart.
 */

export const SLIDE_LENGTH = 4.6;
/** Height of the bed lip above the safety surfacing where the object leaves. */
export const EXIT_HEIGHT = 0.3;
export const BED_HALF_WIDTH = 0.24;

const STEEP = deg(41);
const RUNOUT = deg(2.5);

function slopeAt(s: number): number {
  if (s <= 1.5) return STEEP;
  if (s >= 4.0) return RUNOUT;
  return lerp(STEEP, RUNOUT, smootherstep(1.5, 4.0, s));
}

const SAMPLES = 460;
const ds = SLIDE_LENGTH / (SAMPLES - 1);

const xs = new Float32Array(SAMPLES);
const ys = new Float32Array(SAMPLES);
const th = new Float32Array(SAMPLES);
const kappa = new Float32Array(SAMPLES);

(function integrate(): void {
  let x = 0;
  let y = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const s = i * ds;
    const t = slopeAt(s);
    th[i] = t;
    xs[i] = x;
    ys[i] = y;
    x += Math.cos(t) * ds;
    y -= Math.sin(t) * ds;
  }
  // Lift the whole bed so the lip ends at EXIT_HEIGHT above the ground.
  const drop = ys[SAMPLES - 1];
  for (let i = 0; i < SAMPLES; i++) ys[i] += EXIT_HEIGHT - drop;
  for (let i = 0; i < SAMPLES; i++) {
    const a = th[Math.max(0, i - 1)];
    const b = th[Math.min(SAMPLES - 1, i + 1)];
    const span = (Math.min(SAMPLES - 1, i + 1) - Math.max(0, i - 1)) * ds;
    // Curvature is positive where the bed flattens out (concave up), which is
    // exactly where the extra normal force should bite.
    kappa[i] = span > 0 ? (a - b) / span : 0;
  }
})();

export const TOP_HEIGHT = ys[0];
export const EXIT_X = xs[SAMPLES - 1];

function sampleIndex(s: number): { i: number; f: number } {
  const t = clamp(s, 0, SLIDE_LENGTH) / ds;
  const i = Math.min(SAMPLES - 2, Math.floor(t));
  return { i, f: t - i };
}

export function slideSlope(s: number): number {
  const { i, f } = sampleIndex(s);
  return lerp(th[i], th[i + 1], f);
}

export function slideCurvature(s: number): number {
  const { i, f } = sampleIndex(s);
  return lerp(kappa[i], kappa[i + 1], f);
}

/** Point on the bed centreline (surface level), in slide-local space. */
export function slidePoint(s: number, out = new Vector3()): Vector3 {
  const { i, f } = sampleIndex(s);
  return out.set(lerp(xs[i], xs[i + 1], f), lerp(ys[i], ys[i + 1], f), 0);
}

/** Unit tangent pointing downhill. */
export function slideTangent(s: number, out = new Vector3()): Vector3 {
  const a = slideSlope(s);
  return out.set(Math.cos(a), -Math.sin(a), 0);
}

/** Unit surface normal pointing away from the bed. */
export function slideNormal(s: number, out = new Vector3()): Vector3 {
  const a = slideSlope(s);
  return out.set(Math.sin(a), Math.cos(a), 0);
}

/** Surface point offset sideways by `lateral` and lifted by `height`. */
export function slideSurface(
  s: number,
  lateral: number,
  height: number,
  out = new Vector3(),
): Vector3 {
  slidePoint(s, out);
  const n = slideNormal(s, _tmp);
  out.x += n.x * height;
  out.y += n.y * height;
  out.z += lateral;
  return out;
}

const _tmp = new Vector3();

/** Broad placement bands the child can drop an object into. */
export const START_ZONES = [
  { id: 'top' as const, min: 0.0, max: 1.05, center: 0.42 },
  { id: 'middle' as const, min: 1.35, max: 2.6, center: 2.05 },
  { id: 'lower' as const, min: 2.7, max: 3.9, center: 3.05 },
];

/** Half-thickness of the boom bar, in arc length. */
export const GATE_BAR_HALF = 0.015;

/** Where a body rests when the boom is holding it, actually touching it. */
export function restArc(gateArc: number, gateGap: number): number {
  return Math.max(0.05, gateArc - GATE_BAR_HALF - gateGap);
}

export type StartZoneId = (typeof START_ZONES)[number]['id'];

export function zoneById(id: StartZoneId): (typeof START_ZONES)[number] {
  return START_ZONES.find((z) => z.id === id) ?? START_ZONES[0];
}

/** Nearest placement band for an arbitrary arc position. */
export function nearestZone(s: number): (typeof START_ZONES)[number] {
  let best = START_ZONES[0];
  let bestD = Infinity;
  for (const z of START_ZONES) {
    const d = s < z.min ? z.min - s : s > z.max ? s - z.max : 0;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}
