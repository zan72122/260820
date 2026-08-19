import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries };

/** Chamfered box — reads far heavier than a raw BoxGeometry under grazing light. */
export function roundedBox(w: number, h: number, d: number, r = 0.02, curve = 2): THREE.BufferGeometry {
  const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
  const shape = new THREE.Shape();
  const hw = w / 2 - rr;
  const hh = h / 2 - rr;
  shape.moveTo(-hw - rr, -hh);
  shape.lineTo(-hw - rr, hh);
  shape.quadraticCurveTo(-hw - rr, hh + rr, -hw, hh + rr);
  shape.lineTo(hw, hh + rr);
  shape.quadraticCurveTo(hw + rr, hh + rr, hw + rr, hh);
  shape.lineTo(hw + rr, -hh);
  shape.quadraticCurveTo(hw + rr, -hh - rr, hw, -hh - rr);
  shape.lineTo(-hw, -hh - rr);
  shape.quadraticCurveTo(-hw - rr, -hh - rr, -hw - rr, -hh);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - rr * 2,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: curve,
    curveSegments: curve,
  });
  g.translate(0, 0, -(d - rr * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * A closed rubber-belt loop lying in the YZ plane (stadium track), swept `width` along X.
 * v runs 0..1 once around the loop so a scrolling texture reads as belt motion.
 */
export function beltLoop(straight: number, radius: number, width: number, segs = 10): THREE.BufferGeometry {
  const path: Array<[number, number]> = []; // (z, y)
  const push = (z: number, y: number) => path.push([z, y]);
  // top run: +z -> -z
  push(straight / 2, radius);
  push(-straight / 2, radius);
  for (let i = 1; i < segs; i++) {
    const a = (i / segs) * Math.PI;
    push(-straight / 2 - Math.sin(a) * radius, Math.cos(a) * radius);
  }
  push(-straight / 2, -radius);
  push(straight / 2, -radius);
  for (let i = 1; i < segs; i++) {
    const a = (i / segs) * Math.PI;
    push(straight / 2 + Math.sin(a) * radius, -Math.cos(a) * radius);
  }

  const n = path.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // cumulative arc length for a non-stretching texture
  const arc: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = path[i - 1];
    const b = path[i % n];
    arc.push(arc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = arc[n];
  for (let i = 0; i <= n; i++) {
    const p = path[i % n];
    const v = arc[i] / total;
    pos.push(-width / 2, p[1], p[0]);
    uv.push(0, v);
    pos.push(width / 2, p[1], p[0]);
    uv.push(1, v);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface RibbonOptions {
  /** Points of the centreline, in order. */
  points: THREE.Vector3[];
  /** Half-width at each point. */
  halfWidths: number[];
  /** Direction the ribbon widens along, per point (normalised). */
  sides: THREE.Vector3[];
  /** Extra segments across the width (>=1). */
  widthSegs?: number;
  /** Lift of the centre relative to the edges, as a fraction of half-width. */
  fold?: number;
  /** Normal used to apply the fold. */
  foldDirs?: THREE.Vector3[];
}

/** Generic tapered ribbon — used for leaves, chutes and mud flaps. */
export function ribbon(opts: RibbonOptions): THREE.BufferGeometry {
  const { points, halfWidths, sides } = opts;
  const widthSegs = Math.max(1, opts.widthSegs ?? 3);
  const fold = opts.fold ?? 0;
  const n = points.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const s = sides[i];
    const hw = halfWidths[i];
    const fd = opts.foldDirs ? opts.foldDirs[i] : null;
    for (let j = 0; j <= widthSegs; j++) {
      const t = j / widthSegs;
      const off = (t - 0.5) * 2 * hw;
      const lift = fold * hw * (1 - Math.abs(t - 0.5) * 2);
      const x = p.x + s.x * off + (fd ? fd.x * lift : 0);
      const y = p.y + s.y * off + (fd ? fd.y * lift : 0);
      const z = p.z + s.z * off + (fd ? fd.z * lift : 0);
      pos.push(x, y, z);
      uv.push(t, i / (n - 1));
    }
  }
  const stride = widthSegs + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < widthSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Irregular lump used for soil clods; deterministic per seed. */
export function clodGeometry(radius: number, rand: () => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const s = 0.62 + rand() * 0.75;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.8, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}
