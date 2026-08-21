import * as THREE from 'three';

type ExtraAttrs = Record<string, { itemSize: number; value: (x: number, y: number, z: number) => number[] }>;

/**
 * Merge a set of transformed geometries into one buffer, optionally computing
 * extra per-vertex attributes (used for the per-stem sway of the foliage).
 * Written locally so the game never pulls an addon it only half uses.
 */
export function mergeParts(
  parts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[],
  extra?: ExtraAttrs
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const extras: Record<string, number[]> = {};
  if (extra) for (const k of Object.keys(extra)) extras[k] = [];

  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute | undefined;
    const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
    nm.getNormalMatrix(part.matrix);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(part.matrix);
      positions.push(v.x, v.y, v.z);
      if (nor) {
        n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        normals.push(n.x, n.y, n.z);
      } else normals.push(0, 1, 0);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
      if (extra) {
        for (const k of Object.keys(extra)) extras[k].push(...extra[k].value(v.x, v.y, v.z));
      }
    }
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (extra) {
    for (const k of Object.keys(extra)) {
      out.setAttribute(k, new THREE.Float32BufferAttribute(extras[k], extra[k].itemSize));
    }
  }
  out.computeBoundingSphere();
  return out;
}
