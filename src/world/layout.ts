import { Vector3 } from 'three';

/**
 * One shared map of the park. The swing travels along world X; the top beam and
 * the seat's width run along world Z; the camera lives on the +Z side.
 */
export const LAYOUT = {
  pivot: new Vector3(0, 2.62, 0),
  chainLength: 2.2,
  seatHalfWidth: 0.205,
  beamY: 2.72,
  beamHalfSpan: 1.5,
  frameLegSpread: 1.28,

  /** Centre of the sunlit mist band the seat cuts through. */
  mistCentre: new Vector3(0, 0.95, 0),
  mistHalfX: 2.75,
  mistLowY: 0.02,
  mistHighY: 1.95,
  mistHalfZ: 0.95,

  archPos: new Vector3(3.5, 0, 1.4),
  archSpan: 2.3,
  archHeight: 2.45,

  /** Breeze that carries the veil off the arch and across the swing plane. */
  wind: new Vector3(-0.85, -0.05, -0.52).normalize(),
  windSpeed: 0.72,
} as const;

/** Unit vector from the park toward the low evening sun, at time `t` seconds. */
export function sunDirection(out: Vector3, t: number): Vector3 {
  // The sun sinks a little and swings a touch north during a play session, which
  // is what quietly slides the hue centroid of the weaving over several minutes.
  const elev = (8.6 - Math.min(t, 420) * 0.0072) * (Math.PI / 180);
  const azim = (-152 - Math.min(t, 420) * 0.0085) * (Math.PI / 180);
  out.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim));
  return out.normalize();
}

/**
 * How much lit mist sits at a point: a thin, wind-blown veil that only overlaps
 * the swing's path low down, in the band the raking sunlight actually reaches.
 */
export function mistDensityAt(x: number, y: number, z: number, t: number): number {
  const L = LAYOUT;
  // Gentle, linear falloff: the veil thins toward its edges but the seat still
  // finds mist along the whole of a big arc, not only at the bottom.
  const fx = Math.max(0, 1 - Math.abs(x - L.mistCentre.x) / L.mistHalfX);
  const fz = Math.max(0, 1 - Math.abs(z - L.mistCentre.z) / L.mistHalfZ);
  const lo = Math.max(0, Math.min(1, (y - L.mistLowY) / 0.22));
  const hi = Math.max(0, Math.min(1, (L.mistHighY - y) / 0.62));
  // Gusts make the veil pulse, so passes are never identical.
  const gust =
    0.78 +
    0.22 * Math.sin(t * 0.41 + x * 0.6) * Math.cos(t * 0.27 - z * 0.9) +
    0.10 * Math.sin(t * 1.13 + y * 1.7);
  const d = fx * fz * lo * hi * gust;
  return Math.max(0, Math.min(1, d));
}
