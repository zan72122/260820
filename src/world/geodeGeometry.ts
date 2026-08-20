import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { Rand } from '../core/Rand';

/** Cheap CPU gradient noise. Only shapes the silhouette — the fragment shader
 *  supplies all the fine detail, so it does not need to match GLSL exactly. */
function hash3(ix: number, iy: number, iz: number): [number, number, number] {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const a = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  h = Math.imul(h ^ (h >>> 7), 2246822519);
  const b = ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  h = Math.imul(h ^ (h >>> 11), 3266489917);
  const c = ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  return [a * 2 - 1, b * 2 - 1, c * 2 - 1];
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let acc = 0;
  for (let k = 0; k < 2; k++) {
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const g = hash3(ix + i, iy + j, iz + k);
        const dx = fx - i, dy = fy - j, dz = fz - k;
        const dot = g[0] * dx + g[1] * dy + g[2] * dz;
        const w = (i ? ux : 1 - ux) * (j ? uy : 1 - uy) * (k ? uz : 1 - uz);
        acc += dot * w;
      }
    }
  }
  return acc * 1.6;
}

export function fbm(x: number, y: number, z: number, oct = 4): number {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z);
    n += a;
    x = x * 2.03 + 7.31; y = y * 2.03 + 3.17; z = z * 2.03 + 11.9;
    a *= 0.5;
  }
  return s / n;
}

export interface GeodeShape {
  seed: number;
  radius: number;
  cavityR: number;
  crag: number;
  seamAmp: number;
  seamPhase: Vector3;
  breakAmp: number;
  /** Longitude segments; latitude segments for the outer shell and the cavity. */
  nu: number;
  nvOut: number;
  nvIn: number;
}

export function defaultShape(seed: number, rand = new Rand(seed)): GeodeShape {
  return {
    seed,
    radius: 0.50,
    cavityR: 0.335,
    crag: 0.115,
    seamAmp: 0.038,
    seamPhase: new Vector3(rand.range(0, 6.28), rand.range(0, 6.28), rand.range(0, 6.28)),
    breakAmp: 0.020,
    nu: 64,
    nvOut: 22,
    nvIn: 18,
  };
}

/** JS mirror of `seamOffset()` in gfx/materials.ts. The two halves and the
 *  shader must all agree on where the stone breaks. */
export function seamOffsetAt(lon: number, amp: number, phase: Vector3): number {
  return amp * (0.55 * Math.sin(lon * 3.0 + phase.x)
              + 0.28 * Math.sin(lon * 7.0 + phase.y)
              + 0.17 * Math.sin(lon * 13.0 + phase.z));
}

/** Profile of the break surface across the rim. Zero at both edges so the rim
 *  meets the outer shell and the cavity exactly; shared by both halves so they
 *  interlock instead of z-fighting. */
function breakProfile(lon: number, s: number, amp: number, phase: Vector3): number {
  const wave = 0.6 * Math.sin(lon * 5.0 + phase.y * 1.7) + 0.4 * Math.sin(lon * 9.0 + phase.z);
  return amp * Math.sin(Math.PI * s) * wave;
}

function outerRadius(d: Vector3, sh: GeodeShape): number {
  const f = 2.7;
  const warp = fbm(d.x * 1.9 + 13.1, d.y * 1.9, d.z * 1.9 + sh.seed * 0.013, 2);
  const n = fbm(d.x * f + warp * 0.6, d.y * f + sh.seed * 0.021, d.z * f, 4);
  const lumps = fbm(d.x * 1.35, d.y * 1.35 + 5.0, d.z * 1.35 + sh.seed * 0.007, 2);
  return sh.radius * (1 + sh.crag * n + 0.085 * lumps);
}

function cavityRadius(d: Vector3, sh: GeodeShape): number {
  const n = fbm(d.x * 3.6 + 31.0, d.y * 3.6, d.z * 3.6 + sh.seed * 0.017, 3);
  return sh.cavityR * (1 + 0.16 * n);
}

const _d = new Vector3();

/**
 * One half of the geode: outer weathered shell, the broken rim cross-section,
 * and the concave cavity, in a single geometry with two material groups
 * (0 = rock, 1 = druzy) and an `aSurf` attribute distinguishing shell from rim.
 */
export function buildGeodeHalf(sign: 1 | -1, sh: GeodeShape): BufferGeometry {
  const { nu, nvOut, nvIn } = sh;
  const pos: number[] = [];
  const surf: number[] = [];
  const rockIdx: number[] = [];
  const druzyIdx: number[] = [];

  const dirAt = (lon: number, lat: number) =>
    _d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));

  const shear = (lon: number, t: number) => seamOffsetAt(lon, sh.seamAmp, sh.seamPhase) * (1 - t);

  const push = (x: number, y: number, z: number, s: number) => {
    pos.push(x, y, z);
    surf.push(s);
    return pos.length / 3 - 1;
  };

  // ---- outer shell: t = 0 at the break, t = 1 at the pole ----
  const outerStart = pos.length / 3;
  for (let j = 0; j <= nvOut; j++) {
    const t = j / nvOut;
    const lat = sign * t * Math.PI * 0.5;
    for (let i = 0; i <= nu; i++) {
      const lon = (i / nu) * Math.PI * 2;
      const d = dirAt(lon, lat);
      const r = outerRadius(d, sh);
      push(d.x * r, d.y * r + shear(lon, t), d.z * r, 0);
    }
  }
  for (let j = 0; j < nvOut; j++) {
    for (let i = 0; i < nu; i++) {
      const a = outerStart + j * (nu + 1) + i;
      const b = a + 1, c = a + nu + 1, e = c + 1;
      if (sign > 0) rockIdx.push(a, c, b, b, c, e);
      else rockIdx.push(a, b, c, b, e, c);
    }
  }

  // ---- rim: the fresh break surface, two quads deep ----
  const RIM_STEPS = 3;
  const rimStart = pos.length / 3;
  for (let j = 0; j <= RIM_STEPS; j++) {
    const s = j / RIM_STEPS; // 0 at the cavity edge, 1 at the outer edge
    for (let i = 0; i <= nu; i++) {
      const lon = (i / nu) * Math.PI * 2;
      const dIn = dirAt(lon, 0);
      const rIn = cavityRadius(dIn, sh);
      const rOut = outerRadius(dIn, sh);
      const r = rIn + (rOut - rIn) * s;
      const y = seamOffsetAt(lon, sh.seamAmp, sh.seamPhase)
        + sign * breakProfile(lon, s, sh.breakAmp, sh.seamPhase);
      push(Math.cos(lon) * r, y, Math.sin(lon) * r, 1);
    }
  }
  for (let j = 0; j < RIM_STEPS; j++) {
    for (let i = 0; i < nu; i++) {
      const a = rimStart + j * (nu + 1) + i;
      const b = a + 1, c = a + nu + 1, e = c + 1;
      if (sign > 0) rockIdx.push(a, b, c, b, e, c);
      else rockIdx.push(a, c, b, b, c, e);
    }
  }

  // ---- cavity: concave bowl, gets the druzy material ----
  const inStart = pos.length / 3;
  for (let j = 0; j <= nvIn; j++) {
    const t = j / nvIn;
    const lat = sign * t * Math.PI * 0.5;
    for (let i = 0; i <= nu; i++) {
      const lon = (i / nu) * Math.PI * 2;
      const d = dirAt(lon, lat);
      const r = cavityRadius(d, sh);
      push(d.x * r, d.y * r + shear(lon, t), d.z * r, 2);
    }
  }
  for (let j = 0; j < nvIn; j++) {
    for (let i = 0; i < nu; i++) {
      const a = inStart + j * (nu + 1) + i;
      const b = a + 1, c = a + nu + 1, e = c + 1;
      // Wound inside-out: the cavity is viewed from within.
      if (sign > 0) druzyIdx.push(a, b, c, b, e, c);
      else druzyIdx.push(a, c, b, b, c, e);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSurf', new Float32BufferAttribute(surf, 1));
  geo.setIndex([...rockIdx, ...druzyIdx]);
  geo.addGroup(0, rockIdx.length, 0);
  geo.addGroup(rockIdx.length, druzyIdx.length, 1);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Unit hexagonal quartz: prism from y=0 to 0.62, six-faced tip to y=1. */
export function buildCrystalGeometry(rand: Rand): BufferGeometry {
  const SIDES = 6;
  const SHOULDER = 0.62;
  const pos: number[] = [];
  const idx: number[] = [];

  const rr: number[] = [];
  for (let i = 0; i < SIDES; i++) rr.push(rand.range(0.86, 1.14));

  const ring = (y: number, scale: number) => {
    const base = pos.length / 3;
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      pos.push(Math.cos(a) * rr[i] * scale, y, Math.sin(a) * rr[i] * scale);
    }
    return base;
  };

  const r0 = ring(0, 1);
  const r1 = ring(SHOULDER, 1);
  const r2 = ring(SHOULDER + 0.02, 0.94);
  const apex = pos.length / 3;
  pos.push(0, 1, 0);

  for (let i = 0; i < SIDES; i++) {
    const n = (i + 1) % SIDES;
    idx.push(r0 + i, r1 + i, r0 + n, r0 + n, r1 + i, r1 + n);
    idx.push(r1 + i, r2 + i, r1 + n, r1 + n, r2 + i, r2 + n);
    idx.push(r2 + i, apex, r2 + n);
  }
  // Cap the base so the crystal is watertight where it leaves the rock.
  for (let i = 1; i < SIDES - 1; i++) idx.push(r0, r0 + i + 1, r0 + i);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export interface CrystalPlacement {
  position: Vector3;
  normal: Vector3;
  radius: number;
  height: number;
}

/** Scatter crystals over the cavity wall: bigger and denser toward the bottom
 *  of the bowl, tilted along the surface normal with a little disorder. */
export function placeCrystals(
  sign: 1 | -1, sh: GeodeShape, count: number, scale: number, rand: Rand,
): CrystalPlacement[] {
  const out: CrystalPlacement[] = [];
  const eps = 0.02;
  for (let n = 0; n < count; n++) {
    // Bias toward the pole (bowl bottom) but keep the rim populated.
    const t = Math.pow(rand.next(), 0.55) * 0.88 + 0.10;
    const lon = rand.range(0, Math.PI * 2);
    const lat = sign * t * Math.PI * 0.5;

    const d = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const r = cavityRadius(d, sh);
    const p = d.clone().multiplyScalar(r);
    p.y += seamOffsetAt(lon, sh.seamAmp, sh.seamPhase) * (1 - t);

    // Cavity normal points inward; approximate with a finite difference so
    // crystals follow the lumps of the bowl rather than a perfect sphere.
    const du = new Vector3(
      Math.cos(lat) * Math.cos(lon + eps), Math.sin(lat), Math.cos(lat) * Math.sin(lon + eps),
    ).multiplyScalar(cavityRadius(new Vector3(
      Math.cos(lat) * Math.cos(lon + eps), Math.sin(lat), Math.cos(lat) * Math.sin(lon + eps)), sh));
    const lat2 = sign * Math.min(Math.PI * 0.5, t * Math.PI * 0.5 + eps) * (sign > 0 ? 1 : 1);
    const dv = new Vector3(
      Math.cos(lat2) * Math.cos(lon), Math.sin(lat2), Math.cos(lat2) * Math.sin(lon),
    );
    dv.multiplyScalar(cavityRadius(dv, sh));

    const tu = du.sub(p).normalize();
    const tv = dv.sub(p).normalize();
    let nrm = new Vector3().crossVectors(tu, tv).normalize();
    if (nrm.dot(d) > 0) nrm.negate();               // point into the cavity
    if (!Number.isFinite(nrm.x)) nrm = d.clone().negate();

    // Disorder: real druzy is never perfectly perpendicular.
    nrm.add(new Vector3(rand.signed(), rand.signed(), rand.signed()).multiplyScalar(0.26)).normalize();

    const big = 0.45 + 0.55 * t;
    const size = scale * rand.range(0.55, 1.35) * big;
    out.push({
      position: p,
      normal: nrm,
      radius: size * rand.range(0.22, 0.34),
      height: size,
    });
  }
  // Draw the big ones last so they win the depth fight visually at the tips.
  out.sort((a, b) => a.height - b.height);
  return out;
}
