/**
 * Geometry with fixed topology whose positions are rewritten in place on
 * input. Nothing here allocates per frame — updates touch preallocated
 * Float32 buffers only, and only while a handle is actually moving.
 */
import * as THREE from 'three';

export interface SweepFrame {
  x: number;
  z: number;
  nx: number; // unit outward normal in XZ
  nz: number;
  halfW: number;
}

/**
 * A wall swept along a planar (XZ) curve: outer/inner faces, top/bottom,
 * flat machined end caps. Used by the C glyph. y0/y1 are constant.
 */
export class SweepWall {
  readonly geometry: THREE.BufferGeometry;
  private readonly n: number; // frame count
  private readonly pos: Float32Array;
  private readonly attr: THREE.BufferAttribute;
  private readonly y0: number;
  private readonly y1: number;

  constructor(frameCount: number, y0: number, y1: number) {
    this.n = frameCount;
    this.y0 = y0;
    this.y1 = y1;
    // 4 strips of 2*(n) verts + 2 caps of 4 verts
    const vcount = 4 * 2 * frameCount + 8;
    this.pos = new Float32Array(vcount * 3);
    const idx: number[] = [];
    const stripBase = (s: number) => s * 2 * frameCount;
    for (let s = 0; s < 4; s++) {
      const b = stripBase(s);
      for (let i = 0; i < frameCount - 1; i++) {
        const a0 = b + i * 2;
        // wind so outer/top face outward, inner/bottom get flipped below
        if (s === 0 || s === 2) idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
        else idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3);
      }
    }
    const capBase = 8 * frameCount;
    idx.push(capBase, capBase + 1, capBase + 2, capBase + 1, capBase + 3, capBase + 2);
    idx.push(capBase + 4, capBase + 6, capBase + 5, capBase + 5, capBase + 6, capBase + 7);
    this.geometry = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.geometry.setAttribute('position', this.attr);
    this.geometry.setIndex(idx);
  }

  update(frames: SweepFrame[]) {
    if (frames.length !== this.n) throw new Error('SweepWall frame count changed');
    const p = this.pos;
    const n = this.n;
    const { y0, y1 } = this;
    const set = (vi: number, x: number, y: number, z: number) => {
      p[vi * 3] = x;
      p[vi * 3 + 1] = y;
      p[vi * 3 + 2] = z;
    };
    for (let i = 0; i < n; i++) {
      const f = frames[i];
      const ox = f.x + f.nx * f.halfW;
      const oz = f.z + f.nz * f.halfW;
      const ix = f.x - f.nx * f.halfW;
      const iz = f.z - f.nz * f.halfW;
      // strip 0: outer wall (top, bottom)
      set(0 * 2 * n + i * 2, ox, y1, oz);
      set(0 * 2 * n + i * 2 + 1, ox, y0, oz);
      // strip 1: inner wall
      set(1 * 2 * n + i * 2, ix, y1, iz);
      set(1 * 2 * n + i * 2 + 1, ix, y0, iz);
      // strip 2: top face (outer, inner)
      set(2 * 2 * n + i * 2, ox, y1, oz);
      set(2 * 2 * n + i * 2 + 1, ix, y1, iz);
      // strip 3: bottom face
      set(3 * 2 * n + i * 2, ox, y0, oz);
      set(3 * 2 * n + i * 2 + 1, ix, y0, iz);
    }
    const capBase = 8 * n;
    const f0 = frames[0];
    const fn = frames[n - 1];
    const corners = (f: SweepFrame) => ({
      ox: f.x + f.nx * f.halfW,
      oz: f.z + f.nz * f.halfW,
      ix: f.x - f.nx * f.halfW,
      iz: f.z - f.nz * f.halfW,
    });
    const c0 = corners(f0);
    const cn = corners(fn);
    set(capBase, c0.ox, y1, c0.oz);
    set(capBase + 1, c0.ox, y0, c0.oz);
    set(capBase + 2, c0.ix, y1, c0.iz);
    set(capBase + 3, c0.ix, y0, c0.iz);
    set(capBase + 4, cn.ox, y1, cn.oz);
    set(capBase + 5, cn.ox, y0, cn.oz);
    set(capBase + 6, cn.ix, y1, cn.iz);
    set(capBase + 7, cn.ix, y0, cn.iz);
    this.attr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }
}

/** Extruded planar polygon (XZ plane, +Y up), built once. Points CCW. */
export function extrudePolygonXZ(points: { x: number; z: number }[], y0: number, y1: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].z);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, -points[i].z);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  // Extrude runs along +Z of shape space; rotate so the shape lies in XZ and
  // the extrusion runs up +Y. Shape (x, y=-z) rotated -90° about X maps
  // shape-y to +z... verify: rotateX(-PI/2): (x, y, z) -> (x, z, -y).
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Lathe profile helper: points are (radius, y) pairs, revolved about +Y. */
export function lathe(profile: [number, number][], segments = 64): THREE.LatheGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments);
}
