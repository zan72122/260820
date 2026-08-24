import * as THREE from 'three';

/** Flip winding if a lofted surface came out inside-out (normals inward). */
export function ensureOutward(g: THREE.BufferGeometry): void {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) c.add(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  c.divideScalar(p.count);
  let s = 0;
  for (let i = 0; i < p.count; i += 7) {
    s +=
      n.getX(i) * (p.getX(i) - c.x) +
      n.getY(i) * (p.getY(i) - c.y) +
      n.getZ(i) * (p.getZ(i) - c.z);
  }
  if (s < 0) {
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      idx.setX(i, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
    g.computeVertexNormals();
  }
}
