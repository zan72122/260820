import * as THREE from 'three';
import { LIGHT_Z } from './const';

// Point-light projection onto the screen plane z = 0.
// The lamp sits at (0, lightY, LIGHT_Z) in station-local coordinates.

export function lightPos(lightY: number): THREE.Vector3 {
  return new THREE.Vector3(0, lightY, LIGHT_Z);
}

/** scale factor from a plane at depth z to the screen (magnification of shadows) */
export function scaleAt(z: number): number {
  return LIGHT_Z / (LIGHT_Z - z);
}

/** project world point P from the lamp onto the screen plane z=0 */
export function project(p: THREE.Vector3, lightY: number): THREE.Vector2 {
  const t = LIGHT_Z / (LIGHT_Z - p.z);
  return new THREE.Vector2(t * p.x, lightY + t * (p.y - lightY));
}

/** find the world point at depth z whose shadow lands on screen point s */
export function backproject(sx: number, sy: number, z: number, lightY: number): THREE.Vector3 {
  const t = (LIGHT_Z - z) / LIGHT_Z;
  return new THREE.Vector3(t * sx, lightY + t * (sy - lightY), z);
}

/** 2D intersection of two screen-space segments, with both segment params */
export function intersectSegs2D(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): { s: [number, number]; ta: number; tb: number } | null {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-8) return null;
  const ta = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / den;
  const tb = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / den;
  return { s: [a1[0] + ta * d1x, a1[1] + ta * d1y], ta, tb };
}

/** intersections of a 2D segment with a circle, as segment params in [0,1] */
export function segCircleParams(
  a: [number, number], b: [number, number],
  c: [number, number], r: number,
): number[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const fx = a[0] - c[0], fy = a[1] - c[1];
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].filter((t) => t > 0.02 && t < 0.98);
}

/**
 * For a 3D rod A->B, find param u whose projection equals screen point s.
 * proj_x(u) = P.x(u) * Lz / (Lz - P.z(u)) = sx  (linear in u after clearing).
 */
export function rodParamAtScreen(
  A: THREE.Vector3, B: THREE.Vector3, sx: number, sy: number,
): number {
  // Use whichever screen axis has the larger sweep for stability.
  const dx = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
  const dy = Math.abs(B.y - A.y) + Math.abs(B.z - A.z);
  if (dx >= dy) {
    // (A.x + u*(B.x-A.x)) * Lz = sx * (Lz - (A.z + u*(B.z-A.z)))
    const num = sx * (LIGHT_Z - A.z) - A.x * LIGHT_Z;
    const den = (B.x - A.x) * LIGHT_Z + sx * (B.z - A.z);
    return num / den;
  }
  // y axis needs lightY; assume rays through (0, ly, Lz) — solve with relative y.
  // proj_y(u) = ly + (P.y - ly)*Lz/(Lz - P.z) = sy
  // Caller should prefer x when possible; fall back assuming ly baked into A/B via caller.
  const num = sy * (LIGHT_Z - A.z) - A.y * LIGHT_Z;
  const den = (B.y - A.y) * LIGHT_Z + sy * (B.z - A.z);
  return num / den;
}

/** rodParamAtScreen in lamp-relative y coordinates (handles lightY correctly) */
export function rodParamAtScreenL(
  A: THREE.Vector3, B: THREE.Vector3, sx: number, sy: number, lightY: number,
): number {
  const A2 = A.clone(); A2.y -= lightY;
  const B2 = B.clone(); B2.y -= lightY;
  return rodParamAtScreen(A2, B2, sx, sy - lightY);
}
