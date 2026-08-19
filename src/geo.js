import * as THREE from 'three';

/* Small geometry helpers used by the vehicles and the snow. */

/** Helical ribbon (an auger flight) wound around the X axis. */
export function helicoidGeometry(rInner, rOuter, length, turns, segs = 96, hand = 1) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -length / 2 + t * length;
    const a = t * turns * Math.PI * 2 * hand;
    const ca = Math.cos(a), sa = Math.sin(a);
    pos.push(x, ca * rInner, sa * rInner);
    pos.push(x, ca * rOuter, sa * rOuter);
    // approximate normal: along the local axis of the ribbon twist
    const na = a + Math.PI / 2;
    nor.push(0, Math.cos(na) * 0.25, Math.sin(na) * 0.25);
    nor.push(0, Math.cos(na) * 0.25, Math.sin(na) * 0.25);
    uv.push(t * 4, 0, t * 4, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a0 = i * 2, a1 = i * 2 + 1, b0 = (i + 1) * 2, b1 = (i + 1) * 2 + 1;
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rounded box - gives machinery a cast/pressed-steel silhouette. */
export function roundedBox(w, h, d, r = 0.06, seg = 2) {
  const shape = new THREE.Shape();
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - rr * 2, bevelEnabled: true,
    bevelThickness: rr, bevelSize: rr, bevelSegments: seg, curveSegments: seg + 1,
  });
  g.translate(0, 0, -(d - rr * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Lumpy snow blob: a sphere pushed around with a couple of sine lobes. */
export function lumpySphere(radius, detail = 2, lumpiness = 0.18, seed = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 3.4 + seed * 2);
    v.multiplyScalar(1 + n * lumpiness);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A dome-ish heap that sits on the ground (flat bottom at y = 0). */
export function heapGeometry(radiusX, radiusZ, height, segs = 24, seed = 3, lump = 0.13) {
  const g = new THREE.SphereGeometry(1, segs, Math.max(6, segs / 2), 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const l = 1 + lump * (Math.sin(v.x * 4.3 + seed) * Math.cos(v.z * 3.9 - seed * 1.7)
      + 0.55 * Math.sin(v.x * 9.1 - seed) * Math.sin(v.z * 8.3 + seed));
    p.setXYZ(i, v.x * radiusX * l, v.y * height * (0.85 + 0.15 * l), v.z * radiusZ * l);
  }
  g.computeVertexNormals();
  return g;
}

/** Utility: create a mesh with shadows enabled. */
export function mesh(geo, mat, parent, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (parent) parent.add(m);
  return m;
}

/** Merge every mesh in a group into one mesh per material.
    Street furniture built from a dozen little boxes then costs 2-3 draw
    calls instead of a dozen, which matters a lot on a phone. */
export function mergeGroup(src) {
  src.updateMatrixWorld(true);
  const byMat = new Map();
  src.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: o.material, list: [] });
    byMat.get(key).list.push(g);
  });

  const out = new THREE.Group();
  for (const { mat, list } of byMat.values()) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    let o3 = 0, o2 = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o3);
      nor.set(g.attributes.normal.array, o3);
      uv.set(g.attributes.uv.array.subarray(0, g.attributes.position.count * 2), o2);
      o3 += g.attributes.position.count * 3;
      o2 += g.attributes.position.count * 2;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
