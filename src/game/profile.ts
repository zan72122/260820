import * as THREE from 'three';

/**
 * The entremet is a surface of revolution ("flattened dome").
 * Everything in the game — geometry, the glaze coverage field, the pour
 * hit-test, the drip spawn points — is expressed in this one parameterisation:
 *
 *   v = 0  → top pole
 *   v = 1  → bottom rim (where the cake meets the rack)
 *   u      → angle around, 0..1, wrapping
 *
 * The same formula is duplicated in GLSL (see glazeField.ts / glazeMesh.ts).
 */

/** Cake radius in metres (17 cm diameter). */
export const CAKE_R = 0.085;
/** Cake height in metres. */
export const CAKE_H = 0.056;
/** Superellipse exponent: 2 = ellipse, higher = flatter top + straighter side. */
export const CAKE_N = 2.5;
/** v is warped so that rings bunch up near the steep bottom wall. */
export const V_WARP = 0.75;

/** Radius (0..1 of CAKE_R) at parameter v. */
export function rNorm(v: number): number {
  return Math.sin(Math.pow(THREE.MathUtils.clamp(v, 0, 1), V_WARP) * Math.PI * 0.5);
}

/** Height (0..1 of CAKE_H) at parameter v. */
export function yNorm(v: number): number {
  const s = rNorm(v);
  return Math.pow(Math.max(0, 1 - Math.pow(s, CAKE_N)), 1 / CAKE_N);
}

/** Inverse: parameter v for a given world radius. */
export function vAtRadius(radius: number): number {
  const s = THREE.MathUtils.clamp(radius / CAKE_R, 0, 1);
  const a = Math.asin(s) / (Math.PI * 0.5);
  return Math.pow(a, 1 / V_WARP);
}

/** Surface height (metres) above the cake base at a given world radius. */
export function surfaceY(radius: number): number {
  const s = THREE.MathUtils.clamp(radius / CAKE_R, 0, 1);
  return CAKE_H * Math.pow(Math.max(0, 1 - Math.pow(s, CAKE_N)), 1 / CAKE_N);
}

/** Outward unit normal in the (radial, up) meridian plane. */
export function meridianNormal(v: number): [number, number] {
  const e = 1e-4;
  const a = THREE.MathUtils.clamp(v - e, 0, 1);
  const b = THREE.MathUtils.clamp(v + e, 0, 1);
  const dr = (rNorm(b) - rNorm(a)) * CAKE_R;
  const dy = (yNorm(b) - yNorm(a)) * CAKE_H;
  let nr = -dy;
  let ny = dr;
  const len = Math.hypot(nr, ny) || 1;
  nr /= len;
  ny /= len;
  if (v <= 1e-5) return [0, 1];
  return [nr, ny];
}

/** Total meridian arc length in metres (top pole → bottom rim). */
export const MERIDIAN_ARC = (() => {
  let acc = 0;
  const steps = 512;
  let pr = 0;
  let py = CAKE_H;
  for (let i = 1; i <= steps; i++) {
    const v = i / steps;
    const r = rNorm(v) * CAKE_R;
    const y = yNorm(v) * CAKE_H;
    acc += Math.hypot(r - pr, y - py);
    pr = r;
    py = y;
  }
  return acc;
})();

export interface DomeOptions {
  radialSegments?: number;
  heightSegments?: number;
  /** Uniform outward offset along the normal (metres). */
  offset?: number;
  /** Add a flat disc closing the base. */
  cap?: boolean;
  /** Stop the surface before the rim (used by the silicone mould). */
  vMax?: number;
}

/**
 * Builds the dome as an explicit polar grid so that uv.y === v exactly and the
 * normals are analytic (a LatheGeometry would give neither).
 * The cake base sits at y = 0, the top pole at y = CAKE_H.
 */
export function makeDomeGeometry(opts: DomeOptions = {}): THREE.BufferGeometry {
  const radial = opts.radialSegments ?? 128;
  const rows = opts.heightSegments ?? 72;
  const offset = opts.offset ?? 0;
  const vMax = opts.vMax ?? 1;

  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let j = 0; j <= rows; j++) {
    const v = (j / rows) * vMax;
    const [nr, ny] = meridianNormal(v);
    const r = rNorm(v) * CAKE_R + nr * offset;
    const y = yNorm(v) * CAKE_H + ny * offset;
    for (let i = 0; i <= radial; i++) {
      const u = i / radial;
      const ang = u * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      pos.push(r * c, y, r * s);
      nor.push(nr * c, ny, nr * s);
      uvs.push(u, v);
    }
  }

  const rowLen = radial + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * rowLen + i;
      const b = a + 1;
      const c = a + rowLen;
      const d = c + 1;
      if (j > 0) idx.push(a, b, c);
      idx.push(b, d, c);
    }
  }

  if (opts.cap) {
    const base = pos.length / 3;
    pos.push(0, 0, 0);
    nor.push(0, -1, 0);
    uvs.push(0.5, 1);
    const ring = rows * rowLen;
    for (let i = 0; i < radial; i++) {
      idx.push(base, ring + i, ring + i + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Shared GLSL版 of the profile, injected into every glaze shader. */
export const PROFILE_GLSL = /* glsl */ `
  const float CAKE_R = ${CAKE_R.toFixed(5)};
  const float CAKE_H = ${CAKE_H.toFixed(5)};
  const float CAKE_N = ${CAKE_N.toFixed(3)};
  const float V_WARP = ${V_WARP.toFixed(3)};

  float profileR(float v) {
    return sin(pow(clamp(v, 0.0, 1.0), V_WARP) * 1.5707963);
  }
  float profileY(float v) {
    float s = profileR(v);
    return pow(max(1.0 - pow(s, CAKE_N), 0.0), 1.0 / CAKE_N);
  }
`;
