import { Vector3 } from 'three';
import { clamp } from '../core/mathutil';
import type { ChestCoord } from '../audio/BodySoundField';

/**
 * Geometry of the training manikin's trunk, and the one mapping used
 * everywhere between chest-surface coordinates and world space.
 *
 * World layout: the manikin is supine on the exam table.
 *   superior (head)  -> -Z        anterior (front) -> +Y
 *   manikin's left   -> -X        manikin's right  -> +X
 *
 * Chest coordinates (see BodySoundField):
 *   lat +1 = manikin's left, sup +1 = towards the clavicles.
 */

export const TABLE_TOP_Y = 0.74;

/** Centre of the chest region along the body axis. */
const CHEST_Z = -0.02;
/** Half length of the addressable chest region, metres. */
const CHEST_HALF_LEN = 0.235;
/** Maximum wrap angle around the trunk reachable by the chestpiece, radians. */
const LAT_SPAN = 0.95;

type Key = [number, number];

function catmull(keys: Key[], x: number): number {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] < x) i++;
  const p0 = keys[Math.max(0, i - 1)];
  const p1 = keys[i];
  const p2 = keys[i + 1];
  const p3 = keys[Math.min(n - 1, i + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  );
}

/** Half width of the trunk at body position z. */
const W_KEYS: Key[] = [
  [-0.62, 0.108],
  [-0.52, 0.174],
  [-0.44, 0.206],
  [-0.3, 0.186],
  [-0.05, 0.176],
  [0.12, 0.164],
  [0.26, 0.153],
  [0.36, 0.146],
  [0.42, 0.132],
];

/** Half depth of the trunk at body position z. */
const H_KEYS: Key[] = [
  [-0.62, 0.076],
  [-0.52, 0.091],
  [-0.44, 0.098],
  [-0.3, 0.101],
  [-0.05, 0.105],
  [0.12, 0.102],
  [0.26, 0.095],
  [0.36, 0.09],
  [0.42, 0.082],
];

export const TORSO_Z_MIN = -0.62;
export const TORSO_Z_MAX = 0.42;

/** Replaceable-module seams of the training torso. */
export const SEAM_Z = [-0.395, 0.19];

/** Seam positions expressed in the torso's texture V coordinate. */
export const SEAM_V = SEAM_Z.map((z) => (z - -0.62) / (0.42 - -0.62));

export function halfWidthAt(z: number): number {
  return catmull(W_KEYS, clamp(z, TORSO_Z_MIN, TORSO_Z_MAX));
}

export function halfDepthAt(z: number): number {
  return catmull(H_KEYS, clamp(z, TORSO_Z_MIN, TORSO_Z_MAX));
}

/** Centre of the trunk cross-section: the back rests on the vinyl pad. */
export function axisYAt(z: number): number {
  return TABLE_TOP_Y + halfDepthAt(z) * 0.9;
}

/**
 * Radial detail added on top of the base ellipse: sternal valley, pectoral
 * plates, costal margin and the moulded seams between torso modules.
 */
function surfaceDetail(z: number, phi: number): number {
  let r = 0;
  // Sternal valley along the midline of the chest.
  const chestness = Math.exp(-(((z + 0.1) / 0.3) ** 2));
  r -= 0.0072 * Math.exp(-((phi / 0.16) ** 2)) * chestness;
  // Pectoral plates either side of it.
  const pec = Math.exp(-(((z + 0.16) / 0.19) ** 2));
  r += 0.0055 * (Math.exp(-(((phi - 0.46) / 0.36) ** 2)) + Math.exp(-(((phi + 0.46) / 0.36) ** 2))) * pec;
  // Costal margin flaring towards the abdomen.
  r -= 0.006 * Math.exp(-(((z - 0.13) / 0.09) ** 2)) * Math.exp(-((phi / 0.7) ** 2));
  // Moulded module seams.
  for (const sz of SEAM_Z) r -= 0.0026 * Math.exp(-(((z - sz) / 0.009) ** 2));
  return r;
}

export interface SurfacePoint {
  position: Vector3;
  normal: Vector3;
}

/** Point on the trunk shell for a body position z and wrap angle phi. */
// Scratch vectors: this runs twice a frame while a finger is on the chest.
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _dPhi = new Vector3();
const _dZ = new Vector3();

export function trunkPoint(z: number, phi: number, out?: SurfacePoint): SurfacePoint {
  const W = halfWidthAt(z);
  const H = halfDepthAt(z);
  const yc = axisYAt(z);
  const d = surfaceDetail(z, phi);
  const sn = Math.sin(phi);
  const cs = Math.cos(phi);
  const x = -(W + d) * sn;
  const y = yc + (H + d) * cs;
  const p = out?.position ?? new Vector3();
  p.set(x, y, z);

  // Normal from finite differences of the same function — always consistent
  // with the rendered mesh, so the chestpiece never floats or sinks.
  const e = 1e-3;
  rawPoint(z, phi + e, _a);
  rawPoint(z, phi - e, _b);
  rawPoint(z + e, phi, _c);
  rawPoint(z - e, phi, _d);
  const dPhi = _dPhi.subVectors(_a, _b);
  const dZ = _dZ.subVectors(_c, _d);
  const n = out?.normal ?? new Vector3();
  // dPhi x dZ points out of the shell everywhere, which is also the winding
  // order the triangles are built with below.
  n.crossVectors(dPhi, dZ).normalize();
  return { position: p, normal: n };
}

function rawPoint(z: number, phi: number, out: Vector3): Vector3 {
  const W = halfWidthAt(z);
  const H = halfDepthAt(z);
  const yc = axisYAt(z);
  const d = surfaceDetail(z, phi);
  return out.set(-(W + d) * Math.sin(phi), yc + (H + d) * Math.cos(phi), z);
}

/**
 * Where the heart actually sits inside this torso, in world space: behind the
 * sternum and a little towards the manikin's left — one organ, not four.
 */
export const HEART_CENTRE = new Vector3(-0.022, axisYAt(-0.06) + 0.012, -0.055);

export function chestCoordToBody(c: ChestCoord): { z: number; phi: number } {
  return { z: CHEST_Z - c.sup * CHEST_HALF_LEN, phi: c.lat * LAT_SPAN };
}

export function bodyToChestCoord(z: number, phi: number): ChestCoord {
  return { sup: (CHEST_Z - z) / CHEST_HALF_LEN, lat: phi / LAT_SPAN };
}

/** Surface point (and its outward normal) for a chest coordinate. */
export function chestSurfacePoint(c: ChestCoord, out?: SurfacePoint): SurfacePoint {
  const { z, phi } = chestCoordToBody(c);
  return trunkPoint(z, phi, out);
}

/** Convert a world-space hit on the torso back into chest coordinates. */
export function worldToChestCoord(p: Vector3): ChestCoord {
  const z = clamp(p.z, TORSO_Z_MIN, TORSO_Z_MAX);
  const W = halfWidthAt(z);
  const H = halfDepthAt(z);
  const yc = axisYAt(z);
  const phi = Math.atan2(-p.x / Math.max(W, 1e-4), (p.y - yc) / Math.max(H, 1e-4));
  return bodyToChestCoord(z, phi);
}
