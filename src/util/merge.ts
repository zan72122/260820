/** Minimal geometry merge: enough for the props and crowd, without pulling in an addon. */

import { BufferGeometry, Float32BufferAttribute, Matrix3, Matrix4, Vector3 } from 'three';

export interface MergeItem {
  geometry: BufferGeometry;
  matrix?: Matrix4;
}

const _v = new Vector3();
const _n = new Vector3();

export function mergeGeometries(items: MergeItem[]): BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const nm = new Matrix3();

  for (const item of items) {
    const g = item.geometry;
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const tex = g.getAttribute('uv');
    const idx = g.getIndex();
    const base = position.length / 3;
    if (item.matrix) nm.getNormalMatrix(item.matrix);

    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      if (item.matrix) _v.applyMatrix4(item.matrix);
      position.push(_v.x, _v.y, _v.z);
      if (nrm) {
        _n.fromBufferAttribute(nrm, i);
        if (item.matrix) _n.applyMatrix3(nm).normalize();
        normal.push(_n.x, _n.y, _n.z);
      } else {
        normal.push(0, 1, 0);
      }
      if (tex) uv.push(tex.getX(i), tex.getY(i));
      else uv.push(0, 0);
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) index.push(base + idx.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) index.push(base + i);
    }
  }

  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(position, 3));
  out.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  out.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  out.setIndex(index);
  out.computeBoundingSphere();
  return out;
}
