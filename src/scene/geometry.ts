import * as THREE from 'three';
import { Rng } from '../core/rng';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

/** Dome UV convention, shared by the shell, the peaks and the cut faces:
 *  u = azimuth / 2pi (never wrapped — the mask repeats on S)
 *  v = elevation / (pi/2), 0 at the equator, 1 at the pole. */
export const domeU = (phi: number): number => phi / TAU;
export const domeV = (elev: number): number => Math.max(0, elev) / HALF_PI;

function finish(
  pos: number[],
  idx: number[],
  extra: Record<string, { data: number[]; size: number }> = {},
  uv?: number[],
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (const [name, a] of Object.entries(extra)) {
    g.setAttribute(name, new THREE.Float32BufferAttribute(a.data, a.size));
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ *
 * Meringue shell — a hemisphere wedge with a short skirt that tucks
 * into the sponge so no seam ever shows at the base.
 * ------------------------------------------------------------------ */
export function buildDomeShell(o: {
  radius: number;
  phiStart: number;
  phiLength: number;
  segU: number;
  segV: number;
  skirt?: number;
}): THREE.BufferGeometry {
  const skirt = o.skirt ?? 0.2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = o.segU + 1;

  for (let j = 0; j <= o.segV; j++) {
    const t = j / o.segV;
    const elev = -skirt + (HALF_PI + skirt) * t;
    const y = o.radius * Math.sin(elev);
    const r = o.radius * Math.cos(elev);
    const v = domeV(elev);
    for (let i = 0; i <= o.segU; i++) {
      const phi = o.phiStart + o.phiLength * (i / o.segU);
      pos.push(r * Math.cos(phi), y, r * Math.sin(phi));
      uv.push(domeU(phi), v);
    }
  }

  for (let j = 0; j < o.segV; j++) {
    for (let i = 0; i < o.segU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // top row collapses on the pole: emit a single triangle there
      if (j === o.segV - 1) {
        idx.push(a, c, b);
      } else {
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  return finish(pos, idx, {}, uv);
}

/* ------------------------------------------------------------------ *
 * Frozen ice-cream wedge: curved outer surface plus a closed base.
 * The radial cut faces are separate geometry (different material).
 * ------------------------------------------------------------------ */
export function buildIceWedge(o: {
  radius: number;
  phiStart: number;
  phiLength: number;
  segU: number;
  segV: number;
}): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = o.segU + 1;

  for (let j = 0; j <= o.segV; j++) {
    const elev = HALF_PI * (j / o.segV);
    const y = o.radius * Math.sin(elev);
    const r = o.radius * Math.cos(elev);
    for (let i = 0; i <= o.segU; i++) {
      const phi = o.phiStart + o.phiLength * (i / o.segU);
      pos.push(r * Math.cos(phi), y, r * Math.sin(phi));
      // the frost maps need real UVs or the whole dome samples one texel
      uv.push(domeU(phi), elev / HALF_PI);
    }
  }
  for (let j = 0; j < o.segV; j++) {
    for (let i = 0; i < o.segU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (j === o.segV - 1) idx.push(a, c, b);
      else idx.push(a, c, b, b, c, d);
    }
  }

  // flat base sector, so the frozen block reads as solid from every angle
  const centre = pos.length / 3;
  pos.push(0, 0, 0);
  uv.push(0.5, 0);
  const ring0 = 0;
  for (let i = 0; i < o.segU; i++) idx.push(centre, ring0 + i, ring0 + i + 1);

  return finish(pos, idx, {}, uv);
}

/* ------------------------------------------------------------------ *
 * Sponge wedge: side wall, top and bottom discs.
 * ------------------------------------------------------------------ */
export function buildCylinderWedge(o: {
  radius: number;
  top: number;
  bottom: number;
  phiStart: number;
  phiLength: number;
  seg: number;
}): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = o.seg + 1;

  // side wall
  for (let j = 0; j <= 1; j++) {
    const y = j === 0 ? o.bottom : o.top;
    for (let i = 0; i <= o.seg; i++) {
      const phi = o.phiStart + o.phiLength * (i / o.seg);
      pos.push(o.radius * Math.cos(phi), y, o.radius * Math.sin(phi));
      // keep the crumb square: the wall is ~30x wider than it is tall
      uv.push((phi / TAU) * 3.2, j === 0 ? 0 : (o.top - o.bottom) / 2.4);
    }
  }
  for (let i = 0; i < o.seg; i++) {
    const a = i;
    const b = i + 1;
    const c = cols + i;
    const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }

  // top and bottom caps
  for (const [y, up] of [
    [o.top, true],
    [o.bottom, false],
  ] as Array<[number, boolean]>) {
    const base = pos.length / 3;
    pos.push(0, y, 0);
    uv.push(0.5, 0.5);
    for (let i = 0; i <= o.seg; i++) {
      const phi = o.phiStart + o.phiLength * (i / o.seg);
      pos.push(o.radius * Math.cos(phi), y, o.radius * Math.sin(phi));
      uv.push(0.5 + 0.5 * Math.cos(phi), 0.5 + 0.5 * Math.sin(phi));
    }
    for (let i = 0; i < o.seg; i++) {
      if (up) idx.push(base, base + 1 + i, base + 2 + i);
      else idx.push(base, base + 2 + i, base + 1 + i);
    }
  }

  return finish(pos, idx, {}, uv);
}

const CUT_INSET = 0.0018;

/** Local frame of a radial cut plane: X = outward radius, Y = up, Z = normal. */
function faceBasis(phi: number, sign: number): THREE.Matrix4 {
  const ex = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
  const ey = new THREE.Vector3(0, 1, 0);
  const ez = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(sign);
  const m = new THREE.Matrix4().makeBasis(ex, ey, ez);
  // recess into the piece that owns the face
  m.setPosition(-ez.x * CUT_INSET, 0, -ez.z * CUT_INSET);
  return m;
}

/* ------------------------------------------------------------------ *
 * Cut cross-sections. These are what sell the reveal: a golden rim, a
 * white meringue band, sponge and the cold interior, all readable at a
 * glance and all keyed to the browning the player actually painted.
 * ------------------------------------------------------------------ */
export function buildMeringueCutFace(o: {
  rInner: number;
  rOuter: number;
  phi: number;
  sign: number;
  segA?: number;
  segR?: number;
}): THREE.BufferGeometry {
  const segA = o.segA ?? 28;
  const segR = o.segR ?? 5;
  const pos: number[] = [];
  const domeUv: number[] = [];
  const radial: number[] = [];
  const idx: number[] = [];
  const cols = segR + 1;

  for (let j = 0; j <= segA; j++) {
    const a = HALF_PI * (j / segA);
    for (let i = 0; i <= segR; i++) {
      const s = i / segR;
      const rho = o.rInner + (o.rOuter - o.rInner) * s;
      pos.push(rho * Math.cos(a), rho * Math.sin(a), 0);
      domeUv.push(domeU(o.phi), a / HALF_PI);
      radial.push(s);
    }
  }
  for (let j = 0; j < segA; j++) {
    for (let i = 0; i < segR; i++) {
      const p = j * cols + i;
      idx.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  }
  const g = finish(pos, idx, {
    aDomeUv: { data: domeUv, size: 2 },
    aRadial: { data: radial, size: 1 },
  });
  g.applyMatrix4(faceBasis(o.phi, o.sign));
  return g;
}

export function buildIceCutFace(o: {
  radius: number;
  phi: number;
  sign: number;
  segA?: number;
  segR?: number;
}): THREE.BufferGeometry {
  const segA = o.segA ?? 26;
  const segR = o.segR ?? 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = segR + 1;

  for (let j = 0; j <= segA; j++) {
    const a = HALF_PI * (j / segA);
    for (let i = 0; i <= segR; i++) {
      const rho = o.radius * (i / segR);
      pos.push(rho * Math.cos(a), rho * Math.sin(a), 0);
      uv.push(rho * Math.cos(a) * 0.5 + 0.5, rho * Math.sin(a) * 0.5 + 0.5);
    }
  }
  for (let j = 0; j < segA; j++) {
    for (let i = 0; i < segR; i++) {
      const p = j * cols + i;
      idx.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  }
  const g = finish(pos, idx, {}, uv);
  g.applyMatrix4(faceBasis(o.phi, o.sign));
  return g;
}

export function buildSpongeCutFace(o: {
  radius: number;
  top: number;
  bottom: number;
  phi: number;
  sign: number;
}): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const nx = 5;
  const ny = 3;
  for (let j = 0; j <= ny; j++) {
    const y = o.bottom + (o.top - o.bottom) * (j / ny);
    for (let i = 0; i <= nx; i++) {
      const x = o.radius * (i / nx);
      pos.push(x, y, 0);
      uv.push(x * 0.42, y * 0.42 + 0.5);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * (nx + 1) + i;
      idx.push(p, p + nx + 1, p + 1, p + 1, p + nx + 1, p + nx + 2);
    }
  }
  const g = finish(pos, idx, {}, uv);
  g.applyMatrix4(faceBasis(o.phi, o.sign));
  return g;
}

/* ------------------------------------------------------------------ *
 * One piped meringue peak from a large star nozzle: fluted sides, a
 * twist from the wrist, and a tip that hooks over slightly.
 * ------------------------------------------------------------------ */
export function buildPeakGeometry(o: {
  height: number;
  radius: number;
  points: number;
  twist: number;
  lean: number;
  rings?: number;
  segments?: number;
}): THREE.BufferGeometry {
  const rings = o.rings ?? 5;
  const segments = o.segments ?? Math.max(12, o.points * 2);
  const pos: number[] = [];
  const tip: number[] = [];
  const idx: number[] = [];

  const topU = 0.86;
  for (let k = 0; k < rings; k++) {
    const u = (k / (rings - 1)) * topU;
    const shrink = Math.pow(1 - u * 0.94, 0.85) * (1 + 0.16 * Math.sin(u * Math.PI));
    const starAmp = 0.3 * (1 - 0.5 * u);
    const y = o.height * Math.pow(u, 0.94);
    const dx = o.lean * u * u;
    for (let i = 0; i < segments; i++) {
      const th = (i / segments) * TAU + o.twist * u;
      const r = o.radius * shrink * (1 + starAmp * Math.cos(o.points * th));
      pos.push(r * Math.cos(th) + dx, y, r * Math.sin(th));
      tip.push(u / topU);
    }
  }
  for (let k = 0; k < rings - 1; k++) {
    for (let i = 0; i < segments; i++) {
      const a = k * segments + i;
      const b = k * segments + ((i + 1) % segments);
      const c = a + segments;
      const d = b + segments;
      idx.push(a, c, b, b, c, d);
    }
  }
  // hooked tip
  const tipIdx = pos.length / 3;
  pos.push(o.lean * 1.22, o.height * 1.03, 0);
  tip.push(1);
  const last = (rings - 1) * segments;
  for (let i = 0; i < segments; i++) {
    idx.push(last + i, tipIdx, last + ((i + 1) % segments));
  }

  return finish(pos, idx, { aTip: { data: tip, size: 1 } });
}

/** A small family of peaks so no two neighbours look stamped from a mould. */
export function peakVariants(rng: Rng, count = 3): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      buildPeakGeometry({
        height: rng.range(0.10, 0.15),
        radius: rng.range(0.088, 0.115),
        points: [7, 8, 9][i % 3],
        twist: rng.range(-0.55, 0.55),
        lean: rng.range(-0.014, 0.014),
        rings: 5,
        segments: 12,
      }),
    );
  }
  return out;
}

/** Evenly spread points on a hemisphere (Fibonacci), used as peak slots. */
export function hemisphereSlots(count: number, rng: Rng): Array<{ phi: number; elev: number }> {
  const out: Array<{ phi: number; elev: number }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    // bias slightly towards the shoulder of the dome, where peaks read best
    const t = (i + 0.5) / count;
    const elev = Math.asin(Math.pow(t, 0.94));
    const phi = (i * golden + rng.range(-0.05, 0.05)) % TAU;
    out.push({ phi: (phi + TAU) % TAU, elev });
  }
  return out;
}
