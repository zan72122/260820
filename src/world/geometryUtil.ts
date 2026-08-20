import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { SLIDE_LENGTH, slideNormal, slidePoint, slideTangent } from './slideCurve';

export type Profile2D = { z: number; n: number }[];

/** Cumulative arc length of a cross-section, used for the V coordinate. */
function profileArc(profile: Profile2D): number[] {
  const arc = [0];
  for (let i = 1; i < profile.length; i++) {
    arc.push(
      arc[i - 1] + Math.hypot(profile[i].z - profile[i - 1].z, profile[i].n - profile[i - 1].n),
    );
  }
  return arc;
}

export interface SweepOptions {
  sMin?: number;
  sMax?: number;
  segments?: number;
  /** Metres of slide covered by one texture repeat along U. */
  uScale?: number;
  /** Metres of cross-section covered by one texture repeat along V. */
  vScale?: number;
  closed?: boolean;
  /** Emit the `aSlide` attribute (arc fraction, lateral fraction). */
  slideAttr?: boolean;
  /** Faces up to this profile index go in material group 0. */
  topGroupUntil?: number;
  lateralHalfWidth?: number;
}

/**
 * Sweep a 2D cross-section along the slide centreline. Used for the bed, the
 * side stringers and the handrails, so every piece of the structure follows
 * exactly the same curve the physics uses.
 */
export function sweepAlongSlide(profile: Profile2D, opts: SweepOptions = {}): BufferGeometry {
  const sMin = opts.sMin ?? 0;
  const sMax = opts.sMax ?? SLIDE_LENGTH;
  const segments = opts.segments ?? 120;
  const uScale = opts.uScale ?? 1.1;
  const vScale = opts.vScale ?? 0.5;
  const closed = opts.closed ?? true;
  const arc = profileArc(profile);
  const P = profile.length;
  const rows = segments + 1;
  const count = rows * P;

  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const slideAttr = opts.slideAttr ? new Float32Array(count * 2) : null;
  const half = opts.lateralHalfWidth ?? 0.34;

  const c = new Vector3();
  const t = new Vector3();
  const n = new Vector3();

  for (let r = 0; r < rows; r++) {
    const s = sMin + ((sMax - sMin) * r) / segments;
    slidePoint(s, c);
    slideTangent(s, t);
    slideNormal(s, n);
    for (let i = 0; i < P; i++) {
      const k = (r * P + i) * 3;
      const p = profile[i];
      pos[k + 0] = c.x + n.x * p.n;
      pos[k + 1] = c.y + n.y * p.n;
      pos[k + 2] = c.z + p.z;
      const j = (r * P + i) * 2;
      uv[j + 0] = s / uScale;
      uv[j + 1] = arc[i] / vScale;
      if (slideAttr) {
        slideAttr[j + 0] = s / SLIDE_LENGTH;
        slideAttr[j + 1] = p.z / half;
      }
    }
  }

  const quads = (P - (closed ? 0 : 1)) * segments;
  const idx = new Uint32Array(quads * 6);
  let w = 0;
  const groups: { start: number; count: number; group: number }[] = [];
  const topUntil = opts.topGroupUntil ?? P;
  let runGroup = -1;
  let runStart = 0;
  for (let i = 0; i < P - (closed ? 0 : 1); i++) {
    const i2 = (i + 1) % P;
    const g = i < topUntil - 1 ? 0 : 1;
    if (g !== runGroup) {
      if (runGroup >= 0) groups.push({ start: runStart, count: w - runStart, group: runGroup });
      runGroup = g;
      runStart = w;
    }
    for (let r = 0; r < segments; r++) {
      const a = r * P + i;
      const b = r * P + i2;
      const cc = (r + 1) * P + i2;
      const d = (r + 1) * P + i;
      idx[w++] = a;
      idx[w++] = b;
      idx[w++] = cc;
      idx[w++] = a;
      idx[w++] = cc;
      idx[w++] = d;
    }
  }
  if (runGroup >= 0) groups.push({ start: runStart, count: w - runStart, group: runGroup });

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new BufferAttribute(uv.slice(), 2));
  if (slideAttr) geo.setAttribute('aSlide', new BufferAttribute(slideAttr, 2));
  geo.setIndex(new BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  if (groups.length > 1) for (const g of groups) geo.addGroup(g.start, g.count, g.group);
  geo.computeBoundingSphere();
  return geo;
}

/** Offset a top polyline downwards along the surface normal to give it body. */
export function shellProfile(top: Profile2D, thickness: number): Profile2D {
  const bottom: Profile2D = [];
  for (let i = top.length - 1; i >= 0; i--) bottom.push({ z: top[i].z, n: top[i].n - thickness });
  return [...top, ...bottom];
}
