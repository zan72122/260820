import * as THREE from 'three';

/**
 * Canonical glyph source.
 *
 * Every letter is defined once as 2D contour data in "em space":
 *   x in [-0.5, 0.5], y in [0, 1]  (baseline at y = 0, cap height at y = 1)
 * Contours are closed polylines. `outer` is the outer silhouette,
 * `counters` are the enclosed holes (the "sand islands" in the mold).
 *
 * The same data feeds:
 *  - the pattern (原型) extrusion
 *  - the sand mold depression mask (counters left standing = islands)
 *  - the cast metal letter
 *  - the melt flow-order field (BFS from the gate)
 *  - flat SVG paths for the letter selection UI
 */

export type Contour = THREE.Vector2[];

export interface GlyphDef {
  letter: string;
  outer: Contour[];      // usually 1 outer contour
  counters: Contour[];   // 0..2 closed counters
  counterCount: number;
  nameJa: string;        // spoken name, e.g. 'オー'
  /** preferred gate point (em space) on the outer silhouette, metal enters here */
  gate: THREE.Vector2;
}

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 72, a0 = 0, a1 = Math.PI * 2): Contour {
  const pts: Contour = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (a1 - a0) * (i / (n - 1));
    pts.push(V2(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
  }
  return pts;
}

/* ------------------------------------------------------------------ O */

function glyphO(): GlyphDef {
  return {
    letter: 'O',
    outer: [ellipse(0, 0.5, 0.40, 0.50, 96)],
    counters: [ellipse(0, 0.5, 0.215, 0.31, 72)],
    counterCount: 1,
    nameJa: 'オー',
    gate: V2(-0.40, 0.5),
  };
}

/* ------------------------------------------------------------------ A */

function glyphA(): GlyphDef {
  // straight-sided A. Outer edge slope from apex half-width to base half-width.
  const topHalf = 0.105;      // half width of flat apex
  const baseHalf = 0.46;      // half width at baseline (outer)
  const strokeH = 0.17;       // horizontal stroke thickness of the legs
  const barBot = 0.24;
  const barTop = 0.40;
  const slope = baseHalf - topHalf; // horizontal run over full height

  const xOut = (y: number) => topHalf + slope * (1 - y);       // outer |x| at height y
  const xIn = (y: number) => xOut(y) - strokeH;                 // inner |x| at height y
  // inner edges meet at x=0 when xIn(y)=0
  const yInnerApex = 1 - (strokeH - topHalf) / slope;

  const outer: Contour = [
    V2(-baseHalf, 0),
    V2(-topHalf, 1),
    V2(topHalf, 1),
    V2(baseHalf, 0),
    V2(baseHalf - strokeH * 0.92, 0),
    V2(xIn(barBot), barBot),
    V2(-xIn(barBot), barBot),
    V2(-(baseHalf - strokeH * 0.92), 0),
  ];

  const counter: Contour = [
    V2(-xIn(barTop), barTop),
    V2(xIn(barTop), barTop),
    V2(0, yInnerApex),
  ];

  return {
    letter: 'A',
    outer: [outer],
    counters: [counter],
    counterCount: 1,
    nameJa: 'エー',
    gate: V2(-(topHalf + slope * 0.5), 0.5),
  };
}

/* ------------------------------------------------------------------ B */

function bowl(cx: number, cy: number, rx: number, ry: number, n: number, from: number, to: number): Contour {
  return ellipse(cx, cy, rx, ry, n, from, to);
}

function glyphB(): GlyphDef {
  const stemL = -0.42;
  const stemR = -0.24;      // right edge of vertical stem
  const t = 0.155;          // bowl stroke thickness

  // outer: stem + two bowls (lower slightly larger)
  const upC = 0.745, upRx = 0.315, upRy = 0.255; // upper bowl (center y, radii)
  const loC = 0.26, loRx = 0.36, loRy = 0.26;    // lower bowl

  const outer: Contour = [
    V2(stemL, 0),
    V2(stemL, 1),
    // top edge to start of upper bowl
    V2(stemR + 0.06, 1),
    ...bowl(stemR + 0.06, upC, upRx, upRy, 40, Math.PI / 2, -Math.PI / 2).slice(1, -1),
    // waist between bowls
    V2(stemR + 0.08, upC - upRy),
    V2(stemR + 0.10, loC + loRy),
    ...bowl(stemR + 0.10, loC, loRx, loRy, 44, Math.PI / 2, -Math.PI / 2).slice(1, -1),
    V2(stemR + 0.10, 0),
  ];

  const upper: Contour = ellipse(stemR + 0.03, upC, upRx - t, upRy - t * 0.82, 48);
  // stretch counters to reach the stem
  for (const p of upper) if (p.x < stemR + 0.03) p.x = Math.max(p.x * 0.55 + (stemR + 0.03) * 0.45, stemR + 0.005);
  const lower: Contour = ellipse(stemR + 0.06, loC, loRx - t, loRy - t * 0.8, 48);
  for (const p of lower) if (p.x < stemR + 0.06) p.x = Math.max(p.x * 0.55 + (stemR + 0.06) * 0.45, stemR + 0.005);

  return {
    letter: 'B',
    outer: [outer],
    counters: [upper, lower],
    counterCount: 2,
    nameJa: 'ビー',
    gate: V2(stemL, 0.5),
  };
}

/* ------------------------------------------------------------------ C */

function glyphC(): GlyphDef {
  // annulus with an opening on the right — no closed counter.
  const cx = 0.02, cy = 0.5;
  const oRx = 0.42, oRy = 0.50;
  const iRx = 0.235, iRy = 0.315;
  const gap = 0.62; // half opening angle (radians) around angle 0

  const n = 88;
  const outerArc = ellipse(cx, cy, oRx, oRy, n, gap, Math.PI * 2 - gap);
  const innerArc = ellipse(cx, cy, iRx, iRy, Math.round(n * 0.8), Math.PI * 2 - gap * 1.25, gap * 1.25);
  const outer: Contour = [...outerArc, ...innerArc];

  return {
    letter: 'C',
    outer: [outer],
    counters: [],
    counterCount: 0,
    nameJa: 'シー',
    gate: V2(cx - oRx, cy),
  };
}

/* ------------------------------------------------------------------ */

const registry: Record<string, () => GlyphDef> = {
  O: glyphO, A: glyphA, B: glyphB, C: glyphC,
};

const cache = new Map<string, GlyphDef>();

export function getGlyph(letter: string): GlyphDef {
  let g = cache.get(letter);
  if (!g) {
    const f = registry[letter];
    if (!f) throw new Error(`unknown glyph ${letter}`);
    g = f();
    cache.set(letter, g);
  }
  return g;
}

export const LETTERS = ['O', 'A', 'B', 'C'] as const;

/** THREE.Shape (with holes) from a glyph, in em space. */
export function glyphShape(def: GlyphDef): THREE.Shape {
  const shape = new THREE.Shape();
  const o = def.outer[0];
  shape.setFromPoints(ensureWinding(o, true));
  for (const c of def.counters) {
    const hole = new THREE.Path();
    hole.setFromPoints(ensureWinding(c, false));
    shape.holes.push(hole);
  }
  return shape;
}

function area(c: Contour): number {
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i], q = c[(i + 1) % c.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureWinding(c: Contour, ccw: boolean): Contour {
  const a = area(c);
  if ((a > 0) !== ccw) return [...c].reverse();
  return c;
}

/** point-in-glyph test (outer minus counters), em space */
export function pointInGlyph(def: GlyphDef, x: number, y: number): boolean {
  if (!pointInContour(def.outer[0], x, y)) return false;
  for (const c of def.counters) if (pointInContour(c, x, y)) return false;
  return true;
}

export function pointInCounter(def: GlyphDef, x: number, y: number): number {
  for (let i = 0; i < def.counters.length; i++) {
    if (pointInContour(def.counters[i], x, y)) return i;
  }
  return -1;
}

function pointInContour(c: Contour, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const xi = c[i].x, yi = c[i].y, xj = c[j].x, yj = c[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** flat SVG path string of the glyph (for HTML UI buttons), viewBox 0 0 100 100, y-down */
export function glyphSvgPath(def: GlyphDef): string {
  const map = (p: THREE.Vector2) => `${(50 + p.x * 88).toFixed(1)} ${(94 - p.y * 88).toFixed(1)}`;
  let d = '';
  for (const c of [...def.outer, ...def.counters]) {
    d += `M ${map(c[0])} `;
    for (let i = 1; i < c.length; i++) d += `L ${map(c[i])} `;
    d += 'Z ';
  }
  return d.trim();
}
