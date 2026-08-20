/**
 * Builds many tubes into a single BufferGeometry. Used for the bamboo, wood and wire members
 * of the nebuta frame so the whole skeleton costs three draw calls instead of sixty.
 */

import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

export interface TubePath {
  points: Vector3[];
  radius: number;
  closed?: boolean;
  /** Radius multiplier along the path, e.g. tapering wire. */
  taper?: (t: number) => number;
  /** V-coordinate scale so bamboo nodes repeat sensibly along long members. */
  vScale?: number;
}

export interface CapsuleSeg {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  r: number;
}

const _t = new Vector3();
const _n = new Vector3();
const _prev = new Vector3();
const _tmp = new Vector3();

/** Parallel-transport frames avoid the flipping that plain Frenet frames show on straight runs. */
function frames(points: Vector3[], closed: boolean): { tangents: Vector3[]; normals: Vector3[]; binormals: Vector3[] } {
  const n = points.length;
  const tangents: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    if (closed) {
      const aa = points[(i - 1 + n) % n];
      const bb = points[(i + 1) % n];
      tangents.push(new Vector3().subVectors(bb, aa).normalize());
    } else {
      tangents.push(new Vector3().subVectors(b, a).normalize());
    }
  }
  const normals: Vector3[] = [];
  const binormals: Vector3[] = [];
  // seed
  _t.copy(tangents[0]);
  _tmp.set(0, 1, 0);
  if (Math.abs(_t.dot(_tmp)) > 0.92) _tmp.set(1, 0, 0);
  _n.crossVectors(_t, _tmp).normalize();
  normals.push(_n.clone());
  binormals.push(new Vector3().crossVectors(_t, _n).normalize());
  for (let i = 1; i < n; i++) {
    _prev.copy(normals[i - 1]);
    _t.copy(tangents[i]);
    _n.copy(_prev).sub(_t.clone().multiplyScalar(_prev.dot(_t)));
    if (_n.lengthSq() < 1e-10) {
      _tmp.set(0, 1, 0);
      if (Math.abs(_t.dot(_tmp)) > 0.92) _tmp.set(1, 0, 0);
      _n.crossVectors(_t, _tmp);
    }
    _n.normalize();
    normals.push(_n.clone());
    binormals.push(new Vector3().crossVectors(_t, _n).normalize());
  }
  return { tangents, normals, binormals };
}

export function buildTubes(paths: TubePath[], radialSegments = 6): BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  for (const path of paths) {
    const pts = path.closed ? [...path.points, path.points[0]] : path.points;
    if (pts.length < 2) continue;
    const { normals, binormals } = frames(pts, !!path.closed);
    const base = position.length / 3;
    const rows = pts.length;
    let len = 0;
    const lens: number[] = [0];
    for (let i = 1; i < rows; i++) {
      len += pts[i].distanceTo(pts[i - 1]);
      lens.push(len);
    }
    const vScale = path.vScale ?? 1;

    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const r = path.radius * (path.taper ? path.taper(t) : 1);
      const p = pts[i];
      const N = normals[i];
      const B = binormals[i];
      for (let j = 0; j <= radialSegments; j++) {
        const a = (j / radialSegments) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const nx = N.x * cx + B.x * sy;
        const ny = N.y * cx + B.y * sy;
        const nz = N.z * cx + B.z * sy;
        position.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
        normal.push(nx, ny, nz);
        uv.push(j / radialSegments, (lens[i] / Math.max(len, 1e-5)) * vScale);
      }
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = base + i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

/** Coarse capsules for the baked interior-shadow pass. */
export function pathsToCapsules(paths: TubePath[], maxPerPath = 6): CapsuleSeg[] {
  const out: CapsuleSeg[] = [];
  for (const path of paths) {
    const pts = path.closed ? [...path.points, path.points[0]] : path.points;
    if (pts.length < 2) continue;
    const step = Math.max(1, Math.ceil((pts.length - 1) / maxPerPath));
    for (let i = 0; i + step < pts.length; i += step) {
      const a = pts[i];
      const b = pts[Math.min(pts.length - 1, i + step)];
      out.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, r: path.radius });
    }
  }
  return out;
}
