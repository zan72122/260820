import type { Vec2 } from './math';

/**
 * Canonical glyph source for KERNING CANYON.
 *
 * A small grotesque-sans glyph set defined as closed polygon contours in em
 * units (cap height = 1.0, y up, x starts at 0). The first contour is the
 * outer boundary; any further contours are holes (counters).
 *
 * The SAME contours drive:
 *  - the extruded 3D letter meshes (front silhouette),
 *  - the 2D collision polygons for the test capsule,
 *  - the scanline evaluation of the negative space between two letters.
 */
export interface Glyph {
  /** Letter name, e.g. 'A'. */
  name: string;
  /** em width of the glyph box. */
  width: number;
  /** contours[0] = outer boundary, rest = holes. Em units, y in [0,1]. */
  contours: Vec2[][];
}

const STROKE = 0.17; // horizontal stroke thickness shared by the set

function glyphA(): Glyph {
  const W = 0.74;
  const t = STROKE;
  const ah = 0.09; // apex half width (flat apex, grotesque style)
  const slope = 0.5 * W - ah; // dx over full height for the leg edges
  // outer boundary
  const outer: Vec2[] = [
    { x: 0, y: 0 },
    { x: 0.5 * W - ah, y: 1 },
    { x: 0.5 * W + ah, y: 1 },
    { x: W, y: 0 },
    { x: W - t, y: 0 },
    // inner right leg edge up to the underside of the crossbar
    { x: W - t - slope * 0.2, y: 0.2 },
    { x: t + slope * 0.2, y: 0.2 },
    { x: t, y: 0 },
  ];
  // triangular counter above the crossbar
  const meetY = (W - 2 * t) / (2 * slope);
  const hole: Vec2[] = [
    { x: t + slope * 0.34, y: 0.34 },
    { x: 0.5 * W, y: meetY },
    { x: W - t - slope * 0.34, y: 0.34 },
  ];
  return { name: 'A', width: W, contours: [outer, hole] };
}

function glyphV(): Glyph {
  const W = 0.7;
  const t = STROKE;
  const bh = 0.075; // flat bottom tip half width
  const slope = 0.5 * W - bh;
  const meetU = (W - 2 * t) / (2 * slope); // u = 1 - y at inner meet
  const outer: Vec2[] = [
    { x: 0, y: 1 },
    { x: 0.5 * W - bh, y: 0 },
    { x: 0.5 * W + bh, y: 0 },
    { x: W, y: 1 },
    { x: W - t, y: 1 },
    { x: 0.5 * W, y: 1 - meetU },
    { x: t, y: 1 },
  ];
  return { name: 'V', width: W, contours: [outer] };
}

function superellipsePoint(cx: number, cy: number, rx: number, ry: number, a: number, n: number): Vec2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / n;
  return {
    x: cx + rx * Math.sign(c) * Math.pow(Math.abs(c), e),
    y: cy + ry * Math.sign(s) * Math.pow(Math.abs(s), e),
  };
}

function glyphO(): Glyph {
  const W = 0.78;
  const N = 48;
  const n = 2.35; // slightly squarish grotesque O
  const outer: Vec2[] = [];
  const hole: Vec2[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    outer.push(superellipsePoint(0.5 * W, 0.5, 0.5 * W, 0.5, a, n));
    hole.push(superellipsePoint(0.5 * W, 0.5, 0.5 * W - STROKE, 0.5 - 0.16, a, n));
  }
  return { name: 'O', width: W, contours: [outer, hole] };
}

function glyphL(): Glyph {
  const W = 0.6;
  const t = STROKE;
  const foot = 0.16;
  const outer: Vec2[] = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: foot },
    { x: t, y: foot },
    { x: t, y: 1 },
    { x: 0, y: 1 },
  ];
  return { name: 'L', width: W, contours: [outer] };
}

function glyphT(): Glyph {
  const W = 0.72;
  const t = STROKE;
  const bar = 0.16;
  const sx = 0.5 * W - 0.5 * t; // stem left
  const outer: Vec2[] = [
    { x: 0, y: 1 },
    { x: W, y: 1 },
    { x: W, y: 1 - bar },
    { x: sx + t, y: 1 - bar },
    { x: sx + t, y: 0 },
    { x: sx, y: 0 },
    { x: sx, y: 1 - bar },
    { x: 0, y: 1 - bar },
  ];
  return { name: 'T', width: W, contours: [outer] };
}

const registry: Record<string, Glyph> = {};

export function getGlyph(name: string): Glyph {
  if (!registry[name]) {
    switch (name) {
      case 'A':
        registry[name] = glyphA();
        break;
      case 'V':
        registry[name] = glyphV();
        break;
      case 'O':
        registry[name] = glyphO();
        break;
      case 'L':
        registry[name] = glyphL();
        break;
      case 'T':
        registry[name] = glyphT();
        break;
      default:
        throw new Error(`unknown glyph ${name}`);
    }
  }
  return registry[name];
}

/**
 * Scanline extremes of a glyph at height y (em units).
 * Returns [minX, maxX] of the outer boundary crossings, or null when the
 * scanline misses the glyph.
 */
export function scanline(glyph: Glyph, y: number): [number, number] | null {
  const outer = glyph.contours[0];
  let min = Infinity;
  let max = -Infinity;
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % n];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const t = (y - a.y) / (b.y - a.y);
      const x = a.x + (b.x - a.x) * t;
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  if (min === Infinity) return null;
  return [min, max];
}
