import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Path,
  Shape,
  Vector2,
  Vector3,
} from 'three';

export interface Frame {
  p: Vector3;
  t: Vector3; // tangent, downstream
  r: Vector3; // right, = t x up
  u: Vector3; // local up, = r x t
}

/**
 * The flume centreline. Arc-length parametrised so the test window can be
 * cut as an exact rectangle in (s, theta) — no stair-stepped hole edges.
 */
export class FlumePath {
  readonly curve: CatmullRomCurve3;
  readonly length: number;
  private readonly arc: number[] = [];
  private readonly samples = 900;

  constructor(points: Vector3[]) {
    this.curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    let acc = 0;
    let prev = this.curve.getPoint(0);
    this.arc.push(0);
    for (let i = 1; i <= this.samples; i++) {
      const p = this.curve.getPoint(i / this.samples);
      acc += p.distanceTo(prev);
      prev = p;
      this.arc.push(acc);
    }
    this.length = acc;
  }

  /** arc length -> curve parameter */
  tAt(s: number): number {
    const target = Math.min(Math.max(s, 0), this.length);
    let lo = 0;
    let hi = this.arc.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] < target) lo = mid;
      else hi = mid;
    }
    const a = this.arc[lo];
    const b = this.arc[hi];
    const f = b > a ? (target - a) / (b - a) : 0;
    return (lo + f) / this.samples;
  }

  frameAt(s: number, out?: Frame): Frame {
    const t = this.tAt(s);
    const f: Frame = out ?? { p: new Vector3(), t: new Vector3(), r: new Vector3(), u: new Vector3() };
    this.curve.getPoint(t, f.p);
    this.curve.getTangent(t, f.t).normalize();
    f.r.crossVectors(f.t, UP).normalize();
    f.u.crossVectors(f.r, f.t).normalize();
    return f;
  }

  /** point on the tube wall at arc length s, angle theta (0 = local up), radius r */
  surfacePoint(s: number, theta: number, radius: number, out = new Vector3()): Vector3 {
    const f = this.frameAt(s, _frame);
    const c = Math.cos(theta) * radius;
    const sn = Math.sin(theta) * radius;
    return out.set(
      f.p.x + f.u.x * c + f.r.x * sn,
      f.p.y + f.u.y * c + f.r.y * sn,
      f.p.z + f.u.z * c + f.r.z * sn,
    );
  }

  radialDir(s: number, theta: number, out = new Vector3()): Vector3 {
    const f = this.frameAt(s, _frame);
    return out
      .set(
        f.u.x * Math.cos(theta) + f.r.x * Math.sin(theta),
        f.u.y * Math.cos(theta) + f.r.y * Math.sin(theta),
        f.u.z * Math.cos(theta) + f.r.z * Math.sin(theta),
      )
      .normalize();
  }
}

const UP = new Vector3(0, 1, 0);
const _frame: Frame = { p: new Vector3(), t: new Vector3(), r: new Vector3(), u: new Vector3() };

/* ------------------------------------------------------------------ */

interface Builder {
  pos: number[];
  nrm: number[];
  uv: number[];
  idx: number[];
}

function newBuilder(): Builder {
  return { pos: [], nrm: [], uv: [], idx: [] };
}

function push(b: Builder, p: Vector3, n: Vector3, u: number, v: number): number {
  b.pos.push(p.x, p.y, p.z);
  b.nrm.push(n.x, n.y, n.z);
  b.uv.push(u, v);
  return b.pos.length / 3 - 1;
}

function quad(b: Builder, a: number, c: number, d: number, e: number): void {
  b.idx.push(a, c, d, a, d, e);
}

function finish(b: Builder): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(b.pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(b.nrm), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(b.uv), 2));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}

/** Evenly spaced samples that always land exactly on the given hard edges. */
function samplesWithEdges(min: number, max: number, count: number, edges: number[]): number[] {
  const raw: number[] = [];
  for (let i = 0; i <= count; i++) raw.push(min + ((max - min) * i) / count);
  for (const e of edges) if (e > min && e < max) raw.push(e);
  raw.sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of raw) if (out.length === 0 || v - out[out.length - 1] > 1e-6) out.push(v);
  return out;
}

export interface ShellOptions {
  path: FlumePath;
  innerR: number;
  thickness: number;
  thetaStart: number;
  thetaLength: number;
  sMin: number;
  sMax: number;
  segsAlong: number;
  segsAround: number;
  /** rectangular test window, exact in (s, theta) */
  window?: { s0: number; s1: number; th0: number; th1: number };
  /** which faces to emit */
  side: 'outer' | 'inner' | 'edges';
  uvScale?: number;
}

/**
 * One face set of the flume shell. Called three times (outer skin, inner
 * skin, cut edges) so each can carry its own material: wet gelcoat inside,
 * weathered laminate outside, raw cut laminate on the edges.
 */
export function buildShell(o: ShellOptions): BufferGeometry {
  const b = newBuilder();
  const Ri = o.innerR;
  const Ro = o.innerR + o.thickness;
  const uvS = o.uvScale ?? 1;
  const ss = samplesWithEdges(
    o.sMin,
    o.sMax,
    o.segsAlong,
    o.window ? [o.window.s0, o.window.s1] : [],
  );
  const ths = samplesWithEdges(
    o.thetaStart,
    o.thetaStart + o.thetaLength,
    o.segsAround,
    o.window ? [o.window.th0, o.window.th1] : [],
  );
  const inWindow = (s: number, th: number): boolean =>
    !!o.window && s > o.window.s0 - 1e-6 && s < o.window.s1 + 1e-6 && th > o.window.th0 - 1e-6 && th < o.window.th1 + 1e-6;
  const cellInWindow = (i: number, j: number): boolean =>
    inWindow((ss[i] + ss[i + 1]) * 0.5, (ths[j] + ths[j + 1]) * 0.5);

  const p = new Vector3();
  const n = new Vector3();

  if (o.side === 'outer' || o.side === 'inner') {
    const R = o.side === 'outer' ? Ro : Ri;
    const sign = o.side === 'outer' ? 1 : -1;
    const grid: number[][] = [];
    for (let i = 0; i < ss.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < ths.length; j++) {
        o.path.surfacePoint(ss[i], ths[j], R, p);
        o.path.radialDir(ss[i], ths[j], n).multiplyScalar(sign);
        row.push(push(b, p, n, ss[i] * uvS, ths[j] * R * uvS));
      }
      grid.push(row);
    }
    for (let i = 0; i < ss.length - 1; i++) {
      for (let j = 0; j < ths.length - 1; j++) {
        if (cellInWindow(i, j)) continue;
        if (sign > 0) quad(b, grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]);
        else quad(b, grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
      }
    }
    return finish(b);
  }

  // ---- cut edges: everything that shows the laminate thickness ----
  const edgeStrip = (
    fixed: 'theta' | 's',
    value: number,
    from: number,
    to: number,
    steps: number,
    outward: number,
  ): void => {
    const prevIdx: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = from + ((to - from) * k) / steps;
      const s = fixed === 'theta' ? t : value;
      const th = fixed === 'theta' ? value : t;
      o.path.surfacePoint(s, th, Ri, p);
      const pi = p.clone();
      o.path.surfacePoint(s, th, Ro, p);
      const po = p.clone();
      // edge normal: along +/- theta for longitudinal cuts, along +/- s for end rims
      if (fixed === 'theta') {
        const f = o.path.frameAt(s, _frame);
        n.set(
          (-Math.sin(th) * f.u.x + Math.cos(th) * f.r.x) * outward,
          (-Math.sin(th) * f.u.y + Math.cos(th) * f.r.y) * outward,
          (-Math.sin(th) * f.u.z + Math.cos(th) * f.r.z) * outward,
        ).normalize();
      } else {
        const f = o.path.frameAt(s, _frame);
        n.copy(f.t).multiplyScalar(outward);
      }
      const a = push(b, pi, n, t * uvS, 0);
      const c = push(b, po, n, t * uvS, o.thickness * 40);
      if (k > 0) {
        if (outward > 0) quad(b, prevIdx[0], prevIdx[1], c, a);
        else quad(b, prevIdx[0], a, c, prevIdx[1]);
      }
      prevIdx[0] = a;
      prevIdx[1] = c;
    }
  };

  const th0 = o.thetaStart;
  const th1 = o.thetaStart + o.thetaLength;
  edgeStrip('theta', th0, o.sMin, o.sMax, o.segsAlong, -1);
  edgeStrip('theta', th1, o.sMin, o.sMax, o.segsAlong, 1);
  edgeStrip('s', o.sMin, th0, th1, o.segsAround, -1);
  edgeStrip('s', o.sMax, th0, th1, o.segsAround, 1);

  if (o.window) {
    const w = o.window;
    edgeStrip('theta', w.th0, w.s0, w.s1, 18, 1);
    edgeStrip('theta', w.th1, w.s0, w.s1, 18, -1);
    edgeStrip('s', w.s0, w.th0, w.th1, 18, 1);
    edgeStrip('s', w.s1, w.th0, w.th1, 18, -1);
  }
  return finish(b);
}

/**
 * The wetted bed: a strip of surface just inside the shell that the water
 * film lives on. Carries flow-direction attributes for the water shader.
 */
export function buildBedSurface(
  path: FlumePath,
  radius: number,
  thetaCenter: number,
  thetaHalf: number,
  sMin: number,
  sMax: number,
  segsAlong: number,
  segsAround: number,
): BufferGeometry {
  const b = newBuilder();
  const along: number[] = [];
  const across: number[] = [];
  const p = new Vector3();
  const n = new Vector3();
  const grid: number[][] = [];
  for (let i = 0; i <= segsAlong; i++) {
    const s = sMin + ((sMax - sMin) * i) / segsAlong;
    const f = path.frameAt(s, _frame);
    const tan = f.t.clone();
    const row: number[] = [];
    for (let j = 0; j <= segsAround; j++) {
      const th = thetaCenter - thetaHalf + (2 * thetaHalf * j) / segsAround;
      path.surfacePoint(s, th, radius, p);
      path.radialDir(s, th, n).multiplyScalar(-1);
      row.push(push(b, p, n, s, th * radius));
      along.push(tan.x, tan.y, tan.z);
      const cross = new Vector3().crossVectors(n, tan).normalize();
      across.push(cross.x, cross.y, cross.z);
    }
    grid.push(row);
  }
  for (let i = 0; i < segsAlong; i++) {
    for (let j = 0; j < segsAround; j++) {
      quad(b, grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
    }
  }
  const g = finish(b);
  g.setAttribute('aAlong', new BufferAttribute(new Float32Array(along), 3));
  g.setAttribute('aAcross', new BufferAttribute(new Float32Array(across), 3));
  return g;
}

/**
 * A raised profile band wrapped around the tube: joint flanges and
 * stiffening ribs, the things that make a moulded shell read as fabricated.
 */
export function buildRib(
  path: FlumePath,
  sCenter: number,
  profile: Vector2[], // (ds, radius) pairs
  thetaStart: number,
  thetaLength: number,
  segsAround: number,
): BufferGeometry {
  const b = newBuilder();
  const p = new Vector3();
  const n = new Vector3();
  const grid: number[][] = [];
  for (let k = 0; k < profile.length; k++) {
    const row: number[] = [];
    for (let j = 0; j <= segsAround; j++) {
      const th = thetaStart + (thetaLength * j) / segsAround;
      const s = sCenter + profile[k].x;
      path.surfacePoint(s, th, profile[k].y, p);
      const prev = profile[Math.max(0, k - 1)];
      const next = profile[Math.min(profile.length - 1, k + 1)];
      const dds = next.x - prev.x;
      const ddr = next.y - prev.y;
      const f = path.frameAt(s, _frame);
      const radial = new Vector3(
        f.u.x * Math.cos(th) + f.r.x * Math.sin(th),
        f.u.y * Math.cos(th) + f.r.y * Math.sin(th),
        f.u.z * Math.cos(th) + f.r.z * Math.sin(th),
      );
      n.copy(radial).multiplyScalar(dds).addScaledVector(f.t, -ddr).normalize();
      row.push(push(b, p, n, th * 0.4, k / (profile.length - 1)));
    }
    grid.push(row);
  }
  for (let k = 0; k < profile.length - 1; k++) {
    for (let j = 0; j < segsAround; j++) {
      quad(b, grid[k][j], grid[k][j + 1], grid[k + 1][j + 1], grid[k + 1][j]);
    }
  }
  return finish(b);
}

/**
 * The test port collar welded onto the shell: a straight prism along the
 * port normal whose foot is trimmed to the barrel, exactly like a saddle
 * branch. Inner bore, outer skin, top land and the fillet at the joint.
 */
export function buildSaddleNeck(
  halfBore: number,
  wall: number,
  corner: number,
  topHeight: number,
  barrelR: number,
  segsPerSide: number,
): BufferGeometry {
  const b = newBuilder();
  const inner = roundedRectPoints(halfBore, halfBore, corner * 0.4, segsPerSide);
  const outer = roundedRectPoints(halfBore + wall, halfBore + wall, corner, segsPerSide);
  // foot height on the barrel, measured along the port normal from the axis
  const foot = (_x: number, y: number): number => {
    const b2 = Math.min(Math.abs(y), barrelR * 0.999);
    return Math.sqrt(barrelR * barrelR - b2 * b2) - barrelR;
  };
  const p = new Vector3();
  const n = new Vector3();

  const wallStrip = (pts: Vector2[], flip: boolean): void => {
    const prev: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const c = pts[i];
      const nx = pts[(i + 1) % pts.length];
      const pv = pts[(i - 1 + pts.length) % pts.length];
      n.set(nx.y - pv.y, 0, -(nx.x - pv.x)).normalize();
      if (flip) n.multiplyScalar(-1);
      const bot = push(b, p.set(c.x, foot(c.x, c.y), c.y), n, i / pts.length, 0);
      const top = push(b, p.set(c.x, topHeight, c.y), n, i / pts.length, 1);
      if (i > 0) {
        if (flip) quad(b, prev[0], prev[1], top, bot);
        else quad(b, prev[0], bot, top, prev[1]);
      }
      prev[0] = bot;
      prev[1] = top;
    }
    // close the loop
    const c = pts[0];
    n.set(pts[1].y - pts[pts.length - 1].y, 0, -(pts[1].x - pts[pts.length - 1].x)).normalize();
    if (flip) n.multiplyScalar(-1);
    const bot = push(b, p.set(c.x, foot(c.x, c.y), c.y), n, 1, 0);
    const top = push(b, p.set(c.x, topHeight, c.y), n, 1, 1);
    if (flip) quad(b, prev[0], prev[1], top, bot);
    else quad(b, prev[0], bot, top, prev[1]);
  };

  wallStrip(inner, true);
  wallStrip(outer, false);

  // top land between the two loops
  n.set(0, 1, 0);
  const topInner: number[] = [];
  const topOuter: number[] = [];
  for (let i = 0; i < inner.length; i++) {
    topInner.push(push(b, p.set(inner[i].x, topHeight, inner[i].y), n, inner[i].x, inner[i].y));
    topOuter.push(push(b, p.set(outer[i].x, topHeight, outer[i].y), n, outer[i].x, outer[i].y));
  }
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    quad(b, topInner[i], topOuter[i], topOuter[j], topInner[j]);
  }

  // bonding fillet skirt at the foot
  const skirtInner: number[] = [];
  const skirtOuter: number[] = [];
  for (let i = 0; i < outer.length; i++) {
    const c = outer[i];
    const len = Math.hypot(c.x, c.y) || 1;
    const ex = (c.x / len) * 0.075;
    const ez = (c.y / len) * 0.075;
    n.set(ex, 0.7, ez).normalize();
    skirtInner.push(push(b, p.set(c.x, foot(c.x, c.y), c.y), n, i / outer.length, 0));
    skirtOuter.push(
      push(b, p.set(c.x + ex, foot(c.x + ex, c.y + ez) - 0.012, c.y + ez), n, i / outer.length, 1),
    );
  }
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    quad(b, skirtInner[i], skirtInner[j], skirtOuter[j], skirtOuter[i]);
  }
  return finish(b);
}

export function roundedRectPoints(hx: number, hy: number, r: number, perSide: number): Vector2[] {
  const pts: Vector2[] = [];
  const rr = Math.min(r, hx, hy);
  const corners: Array<[number, number, number]> = [
    [hx - rr, hy - rr, 0],
    [-(hx - rr), hy - rr, Math.PI * 0.5],
    [-(hx - rr), -(hy - rr), Math.PI],
    [hx - rr, -(hy - rr), Math.PI * 1.5],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perSide; i++) {
      const a = a0 + (Math.PI * 0.5 * i) / perSide;
      pts.push(new Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
  }
  return pts;
}

export function roundedRectShape(hx: number, hy: number, r: number): Shape {
  const s = new Shape();
  const rr = Math.min(r, hx, hy);
  s.moveTo(-hx + rr, -hy);
  s.lineTo(hx - rr, -hy);
  s.quadraticCurveTo(hx, -hy, hx, -hy + rr);
  s.lineTo(hx, hy - rr);
  s.quadraticCurveTo(hx, hy, hx - rr, hy);
  s.lineTo(-hx + rr, hy);
  s.quadraticCurveTo(-hx, hy, -hx, hy - rr);
  s.lineTo(-hx, -hy + rr);
  s.quadraticCurveTo(-hx, -hy, -hx + rr, -hy);
  return s;
}

export function circleHole(cx: number, cy: number, r: number): Path {
  const p = new Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

export interface PlateOptions {
  half: number;
  halfY?: number;
  thickness: number;
  corner: number;
  holeR?: number;
  holeAt?: number;
  boreR?: number;
  bevel?: number;
  curveSegments?: number;
}

/** A real moulded plate: thickness, chamfered edge, clamp bores. */
export function buildPlate(o: PlateOptions): BufferGeometry {
  const shape = roundedRectShape(o.half, o.halfY ?? o.half, o.corner);
  if (o.boreR) shape.holes.push(circleHole(0, 0, o.boreR));
  if (o.holeR && o.holeAt) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        shape.holes.push(circleHole(sx * o.holeAt, sy * o.holeAt, o.holeR));
      }
    }
  }
  const bevel = o.bevel ?? Math.min(0.004, o.thickness * 0.3);
  const g = new ExtrudeGeometry(shape, {
    depth: o.thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 1.4,
    bevelSegments: 2,
    curveSegments: o.curveSegments ?? 10,
  });
  g.translate(0, 0, -o.thickness * 0.5 + bevel);
  g.rotateX(-Math.PI * 0.5);
  g.computeVertexNormals();
  // plate-local UVs in metres so relief maps and projected light stay locked together
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

/** Revolve a profile: knobs, levers, seals, valve bodies. */
export function revolve(profile: Vector2[], segments: number, closeTop = false): BufferGeometry {
  const b = newBuilder();
  const p = new Vector3();
  const n = new Vector3();
  const grid: number[][] = [];
  for (let k = 0; k < profile.length; k++) {
    const row: number[] = [];
    const prev = profile[Math.max(0, k - 1)];
    const next = profile[Math.min(profile.length - 1, k + 1)];
    const dr = next.x - prev.x;
    const dy = next.y - prev.y;
    for (let j = 0; j <= segments; j++) {
      const a = (Math.PI * 2 * j) / segments;
      p.set(Math.cos(a) * profile[k].x, profile[k].y, Math.sin(a) * profile[k].x);
      n.set(Math.cos(a) * dy, -dr, Math.sin(a) * dy).normalize();
      row.push(push(b, p, n, j / segments, k / (profile.length - 1)));
    }
    grid.push(row);
  }
  for (let k = 0; k < profile.length - 1; k++) {
    for (let j = 0; j < segments; j++) {
      quad(b, grid[k][j], grid[k][j + 1], grid[k + 1][j + 1], grid[k + 1][j]);
    }
  }
  if (closeTop) {
    const top = profile[profile.length - 1];
    n.set(0, 1, 0);
    const c = push(b, p.set(0, top.y, 0), n, 0.5, 0.5);
    const ring: number[] = [];
    for (let j = 0; j <= segments; j++) {
      const a = (Math.PI * 2 * j) / segments;
      ring.push(push(b, p.set(Math.cos(a) * top.x, top.y, Math.sin(a) * top.x), n, 0, 0));
    }
    for (let j = 0; j < segments; j++) b.idx.push(c, ring[j], ring[j + 1]);
  }
  return finish(b);
}

/** Sweep a closed section along a closed path: the compressed EPDM seal. */
export function sweepSeal(
  path: Vector2[],
  section: Vector2[], // (offset outward, height)
  ): BufferGeometry {
  const b = newBuilder();
  const p = new Vector3();
  const n = new Vector3();
  const grid: number[][] = [];
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    const nx = path[(i + 1) % path.length];
    const pv = path[(i - 1 + path.length) % path.length];
    const tx = nx.x - pv.x;
    const ty = nx.y - pv.y;
    const tl = Math.hypot(tx, ty) || 1;
    const ox = ty / tl;
    const oy = -tx / tl;
    const row: number[] = [];
    for (let k = 0; k < section.length; k++) {
      const sPrev = section[(k - 1 + section.length) % section.length];
      const sNext = section[(k + 1) % section.length];
      const dOff = sNext.x - sPrev.x;
      const dH = sNext.y - sPrev.y;
      p.set(c.x + ox * section[k].x, section[k].y, c.y + oy * section[k].x);
      n.set(ox * dH, -dOff, oy * dH).normalize();
      row.push(push(b, p, n, i / path.length, k / section.length));
    }
    grid.push(row);
  }
  for (let i = 0; i < path.length; i++) {
    const i2 = (i + 1) % path.length;
    for (let k = 0; k < section.length; k++) {
      const k2 = (k + 1) % section.length;
      quad(b, grid[i][k], grid[i2][k], grid[i2][k2], grid[i][k2]);
    }
  }
  return finish(b);
}

/** Invisible, generous touch target: small parts must still be easy to hit. */
export function hitProxy(radius: number): BufferGeometry {
  const g = new BufferGeometry();
  const seg = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const phi = (Math.PI * i) / seg;
    for (let j = 0; j <= seg * 2; j++) {
      const th = (Math.PI * 2 * j) / (seg * 2);
      pos.push(
        Math.sin(phi) * Math.cos(th) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(th) * radius,
      );
    }
  }
  const row = seg * 2 + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg * 2; j++) {
      const a = i * row + j;
      idx.push(a, a + row, a + row + 1, a, a + row + 1, a + 1);
    }
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** A flat bar bent around an arc: cradle straps, hold-down bands. */
export function arcBar(
  radius: number,
  thickness: number,
  width: number,
  centerAngle: number,
  halfAngle: number,
  segments = 36,
): BufferGeometry {
  const b = newBuilder();
  const p = new Vector3();
  const n = new Vector3();
  const ri = radius;
  const ro = radius + thickness;
  const hw = width * 0.5;
  const ring = (r: number, z: number, outward: number): number[] => {
    const idx: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = centerAngle - halfAngle + (2 * halfAngle * i) / segments;
      p.set(Math.sin(a) * r, Math.cos(a) * r, z);
      n.set(Math.sin(a) * outward, Math.cos(a) * outward, 0);
      idx.push(push(b, p, n, i / segments, z));
    }
    return idx;
  };
  const oi = ring(ro, -hw, 1);
  const oo = ring(ro, hw, 1);
  const ii = ring(ri, -hw, -1);
  const io = ring(ri, hw, -1);
  for (let i = 0; i < segments; i++) {
    quad(b, oi[i], oo[i], oo[i + 1], oi[i + 1]);
    quad(b, ii[i], ii[i + 1], io[i + 1], io[i]);
  }
  // side faces
  const sideA: number[] = [];
  const sideB: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = centerAngle - halfAngle + (2 * halfAngle * i) / segments;
    n.set(0, 0, -1);
    sideA.push(push(b, p.set(Math.sin(a) * ri, Math.cos(a) * ri, -hw), n, i / segments, 0));
    sideA.push(push(b, p.set(Math.sin(a) * ro, Math.cos(a) * ro, -hw), n, i / segments, 1));
    n.set(0, 0, 1);
    sideB.push(push(b, p.set(Math.sin(a) * ri, Math.cos(a) * ri, hw), n, i / segments, 0));
    sideB.push(push(b, p.set(Math.sin(a) * ro, Math.cos(a) * ro, hw), n, i / segments, 1));
  }
  for (let i = 0; i < segments; i++) {
    quad(b, sideA[i * 2], sideA[i * 2 + 1], sideA[i * 2 + 3], sideA[i * 2 + 2]);
    quad(b, sideB[i * 2], sideB[i * 2 + 2], sideB[i * 2 + 3], sideB[i * 2 + 1]);
  }
  // end caps
  for (const [k, s] of [[0, -1], [segments, 1]] as Array<[number, number]>) {
    const a = centerAngle - halfAngle + (2 * halfAngle * k) / segments;
    n.set(Math.cos(a) * s, -Math.sin(a) * s, 0);
    const c0 = push(b, p.set(Math.sin(a) * ri, Math.cos(a) * ri, -hw), n, 0, 0);
    const c1 = push(b, p.set(Math.sin(a) * ro, Math.cos(a) * ro, -hw), n, 1, 0);
    const c2 = push(b, p.set(Math.sin(a) * ro, Math.cos(a) * ro, hw), n, 1, 1);
    const c3 = push(b, p.set(Math.sin(a) * ri, Math.cos(a) * ri, hw), n, 0, 1);
    if (s > 0) quad(b, c0, c1, c2, c3);
    else quad(b, c0, c3, c2, c1);
  }
  return finish(b);
}

/** Rectangular structural beam with softened arrises. */
export function beam(w: number, h: number, d: number): BufferGeometry {
  const g = buildPlate({
    half: 0.5,
    thickness: h,
    corner: Math.min(0.14, (Math.min(w, d) / Math.max(w, d)) * 0.18),
    bevel: 0.006,
    curveSegments: 3,
  });
  g.scale(w, 1, d);
  return g;
}
