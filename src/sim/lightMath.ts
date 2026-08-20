/**
 * Analytic bounce-light model shared by the CPU (blush growth) and the GPU
 * (peach / leaf shading).
 *
 * The reflective sheet is treated as a uniformly radiant convex polygon. The
 * irradiance it deposits on a differential surface element is then exact:
 *
 *   E = L * sum_edges( acos(ri . rj) * ( normalize(ri x rj) . n ) )
 *
 * (Lambert's contour-integral form factor). Because it is a real solution and
 * not a point light, moving / rotating / folding the sheet changes the light on
 * the fruit the way the material itself would - no white blow-out, no beam.
 */

export type V3 = { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })

export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
export const len = (a: V3): number => Math.sqrt(dot(a, a))
export const norm = (a: V3): V3 => {
  const l = len(a)
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 }
}
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)
export const clamp01 = (x: number): number => clamp(x, 0, 1)
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9))
  return t * t * (3 - 2 * t)
}

/** Sutherland-Hodgman clip of a polygon against the tangent plane at (p, n). */
export function clipToTangentPlane(poly: V3[], p: V3, n: V3): V3[] {
  const out: V3[] = []
  const count = poly.length
  if (count === 0) return out
  let prev = poly[count - 1]
  let prevD = dot(sub(prev, p), n)
  for (let i = 0; i < count; i++) {
    const cur = poly[i]
    const curD = dot(sub(cur, p), n)
    const prevIn = prevD > 0
    const curIn = curD > 0
    if (prevIn !== curIn) {
      const t = prevD / (prevD - curD)
      out.push({
        x: prev.x + (cur.x - prev.x) * t,
        y: prev.y + (cur.y - prev.y) * t,
        z: prev.z + (cur.z - prev.z) * t,
      })
    }
    if (curIn) out.push(cur)
    prev = cur
    prevD = curD
  }
  return out
}

/**
 * Form factor from the differential element (p, n) to `poly`, in [0, 1].
 * 1 would mean the polygon fills the whole visible hemisphere.
 */
export function polygonFormFactor(p: V3, n: V3, poly: V3[]): number {
  const clipped = clipToTangentPlane(poly, p, n)
  if (clipped.length < 3) return 0
  let sum = 0
  for (let i = 0; i < clipped.length; i++) {
    const a = norm(sub(clipped[i], p))
    const b = norm(sub(clipped[(i + 1) % clipped.length], p))
    const c = clamp(dot(a, b), -1, 1)
    const theta = Math.acos(c)
    if (theta < 1e-6) continue
    const axis = norm(cross(a, b))
    sum += theta * dot(axis, n)
  }
  return clamp01(Math.abs(sum) / (2 * Math.PI))
}

export interface SheetLightState {
  /** World-space quad, counter-clockwise seen from above. */
  quad: [V3, V3, V3, V3]
  /** Upward-facing sheet normal. */
  normal: V3
  /** Diffuse reflectance of the material (a farm sheet, not a mirror). */
  albedo: number
  /** 0 when the sheet is still rolled up, 1 when fully spread. */
  deployed: number
}

/**
 * Irradiance arriving at (p, n) after one bounce off the sheet, normalised so
 * that ~1.0 is "as bright as direct noon sun on a surface facing it".
 */
export function bounceIrradiance(
  p: V3,
  n: V3,
  sheet: SheetLightState,
  sunDir: V3,
  sunStrength: number,
): number {
  if (sheet.deployed <= 0.001 || sunStrength <= 0) return 0
  const cosSun = Math.max(0, dot(sheet.normal, sunDir))
  if (cosSun <= 0) return 0
  const ff = polygonFormFactor(p, n, sheet.quad)
  return ff * cosSun * sheet.albedo * sunStrength * sheet.deployed
}

/** GLSL mirror of the functions above (GLSL ES 3.00 / WebGL2). */
export const GLSL_BOUNCE = /* glsl */ `
#define MOMO_MAX_POLY 6

float momoFormFactor(vec3 p, vec3 n, vec3 q0, vec3 q1, vec3 q2, vec3 q3) {
  vec3 src[4];
  src[0] = q0; src[1] = q1; src[2] = q2; src[3] = q3;
  vec3 poly[MOMO_MAX_POLY];
  int count = 0;
  vec3 prev = src[3];
  float prevD = dot(prev - p, n);
  for (int i = 0; i < 4; i++) {
    vec3 cur = src[i];
    float curD = dot(cur - p, n);
    bool prevIn = prevD > 0.0;
    bool curIn = curD > 0.0;
    if (prevIn != curIn && count < MOMO_MAX_POLY) {
      float t = prevD / (prevD - curD);
      poly[count] = mix(prev, cur, t);
      count++;
    }
    if (curIn && count < MOMO_MAX_POLY) {
      poly[count] = cur;
      count++;
    }
    prev = cur;
    prevD = curD;
  }
  if (count < 3) return 0.0;
  float sum = 0.0;
  for (int i = 0; i < MOMO_MAX_POLY; i++) {
    if (i >= count) break;
    int j = i + 1;
    if (j >= count) j = 0;
    vec3 a = normalize(poly[i] - p);
    vec3 b = normalize(poly[j] - p);
    float c = clamp(dot(a, b), -1.0, 1.0);
    float theta = acos(c);
    if (theta < 1e-5) continue;
    vec3 axis = normalize(cross(a, b));
    sum += theta * dot(axis, n);
  }
  return clamp(abs(sum) / 6.2831853, 0.0, 1.0);
}

float momoBounce(
  vec3 p, vec3 n,
  vec3 q0, vec3 q1, vec3 q2, vec3 q3,
  vec3 sheetNormal, vec3 sunDir,
  float albedo, float sunStrength, float deployed
) {
  if (deployed <= 0.001 || sunStrength <= 0.0) return 0.0;
  float cosSun = max(0.0, dot(sheetNormal, sunDir));
  if (cosSun <= 0.0) return 0.0;
  return momoFormFactor(p, n, q0, q1, q2, q3) * cosSun * albedo * sunStrength * deployed;
}
`
