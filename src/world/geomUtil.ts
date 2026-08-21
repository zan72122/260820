import * as THREE from 'three';

/**
 * Minimal indexed merge for position/normal/uv geometries.
 *
 * Small hardware parts such as bristles or knurl rings are modelled as many
 * primitives and merged here so each tool still costs a single draw call.
 */
export function mergeGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const g of geoms) {
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    const gu = g.getAttribute('uv');
    for (let i = 0; i < gp.count; i++) {
      positions.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      if (gn) normals.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      if (gu) uvs.push(gu.getX(i), gu.getY(i));
      else uvs.push(0, 0);
    }
    const gi = g.getIndex();
    if (gi) {
      for (let i = 0; i < gi.count; i++) indices.push(gi.getX(i) + offset);
    } else {
      for (let i = 0; i < gp.count; i++) indices.push(i + offset);
    }
    offset += gp.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  if (!normals.length) out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

export function transformed(
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot?: [number, number, number],
  scale?: [number, number, number],
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  if (rot) q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  m.compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    q,
    new THREE.Vector3(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Rounded box built from a scaled sphere-ish extrusion; cheap and soft edged. */
export function softBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  const half = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = new THREE.Vector3(
      THREE.MathUtils.clamp(v.x, -half.x, half.x),
      THREE.MathUtils.clamp(v.y, -half.y, half.y),
      THREE.MathUtils.clamp(v.z, -half.z, half.z),
    );
    const off = v.clone().sub(c);
    if (off.lengthSq() > 1e-9) off.normalize().multiplyScalar(r);
    v.copy(c).add(off);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
